# InvStorage: Inventory Query

Query the Medusa product database to check inventory status, find products, and get listing details.

## When to Use
- User asks "What do I have listed?"
- User asks about a specific item's status
- Checking if an item is still available (for customer replies)
- Getting product details for any workflow

## Medusa API Reference

### Authentication
```http
POST http://medusa:9000/auth/user/emailpass
Content-Type: application/json

{"email": "admin@invstorage.local", "password": "invtrack123"}
```
Response: `{"token": "..."}`

### List All Products
```http
GET http://medusa:9000/admin/products?limit=50&order=-created_at
Authorization: Bearer <token>
```

### Search Products
```http
GET http://medusa:9000/admin/products?q=<search_term>&limit=10
Authorization: Bearer <token>
```

### Get Single Product
```http
GET http://medusa:9000/admin/products/<product_id>?fields=*variants,*variants.prices,*images
Authorization: Bearer <token>
```

### Update Product (price, status, metadata)
```http
POST http://medusa:9000/admin/products/<product_id>
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "draft",
  "metadata": {"sold": true, "sold_at": "2026-01-15"}
}
```

## Response Formatting

When showing inventory to the user:
```
📦 Your Listings ([count] items)

1. [Title] — $[price] (listed [N] days ago)
   SKU: [sku] | Status: [published/draft]
   Channels: [ebay, craigslist]

2. [Title] — $[price] (listed [N] days ago)
   ...

💰 Total listed value: $[sum]
```

## Important
- Cache the auth token — it lasts 23 hours
- Always use the internal URL: `http://medusa:9000` (not localhost)
- Prices in Medusa are in cents — divide by 100 for display
