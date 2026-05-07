-- ============================================================================
-- SEED DATA — Personal Inventory System
-- ============================================================================
-- Runs automatically after 01_schema.sql on first Docker startup.
-- Provides sample data so the frontend has something to render immediately.
-- ============================================================================

-- Sample Users
INSERT INTO users (name, email, role) VALUES
    ('Admin',       'admin@inventory.local',    'admin'),
    ('Sam Parker',  'sam@inventory.local',      'member');

-- Sample Locations
INSERT INTO locations (name, description, address, city, state, country) VALUES
    ('Home Office',     'Primary workspace',            '123 Main St',      'Brisbane',     'QLD', 'AU'),
    ('Garage',          'Tool storage & workshop',      '123 Main St',      'Brisbane',     'QLD', 'AU'),
    ('Living Room',     'Main living area',             '123 Main St',      'Brisbane',     'QLD', 'AU'),
    ('Storage Unit',    'Off-site storage facility',    '45 Industrial Ave','Brisbane',     'QLD', 'AU'),
    ('Kitchen',         'Kitchen & pantry',             '123 Main St',      'Brisbane',     'QLD', 'AU');

-- Sample Items (mapped to Amazon-clone frontend fields)
INSERT INTO items (title, description, price, image_url, rating, rating_count,
                   asset_tag, serial_number, model_name, model_number, manufacturer,
                   category_id, location_id, default_location_id, status,
                   purchase_date, purchase_cost, warranty_months, quantity) VALUES

    -- Electronics
    ('MacBook Pro 16" M3 Max',
     'Primary development laptop. 64GB RAM, 1TB SSD. Used for all coding projects.',
     4299.00,
     'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp16-spaceblack-select-202310',
     4.8, 3,
     'ELEC-001', 'C02ZN1MDLVDL', 'MacBook Pro 16"', 'A2991', 'Apple',
     1, 1, 1, 'checked_out',
     '2024-01-15', 4299.00, 12, 1),

    ('Sony WH-1000XM5 Headphones',
     'Noise-cancelling wireless headphones. Excellent for focus work.',
     349.00,
     'https://m.media-amazon.com/images/I/51aXvjzcukL._AC_SL1500_.jpg',
     4.5, 2,
     'ELEC-002', 'SN-WH1000XM5-2847', 'WH-1000XM5', 'WH1000XM5/B', 'Sony',
     1, 1, 1, 'available',
     '2023-11-20', 349.00, 12, 1),

    ('iPad Pro 12.9" M2',
     'Drawing tablet and secondary screen. 256GB WiFi model.',
     1199.00,
     'https://m.media-amazon.com/images/I/81gqHuHXkYL._AC_SL1500_.jpg',
     4.7, 1,
     'ELEC-003', 'DLXZ92HCQF', 'iPad Pro 12.9"', 'MNXR3LL/A', 'Apple',
     1, 3, 1, 'available',
     '2023-06-10', 1199.00, 12, 1),

    ('Dell U3423WE Monitor',
     '34-inch ultrawide USB-C hub monitor for home office.',
     819.00,
     'https://m.media-amazon.com/images/I/81pGjfBW4NL._AC_SL1500_.jpg',
     4.3, 2,
     'ELEC-004', 'CN-0F2JMN-FCC00', 'U3423WE', 'U3423WE', 'Dell',
     1, 1, 1, 'checked_out',
     '2023-09-01', 819.00, 36, 1),

    -- Furniture
    ('Herman Miller Aeron Chair',
     'Size C ergonomic office chair. Graphite frame, remastered.',
     1695.00,
     'https://m.media-amazon.com/images/I/71+-WVXxs+L._AC_SL1500_.jpg',
     5.0, 4,
     'FURN-001', 'HM-AER-2024-001', 'Aeron', 'AER1C23DWALPVPRSNASNASG1', 'Herman Miller',
     2, 1, 1, 'available',
     '2022-03-15', 1695.00, 144, 1),

    ('IKEA BEKANT Standing Desk',
     '160x80cm electric sit/stand desk. White top, white legs.',
     699.00,
     'https://m.media-amazon.com/images/I/41h02H2XNTL._AC_SL1000_.jpg',
     4.2, 1,
     'FURN-002', NULL, 'BEKANT', '120.224.55', 'IKEA',
     2, 1, 1, 'available',
     '2022-03-20', 699.00, 120, 1),

    -- Tools & Equipment
    ('DeWalt 20V MAX Drill Kit',
     'Cordless drill/driver with 2 batteries and charger. Used for home projects.',
     149.00,
     'https://m.media-amazon.com/images/I/71so0CWPO1L._AC_SL1500_.jpg',
     4.6, 5,
     'TOOL-001', 'DW-DCD771C2-9283', 'DCD771C2', 'DCD771C2', 'DeWalt',
     3, 2, 2, 'available',
     '2021-08-10', 149.00, 36, 1),

    -- Kitchen
    ('Breville Barista Express',
     'Espresso machine with built-in grinder. Daily driver for coffee.',
     699.00,
     'https://m.media-amazon.com/images/I/71LhLZGFahL._AC_SL1500_.jpg',
     4.4, 3,
     'KTCN-001', 'BRV-BES870-44721', 'Barista Express', 'BES870XL', 'Breville',
     4, 5, 5, 'available',
     '2023-01-05', 699.00, 24, 1),

    -- Books & Media
    ('Designing Data-Intensive Applications',
     'Martin Kleppmann. The definitive guide to distributed systems. Hardcover.',
     42.00,
     'https://m.media-amazon.com/images/I/91YfNb49PLL._SL1500_.jpg',
     4.9, 8,
     'BOOK-001', '978-1449373320', NULL, '978-1449373320', 'O''Reilly Media',
     5, 1, 1, 'available',
     '2020-06-15', 42.00, NULL, 1),

    -- Outdoor & Sports
    ('Garmin Fenix 7X Solar',
     'GPS multisport watch with solar charging. Used for running and hiking.',
     899.00,
     'https://m.media-amazon.com/images/I/61vmJCw0raL._AC_SL1500_.jpg',
     4.7, 2,
     'SPRT-001', 'GMN-F7X-28475', 'Fenix 7X Solar', '010-02541-01', 'Garmin',
     8, NULL, 1, 'checked_out',
     '2023-04-20', 899.00, 12, 1);

