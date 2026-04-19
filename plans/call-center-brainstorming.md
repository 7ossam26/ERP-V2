# Call Center Role — Brainstorming Questionnaire

> **Instructions:** For each question, put an **X** next to your chosen option (e.g. `[X] A`) or write free text where asked. Skip nothing — if unsure, pick "not sure / please recommend" and I'll propose a default with tradeoffs.
>
> When done, save and send back. I'll produce the Understanding Lock → Design Doc → Implementation Plan.

---

## SECTION 1 — The Flow & Actors (foundational)

### Q1. What is "قسم التجهيزات" in the system? _(already answered → B: a workflow stage, no separate login)_

- [ ] A — New role with its own login + queue screen
- [x] B — Just a workflow stage; cashier handles prep-side work (**your answer**)
- [ ] C — Shared device screen at the branch, no per-user login
- [ ] D — Other: **\*\***\_\_\_**\*\***

> ⚠️ Note: Q1 may need to be revisited depending on Q2.

---

### Q2. End-to-end flow — who does what, and when does a notification fire?

- [ ] **A — Single-actor branch flow**
      Call center creates order → cashier (open shift) gets notified **once** at order creation → cashier prepares + finalizes + dispatches.
- [ ] **B — Two-actor flow**
      Call center → preparation staff on shared screen → when prep done, cashier gets notified to finalize/dispatch. _(Requires revisiting Q1 to add a shared device view.)_
- [ ] **C — Cashier-triggered flow**
      Call center creates order → cashier sees it in POS → manually clicks "Start Preparing" then "Mark Ready" → no separate notifications (cashier owns both sides).
- [x] **D — Other / hybrid:** The call center takes the order and the customer’s details and decides which branch to send it to. After that, the order goes to the preparation section in the branch. At that point, the cashier in each branch just prints the order and assigns a regular delivery guy to it.

---

### Q3. Who actually finalizes payment on a call-center order?

- [ ] A — Call center agent collects payment details (pre-paid card / online) at order time. Order is paid-in-full when it reaches the branch.
- [ ] B — Cashier at the branch finalizes payment when the order is ready / dispatched.
- [x] C — Delivery man collects cash-on-delivery; cashier reconciles after.
- [ ] D — Mix of the above (agent picks payment method at order time: COD / pre-paid / card).

---

## SECTION 2 — Call Center Scope

### Q4. Is the call center centralized or per-branch?

- [ ] A — **Centralized** — one team serves ALL branches; agent picks the target branch per order.
- [ ] B — **Per-branch** — each agent is assigned to one branch (via `branchId` on user).
- [x] C — **Regional** — agent handles a group of branches (via `accessibleBranches`).
- [ ] D — Not sure / recommend default.

---

### Q5. How does the agent decide which branch to route the order to?

- [x] A — **Manual** — agent picks branch from a dropdown.
- [ ] B — **Auto by client address / delivery zone** — system suggests nearest branch based on `DeliveryZone`, agent can override.
- [ ] C — **Auto-assigned** — one branch, no choice.
- [ ] D — Combination: auto-suggest + manual override.

---

### Q6. What catalog / stock does the call-center agent see?

