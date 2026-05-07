# InvStorage: Social Media Promoter

Draft social media posts for high-value or special items to drive extra traffic to listings.

## When to Use
- Item is listed at $200+ (high-ticket)
- User asks to "promote" or "boost" a listing
- Item has been stale for 14+ days and is photogenic

## Steps

### 1. Get Product Details
Fetch from Medusa:
```http
GET http://medusa:9000/admin/products/<product_id>?fields=*variants,*variants.prices,*images
Authorization: Bearer <token>
```

### 2. Draft Platform-Specific Posts

**Twitter/X (280 chars max):**
```
Just listed: [Item Name] — $[price]

[1-line hook: why it's special]

DM or link in bio 📸
#vintage #forsale #[category]
```

**Facebook Group Post:**
```
🏷️ [Item Name] — $[price]

[2-3 sentence description highlighting the best features]

📍 [Location] | Local pickup preferred
💬 Comment or DM if interested!

#[category] #forsale #vintage
```

**Instagram Caption:**
```
[Item Name] ✨

[2-3 sentences about the item's story/appeal]

$[price] — Link in bio or DM to claim
.
.
.
#vintage #forsale #[category] #[brand] #resale #thrift #estate
```

### 3. Suggest Timing
- **Best posting times**: 
  - Facebook: Tuesday-Thursday, 9am-12pm
  - Twitter: Monday-Wednesday, 8am-10am
  - Instagram: Tuesday-Friday, 11am-2pm
- Adjust for user's timezone (from USER.md)

### 4. Present to User
```
📱 Social Media Drafts for "[item title]"

🐦 Twitter/X:
[draft]

📘 Facebook:
[draft]

📸 Instagram:
[draft]

Post to which platforms? (all / twitter / facebook / instagram / skip)
```

## Important
- Include the product image in the post if possible
- Don't over-hashtag (5-8 tags max per platform)
- Never include personal phone numbers or addresses
- Get approval before posting