-- Sample Action Logs (recent activity)
INSERT INTO action_logs (action_type, performed_by, item_id, target_user_id,
                        to_location_id, note, action_date) VALUES
    ('create',   1, 1,  NULL, 1,    'Added MacBook Pro to inventory',           '2024-01-15 10:00:00+10'),
    ('checkout', 1, 1,  2,    1,    'Checked out to Sam for daily use',         '2024-01-16 09:00:00+10'),
    ('create',   1, 4,  NULL, 1,    'Added Dell monitor to inventory',          '2023-09-01 14:00:00+10'),
    ('checkout', 1, 4,  2,    1,    'Set up at home office desk',               '2023-09-02 10:00:00+10'),
    ('create',   1, 5,  NULL, 1,    'Added Aeron chair to inventory',           '2022-03-15 12:00:00+10'),
    ('transfer', 1, 3,  NULL, 3,    'Moved iPad to living room for media use',  '2024-06-01 18:30:00+10'),
    ('create',   1, 10, NULL, NULL, 'Added Garmin watch to inventory',          '2023-04-20 09:00:00+10'),
    ('checkout', 2, 10, 2,    NULL, 'Wearing daily for fitness tracking',       '2023-04-21 07:00:00+10');

-- Update assigned_to for checked-out items
UPDATE items SET assigned_to_user_id = 2 WHERE status = 'checked_out';
