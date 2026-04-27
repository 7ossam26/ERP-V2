# 02 — Design Thesis

## Aesthetic direction: *Warm Operator Console*

A focused, dense, keyboard-first workspace that still carries the coffee-brand warmth from `tailwind.config.js`:
- Primary `#6F4E37` (coffee)
- Accent `#D7CCC8` (warm taupe)
- Background light `#F5F5F0` (off-white parchment)
- Cairo for both display and body

Reference points (conceptual, not visual plagiarism):
- **Linear / Superhuman** — compactness, keyboard primacy, status-as-affordance
- **Stripe Dashboard tables** — disciplined number alignment, restrained color
- **Old terminals & flight-deck UIs** — persistent status bar, no decorative motion

What this *isn't*:
- ❌ A purple-gradient SaaS
- ❌ A cartoony POS UI with big rounded shadows
- ❌ A maximalist "delight" page — agents don't want delight, they want speed

---

## Differentiation anchor

**The Order Command Bar.**

A persistent strip at the top of the page that always shows the live state of the order:

```
فرع: المعادي  ·  عميل: أحمد سعيد (٤ طلبات)  ·  أصناف: ٣  ·  الإجمالي: ١٢٥.٠٠ ج.م     [?]
```

- Visible from any scroll position.
- Each segment is a chip. Clicking it scrolls/focuses the corresponding section.
- Unset segments show a subtle amber dot (`stock.low` token).
- The trailing `?` opens the keyboard cheat sheet.

**Why this is the anchor:** if a screenshot of this page were shared with the logo cropped out, the command bar is what makes it recognisable as ours. No other page in the ERP has it (yet).

---

## DFII scoring

| Dimension | Score (1–5) | Rationale |
|---|---|---|
| Aesthetic Impact | 4 | Command bar + bottom drawer is genuinely distinctive vs. our other forms; not earth-shattering visually because we're staying inside the brand palette. |
| Context Fit | 5 | Operator console is exactly what call-center agents need. Calm warmth fits the coffee brand. |
| Implementation Feasibility | 5 | Pure Tailwind + existing Cairo + a couple of CSS variables. No new deps. |
| Performance Safety | 5 | Sticky elements + a small client-side keyboard handler. No heavy animation, no JS-driven layout. |
| Consistency Risk | 1 | Patterns (chips, sticky bar, bottom drawer) are reusable on the other call-center pages and the bulk-POS work. |

**DFII = 4 + 5 + 5 + 5 − 1 = 18 → capped at 15 → execute fully.**

---

## Tone & restraint rules

- **Type:** Cairo only. No second display font — Cairo Bold + size contrast does the work.
- **Color:** primary `#6F4E37` is reserved for *active state* and the submit CTA. Borders use `border-light` `#E7E5E4`. No gradients on chrome.
- **Motion:** exactly two purposeful animations:
  1. `cart-pulse` (200ms) on the bottom bar total when an item is added.
  2. `slide-down` (already in config) for the customer-results dropdown.
  No micro-motion on hovers. No skeleton-shimmer beyond Tailwind's standard `animate-pulse`.
- **Depth:** `shadow-soft` only on the sticky command bar and bottom drawer to lift them from the body. Cards stay flat with a 1px `border-light` border.
- **Iconography:** Lucide (already in the project) at 18–20px, `stroke-width: 1.75`. No emoji.

---

## What "memorable" looks like here

After 24 hours, a returning agent should remember three things:
1. **The command bar at the top tells me where I am.**
2. **I can submit from anywhere — the cart is always at the bottom.**
3. **Typing the phone number is the fastest path to a finished order.**

If a redesign reviewer can't recall those three things from a screenshot, we've drifted toward generic and need to restart.
