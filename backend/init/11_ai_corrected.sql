-- =============================================================================
-- Phase 13: AI Correction Flag
-- =============================================================================
-- Adds a flag to prevent the nightly worker and label scripts from overwriting
-- human-corrected AI labels. When a user manually corrects an AI label via the
-- UI, this column is set to TRUE so automated processes skip it.
-- =============================================================================

ALTER TABLE item_images ADD COLUMN IF NOT EXISTS ai_corrected BOOLEAN DEFAULT FALSE;
