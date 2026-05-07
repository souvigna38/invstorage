-- ============================================================================
-- VAULT_SpM1 — Timestamped Backup Vault Schema
-- ============================================================================
-- Stores dated snapshots of the entire inventory system including binary
-- copies of all images. Supports point-in-time rollback.
-- ============================================================================

-- Enable pgvector for storing CLIP embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- TABLE: snapshots — One row per backup
-- ============================================================================
CREATE TABLE snapshots (
    id              SERIAL PRIMARY KEY,
    snapshot_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    label           TEXT,                              -- Optional human label
    status          VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress', 'complete', 'failed')),
    item_count      INTEGER DEFAULT 0,
    image_count     INTEGER DEFAULT 0,
    size_bytes      BIGINT DEFAULT 0,
    error_message   TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_snapshots_date ON snapshots(snapshot_date);
CREATE INDEX idx_snapshots_status ON snapshots(status);

-- ============================================================================
-- TABLE: vault_users — Mirror of users
-- ============================================================================
CREATE TABLE vault_users (
    vault_id        SERIAL PRIMARY KEY,
    snapshot_id     INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    -- Original columns
    id              INTEGER NOT NULL,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL,
    avatar_url      TEXT,
    role            VARCHAR(50),
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ
);

CREATE INDEX idx_vault_users_snapshot ON vault_users(snapshot_id);

-- ============================================================================
-- TABLE: vault_categories — Mirror of categories
-- ============================================================================
CREATE TABLE vault_categories (
    vault_id        SERIAL PRIMARY KEY,
    snapshot_id     INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    -- Original columns
    id              INTEGER NOT NULL,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) NOT NULL,
    description     TEXT,
    image_url       TEXT,
    parent_id       INTEGER,
    display_order   INTEGER,
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ
);

CREATE INDEX idx_vault_categories_snapshot ON vault_categories(snapshot_id);

-- ============================================================================
-- TABLE: vault_locations — Mirror of locations
-- ============================================================================
CREATE TABLE vault_locations (
    vault_id        SERIAL PRIMARY KEY,
    snapshot_id     INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    -- Original columns
    id              INTEGER NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    address         VARCHAR(255),
    city            VARCHAR(100),
    state           VARCHAR(100),
    country         VARCHAR(100),
    zip             VARCHAR(20),
    parent_id       INTEGER,
    image_url       TEXT,
    created_at      TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ
);

CREATE INDEX idx_vault_locations_snapshot ON vault_locations(snapshot_id);

-- ============================================================================
-- TABLE: vault_items — Mirror of items
-- ============================================================================
CREATE TABLE vault_items (
    vault_id            SERIAL PRIMARY KEY,
    snapshot_id         INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    -- Original columns (all 50+ columns)
    id                  INTEGER NOT NULL,
    title               VARCHAR(255) NOT NULL,
    description         TEXT,
    price               DECIMAL(12,2),
    image_url           TEXT,
    rating              DECIMAL(2,1),
    rating_count        INTEGER,
    asset_tag           VARCHAR(255),
    serial_number       VARCHAR(255),
    model_name          VARCHAR(255),
    model_number        VARCHAR(255),
    manufacturer        VARCHAR(255),
    category_id         INTEGER,
    location_id         INTEGER,
    default_location_id INTEGER,
    assigned_to_user_id INTEGER,
    status              VARCHAR(50),
    purchase_date       DATE,
    purchase_cost       DECIMAL(12,2),
    warranty_months     INTEGER,
    warranty_expires    DATE,
    order_number        VARCHAR(255),
    supplier            VARCHAR(255),
    quantity            INTEGER,
    is_requestable      BOOLEAN,
    last_checkout       TIMESTAMPTZ,
    last_checkin        TIMESTAMPTZ,
    expected_checkin    DATE,
    checkout_counter    INTEGER,
    notes               TEXT,
    custom_fields       JSONB,
    cpu_type            VARCHAR(255),
    ram_amount          VARCHAR(100),
    hard_drive_info     VARCHAR(255),
    gpu                 VARCHAR(255),
    network_info        VARCHAR(500),
    role                VARCHAR(255),
    storage_detail      TEXT,
    search_text         TEXT,
    estimated_value     DECIMAL(12,2),
    msrp_price          DECIMAL(12,2),
    msrp_source         TEXT,
    msrp_lookup_query   TEXT,
    msrp_last_checked   TIMESTAMPTZ,
    list_price          DECIMAL(12,2),
    sold_price          DECIMAL(12,2),
    sold_date           DATE,
    listing_url         TEXT,
    medusa_product_id   VARCHAR(255),
    created_at          TIMESTAMPTZ,
    updated_at          TIMESTAMPTZ,
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX idx_vault_items_snapshot ON vault_items(snapshot_id);

-- ============================================================================
-- TABLE: vault_item_images — Mirror of item_images + binary image data
-- ============================================================================
CREATE TABLE vault_item_images (
    vault_id            SERIAL PRIMARY KEY,
    snapshot_id         INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    -- Original columns
    id                  INTEGER NOT NULL,
    item_id             INTEGER NOT NULL,
    image_url           TEXT NOT NULL,
    alt_text            VARCHAR(255),
    display_order       INTEGER,
    is_primary          BOOLEAN,
    created_at          TIMESTAMPTZ,
    ai_processed        BOOLEAN,
    ai_description      TEXT,
    ai_main_color       VARCHAR(100),
    ai_object_type      VARCHAR(255),
    ai_detected_text    TEXT,
    ai_tags             JSONB,
    ai_processed_at     TIMESTAMPTZ,
    -- Binary image data (self-contained backup)
    image_data          BYTEA,
    image_content_type  VARCHAR(100)
);

CREATE INDEX idx_vault_item_images_snapshot ON vault_item_images(snapshot_id);

-- ============================================================================
-- TABLE: vault_action_logs — Mirror of action_logs
-- ============================================================================
CREATE TABLE vault_action_logs (
    vault_id            SERIAL PRIMARY KEY,
    snapshot_id         INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    -- Original columns
    id                  INTEGER NOT NULL,
    action_type         VARCHAR(50) NOT NULL,
    performed_by        INTEGER,
    item_id             INTEGER,
    target_user_id      INTEGER,
    from_location_id    INTEGER,
    to_location_id      INTEGER,
    note                TEXT,
    action_date         TIMESTAMPTZ,
    expected_return     DATE,
    attachment_url      TEXT,
    source              VARCHAR(50),
    ip_address          INET,
    user_agent          TEXT,
    metadata            JSONB,
    created_at          TIMESTAMPTZ
);

CREATE INDEX idx_vault_action_logs_snapshot ON vault_action_logs(snapshot_id);

-- ============================================================================
-- TABLE: vault_images_primary — Stores primary item image binaries
-- ============================================================================
-- For items.image_url (the main product image, separate from item_images)
CREATE TABLE vault_item_primary_images (
    vault_id            SERIAL PRIMARY KEY,
    snapshot_id         INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    item_id             INTEGER NOT NULL,
    image_url           TEXT NOT NULL,
    image_data          BYTEA,
    image_content_type  VARCHAR(100)
);

CREATE INDEX idx_vault_primary_images_snapshot ON vault_item_primary_images(snapshot_id);
