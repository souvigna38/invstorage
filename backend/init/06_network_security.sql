-- =============================================================================
-- NETWORK & SECURITY INFRASTRUCTURE — Sentinel, Clean-Core, Dirty-Core, Access, Hazmat-AP
-- =============================================================================

-- 1. SENTINEL — Secure Gateway: Malware & C&C Defense
INSERT INTO items (
  title, description, price, rating, rating_count,
  asset_tag, serial_number, model_name, model_number, manufacturer,
  category_id, location_id, default_location_id, status, quantity,
  cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail,
  notes
) VALUES (
  'SonicWall NSA 5650 — "Sentinel"',
  E'Secure Gateway: Malware & C&C Defense.\n\nThe perimeter guardian. Sentinel performs deep packet inspection with SSL decryption (DPI-SSL) and intrusion prevention (IPS) at 10G line rate. Every byte entering or leaving the network is scanned for malware signatures, command-and-control callbacks, and anomalous traffic patterns. Nothing gets in or out without Sentinel''s approval.',
  8500.00, 5.0, 1,
  'NET-SENTINEL-001', 'SNW-5650-AX1', 'NSA 5650', 'NSA5650', 'SonicWall',
  11, 8, 8, 'available', 1,
  NULL,
  NULL,
  NULL,
  NULL,
  '10G DPI-SSL / IPS — Deep Packet Inspection with SSL Decryption & Intrusion Prevention',
  'Secure Gateway: Malware & C&C Defense',
  NULL,
  'Perimeter firewall. Scans all traffic for malware signatures, C&C callbacks, and anomalous patterns at 10G line rate. DPI-SSL decrypts and inspects encrypted traffic.'
);

-- 2. CLEAN-CORE — Sanctuary Switch: AI & Database Backbone
INSERT INTO items (
  title, description, price, rating, rating_count,
  asset_tag, serial_number, model_name, model_number, manufacturer,
  category_id, location_id, default_location_id, status, quantity,
  cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail,
  notes
) VALUES (
  'Netgear M4300-24x24F — "Clean-Core"',
  E'Sanctuary Switch: AI & Database Backbone.\n\nThe trusted core of the network. Clean-Core connects all production-grade machines — BigBrain, Cisco, Hal, and Vault — on the clean VLAN. With 24x 10G fiber ports and Layer 3 routing, it provides the high-bandwidth, low-latency backbone that the AI compute and database tiers demand. Only sanitized, validated traffic touches this switch.',
  6500.00, 5.0, 1,
  'NET-CLEANCORE-001', 'NGEAR-M4300-24F-1A', 'M4300-24x24F', 'XSM4348S', 'Netgear',
  11, 8, 8, 'available', 1,
  NULL,
  NULL,
  NULL,
  NULL,
  '24x 10G SFP+ (Fiber) / Layer 3 Routing — Jumbo Frames MTU 9000',
  'Sanctuary Switch: AI & Database Backbone',
  NULL,
  'Trusted core switch for the clean VLAN. Connects BigBrain, Cisco, Hal, and Vault. Only sanitized/validated traffic allowed. L3 routing between production subnets.'
);

-- 3. DIRTY-CORE — Hazard Switch: Ingest & Swarm Backbone
INSERT INTO items (
  title, description, price, rating, rating_count,
  asset_tag, serial_number, model_name, model_number, manufacturer,
  category_id, location_id, default_location_id, status, quantity,
  cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail,
  notes
) VALUES (
  'Netgear M4300-12x12F — "Dirty-Core"',
  E'Hazard Switch: Ingest & Swarm Backbone.\n\nThe untrusted side of the network. Dirty-Core handles all raw ingest traffic — Temp-Data-1, Temp-Data-2, Yondex swarm nodes, and any external data feeds. With 12x 10G fiber and Layer 3 routing, it isolates potentially dangerous or unvalidated traffic from ever touching the clean production backbone.',
  3500.00, 5.0, 1,
  'NET-DIRTYCORE-001', 'NGEAR-M4300-12F-2B', 'M4300-12x12F', 'XSM4324S', 'Netgear',
  11, 8, 8, 'available', 1,
  NULL,
  NULL,
  NULL,
  NULL,
  '12x 10G SFP+ (Fiber) / Layer 3 Routing — Jumbo Frames MTU 9000',
  'Hazard Switch: Ingest & Swarm Backbone',
  NULL,
  'Untrusted core switch for the dirty VLAN. Handles Temp-Data-1/2, Yondex swarm, and external feeds. Isolates unvalidated traffic from the clean production backbone.'
);

-- 4. ACCESS — The Split Switch: Wired Access (VLAN 100/666)
INSERT INTO items (
  title, description, price, rating, rating_count,
  asset_tag, serial_number, model_name, model_number, manufacturer,
  category_id, location_id, default_location_id, status, quantity,
  cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail,
  notes
) VALUES (
  'Netgear S3300-52X — "Access"',
  E'The Split Switch: Wired Access (VLAN 100/666).\n\nThe edge access layer. Access provides 48x 1G copper ports for workstations and laptops, with 4x 10G uplinks to the core switches. VLAN 100 carries trusted clean traffic to Clean-Core, while VLAN 666 routes dirty/ingest traffic to Dirty-Core. One switch, two worlds — physically the same box, logically completely separated.',
  1800.00, 5.0, 1,
  'NET-ACCESS-001', 'NGEAR-S3300-52X-3C', 'S3300-52X', 'GS752TXS', 'Netgear',
  11, 8, 8, 'available', 1,
  NULL,
  NULL,
  NULL,
  NULL,
  '48x 1G Base-T (Copper) / 4x 10G SFP+ Uplink — VLAN 100 (Clean) / VLAN 666 (Dirty)',
  'The Split Switch: Wired Access (VLAN 100/666)',
  NULL,
  'Edge access layer. 48 copper ports for workstations. VLAN 100 → Clean-Core (trusted), VLAN 666 → Dirty-Core (ingest/untrusted). One box, two logically separated worlds.'
);

-- 5. HAZMAT-AP — Dirty Wi-Fi: Air-Gapped Swarm Access
INSERT INTO items (
  title, description, price, rating, rating_count,
  asset_tag, serial_number, model_name, model_number, manufacturer,
  category_id, location_id, default_location_id, status, quantity,
  cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail,
  notes
) VALUES (
  'Totolink Wireless AP — "Hazmat-AP"',
  E'Dirty Wi-Fi: Air-Gapped Swarm Access.\n\nA dedicated wireless access point operating in isolation mode on the dirty VLAN (666). Hazmat-AP provides Wi-Fi 6 connectivity exclusively for swarm agents, mobile test devices, and any wireless node that needs to touch the ingest pipeline without risking contamination of the clean network. Client isolation prevents lateral movement between connected devices.',
  120.00, 4.0, 1,
  'NET-HAZMATAP-001', 'TOTO-AP-WIFI6-1D', 'Totolink Wireless AP', 'AX3600R', 'Totolink',
  11, 8, 8, 'available', 1,
  NULL,
  NULL,
  NULL,
  NULL,
  'Wi-Fi 6 (802.11ax) / Isolation Mode — VLAN 666 (Dirty) Only',
  'Dirty Wi-Fi: Air-Gapped Swarm Access',
  NULL,
  'Dedicated Wi-Fi AP on dirty VLAN 666. Client isolation enabled — no lateral movement between devices. For swarm agents, mobile test devices, and ingest pipeline wireless access only.'
);
