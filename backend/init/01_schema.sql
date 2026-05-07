-- ============================================================================
-- PERSONAL INVENTORY SYSTEM — PostgreSQL Schema Plan
-- ============================================================================
-- Bridges Snipe-IT enterprise asset logic with Amazon-clone frontend rendering.
--
-- Design Principles:
--   1. Column names (title, price, image_url, description, category, rating)
--      map directly to what a React/Next.js Amazon-clone ProductFeed expects.
--   2. Enterprise check-in/check-out replaces Stripe payment flow.
--   3. Snipe-IT's 20+ related tables are simplified to 6 core tables.
--
-- Source Analysis:
--   Frontend: Amazon Clone (Next.js) — ProductFeed, Header, Checkout components
--   Backend:  Snipe-IT — assets, locations, categories, action_logs, models
-- ============================================================================

-- ============================================================================
-- TABLE: users
-- ============================================================================
-- Simplified from Snipe-IT's full User model. Supports both "who owns items"
-- and "who performed actions" in the action_logs.
-- ============================================================================
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    avatar_url      TEXT,                              -- Profile image
    role            VARCHAR(50) DEFAULT 'member',      -- admin | member | viewer
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: categories
-- ============================================================================
-- Snipe-IT Source:  categories table (name, category_type, parent via models)
-- Frontend Target:  Header nav categories, ProductFeed category filter/banner
--
-- Snipe-IT has category_type (asset/accessory/consumable/component/license)
-- and connects to items via an intermediate "models" table. We simplify this
-- into a self-referencing hierarchy that the frontend can render as a nav tree.
-- ============================================================================
CREATE TABLE categories (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,             -- "Electronics", "Furniture", "Tools"
    slug            VARCHAR(255) UNIQUE NOT NULL,      -- URL-friendly: "electronics"
    description     TEXT,
    image_url       TEXT,                              -- Category banner image for frontend
    parent_id       INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    display_order   INTEGER DEFAULT 0,                 -- Sorting for Header nav
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed some default categories (matching typical personal inventory + Amazon UI)
INSERT INTO categories (name, slug, description, display_order) VALUES
    ('Electronics',     'electronics',     'Phones, laptops, tablets, cameras',           1),
    ('Furniture',       'furniture',       'Desks, chairs, shelves, storage',             2),
    ('Tools & Equipment','tools-equipment','Power tools, hand tools, safety gear',        3),
    ('Kitchen',         'kitchen',         'Appliances, cookware, utensils',              4),
    ('Books & Media',   'books-media',     'Books, DVDs, vinyl, games',                   5),
    ('Clothing',        'clothing',        'Wardrobe items, shoes, accessories',          6),
    ('Collectibles',    'collectibles',    'Art, antiques, memorabilia',                   7),
    ('Outdoor & Sports','outdoor-sports',  'Camping, fitness, bicycles',                  8),
    ('Office Supplies', 'office-supplies', 'Stationery, printers, peripherals',           9),
    ('Other',           'other',           'Miscellaneous items',                         10);

-- ============================================================================
-- TABLE: locations
-- ============================================================================
-- Snipe-IT Source:  locations table (name, address, city, state, country, zip,
--                   parent_id, manager_id, phone, fax, ldap_ou, currency, image)
-- Frontend Target:  Displayed as "shipping address" area in Checkout component;
--                   also used for location badge/filter in ProductFeed
--
-- Simplified: removed enterprise fields (ldap_ou, currency, fax, company_id).
-- Kept hierarchical structure (parent_id) for room-in-building-in-site nesting.
-- ============================================================================
CREATE TABLE locations (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,             -- "Home Office", "Garage", "Storage Unit"
    description     TEXT,
    address         VARCHAR(255),
    city            VARCHAR(100),
    state           VARCHAR(100),
    country         VARCHAR(100),
    zip             VARCHAR(20),
    parent_id       INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    image_url       TEXT,                              -- Photo of the location
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: items
-- ============================================================================
-- Snipe-IT Source:  assets + models + status_labels (3 tables merged)
--   assets:  asset_tag, name, serial, purchase_date, purchase_cost, image,
--            model_id, status_id, location_id, assigned_to, warranty_months,
--            order_number, notes, last_checkout, last_checkin, expected_checkin
--   models:  name (make/model), model_number, manufacturer_id, category_id, eol, image
--   status_labels: deployable, pending, archived → simplified to status enum
--
-- Frontend Target:  ProductFeed component expects each product to have:
--   { id, title, price, description, category, image, rating { rate, count } }
--   Checkout component expects: { id, title, price, image, quantity }
--
-- ★ KEY MAPPING (Snipe-IT → Frontend-compatible columns):
--   assets.name / models.name       →  title
--   assets.purchase_cost             →  price        (displayed as "value")
--   assets.image / models.image      →  image_url
--   assets.notes                     →  description
--   models.category_id               →  category_id  (direct FK, no intermediate)
--   (new)                            →  rating / rating_count (personal condition rating)
-- ============================================================================
CREATE TABLE items (
    id                  SERIAL PRIMARY KEY,

    -- ★ Frontend-compatible display columns
    title               VARCHAR(255) NOT NULL,         -- Snipe: assets.name or models.name
    description         TEXT,                          -- Snipe: assets.notes
    price               DECIMAL(12,2) DEFAULT 0.00,   -- Snipe: assets.purchase_cost (item value)
    image_url           TEXT,                          -- Snipe: assets.image or models.image
    rating              DECIMAL(2,1) DEFAULT 5.0       -- Personal condition: 1.0–5.0 (maps to star rating)
                        CHECK (rating >= 0 AND rating <= 5),
    rating_count        INTEGER DEFAULT 1,             -- Number of condition assessments

    -- ★ Asset tracking columns (from Snipe-IT)
    asset_tag           VARCHAR(255) UNIQUE,           -- Snipe: assets.asset_tag (barcode/QR label)
    serial_number       VARCHAR(255),                  -- Snipe: assets.serial
    model_name          VARCHAR(255),                  -- Snipe: models.name (e.g. "MacBook Pro 16")
    model_number        VARCHAR(255),                  -- Snipe: models.model_number (e.g. "A2485")
    manufacturer        VARCHAR(255),                  -- Snipe: manufacturers.name (denormalized)

    -- ★ Categorization & Location
    category_id         INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    location_id         INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    default_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL, -- Snipe: rtd_location_id

    -- ★ Ownership & Assignment (replaces Snipe-IT polymorphic assigned_to)
    assigned_to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- ★ Status (simplified from Snipe-IT's status_labels table)
    -- Snipe-IT had: deployable(1/0), pending(1/0), archived(1/0)
    -- We collapse to a single enum for personal use
    status              VARCHAR(50) DEFAULT 'available'
                        CHECK (status IN (
                            'available',        -- Ready to use (Snipe: deployable)
                            'checked_out',      -- Currently assigned/in-use (Snipe: assigned_to != null)
                            'maintenance',      -- Being repaired (Snipe: undeployable status)
                            'storage',          -- In long-term storage (Snipe: pending)
                            'archived',         -- No longer active (Snipe: archived)
                            'lost',             -- Cannot be located
                            'disposed'          -- Thrown away / donated / sold
                        )),

    -- ★ Purchase & Warranty
    purchase_date       DATE,                          -- Snipe: assets.purchase_date
    purchase_cost       DECIMAL(12,2),                 -- Original cost (price may differ for current value)
    warranty_months     INTEGER,                       -- Snipe: assets.warranty_months
    warranty_expires    DATE,                          -- Computed or explicit
    order_number        VARCHAR(255),                  -- Snipe: assets.order_number (receipt/PO number)
    supplier            VARCHAR(255),                  -- Where purchased (denormalized from Snipe suppliers)

    -- ★ Checkout tracking
    quantity            INTEGER DEFAULT 1,             -- Frontend Checkout expects quantity
    is_requestable      BOOLEAN DEFAULT FALSE,         -- Snipe: assets.requestable (others can request it)
    last_checkout       TIMESTAMPTZ,                   -- Snipe: assets.last_checkout
    last_checkin        TIMESTAMPTZ,                   -- Snipe: assets.last_checkin
    expected_checkin    DATE,                          -- Snipe: assets.expected_checkin
    checkout_counter    INTEGER DEFAULT 0,             -- How many times checked out

    -- ★ Pricing (3-tier: Purchase, Estimated, MSRP)
    estimated_value     DECIMAL(12,2),                 -- Current estimated market value
    msrp_price          DECIMAL(12,2),                 -- Manufacturer suggested retail price (auto-looked up)
    msrp_source         TEXT,                          -- Where MSRP was found (e.g. "Amazon: $199.00 | BestBuy: $199.99")
    msrp_lookup_query   TEXT,                          -- Search query used to find MSRP
    msrp_last_checked   TIMESTAMPTZ,                   -- When MSRP was last looked up

    -- ★ Metadata
    notes               TEXT,                          -- Additional notes beyond description
    custom_fields       JSONB DEFAULT '{}',            -- Snipe-IT custom fieldsets → flexible JSON
    -- Hardware specifications
    cpu_type            VARCHAR(255),                  -- e.g. "Apple M3 Max (16-core)"
    ram_amount          VARCHAR(100),                  -- e.g. "48 GB Unified"
    hard_drive_info     VARCHAR(255),                  -- e.g. "1 TB SSD"
    gpu                 VARCHAR(255),                  -- e.g. "NVIDIA RTX 5070 (16 GB GDDR7)"
    network_info        VARCHAR(500),                  -- e.g. "4x 10G Base-T → LACP Bond (40Gbps)"
    role                VARCHAR(255),                  -- e.g. "Stateless Calculation Engine"
    storage_detail      TEXT,                          -- Multi-line storage tier breakdown
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ                    -- Soft delete (Snipe-IT pattern)
);

-- Performance indexes
CREATE INDEX idx_items_category ON items(category_id);
CREATE INDEX idx_items_location ON items(location_id);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_assigned ON items(assigned_to_user_id);
CREATE INDEX idx_items_asset_tag ON items(asset_tag);
CREATE INDEX idx_items_deleted_at ON items(deleted_at);

-- ============================================================================
-- TABLE: action_logs
-- ============================================================================
-- Snipe-IT Source:  action_logs table
--   created_by (user_id), action_type, item_type, item_id, target_id,
--   target_type, location_id, note, filename, expected_checkin,
--   action_date, action_source, remote_ip, user_agent, log_meta
--
-- Frontend Target:  Replaces Stripe payment/order history.
--   Instead of: "Order placed → Payment processed → Shipped → Delivered"
--   We have:    "Checked out → In use → Checked in → Available"
--
-- ★ STRIPE → CHECK-IN/CHECK-OUT SWAP:
--   Stripe's checkout_sessions.create()  →  action_logs INSERT (action='checkout')
--   Stripe's webhook (payment_success)   →  UPDATE items SET status='checked_out'
--   Stripe's refund                      →  action_logs INSERT (action='checkin')
-- ============================================================================
CREATE TABLE action_logs (
    id              SERIAL PRIMARY KEY,

    -- What happened
    action_type     VARCHAR(50) NOT NULL               -- ★ Core actions that replace Stripe flow:
                    CHECK (action_type IN (
                        'checkout',         -- Item checked out (≈ Stripe "purchase")
                        'checkin',          -- Item returned (≈ Stripe "refund")
                        'transfer',         -- Moved between locations
                        'update',           -- Item details modified
                        'audit',            -- Condition/existence verified
                        'maintenance',      -- Sent for repair
                        'archive',          -- Retired from active use
                        'restore',          -- Brought back from archive
                        'create',           -- Item first added to inventory
                        'delete'            -- Item removed from system
                    )),

    -- Who did it
    performed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- What item
    item_id         INTEGER REFERENCES items(id) ON DELETE CASCADE,

    -- To whom / where (replaces Snipe-IT polymorphic target)
    target_user_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    from_location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    to_location_id  INTEGER REFERENCES locations(id) ON DELETE SET NULL,

    -- Details
    note            TEXT,                              -- "Lending to John for the weekend"
    action_date     TIMESTAMPTZ DEFAULT NOW(),         -- When it happened
    expected_return DATE,                              -- When it should come back
    attachment_url  TEXT,                              -- Photo proof / receipt scan

    -- Metadata
    source          VARCHAR(50) DEFAULT 'web',         -- web | api | mobile | import
    ip_address      INET,                              -- Snipe: remote_ip
    user_agent      TEXT,                              -- Snipe: user_agent
    metadata        JSONB DEFAULT '{}',                -- Snipe: log_meta (flexible extra data)

    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX idx_action_logs_item ON action_logs(item_id);
CREATE INDEX idx_action_logs_type ON action_logs(action_type);
CREATE INDEX idx_action_logs_user ON action_logs(performed_by);
CREATE INDEX idx_action_logs_date ON action_logs(action_date);

-- ============================================================================
-- TABLE: item_images
-- ============================================================================
-- Amazon clones typically show multiple product images (carousel).
-- Snipe-IT only has a single image per asset/model. We extend to support
-- multiple images per item for richer UI rendering.
-- ============================================================================
CREATE TABLE item_images (
    id              SERIAL PRIMARY KEY,
    item_id         INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    image_url       TEXT NOT NULL,
    alt_text        VARCHAR(255),
    display_order   INTEGER DEFAULT 0,                 -- Primary image = order 0
    is_primary      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_item_images_item ON item_images(item_id);

-- ============================================================================
-- VIEWS: Frontend-ready queries
-- ============================================================================

-- ★ VIEW: product_feed
-- Returns data shaped exactly like what the Amazon clone ProductFeed component expects:
--   { id, title, price, description, category, image, rating: { rate, count } }
-- ============================================================================
CREATE VIEW product_feed AS
SELECT
    i.id,
    i.title,
    i.price,
    i.description,
    c.name              AS category,
    c.slug              AS category_slug,
    COALESCE(
        i.image_url,
        (SELECT img.image_url FROM item_images img
         WHERE img.item_id = i.id AND img.is_primary = TRUE LIMIT 1)
    )                   AS image,
    i.rating            AS "rating.rate",
    i.rating_count      AS "rating.count",
    i.status,
    i.asset_tag,
    i.quantity,
    l.name              AS location,
    i.assigned_to_user_id,
    i.last_checkout,
    i.last_checkin
FROM items i
LEFT JOIN categories c ON i.category_id = c.id
LEFT JOIN locations l  ON i.location_id = l.id
WHERE i.deleted_at IS NULL;

-- ★ VIEW: checkout_basket
-- Returns data shaped for the Amazon clone Checkout/BasketItem component:
--   { id, title, price, description, image, quantity, rating }
-- This shows currently checked-out items for a given user
-- ============================================================================
CREATE VIEW checkout_basket AS
SELECT
    i.id,
    i.title,
    i.price,
    i.description,
    COALESCE(i.image_url, '') AS image,
    i.quantity,
    i.rating,
    i.rating_count,
    i.assigned_to_user_id   AS user_id,
    u.name                  AS assigned_to_name,
    i.last_checkout,
    i.expected_checkin,
    l.name                  AS current_location
FROM items i
LEFT JOIN users u     ON i.assigned_to_user_id = u.id
LEFT JOIN locations l ON i.location_id = l.id
WHERE i.status = 'checked_out'
  AND i.deleted_at IS NULL;

-- ★ VIEW: item_history
-- Returns the activity log for an item, replacing the "order history" view
-- ============================================================================
CREATE VIEW item_history AS
SELECT
    al.id           AS log_id,
    al.action_type,
    al.action_date,
    al.note,
    i.id            AS item_id,
    i.title         AS item_title,
    i.image_url     AS item_image,
    performer.name  AS performed_by_name,
    target.name     AS target_user_name,
    fl.name         AS from_location,
    tl.name         AS to_location,
    al.expected_return
FROM action_logs al
JOIN items i                ON al.item_id = i.id
LEFT JOIN users performer   ON al.performed_by = performer.id
LEFT JOIN users target      ON al.target_user_id = target.id
LEFT JOIN locations fl      ON al.from_location_id = fl.id
LEFT JOIN locations tl      ON al.to_location_id = tl.id
ORDER BY al.action_date DESC;

-- ============================================================================
-- FUNCTIONS: Check-in / Check-out (Replacing Stripe Payment Logic)
-- ============================================================================

-- ★ FUNCTION: checkout_item
-- Replaces:  Stripe checkout_sessions.create() + payment webhook
-- Called by: The Checkout button in the Amazon-clone Checkout component
-- ============================================================================
CREATE OR REPLACE FUNCTION checkout_item(
    p_item_id       INTEGER,
    p_user_id       INTEGER,
    p_location_id   INTEGER DEFAULT NULL,
    p_note          TEXT DEFAULT NULL,
    p_expected_return DATE DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_status VARCHAR(50);
    v_current_location INTEGER;
BEGIN
    -- Get current item status
    SELECT status, location_id INTO v_current_status, v_current_location
    FROM items WHERE id = p_item_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item % not found', p_item_id;
    END IF;

    IF v_current_status != 'available' THEN
        RAISE EXCEPTION 'Item % is not available (current status: %)', p_item_id, v_current_status;
    END IF;

    -- Update item status
    UPDATE items SET
        status = 'checked_out',
        assigned_to_user_id = p_user_id,
        location_id = COALESCE(p_location_id, location_id),
        last_checkout = NOW(),
        expected_checkin = p_expected_return,
        checkout_counter = checkout_counter + 1,
        updated_at = NOW()
    WHERE id = p_item_id;

    -- Log the action
    INSERT INTO action_logs (action_type, performed_by, item_id, target_user_id,
                            from_location_id, to_location_id, note, expected_return)
    VALUES ('checkout', p_user_id, p_item_id, p_user_id,
            v_current_location, p_location_id, p_note, p_expected_return);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ★ FUNCTION: checkin_item
-- Replaces:  Stripe refund flow
-- Called by: A "Return" / "Check In" button (replaces "Cancel Order")
-- ============================================================================
CREATE OR REPLACE FUNCTION checkin_item(
    p_item_id       INTEGER,
    p_user_id       INTEGER,
    p_location_id   INTEGER DEFAULT NULL,
    p_note          TEXT DEFAULT NULL,
    p_condition     DECIMAL(2,1) DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_current_location INTEGER;
    v_default_location INTEGER;
BEGIN
    -- Get current and default locations
    SELECT location_id, default_location_id INTO v_current_location, v_default_location
    FROM items WHERE id = p_item_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item % not found', p_item_id;
    END IF;

    -- Update item status
    UPDATE items SET
        status = 'available',
        assigned_to_user_id = NULL,
        location_id = COALESCE(p_location_id, v_default_location, v_current_location),
        last_checkin = NOW(),
        expected_checkin = NULL,
        rating = COALESCE(p_condition, rating),
        updated_at = NOW()
    WHERE id = p_item_id;

    -- Log the action
    INSERT INTO action_logs (action_type, performed_by, item_id,
                            from_location_id, to_location_id, note)
    VALUES ('checkin', p_user_id, p_item_id,
            v_current_location, COALESCE(p_location_id, v_default_location),
            p_note);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ★ FUNCTION: transfer_item
-- Moves an item between locations (no equivalent in Stripe — pure asset tracking)
-- ============================================================================
CREATE OR REPLACE FUNCTION transfer_item(
    p_item_id       INTEGER,
    p_user_id       INTEGER,
    p_to_location   INTEGER,
    p_note          TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_from_location INTEGER;
BEGIN
    SELECT location_id INTO v_from_location
    FROM items WHERE id = p_item_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item % not found', p_item_id;
    END IF;

    UPDATE items SET
        location_id = p_to_location,
        updated_at = NOW()
    WHERE id = p_item_id;

    INSERT INTO action_logs (action_type, performed_by, item_id,
                            from_location_id, to_location_id, note)
    VALUES ('transfer', p_user_id, p_item_id,
            v_from_location, p_to_location, p_note);

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MAPPING REFERENCE
-- ============================================================================
-- ┌──────────────────────────────┬───────────────────────────────────────────┐
-- │ AMAZON CLONE FRONTEND        │ PERSONAL INVENTORY (this schema)          │
-- ├──────────────────────────────┼───────────────────────────────────────────┤
-- │ ProductFeed.js               │                                           │
-- │   product.id                 │ items.id                                  │
-- │   product.title              │ items.title                               │
-- │   product.price              │ items.price                               │
-- │   product.description        │ items.description                         │
-- │   product.category           │ categories.name (via items.category_id)   │
-- │   product.image              │ items.image_url                           │
-- │   product.rating.rate        │ items.rating                              │
-- │   product.rating.count       │ items.rating_count                        │
-- ├──────────────────────────────┼───────────────────────────────────────────┤
-- │ Header.js                    │                                           │
-- │   Category navigation        │ categories table (hierarchical)           │
-- │   Search                     │ Full-text on items.title + description    │
-- │   Cart count                 │ COUNT(*) FROM items WHERE status =        │
-- │                              │   'checked_out' AND assigned_to = ?       │
-- ├──────────────────────────────┼───────────────────────────────────────────┤
-- │ Checkout.js / BasketItem     │                                           │
-- │   item.id                    │ items.id                                  │
-- │   item.title                 │ items.title                               │
-- │   item.price                 │ items.price                               │
-- │   item.image                 │ items.image_url                           │
-- │   item.quantity              │ items.quantity                             │
-- │   Stripe checkout button     │ checkout_item() function                  │
-- │   "Place your order"         │ "Check Out Item" (calls checkout_item)    │
-- │   Order total                │ SUM(price) of checked-out items           │
-- ├──────────────────────────────┼───────────────────────────────────────────┤
-- │ Stripe Payment Logic         │ Check-in/Check-out Logic                  │
-- │   checkout_sessions.create() │ SELECT checkout_item(item, user, loc)     │
-- │   payment_intent.succeeded   │ status → 'checked_out' (in function)     │
-- │   refund                     │ SELECT checkin_item(item, user)           │
-- │   order history              │ item_history VIEW                         │
-- └──────────────────────────────┴───────────────────────────────────────────┘
--
-- ┌──────────────────────────────┬───────────────────────────────────────────┐
-- │ SNIPE-IT ENTERPRISE          │ PERSONAL INVENTORY (this schema)          │
-- ├──────────────────────────────┼───────────────────────────────────────────┤
-- │ assets + models + status     │ items (single table, denormalized)        │
-- │ locations (enterprise)       │ locations (simplified, no LDAP/currency)  │
-- │ categories (typed)           │ categories (generic, hierarchical)        │
-- │ action_logs (polymorphic)    │ action_logs (direct FKs, no polymorphism) │
-- │ users (Sentry auth)          │ users (simple, bring-your-own-auth)       │
-- │ manufacturers (table)        │ items.manufacturer (denormalized string)  │
-- │ suppliers (table)            │ items.supplier (denormalized string)      │
-- │ status_labels (3 booleans)   │ items.status (single enum)               │
-- │ custom_fields + fieldsets    │ items.custom_fields (JSONB)               │
-- └──────────────────────────────┴───────────────────────────────────────────┘
-- ============================================================================

-- Full-text search index for the Header search bar
CREATE INDEX idx_items_search ON items USING GIN (
    to_tsvector('english', COALESCE(title, '') || ' ' ||
                           COALESCE(description, '') || ' ' ||
                           COALESCE(model_name, '') || ' ' ||
                           COALESCE(manufacturer, ''))
);
