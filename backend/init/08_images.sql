-- =============================================================================
-- IMAGE URLS FOR ALL ITEMS MISSING PHOTOS
-- Mix of Amazon CDN, Apple CDN, and Unsplash (all verified HTTP 200)
-- =============================================================================

-- ─── SERVERS ─────────────────────────────────────────────────────────────────

-- 11: Cisco UCS C220 M5 — "Cisco" Compute Node
-- Data center with blue server LEDs
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&h=400&fit=crop' WHERE id = 11;

-- 12: Dell PowerEdge R730xd — "BigBrain" Database Node
-- Server hardware close-up
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1629654297299-c8506221ca97?w=600&h=400&fit=crop' WHERE id = 12;

-- 13: Custom Workstation — "Hal" Inference Node (has GPU)
-- GPU card / compute hardware
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=600&h=400&fit=crop' WHERE id = 13;

-- 14: Dell PowerEdge R510 — "Vault" Archive Node
-- Storage/data center racks
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1484662020986-75935d2ebc66?w=600&h=400&fit=crop' WHERE id = 14;

-- 17: HP ProLiant DL380 G6 — "Temp-Data-1"
-- Rack server front view
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1597852074816-d933c7d2b988?w=600&h=400&fit=crop' WHERE id = 17;

-- 18: HP ProLiant DL380 G6 — "Temp-Data-2"
-- Server blade / hardware
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1600267185393-e158a98703de?w=600&h=400&fit=crop' WHERE id = 18;

-- ─── NETWORK & SECURITY ─────────────────────────────────────────────────────

-- 15: Netgear M4300-12X12F — Network Fabric Switch (original)
-- Network switch with fiber cables
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&h=400&fit=crop' WHERE id = 15;

-- 26: SonicWall NSA 5650 — "Sentinel"
-- Cybersecurity / firewall concept
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?w=600&h=400&fit=crop' WHERE id = 26;

-- 27: Netgear M4300-24x24F — "Clean-Core"
-- Network fiber cables / backbone
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1605810230434-7631ac76ec81?w=600&h=400&fit=crop' WHERE id = 27;

-- 28: Netgear M4300-12x12F — "Dirty-Core"
-- Network infrastructure / tech
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1562408590-e32931084e23?w=600&h=400&fit=crop' WHERE id = 28;

-- 29: Netgear S3300-52X — "Access"
-- Network / circuit board
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=400&fit=crop' WHERE id = 29;

-- 30: Totolink Wireless AP — "Hazmat-AP"
-- Wireless router / access point
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1563206767-5b18f218e8de?w=600&h=400&fit=crop' WHERE id = 30;

-- 31: Dell PowerEdge R510 (8-Bay) — "Gatekeeper"
-- Security / lock / firewall concept
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1614064641938-3bbee52942c7?w=600&h=400&fit=crop' WHERE id = 31;

-- ─── LAPTOPS & WORKSTATIONS ─────────────────────────────────────────────────

-- 16: Lenovo ThinkPad T15g Gen 2 — "Frank"
-- Black business laptop (ThinkPad style)
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=600&h=400&fit=crop' WHERE id = 16;

-- 19: Mac Pro (Tower) — "Oracle"
-- Mac Pro tower (Amazon CDN - verified)
UPDATE items SET image_url = 'https://m.media-amazon.com/images/I/71an9eiBxpL._AC_SL1500_.jpg' WHERE id = 19;

-- 20: Acer ConceptD CN516-72G — "ConceptD"
-- Creative/design laptop
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1525547719571-a2d4ac8945e2?w=600&h=400&fit=crop' WHERE id = 20;

-- 21: MacBook Pro 16" (2019) — "SP9"
-- MacBook Pro (Amazon CDN - verified)
UPDATE items SET image_url = 'https://m.media-amazon.com/images/I/71pC69I3lzL._AC_SL1500_.jpg' WHERE id = 21;

-- 22: MacBook Pro 16" (2019) — "SP7"
-- MacBook silver from above
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=400&fit=crop' WHERE id = 22;

-- 23: MacBook Air (M1) — "SPM1"
-- MacBook Air (Amazon CDN - verified)
UPDATE items SET image_url = 'https://m.media-amazon.com/images/I/71vFKBpKakL._AC_SL1500_.jpg' WHERE id = 23;

-- 24: MacBook Air (M1) — "SPM2"
-- MacBook Air midnight (Apple CDN - verified)
UPDATE items SET image_url = 'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/macbook-air-midnight-select-20220606' WHERE id = 24;

-- 25: Toshiba Qosmio X70 — "Yondex"
-- Gaming/older laptop
UPDATE items SET image_url = 'https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=600&h=400&fit=crop' WHERE id = 25;
