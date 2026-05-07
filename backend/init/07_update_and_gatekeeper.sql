-- =============================================================================
-- UPDATE MISSING FIELDS: VAULT (ID 14) & FRANK (ID 16)
-- INSERT NEW: GATEKEEPER
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- VAULT (ID 14) — Fill in missing: cpu_type, ram_amount, model, manufacturer
--   Also update model_name from generic "ZFS Server" to actual hardware
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE items SET
  cpu_type        = '2x Intel Xeon E5645 (12 Cores / 24 Threads)',
  ram_amount      = '32 GB DDR3',
  model_name      = 'Dell PowerEdge R510 (12-Bay)',
  model_number    = 'R510-12Bay',
  manufacturer    = 'Dell',
  title           = 'Dell PowerEdge R510 — "Vault" Archive Node',
  storage_detail  = E'Controller: H200 (IT Mode)\nBoot: 500 GB SSD\n12x 3.5" Drive Bays — 24 TB Raw XFS Array\nStorage Pool A: 24 TB (Main Backup)\nStorage Pool B: 16 TB (Archive)',
  notes           = E'OS: Ubuntu 24.04 Server | VLAN: 20 (Storage)\nContinuously ingests WAL from BigBrain for point-in-time recovery. Final destination for results files from Cisco and Hal.\n12x 3.5" hot-swap bays, H200 in IT Mode for direct disk access. Long-term archival repository.'
WHERE id = 14;

-- ─────────────────────────────────────────────────────────────────────────────
-- FRANK (ID 16) — Fill in missing: hard_drive_info, network_info, storage_detail
--   Also enhance notes with OS and VLAN info
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE items SET
  hard_drive_info = '2 TB NVMe (Gen4)',
  network_info    = '2.5GbE Ethernet + Wi-Fi 6E — VLAN 100 (Trusted)',
  storage_detail  = '2 TB NVMe Gen4 SSD',
  notes           = E'OS: Windows 11 Pro / WSL2 | VLAN: 100 (Trusted)\nMobile workstation. Xeon W-class CPU + full RTX 3080 for portable AI inference and emergency cluster recovery operations.\nDisaster Recovery Console — can serve as fallback command node if primary cluster goes down.'
WHERE id = 16;

-- ─────────────────────────────────────────────────────────────────────────────
-- GATEKEEPER — NEW INSERT: Edge Security / pfSense Firewall
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO items (
  title, description, price, rating, rating_count,
  asset_tag, serial_number, model_name, model_number, manufacturer,
  category_id, location_id, default_location_id, status, quantity,
  cpu_type, ram_amount, hard_drive_info, gpu, network_info, role, storage_detail,
  notes
) VALUES (
  'Dell PowerEdge R510 (8-Bay) — "Gatekeeper"',
  E'Firewall: Edge Security.\n\nThe network''s front door. Running pfSense Plus, Gatekeeper handles all VLAN management, VPN termination, and perimeter firewall rules. With a dedicated quad-port NIC bonded via LACP, it provides redundant connectivity while inspecting and routing traffic between the WAN, clean VLAN, and dirty VLAN. A dedicated security appliance — nothing else runs on this box.',
  2200.00, 5.0, 1,
  'NET-GATEKEEPER-001', 'JNKF-R510-GK1', 'PowerEdge R510 (8-Bay)', 'R510-8Bay', 'Dell',
  11, 8, 8, 'available', 1,
  '2x Intel Xeon E5620 (8 Cores / 16 Threads)',
  '64 GB DDR3',
  '4x 1TB SATA',
  NULL,
  'WAN: 1GbE | LAN: 4x 1GbE Quad Port NIC (3x LACP Bond) — VLAN Management / VPN',
  'Firewall: Edge Security',
  E'Boot: 120 GB SSD\nData: 4x 1TB SATA',
  E'OS: pfSense Plus | Dedicated Security Appliance\nEdge firewall handling all VLAN management, VPN termination, and perimeter rules.\nWAN: 1GbE | LAN: 3x LACP bonded from quad-port NIC.\n8-Bay chassis repurposed as dedicated security appliance.'
);
