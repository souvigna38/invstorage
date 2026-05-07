-- =============================================================================
-- WORKSTATIONS & LAPTOPS — Oracle, ConceptD, SP9, SP7, SPM1, SPM2, Yondex
-- =============================================================================

-- 1. ORACLE — The Airlock: Sanitization Bridge
INSERT INTO items (
  title, description, price, rating, rating_count,
  asset_tag, serial_number, model_name, model_number, manufacturer,
  category_id, location_id, default_location_id, status, quantity,
  cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail,
  notes
) VALUES (
  'Mac Pro (Tower) — "Oracle"',
  E'The Airlock: Sanitization Bridge.\n\nRunning Ubuntu 24.04, Oracle acts as the gateway between untrusted external data and the secure cluster network. All inbound data must pass through Oracle''s validation and sanitization pipeline before it is allowed onto the cluster subnet. Think of it as the immune system — nothing dirty gets past.',
  3500.00, 5.0, 1,
  'WS-ORACLE-001', 'C02XM0XXHTD', 'Mac Pro (Tower)', 'MacPro7,1', 'Apple',
  11, 7, 7, 'available', 1,
  'Dual Intel Xeon',
  '32 GB DDR4 ECC',
  NULL,
  NULL,
  NULL,
  'The Airlock: Sanitization Bridge',
  NULL,
  'Running Ubuntu 24.04. Gateway between untrusted external data and the secure cluster. All inbound data passes through validation/sanitization before reaching the cluster subnet.'
);

-- 2. CONCEPTD — The Canvas: Design/UI
INSERT INTO items (
  title, description, price, rating, rating_count,
  asset_tag, serial_number, model_name, model_number, manufacturer,
  category_id, location_id, default_location_id, status, quantity,
  cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail,
  notes
) VALUES (
  'Acer ConceptD CN516-72G — "ConceptD"',
  E'The Canvas: Design/UI.\n\nThe creative workstation dedicated to front-end design, UI/UX prototyping, and visual asset creation. Its color-accurate display and dedicated GPU make it the go-to machine for building dashboards, designing interfaces, and producing documentation graphics for the cluster ecosystem.',
  1800.00, 5.0, 1,
  'WS-CONCEPTD-001', 'NXCB2SA001', 'ConceptD CN516-72G', 'CN516-72G', 'Acer',
  11, 6, 6, 'available', 1,
  'Intel Core i7-11800H (8 Cores / 16 Threads)',
  '16 GB DDR4',
  NULL,
  NULL,
  NULL,
  'The Canvas: Design/UI',
  NULL,
  'Running Windows 11 Pro. Dedicated creative workstation for front-end design, UI/UX prototyping, dashboard building, and visual asset creation.'
);

-- 3. SP9 — High-End x86 Build Node
INSERT INTO items (
  title, description, price, rating, rating_count,
  asset_tag, serial_number, model_name, model_number, manufacturer,
  category_id, location_id, default_location_id, status, quantity,
  cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail,
  notes
) VALUES (
  'MacBook Pro 16" (2019) — "SP9"',
  E'High-End x86 Build Node.\n\nThe heavy-duty Intel build machine. With an i9 processor and 64GB of RAM, SP9 handles large compilation jobs, cross-platform builds, and x86-native testing. Dual-boots macOS and Windows, making it the swiss army knife for platform-specific development and compatibility testing.',
  2800.00, 5.0, 1,
  'WS-SP9-001', 'C02ZK1XXMD6R', 'MacBook Pro 16" (2019)', 'MacBookPro16,1', 'Apple',
  11, 6, 6, 'available', 1,
  'Intel Core i9-9980HK (8 Cores / 16 Threads @ 2.4 GHz)',
  '64 GB DDR4',
  NULL,
  NULL,
  NULL,
  'High-End x86 Build Node',
  NULL,
  'Dual-boot macOS/Windows. Heavy-duty Intel build machine for large compilations, cross-platform builds, and x86-native testing.'
);

