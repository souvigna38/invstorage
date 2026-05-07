-- =============================================================================
-- Phase 12: Multimodal Vector Search (pgvector)
-- =============================================================================
-- Adds the pgvector extension and a 512-dim embedding column to item_images.
-- CLIP ViT-B-32 produces 512-dimensional vectors for both text and images,
-- enabling cross-modal cosine similarity search.
-- =============================================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add 512-dim embedding column to item_images
ALTER TABLE item_images
  ADD COLUMN IF NOT EXISTS embedding vector(512);

-- 3. Create an IVFFlat index for fast approximate nearest neighbor search.
--    IVFFlat partitions vectors into lists; at query time, only nearby lists
--    are scanned. We start with 10 lists (suitable for <1000 rows).
--    Rebuild with more lists as the dataset grows.
--
--    NOTE: IVFFlat requires at least 1 row to build the index.
--    If the table is empty, we create the index anyway — Postgres handles it.
CREATE INDEX IF NOT EXISTS idx_item_images_embedding
  ON item_images
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);
