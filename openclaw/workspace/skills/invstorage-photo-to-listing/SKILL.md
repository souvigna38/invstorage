# InvStorage: Photo-to-Listing

Create a product listing from a photo dropped into chat. Analyzes the image, generates SEO-friendly title and description, checks market pricing, and creates the product in Medusa.

## When to Use
- User sends a photo with intent to sell (e.g., "sell this", "list this", "how much?", a photo with a price)
- User asks to create a listing for an item

## Steps

### 1. Vision Analysis
Analyze the photo to extract:
- **Item type** (lamp, camera, chair, electronics, etc.)
- **Brand/Manufacturer** (if visible on labels, logos, or recognizable design)
- **Model** (if identifiable)
- **Era/Style** (mid-century, vintage, modern, antique)
- **Material** (brass, wood, glass, plastic, fabric)
- **Color** (primary and accent colors)
- **Condition** (mint, excellent, good, fair, poor — note any visible damage)
- **Approximate dimensions** (if scale references are visible)

### 2. Generate Listing Content
- **Title**: 60-80 characters, SEO-optimized
  - Format: `[Brand] [Model/Type] [Key Feature] [Era/Style]`
  - Example: "Mid-Century Brass Desk Lamp with Adjustable Arm — 1960s"
- **Description**: 2-3 paragraphs
  - Paragraph 1: What it is, key features, what makes it desirable
  - Paragraph 2: Condition details, measurements, any flaws
  - Paragraph 3: Shipping/pickup notes (default: "Local pickup preferred")
- **SKU**: `[CATEGORY]-[BRAND_OR_TYPE]-[3_DIGITS]`
  - Example: `LAMP-BRASS-001`, `CAM-CANON-042`, `FURN-EAMES-007`

### 3. Market Price Check
If web search is available:
```
Search: "[item description] sold eBay"
```
Report findings:
- Price range of sold comparable items
- Average selling price
- Whether user's asking price is competitive

### 4. Create in Medusa
Authenticate:
```http
POST http://medusa:9000/auth/user/emailpass
Content-Type: application/json

{"email": "admin@invstorage.local", "password": "invtrack123"}
```

Create product:
```http
POST http://medusa:9000/admin/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "<generated_title>",
  "description": "<generated_description>",
  "status": "published",
  "metadata": {
    "channels": <user_selected_channels>,
    "source": "openclaw-photo-pipeline",
    "condition": "<assessed_condition>",
    "category": "<item_category>"
  },
  "options": [{"title": "Type", "values": ["Default"]}],
  "variants": [{
    "title": "Default",
    "sku": "<generated_sku>",
    "options": {"Type": "Default"},
    "prices": [{"amount": <price_cents>, "currency_code": "usd"}],
    "manage_inventory": false
  }]
}
```

### 5. Confirm to User
Reply with:
```
✅ Listed: [Title]
💰 Price: $[price]
📋 SKU: [sku]
📡 Channels: [channels]
🆔 Medusa ID: [product_id]

n8n will distribute to [channels] automatically.
```

## Channel Recommendations (if user doesn't specify)
- **Under $25**: craigslist, facebook
- **$25-$200**: ebay, craigslist, facebook
- **Over $200**: ebay, amazon

## Important
- Always confirm with user before creating the listing
- If price seems too low or high based on market data, warn the user
- Include all visible flaws in the description — honesty builds reputation