-- 4. SP7 — Legacy Bridge Node
INSERT INTO items (
  title, description, price, rating, rating_count,
  asset_tag, serial_number, model_name, model_number, manufacturer,
  category_id, location_id, default_location_id, status, quantity,
  cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail,
  notes
) VALUES (
  'MacBook Pro 16" (2019) — "SP7"',
  E'Legacy Bridge Node.\n\nMaintains compatibility with older x86-only toolchains and legacy systems. SP7 serves as the bridge between modern ARM-based workflows and legacy Intel dependencies, ensuring nothing falls through the cracks during architecture transitions.',
  1200.00, 4.0, 1,
  'WS-SP7-001', 'C02ZK1XXMD7S', 'MacBook Pro 16" (2019)', 'MacBookPro16,1', 'Apple',
  11, 6, 6, 'available', 1,
  'Intel Core i7-9750H (6 Cores / 12 Threads @ 2.6 GHz)',
  '16 GB DDR4',
  NULL,
  NULL,
  NULL,
  'Legacy Bridge Node',
  NULL,
  'Running macOS. Maintains compatibility with older x86-only toolchains. Bridges modern ARM workflows and legacy Intel dependencies.'
);

-- 5. SPM1 — The Scout: Mobile Inference
INSERT INTO items (
  title, description, price, rating, rating_count,
  asset_tag, serial_number, model_name, model_number, manufacturer,
  category_id, location_id, default_location_id, status, quantity,
  cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail,
  notes
) VALUES (
  'MacBook Air (M1) — "SPM1"',
  E'The Scout: Mobile Inference.\n\nUltra-portable ARM-based inference node. The M1''s unified memory architecture and Neural Engine allow SPM1 to run lightweight ML models on the go with exceptional power efficiency. Perfect for field testing, remote monitoring, and mobile development when away from the cluster.',
  1100.00, 5.0, 1,
  'WS-SPM1-001', 'C02FL0XXPN6Q', 'MacBook Air (M1)', 'MacBookAir10,1', 'Apple',
  11, 6, 6, 'available', 1,
  'Apple M1 (8-Core CPU / 8-Core GPU / 16-Core Neural Engine)',
  '16 GB Unified Memory',
  NULL,
  NULL,
  NULL,
  'The Scout: Mobile Inference',
  NULL,
  'Running macOS. Ultra-portable ARM inference node. M1 Neural Engine for lightweight ML models, field testing, and remote monitoring.'
);

-- 6. SPM2 — Moltbot Sandbox: Autonomous Agent
INSERT INTO items (
  title, description, price, rating, rating_count,
  asset_tag, serial_number, model_name, model_number, manufacturer,
  category_id, location_id, default_location_id, status, quantity,
  cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail,
  notes
) VALUES (
  'MacBook Air (M1) — "SPM2"',
  E'Moltbot Sandbox: Autonomous Agent.\n\nAn isolated, network-restricted M1 machine dedicated to running autonomous AI agents. SPM2 is intentionally air-gapped from the production cluster to prevent uncontrolled agent behavior from affecting live systems. All agent experiments run here first before promotion to the main cluster.',
  1100.00, 5.0, 1,
  'WS-SPM2-001', 'C02FL0XXPN7R', 'MacBook Air (M1)', 'MacBookAir10,1', 'Apple',
  11, 6, 6, 'available', 1,
  'Apple M1 (8-Core CPU / 8-Core GPU / 16-Core Neural Engine)',
  '16 GB Unified Memory',
  NULL,
  NULL,
  NULL,
  'Moltbot Sandbox: Autonomous Agent',
  NULL,
  'Running macOS (Isolated). Air-gapped from production cluster. Dedicated to autonomous AI agent experiments. Prevents uncontrolled agent behavior from affecting live systems.'
);

-- 7. YONDEX — Juju Controller: Swarm Commander
INSERT INTO items (
  title, description, price, rating, rating_count,
  asset_tag, serial_number, model_name, model_number, manufacturer,
  category_id, location_id, default_location_id, status, quantity,
  cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail,
  notes
) VALUES (
  'Toshiba Qosmio X70 — "Yondex"',
  E'Juju Controller: Swarm Commander.\n\nThe orchestration brain running Ubuntu 24.04 with Canonical Juju. Yondex manages the deployment, scaling, and lifecycle of all services across the cluster. Despite its older hardware, 32GB of RAM and a quad-core i7 are more than sufficient for running the Juju controller and coordinating the swarm.',
  800.00, 4.0, 1,
  'WS-YONDEX-001', 'Z9120456YX', 'Qosmio X70', 'PSPLTU-00H007', 'Toshiba',
  11, 7, 7, 'available', 1,
  'Intel Core i7-4700MQ (4 Cores / 8 Threads @ 2.4 GHz)',
  '32 GB DDR3',
  NULL,
  NULL,
  NULL,
  'Juju Controller: Swarm Commander',
  NULL,
  'Running Ubuntu 24.04. Canonical Juju controller for cluster orchestration. Manages deployment, scaling, and lifecycle of all services across the swarm.'
);
