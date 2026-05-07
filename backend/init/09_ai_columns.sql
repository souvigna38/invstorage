-- =============================================================================
-- Phase 11: AI Vision Background Worker — Schema Additions
-- =============================================================================
-- Adds AI processing columns to item_images and search_text to items.
-- These support the BullMQ background worker that runs LLaVA at 3 AM.
-- =============================================================================

-- AI processing metadata on each image
ALTER TABLE item_images
ADD COLUMN IF NOT EXISTS ai_processed    BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_description  TEXT,
ADD COLUMN IF NOT EXISTS ai_main_color   VARCHAR(100),
ADD COLUMN IF NOT EXISTS ai_object_type  VARCHAR(255),
ADD COLUMN IF NOT EXISTS ai_detected_text TEXT,
ADD COLUMN IF NOT EXISTS ai_tags         JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS ai_processed_at TIMESTAMPTZ;

-- Full-text search column on items (AI appends keywords here)
ALTER TABLE items
ADD COLUMN IF NOT EXISTS search_text TEXT;

-- Index for quickly finding unprocessed images
CREATE INDEX IF NOT EXISTS idx_item_images_ai_unprocessed
ON item_images (ai_processed) WHERE ai_processed = FALSE;

-- Index for full-text search on items
CREATE INDEX IF NOT EXISTS idx_items_search_text
ON items USING GIN (to_tsvector('english', COALESCE(search_text, '')));
