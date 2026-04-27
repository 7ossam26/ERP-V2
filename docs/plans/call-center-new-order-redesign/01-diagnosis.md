# 01 — Diagnosis

What's slow, confusing, or error-prone about [`CallCenterNewOrderPage.jsx`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx) today, ranked by how much they cost the agent on a live call.

---

## Pain points (ranked by impact)

| # | Problem | Where in the code | Why it hurts the agent |
|---|---|---|---|
| 1 | **No flow sequence.** Cart sits on the left (RTL: leading), branch (the gating field) is on the right (RTL: trailing). The eye has to ping-pong across the page. | [`CallCenterNewOrderPage.jsx:231-477`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L231-L477) | Every click costs a saccade. With a customer on the line, "where do I start?" is a brutal first question. |
| 2 | **Branch picker is a buried `<select>`** even though it gates items, zones, and stock. | [`CallCenterNewOrderPage.jsx:236-248`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L236-L248) | Hides options behind a click. Most call centers serve <10 branches — chips would expose them all at once. |
| 3 | **Phone field has the same visual weight as "اسم العميل"** despite being the highest-leverage field (returning customers = ~80% of calls). | [`CallCenterNewOrderPage.jsx:251-258`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L251-L258) | Agent doesn't know that typing the phone first will save them work. |
| 4 | **Customer search results show only name + phone** — no signal of "is this a regular?" | [`CallCenterNewOrderPage.jsx:263-272`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L263-L272) | Agent can't recognise a VIP or remember the customer's usual address branch. |
| 5 | **Items grid is `grid-cols-2` inside one-third of the page width.** | [`CallCenterNewOrderPage.jsx:378-395`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L378-L395) | ~14 items visible per scroll on a 1080p screen. With 60+ SKUs that's a lot of scrolling per call. |
| 6 | **Cart, discount, totals, and submit all crammed into the third column.** Discount panel is squeezed, submit can disappear below the fold once the cart grows. | [`CallCenterNewOrderPage.jsx:400-476`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L400-L476) | The most important button on the page is not always reachable without scrolling. |
| 7 | **Validation only on submit.** Agent fills 6 fields, clicks submit, then learns one is missing. | [`CallCenterNewOrderPage.jsx:155-225`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L155-L225) | A single missed `zoneId` means a toast error after the customer's already off the line in their head. |
| 8 | **No keyboard affordance.** No autofocus, no Enter-to-add, no shortcuts. | (whole file) | Call-center work is keyboard-first — every forced mouse trip slows the call. |
| 9 | **Cart quantity is a tiny `<input type="number">`.** | [`CallCenterNewOrderPage.jsx:412-419`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L412-L419) | Slow to keyboard, wrong-feeling on mouse, awful on touch. Native spinners differ across browsers. |
| 10 | **Empty states are flat strings** ("السلة فارغة", "اختر فرعاً أولاً"). | [`CallCenterNewOrderPage.jsx:373-403`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L373-L403) | Wastes prime real estate on stating the obvious instead of guiding the next step. |
| 11 | **Notes field always visible** even though most orders don't need notes. | [`CallCenterNewOrderPage.jsx:321-329`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L321-L329) | Adds vertical noise. Should be collapsed behind a "+ أضف ملاحظة" affordance. |
| 12 | **Stock & price typography are visually identical to the item name.** | [`CallCenterNewOrderPage.jsx:389-393`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L389-L393) | Glance-reading "what's in stock" is impossible — eye has to focus to parse each card. |
| 13 | **Out-of-stock items disappear into a grey pill** with no visual cue *why*. | [`CallCenterNewOrderPage.jsx:384-387`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L384-L387) | Agent can't tell the customer "we don't have that today" without zooming in. |
| 14 | **Discount-reason validation lives inside `handleSubmit`** rather than the panel. | [`CallCenterNewOrderPage.jsx:188-192`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L188-L192) | Agent enters a discount, hits submit, gets bounced back — frustrating and avoidable. |

---

## What is *not* broken (keep it)

These work and should not regress in the redesign:

- The phone-debounce + customer search at [`CallCenterNewOrderPage.jsx:67-76`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L67-L76).
- The category filter logic at [`CallCenterNewOrderPage.jsx:78-98`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L78-L98).
- The stock guard on add-to-cart at [`CallCenterNewOrderPage.jsx:100-121`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L100-L121).
- The post-submit reset + items refresh at [`CallCenterNewOrderPage.jsx:200-214`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L200-L214).
- `OUT_OF_STOCK` server-error toast specialisation at [`CallCenterNewOrderPage.jsx:217-219`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L217-L219).

The bones are fine. The presentation is the bottleneck.

---

## Hypothesised gains (to verify post-launch)

- Time-to-submit per order: **−30%**
- First-attempt validation errors: **−60%**
- Returning-customer pick rate (vs. new): **>75%**
- Keyboard-only submission rate: **0% → >50%** for trained agents

Measurement strategy in [06-phases-and-metrics.md](06-phases-and-metrics.md#success-metrics).
