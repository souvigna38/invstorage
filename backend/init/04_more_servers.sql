-- =============================================================================
-- ADDITIONAL CLUSTER NODES — Frank, Temp-Data-1, Temp-Data-2
-- =============================================================================

-- 1. FRANK — Field Commander: Local AI & Recovery
INSERT INTO items (
  title, description, price, rating, rating_count,
  asset_tag, serial_number, model_name, model_number, manufacturer,
  category_id, location_id, default_location_id, status, quantity,
  cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail,
  notes
) VALUES (
  'Lenovo ThinkPad T15g Gen 2 — "Frank"',
  E'Field Commander: Local AI & Recovery.\n\nA mobile powerhouse built for on-site operations. Equipped with a workstation-class Xeon CPU and a full RTX 3080 laptop GPU, Frank can run local AI inference, serve as a portable recovery console, and act as an emergency command node if the primary cluster goes down.',
  4200.00, 5.0, 1,
  'SRV-FRANK-001', 'PF-3KXYZ1', 'ThinkPad T15g Gen 2', '20YS-CTO', 'Lenovo',
  11, 6, 6, 'available', 1,
  'Intel Xeon W-11855M (6 Cores / 12 Threads)',
  '64 GB DDR4',
  NULL,
  'NVIDIA RTX 3080 Laptop (16 GB GDDR6)',
  NULL,
  'Field Commander: Local AI & Recovery',
  NULL,
  'Mobile workstation. Xeon W-class CPU + full RTX 3080 for portable AI inference and emergency cluster recovery operations.'
);

-- 2. TEMP-DATA-1 — The Hot Zone: Raw Ingest (Dirty)
INSERT INTO items (
  title, description, price, rating, rating_count,
  asset_tag, serial_number, model_name, model_number, manufacturer,
  category_id, location_id, default_location_id, status, quantity,
  cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail,
  notes
) VALUES (
  'HP ProLiant DL380 G6 — "Temp-Data-1"',
  E'The Hot Zone: Raw Ingest (Dirty).\n\nThe first stage of the data pipeline. All raw, unvalidated data lands here. This machine absorbs high-volume incoming feeds without contaminating the clean production databases. Once data is validated and normalized, it is promoted to Temp-Data-2 for staging.',
  2800.00, 5.0, 1,
  'SRV-TEMPDATA1-001', 'MXQ9420ABC', 'ProLiant DL380 G6', 'DL380-G6', 'HP',
  11, 7, 7, 'available', 1,
  '2x Intel Xeon X5600 Series',
  '144 GB DDR3 ECC',
  '8x 300GB 10k SAS',
  NULL,
  NULL,
  'The Hot Zone: Raw Ingest (Dirty)',
  E'8x 300GB 10k SAS (2.4 TB raw)\nRAID configuration for raw data ingest',
  'First stage of data pipeline. All raw, unvalidated data lands here before promotion to Temp-Data-2. Keeps dirty data isolated from production.'
);

-- 3. TEMP-DATA-2 — The Clean Room: Staging Database
INSERT INTO items (
  title, description, price, rating, rating_count,
  asset_tag, serial_number, model_name, model_number, manufacturer,
  category_id, location_id, default_location_id, status, quantity,
  cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail,
  notes
) VALUES (
  'HP ProLiant DL380 G6 — "Temp-Data-2"',
  E'The Clean Room: Staging Database.\n\nThe second stage of the data pipeline. Only validated and normalized data from Temp-Data-1 is promoted here. This staging database mirrors the production schema, allowing final quality checks before data is committed to BigBrain as the Source of Truth.',
  2800.00, 5.0, 1,
  'SRV-TEMPDATA2-001', 'MXQ9420DEF', 'ProLiant DL380 G6', 'DL380-G6', 'HP',
  11, 7, 7, 'available', 1,
  '2x Intel Xeon X5600 Series',
  '144 GB DDR3 ECC',
  '8x 300GB 10k SAS',
  NULL,
  NULL,
  'The Clean Room: Staging Database',
  E'8x 300GB 10k SAS (2.4 TB raw)\nRAID configuration for staging database',
  'Second stage of data pipeline. Only validated/normalized data promoted here from Temp-Data-1. Mirrors production schema for final QA before commit to BigBrain.'
);
