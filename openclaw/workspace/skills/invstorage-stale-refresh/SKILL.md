# InvStorage: Stale Listing Refresher

Monitor listings that haven't sold and proactively suggest price drops and re-listings to keep inventory moving.

## When to Use
- During heartbeat checks (every 6 hours)
- User asks "What hasn't sold?"
- User asks to refresh old listings

## Stale Listing Detection

### Query Medusa
```http
GET http://medusa:9000/admin/products?status=published&order=created_at&limit=50
Authorization: Bearer <token>
```

### Calculate Staleness
For each product:
- `days_listed = (now - product.created_at) / (1000 * 60 * 60 * 24)`
- **Fresh**: 0-14 days (no action)
- **Aging**: 15-29 days (watch)
- **Stale**: 30-59 days (suggest 10% price drop)
- **Dead**: 60+ days (suggest 20% drop or removal)

## Refresh Actions

### 10% Price Drop (Stale: 30+ days)
1. Calculate new price: `current_price * 0.90`
2. Message user:
   ```
   📦 Stale Listing: "[title]"
   Listed [N] days ago at $[price]. No takers yet.
   
   Suggestion: Drop to $[new_price] (10% off) and re-post on Craigslist.
   Reply "drop" to proceed, "skip" to ignore.
   ```
3. On "drop":
   - Update Medusa product price
   - Trigger n8n re-listing (POST to n8n webhook)

### 20% Price Drop (Dead: 60+ days)
1. Calculate new price: `current_price * 0.80`
2. Suggest more aggressive action:
   ```
   ⚠️ Dead Listing: "[title]"
   Listed [N] days ago. Time for aggressive action.
   
   Options:
   1. Drop 20% to $[new_price] and re-list everywhere
   2. Bundle with other items for a lot sale
   3. Donate and remove listing
   
   Reply 1, 2, or 3.
   ```

### Price Update in Medusa
```http
POST http://medusa:9000/admin/products/<product_id>/variants/<variant_id>
Authorization: Bearer <token>
Content-Type: application/json

{
  "prices": [{"amount": <new_price_cents>, "currency_code": "usd"}]
}
```

### Trigger n8n Re-listing
```http
POST http://n8n:5678/webhook/medusa-product
Content-Type: application/json

{
  "event": "product.updated",
  "timestamp": "<now>",
  "source": "openclaw-stale-refresh",
  "data": { "id": "<product_id>" }
}
```

## Important
- Don't suggest drops more than once per week per item
- Track suggestions in memory to avoid nagging
- Always get user approval before changing prices
- Consider seasonal factors (holiday items may sell later)
