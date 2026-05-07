# InvStorage — Available Tools & APIs

## Internal Services (Docker Network)

### Medusa (Product Database)
- **URL**: `http://medusa:9000`
- **Auth**: POST to `/auth/user/emailpass` with `{"email":"admin@invstorage.local","password":"invtrack123"}`
- **Use for**: Creating products, checking inventory, updating prices, marking items sold

### n8n (Automation Webhooks)
- **URL**: `http://n8n:5678`
- **Webhooks**:
  - `POST /webhook/openclaw-product` — Create product via n8n pipeline (returns product ID)
  - `POST /webhook/medusa-product` — Trigger channel distribution for existing product
  - `POST /webhook/medusa-order` — Process order events
  - `POST /webhook/erpnext-product-sync` — Sync product to ERPNext
  - `POST /webhook/erpnext-order-sync` — Sync order to ERPNext

### ERPNext (Shadow ERP)
- **URL**: `http://erpnext-backend:8000`
- **Auth**: `token api_key:api_secret` (configure after setup)
- **Use for**: Checking accounting data, item history (read-only in Phase 1)

### CLIP Service (Image Similarity)
- **URL**: `http://clip-service:8000`
- **Use for**: Finding visually similar items already in inventory

## External APIs (require API keys)

### eBay (Price Research)
- Use web search to find sold listings: `"[item] sold site:ebay.com"`
- For direct API: configure eBay developer credentials

### Email
- Install `gmail-manager` skill from ClawHub for email access
- Or use n8n email nodes for automated email drafting

## Quick Reference: Create a Product

The fastest way to create a product:
```
POST http://n8n:5678/webhook/openclaw-product
Content-Type: application/json

{
  "title": "Mid-Century Brass Desk Lamp",
  "description": "Beautiful vintage desk lamp...",
  "price_dollars": 85.00,
  "sku": "LAMP-BRASS-001",
  "channels": ["ebay", "craigslist"],
  "image_url": "https://...",
  "condition": "good"
}
```

Response:
```json
{
  "success": true,
  "product_id": "prod_...",
  "title": "Mid-Century Brass Desk Lamp",
  "sku": "LAMP-BRASS-001",
  "price": 85.00,
  "channels": ["ebay", "craigslist"]
}
```
