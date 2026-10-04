# InvStorage — Personal Inventory System & WMS

A self-contained personal inventory management system designed for tracking household belongings, electronics, tools, and server hardware.

This repository supports both **Local Self-Hosted Deployment** (Docker Compose on macOS/Ubuntu home-lab hardware) and **Cursor Cloud Agent Environments** (instant setup on cloud VMs without Docker or GPU requirements).

---

## Intended Vision: Personal Storage v2 ("Amazon WMS for Your Belongings")

The long-term vision for InvStorage is a **personal digital twin of all physical belongings run like an Amazon Warehouse Management System (WMS)**, 100% local and private:

1. **Hierarchical Containers & Bins**: Items live inside parent-child containers (e.g. `Badminton Racket` in `Blue Duffel` in `BIN_001` in `Van`). Moving a container moves all items inside it automatically.
2. **Batch Photo Ingestion**: Labelled bin photos (e.g. `BIN_001.jpg`) dropped into an inbox folder are analyzed by a local vision model (`qwen3-vl`) with strict Pydantic JSON schema validation, inserted into PostgreSQL, and archived.
3. **Chokepoint Motion Tracking**: Frigate cameras at transit points (Van trunk, storage room door, front door) send motion-event snapshots to Ollama to automatically track item location changes.
4. **Natural Voice Queries**: "Where is my badminton gear?" answered through Home Assistant Assist (OpenWakeWord, Wyoming, Faster-Whisper, Piper) or an Apple Shortcut calling a local API.
5. **Distributed Local Hardware**:
   - **Node A (RTX 5070 Ti 16GB)**: Ollama (`qwen3-vl`), Faster-Whisper, Piper TTS
   - **Node B (Dual Xeon 768GB RAM)**: Home Assistant, PostgreSQL (pgvector), Frigate, Node-RED
   - **Node C (60TB NAS)**: Video clips, photo drop zone, backups

For the full phased implementation plan, see **[ROADMAP.md](ROADMAP.md)**.

### Current Implementation vs. Target Vision

| Feature | Implemented Today | Target Vision (WMS) |
|---|---|---|
| **Inventory Hierarchy** | Flat locations (`Server Room`, `Garage`, etc.) | Nested containers (`Van → BIN_001 → Blue Duffel → Racket`) |
| **Vision Model** | Pluggable client: local Ollama (`qwen3-vl`/`llava`) or Cloud Mock fixtures | Multi-node GPU pipeline (`qwen3-vl`) on Node A |
| **Voice / Shortcuts** | Floating web voice button + `/api/locate` for Apple Shortcuts | Home Assistant Assist voice satellites + Siri shortcuts |
| **Ingestion** | `photo-inbox/` with CLIP visual similarity grouping & AI labeling | Automated drop folder with Pydantic JSON schema validation |
| **Physical Tracking** | Manual check-in / check-out UI & QR tags | Frigate chokepoint camera motion tracking |

---

## How to Run

### Option A: Running in Cursor Cloud Agent (Instant Cloud Setup)

When opened in Cursor Cloud Agent, the environment is automatically configured via `.cursor/environment.json`:

1. **Automatic Bootstrap**:
   - Cursor runs `.cursor/install.sh`: installs native PostgreSQL 16, `pgvector`, and Redis, loads the pre-configured inventory database, installs dependencies, and builds the Next.js app.
   - Cursor runs `.cursor/start.sh`: launches PostgreSQL, Redis, and the Next.js web application on port 3000.
2. **Pluggable Vision / Cloud Mocks**:
   - Because the cloud VM has no GPU or Ollama, the app automatically runs in **mock vision mode** (`VISION_PROVIDER=auto`).
   - Mock fixtures for labelled bins (`BIN_001`, `BIN_002`) and sample hardware are served instantly from `fixtures/sample_bins/`.
3. **Running Tests**:
   ```bash
   npm test               # Run all 78 unit & security tests (from frontend/)
   bash scripts/test-smoke.sh  # Run end-to-end smoke test (DB, Redis, Vision, Next.js)
   ```

---

### Option B: Running Locally (Docker Compose)

For running on your personal machine or home server with Docker:

