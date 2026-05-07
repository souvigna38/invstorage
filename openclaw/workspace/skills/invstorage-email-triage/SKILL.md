# InvStorage: Email & Message Triage

Read incoming buyer messages (email, Craigslist, Facebook, etc.) and draft intelligent replies based on actual product data from the inventory system.

## When to Use
- User forwards a buyer email/message
- User asks to check or respond to messages
- Automated email monitoring detects new buyer inquiries

## Steps

### 1. Parse the Incoming Message
Extract:
- **Buyer name/email** (for personalization)
- **Product referenced** (item name, listing title, or SKU)
- **Question type**: availability, condition, price, shipping, meetup, negotiation
- **Tone**: polite, aggressive, suspicious, casual

### 2. Look Up the Product
Search Medusa for the referenced product:
```http
GET http://medusa:9000/admin/products?q=<product_name_or_sku>&limit=5
Authorization: Bearer <token>
```

Check:
- **Status**: Is it still published (available)?
- **Price**: What's the current asking price?
- **Description**: What condition details are in the listing?
- **Created at**: How long has it been listed?

### 3. Draft a Reply

**Availability question** ("Is this still available?"):
```
Hi [name]! Yes, the [item] is still available at $[price]. 
When would work for you to pick it up? I'm flexible on times.
```

**Condition question** ("Any scratches? Does it work?"):
```
Hi [name]! Great question. [Quote relevant condition details from description].
I've described everything in the listing, but happy to send more photos if you'd like!
```

**Price question** ("Is the price negotiable?"):
- Route to the **invstorage-negotiate** skill
- Or: "The price is $[price]. I'm open to reasonable offers — what did you have in mind?"

**Shipping question** ("Do you ship?"):
```
Hi! I prefer local pickup, but I can ship if needed. 
Based on the item size, shipping would be approximately $[estimate]. 
Would that work for you?
```

**Suspicious/scam message** (overpayment, wire transfer, etc.):
- Flag to user: "This message looks like a potential scam. It mentions [red flag]. I'd recommend ignoring it."
- DO NOT draft a reply for scam messages

### 4. Present to User for Approval
```
📩 Buyer Inquiry for "[item title]"
From: [buyer name/email]
Question: [summary]
Product Status: [available/sold]

📝 Drafted reply:
---
[draft text]
---

Send this reply? (yes/no/edit)
```

### 5. Send on Approval
- If user says "yes" or "send": Send the reply
- If user says "edit" or provides changes: Update and re-confirm
- If user says "no": Discard

## Red Flags (Auto-Detect)
Flag these to the user WITHOUT replying:
- Mentions of wire transfers, cashier's checks, or money orders
- "I'll send a mover to pick it up"
- Offering more than asking price
- Requests to communicate off-platform
- Very generic messages that don't reference the specific item

## Important
- NEVER auto-send without user approval
- ALWAYS check product status before drafting (don't say "available" if it's sold)
- Keep responses short — 2-3 sentences max for marketplace messages
- Match the platform tone: eBay = professional, Craigslist = casual, Facebook = friendly
