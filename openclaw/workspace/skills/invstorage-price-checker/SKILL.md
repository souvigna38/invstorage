# InvStorage: Price Checker

Check market prices for an item by searching eBay sold listings and other marketplaces.

## When to Use
- User asks "How much is this worth?"
- User asks to price check before listing
- During the photo-to-listing pipeline (Step 3)
- User wants to validate or adjust a price

## Steps

### 1. Build Search Query
From the item details, construct an eBay search:
- Include: brand, model, key descriptors
- Exclude: "lot", "parts", "broken" (unless the item IS broken)
- Example: `"Canon AE-1" camera vintage sold`

### 2. Search eBay Sold Listings
Use web search to find:
```
Search: "[item] sold site:ebay.com"
```
Or:
```
Search: "[item] eBay sold listings price 2025 2026"
```

### 3. Analyze Results
Extract from search results:
- **Price range**: lowest to highest sold price
- **Average price**: mean of sold prices
- **Trend**: are prices going up or down?
- **Condition impact**: how much does condition affect price?

### 4. Report to User
```
📊 Market Check: [Item Name]

eBay Sold Listings (last 90 days):
• Range: $[low] — $[high]
• Average: $[avg]
• Your price: $[user_price] → [COMPETITIVE / HIGH / LOW]

💡 Recommendation: [suggestion]
```

### 5. Suggest Pricing Strategy
- **If user price is within 10% of average**: "Your price looks good."
- **If user price is 20%+ above average**: "You might get more views at $[suggested]. Similar items averaged $[avg]."
- **If user price is 20%+ below average**: "You could get more! Similar items sell for $[avg] on average."
- **If no comparable data found**: "I couldn't find exact comparisons. $[user_price] seems reasonable for this type of item."

## Important
- Always mention the data source ("based on eBay sold listings")
- Note that local sales (Craigslist/FB) typically go for 20-30% less than eBay
- Factor in condition — "excellent" items sell for 20-40% more than "good"
