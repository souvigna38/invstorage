# InvStorage Heartbeat — Stale Listing Monitor

## Model
Uses `anthropic/claude-3-5-haiku-latest` (configured in `openclaw.json` → `agents.defaults.heartbeat.model`).
Haiku is the cheapest Anthropic tier — fast and inexpensive for simple checks like date comparisons and API calls.

## Schedule
Run every 6 hours.

## Check: Stale Listings (30+ Days)

1. Authenticate with Medusa:
   ```
   POST http://medusa:9000/auth/user/emailpass
   Body: {"email": "admin@invstorage.local", "password": "invtrack123"}
   ```

2. Fetch published products sorted by creation date:
   ```
   GET http://medusa:9000/admin/products?status=published&order=created_at&limit=50
   Authorization: Bearer <token>
   ```

3. For each product, calculate age in days from `created_at`.

4. If any product is older than 30 days and still published:
   - Message the user on Telegram:
     ```
     📦 Stale Listing Alert
     "[product.title]" has been listed for [N] days without selling.
     Current price: $[price]
     
     Suggestions:
     • Drop price 10% to $[new_price] and re-post on Craigslist
     • Remove listing if no longer available
     
     Reply "drop" to reduce price, or "remove" to delist.
     ```

5. If NO stale listings found: NO_FLUSH (nothing to report).

## Check: Low Inventory Alert

If total published products < 3:
- Message: "You only have [N] items listed. Time to photograph more inventory!"

## Important
- Do NOT auto-modify prices. Always ask the user first.
- Do NOT send heartbeat messages more than once per day per item.
- Track which items you've already alerted about in memory to avoid spam.
