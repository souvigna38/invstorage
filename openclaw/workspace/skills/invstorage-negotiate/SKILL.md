# InvStorage: Lowball Negotiator

Handle buyer negotiations automatically based on configurable rules. Responds to offers, counters lowballs, and accepts fair deals.

## When to Use
- User forwards a buyer's offer/message
- Email triage identifies a price negotiation
- User asks to handle a specific negotiation

## Negotiation Rules

### Price Thresholds
- **Auto-accept floor**: 80% of asking price
- **Counter range**: 50% to 80% of asking price
- **Auto-decline floor**: 50% of asking price

### Decision Logic
```
IF offer >= (asking_price * 0.80):
  → AUTO-ACCEPT
  → Reply: "That works! When can you pick up?"
  → Tell user: "Accepted $[offer] for [item] (asking was $[price])"

ELSE IF offer >= (asking_price * 0.50):
  → COUNTER at floor (80% of asking)
  → Reply: "The lowest I can go is $[floor]. Let me know!"
  → Tell user: "Countered $[offer] with $[floor] for [item]"

ELSE IF offer < (asking_price * 0.50):
  → POLITE DECLINE
  → Reply: "Thanks for the interest, but the price is firm at $[price]."
  → Tell user: "Declined $[offer] for [item] (too low)"
```

### Response Templates

**Accepting:**
> Hi! That works for me. When would you like to pick it up? I'm available [suggest times based on USER.md timezone].

**Countering:**
> Thanks for the offer! The lowest I can go is $[floor_price]. It's in [condition] and similar ones have been selling for $[market_avg] on eBay. Let me know if that works!

**Declining:**
> Thanks for reaching out! The price is firm at $[asking_price]. It's priced competitively based on recent sales of similar items. Let me know if you change your mind!

## Important Rules
- **NEVER auto-send** a response without telling the user first
- Show the user: "[Buyer] offered $[X]. I'd [accept/counter/decline]. Send?"
- Wait for user confirmation before sending
- If the item has been listed for 30+ days, suggest accepting at 70% instead of 80%
- Track all negotiations in memory for the user's records