#### 1. Requirements
- **Docker Engine** with Compose V2 (`docker compose`)
  - **macOS**: [Docker Desktop](https://www.docker.com/products/docker-desktop/)
  - **Ubuntu**: `sudo apt install docker.io docker-compose-plugin`
- **8 GB RAM** minimum (16 GB recommended for Ollama/CLIP)

#### 2. First-Time Setup
```bash
# 1. Clone repository
git clone https://github.com/souvigna38/invstorage.git
cd invstorage

# 2. Copy environment template
cp .env.example .env

# 3. Run automated setup script
chmod +x scripts/setup.sh
./scripts/setup.sh
```

#### 3. Daily Commands
```bash
./scripts/start.sh    # Start all services
./scripts/stop.sh     # Stop all services (data is preserved in Docker volumes)
./scripts/backup.sh   # Create a fresh database backup
```

---

## Web Interfaces & Services

| Service | Local URL | Description | Default Credentials |
|---|---|---|---|
| **Inventory App** | `http://localhost:3000` | Main Next.js web dashboard | — |
| **Locate API** | `http://localhost:3000/api/locate?q=X` | Fast Siri / Apple Shortcuts query | — |
| **MinIO Console** | `http://localhost:9001` | Object storage (item images) | Set in `.env` |
| **Medusa Admin** | `http://localhost:9500/app` | Sales & e-commerce backend | Set in `.env` |
| **n8n Workflows** | `http://localhost:5678` | Marketplace sync automation | Set on first visit |
| **ERPNext** | `http://localhost:8090` | Accounting & shadow ERP | `Administrator` / set in `.env` |
| **NocoDB Data Lake**| `http://localhost:8086` | Central Data Lake spreadsheet | Set on first visit |
| **Ingestion API** | `http://localhost:8085/dashboard` | Schema-evolving dlt pipeline | — |
| **Database UI** | `http://localhost:8080` | Adminer database browser | `admin` / set in `.env` |

---

## Fast Voice Search with Apple Shortcuts ("Where is my X?")

InvStorage includes a high-speed search endpoint designed for voice assistants and iOS Shortcuts:

```bash
# JSON response (for web and custom integrations):
curl "http://localhost:3000/api/locate?q=MacBook"

# Plain text response (for Siri / Apple Shortcuts 'Speak Text'):
curl -H "Accept: text/plain" "http://localhost:3000/api/locate?q=MacBook"
# Output: Found 5 matching items. First is MacBook Pro 16" M3 Max in Garage.
```

### Setting Up an Apple Shortcut:
1. Open the **Shortcuts** app on your iPhone or Mac.
2. Add action: **Ask for Input** (`What item are you looking for?`).
3. Add action: **Get Contents of URL**:
   - URL: `http://<YOUR_SERVER_IP>:3000/api/locate?q=<Provided Input>`
   - Headers: `Accept: text/plain`
4. Add action: **Speak Text** with the result.
5. Say: *"Hey Siri, Locate Item"*.

---

## AI Vision & Vector Embedding Configuration

Vision analysis and embeddings are pluggable via environment variables in `.env`:

```bash
# Vision Provider (Ollama or Mock Fixtures)
#   - auto   : Uses Ollama if running; falls back to mock fixtures if offline/cloud
#   - mock   : Always uses deterministic fixtures (zero GPU, ideal for CI/testing)
#   - ollama : Enforces real local Ollama server
VISION_PROVIDER=auto
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen3-vl

# CLIP Vector Embeddings
#   - auto    : Uses CLIP service if running; falls back to deterministic vector if offline
#   - mock    : Always generates deterministic 512-dim normalized vectors
#   - service : Calls FastAPI CLIP microservice
CLIP_PROVIDER=auto
CLIP_SERVICE_URL=http://localhost:8100
```

---

## Security & Privacy Guidelines (Public Repository)

This repository is public. The following rules protect privacy:
- **Never commit `.env`**: Always keep actual passwords, API keys, and auth tokens in `.env` (gitignored). Use `.env.example` as a template with placeholder values only.
- **Never commit raw SQL dumps**: Personal serial numbers, home IP addresses, and physical locations must never be committed. Real database backups belong in local storage or encrypted backup drives.
- **API Authentication**: In production or when exposing the web interface to external networks, set `INVSTORAGE_API_KEY` in `.env` to require authentication on mutating routes.
