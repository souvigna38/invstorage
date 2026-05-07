"""
CLIP + Whisper AI Service — Multimodal Vector Search + Voice for InvStorage

Endpoints:
  POST /embed-text      → text string  → 512-dim CLIP vector
  POST /embed-image     → image upload → 512-dim CLIP vector
  POST /embed-image-url → image URL    → 512-dim CLIP vector
  POST /transcribe      → audio file   → { text: "..." }
  GET  /health          → readiness probe

CLIP vectors live in the same embedding space, enabling cross-modal
cosine similarity search in pgvector. Whisper converts voice commands
to text for the "Star Trek" voice search interface.
"""

import io
import logging
import os
import tempfile
import time
from contextlib import asynccontextmanager

import numpy as np
import whisper
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ai-service")

# ---------------------------------------------------------------------------
# Global model references (loaded once at startup)
# ---------------------------------------------------------------------------
clip_model: SentenceTransformer | None = None
whisper_model: whisper.Whisper | None = None

CLIP_MODEL_NAME = "clip-ViT-B-32"
VECTOR_DIM = 512
WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "base")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load both CLIP and Whisper models once when the server boots."""
    global clip_model, whisper_model

    # Load CLIP
    logger.info(f"Loading CLIP model: {CLIP_MODEL_NAME} ...")
    start = time.time()
    clip_model = SentenceTransformer(CLIP_MODEL_NAME)
    logger.info(f"✓ CLIP loaded in {time.time() - start:.1f}s  (dim={VECTOR_DIM})")

    # Load Whisper
    logger.info(f"Loading Whisper model: {WHISPER_MODEL_SIZE} ...")
    start = time.time()
    whisper_model = whisper.load_model(WHISPER_MODEL_SIZE)
    logger.info(f"✓ Whisper loaded in {time.time() - start:.1f}s")

    yield

    logger.info("Shutting down AI service")


app = FastAPI(
    title="InvStorage AI Service (CLIP + Whisper)",
    version="2.0.0",
    lifespan=lifespan,
)

# Allow the Next.js frontend to call this service directly from the browser
# (for health checks, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------
class TextRequest(BaseModel):
    text: str


class EmbeddingResponse(BaseModel):
    embedding: list[float]
    dimensions: int
    model: str


class TranscribeResponse(BaseModel):
    text: str
    language: str
    duration: float


class HealthResponse(BaseModel):
    status: str
    clip_model: str
    clip_dimensions: int
    whisper_model: str
    whisper_ready: bool


# ---------------------------------------------------------------------------
# Health Endpoint
# ---------------------------------------------------------------------------
@app.get("/health", response_model=HealthResponse)
async def health():
    """Readiness probe — returns 200 only if models are loaded."""
    if clip_model is None:
        raise HTTPException(status_code=503, detail="CLIP model not loaded yet")
    return HealthResponse(
        status="ok",
        clip_model=CLIP_MODEL_NAME,
        clip_dimensions=VECTOR_DIM,
        whisper_model=WHISPER_MODEL_SIZE,
        whisper_ready=whisper_model is not None,
    )


# ---------------------------------------------------------------------------
# CLIP Endpoints
# ---------------------------------------------------------------------------
@app.post("/embed-text", response_model=EmbeddingResponse)
async def embed_text(req: TextRequest):
    """Convert a text string into a 512-dim CLIP vector."""
    if clip_model is None:
        raise HTTPException(status_code=503, detail="CLIP model not loaded yet")

    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text must not be empty")

    try:
        embedding = clip_model.encode(req.text.strip(), convert_to_numpy=True)
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        vector = embedding.tolist()
        return EmbeddingResponse(embedding=vector, dimensions=len(vector), model=CLIP_MODEL_NAME)
    except Exception as e:
        logger.error(f"embed-text error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed-image", response_model=EmbeddingResponse)
async def embed_image(file: UploadFile = File(...)):
    """Convert an uploaded image into a 512-dim CLIP vector."""
    if clip_model is None:
        raise HTTPException(status_code=503, detail="CLIP model not loaded yet")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")

        embedding = clip_model.encode(image, convert_to_numpy=True)
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        vector = embedding.tolist()
        return EmbeddingResponse(embedding=vector, dimensions=len(vector), model=CLIP_MODEL_NAME)
    except Exception as e:
        logger.error(f"embed-image error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed-image-url", response_model=EmbeddingResponse)
async def embed_image_url(req: TextRequest):
    """Fetch an image from a URL and return its 512-dim CLIP vector."""
    if clip_model is None:
        raise HTTPException(status_code=503, detail="CLIP model not loaded yet")

    import urllib.request

    try:
        url = req.text.strip()
        if not url.startswith("http"):
            raise HTTPException(status_code=400, detail="Must be an HTTP(S) URL")

        request = urllib.request.Request(url, headers={"User-Agent": "InvStorage-AI/2.0"})
        with urllib.request.urlopen(request, timeout=15) as resp:
            image_bytes = resp.read()

        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        embedding = clip_model.encode(image, convert_to_numpy=True)
        norm = np.linalg.norm(embedding)
        if norm > 0:
            embedding = embedding / norm
        vector = embedding.tolist()
        return EmbeddingResponse(embedding=vector, dimensions=len(vector), model=CLIP_MODEL_NAME)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"embed-image-url error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Whisper Endpoint — Voice Transcription
# ---------------------------------------------------------------------------
@app.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(file: UploadFile = File(...)):
    """
    Transcribe an audio file to text using Whisper.

    Accepts:
      - .webm (Chrome/Android MediaRecorder)
      - .mp4 / .m4a (Safari/iOS MediaRecorder)
      - .wav, .mp3 (standard audio)

    Returns:
      { text: "find the red sweater", language: "en", duration: 2.3 }
    """
    if whisper_model is None:
        raise HTTPException(status_code=503, detail="Whisper model not loaded yet")

    # Determine file extension from content type or filename
    ext = ".webm"
    if file.filename:
        if "." in file.filename:
            ext = "." + file.filename.rsplit(".", 1)[-1].lower()
    elif file.content_type:
        ct = file.content_type.lower()
        if "mp4" in ct or "m4a" in ct:
            ext = ".mp4"
        elif "wav" in ct:
            ext = ".wav"
        elif "mpeg" in ct or "mp3" in ct:
            ext = ".mp3"
        elif "ogg" in ct:
            ext = ".ogg"

    try:
        # Save uploaded audio to a temp file (Whisper needs a file path)
        contents = await file.read()
        if len(contents) == 0:
            raise HTTPException(status_code=400, detail="Audio file is empty")

        logger.info(f"Transcribing audio: {len(contents)} bytes, ext={ext}")
        start = time.time()

        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(contents)
            tmp_path = tmp.name

        try:
            # Run Whisper transcription
            result = whisper_model.transcribe(
                tmp_path,
                language="en",      # Optimize for English commands
                fp16=False,          # CPU-safe (no GPU)
                task="transcribe",
            )

            elapsed = time.time() - start
            text = result.get("text", "").strip()
            language = result.get("language", "en")

            logger.info(f"✓ Transcribed in {elapsed:.1f}s: \"{text}\"")

            return TranscribeResponse(
                text=text,
                language=language,
                duration=round(elapsed, 2),
            )
        finally:
            # Clean up temp file
            os.unlink(tmp_path)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"transcribe error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