- [ ] A — Master item catalog, price only, **no stock info** (agent doesn't care about branch stock).
- [x] B — Master catalog + stock of the **selected branch** (warn if out-of-stock).
- [] C — Only items the selected branch sells (branch-specific menu).
- [ ] D — Not sure / recommend default.

---

## SECTION 3 — Order Type & Delivery

### Q7. Can call-center orders be anything other than delivery?

- [x] A — **Delivery only** — every call-center order has a delivery address.
- [ ] B — Delivery + pickup (client comes to collect).
- [ ] C — Delivery + pickup + dine-in reservation.
- [ ] D — Other: **\*\***\_\_\_**\*\***

---

### Q8. Does the agent assign a delivery man / zone at order creation?

- [x] A — Agent assigns delivery zone only; branch cashier assigns delivery man later.
- [ ] B — Agent assigns both zone and delivery man.
- [ ] C — Neither — branch cashier assigns everything at "ready" time.
- [ ] D — Zone auto-detected from client address; delivery man chosen by cashier.

---

## SECTION 4 — Order Lifecycle & Data Model

### Q9. How should the call-center order be stored?

- [ ] A — **Extend the existing `Sale` model** — add new statuses (NEW, PREPARING, READY…) to it. Simpler, keeps reports unified.
- [ ] B — **New separate `Order` model** — sale is created only when the cashier finalizes. Cleaner separation but more work and reporting changes.
- [x] C — Not sure / recommend the best trade-off.

---

### Q10. What status transitions do you need?

Check all that apply:

- [x] NEW (just created by call center)
- [x] PREPARING (cashier / prep is working on it)
- [x] READY (prep done, ready to hand off / dispatch)
- [x] OUT_FOR_DELIVERY (delivery man took it)
- [x] DELIVERED (completed)
- [x] CANCELLED
- [ ] REJECTED (branch refused — e.g., out of stock, closed)
- [ ] Other: **\*\***\_\_\_**\*\***

---

### Q11. Can a call-center order be cancelled or edited after creation?

- [ ] A — Yes, by call center only, only while status = NEW.
- [ ] B — Yes, by call center until status = READY; cashier must approve if already PREPARING.
- [ ] C — Yes, by anyone with permission, any time.
- [x] D — No edits; cancel only if the order only while status = NEW.

---

### Q12. When is inventory / stock deducted?

- [x] A — At order creation (call-center confirms).
- [ ] B — At "mark ready" (cashier confirms prep done).
- [ ] C — At delivery (order reaches client).
- [ ] D — Not sure / recommend default.

> ⚠️ This affects how cancellations reverse stock.

---

## SECTION 5 — Client Management

### Q13. Can call-center create new clients during order entry?

- [x] A — Yes, inline (search by phone → if not found, create on the fly).
- [ ] B — Yes, but only via a separate "create client" screen before starting the order.
- [ ] C — No — clients must be pre-created by admin.

---

### Q14. Required client fields for call-center order?

Check all that must be captured:

- [x] Name
- [x] Phone
- [x] Delivery address (free text)
- [x] Delivery zone
- [ ] Secondary phone (optional)
- [ ] Notes / landmark (optional)
- [ ] Other: **\*\***\_\_\_**\*\***

---

### Q15. One client, many addresses?

- [x] A — No, one address per client.
- [ ] B — Yes, multiple saved addresses per client (agent picks one).
- [ ] C — Agent enters address free-text each time, not saved.

---

## SECTION 6 — Branch & Shift Coupling

### Q16. What happens if NO cashier shift is open at the target branch when an order is created?

- [ ] A — **Reject** — agent sees error "Branch closed, pick another."
- [x] B — **Queue** — order is accepted as NEW; notification fires as soon as a shift opens.
- [ ] C — **Warn, allow** — agent sees warning, order still created, notifies any user with POS module access at that branch by email/other.
- [ ] D — Not sure / recommend default.

---

### Q17. If multiple cashiers have open shifts at the same branch, who gets notified?

- [ ] A — All cashiers at that branch (broadcast).
- [ ] B — Only the first shift opened (primary cashier).
- [ ] C — Round-robin (distribute orders across cashiers).
- [x] D — Not sure / recommend default.

---

### Q18. Should call-center orders be included in the cashier's shift cash reconciliation / sales report?

- [x] A — Yes — if the cashier finalizes payment, it's part of their shift.
- [ ] B — No — call-center orders are tracked separately; shift covers POS-only.
- [ ] C — Only for COD orders.

---

## SECTION 7 — Notifications

### Q19. Notification channel / medium?

Check all that apply:

- [x] In-app toast/banner
- [x] Unread badge on a "New Orders" menu item
- [x] Sound / beep
- [x] Browser native notification
- [ ] Printed ticket (branch receipt printer)
- [ ] SMS to cashier's phone
- [ ] Email
- [ ] Other: **\*\***\_\_\_**\*\***

---

### Q20. Real-time mechanism?

- [ ] A — **WebSocket / Socket.IO** (real-time push, needs server-side connection management).
- [ ] B — **Server-Sent Events (SSE)** (simpler, one-way server→client).
- [ ] C — **Polling** (frontend asks every N seconds; simple but laggy).
- [x] D — Not sure / recommend the best for our scale.

---

### Q21. Do we persist a notification history?

- [ ] A — Yes — notifications stored in DB, user can see past N days, mark as read.
- [ ] B — No — ephemeral only, gone after page reload.
- [x] C — Yes, but auto-deleted after cashier acknowledges.

---

### Q22. If the cashier is logged in on multiple devices, should all receive the notification?

- [ ] A — Yes, broadcast to all sessions.
- [ ] B — Only the most recent session.
- [x] C — Doesn't matter / not a real case.

---

## SECTION 8 — Permissions

### Q23. Which modules should the Call Center role have access to? (check all)

- [ ] POS (full)
- [x] A **new** module: `CALL_CENTER` (create/manage call-center orders)
- [ ] CLIENTS (view + create)
- [ ] ITEMS (view only)
- [ ] REPORTS (their own orders)
- [ ] DELIVERY_MEN (view only)
- [ ] DELIVERY_ZONES (view only)
- [x] Other: let me enter in superadmin dashboared

---

### Q24. Can call-center agent see prices / cost?

- [x] A — Selling price: yes. Cost: no.
- [ ] B — Both visible.
- [ ] C — Neither (pre-set pricing shown only as line totals).

---

### Q25. Can call-center agent see orders from OTHER agents?

- [x] A — Yes, all call-center orders across the company.
- [ ] B — Only their own orders.
- [ ] C — Only orders for branches they have access to.

---

## SECTION 9 — Non-Functional Requirements

### Q26. Expected volume (rough estimate)

- [x] Orders per day across all branches: **\*\***\_\_\_**\*\***
- [ ] Concurrent call-center agents online: **\*\***\_\_\_**\*\***
- [ ] Number of branches: **\*\***\_\_\_**\*\***

---

### Q27. Notification latency target

- [ ] A — Real-time — cashier sees it within 1 second.
- [ ] B — Near real-time — within 5 seconds is OK.
- [x] C — Best effort — within 30 seconds is OK.

---

### Q28. UI language

- [x] A — Arabic-first RTL (follow existing app direction).
- [ ] B — Bilingual (EN/AR toggle).
- [ ] C — Same as the rest of the app — no change.

---

### Q29. Devices / browser constraints for call-center agents

- [ ] A — Desktop only (agents use full browser).
- [x] B — Desktop + tablet.
- [ ] C — Phone too (agents on the go).

---

## SECTION 10 — Reporting

### Q30. Which new reports / metrics do you want?

Check all that apply:

- [x] Orders per agent / day
- [x] Average preparation time (create → ready)
- [x] Rejection / cancellation rate
- [x] Orders per branch from call center
- [x] Revenue attributed to call center
- [ ] None for now — add later
- [ ] Other: **\*\***\_\_\_**\*\***

---

### Q31. Should call-center orders appear in existing Sales report?

- [x] A — Yes, mixed with POS sales (filter column "source = CALL_CENTER / POS").
- [ ] B — No, separate report only.
- [ ] C — Yes, but with a clear visual marker.

---

## SECTION 11 — Rollout

### Q32. Rollout strategy

- [ ] A — Ship everything at once, no feature flag.
- [x] B — Phase it: (1) role + order creation, (2) notifications, (3) reports.
- [ ] C — Feature flag so we can turn it on/off per company or per environment.

---

### Q33. Anything I missed? Free-text notes / constraints / deadlines:

```



```

---

## End of questionnaire

Once you fill this in and send it back, I will:

1. Write the **Understanding Lock** summary for your confirmation.
2. Propose **2–3 design approaches** with trade-offs.
3. Build the final **design doc + decision log + implementation plan**.
