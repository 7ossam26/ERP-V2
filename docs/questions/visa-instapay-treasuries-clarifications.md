# Clarifying Questions — Visa & Instapay Treasuries + Branches Sales Revamp

## ✅ Model — Locked by you

> **One treasury per branch handles Cash (existing, unchanged) AND two global treasuries (Visa + Instapay) serve all branches at the same time.**
>
> So: every sale belongs to a branch, but routes to **one of three treasuries** based on `paymentMethod`:
>
> - `CASH` → that branch's cash treasury (existing `Branch.treasuryId`)
> - `VISA` → the **global** Visa treasury (shared across all branches)
> - `INSTAPAY` → the **global** Instapay treasury (shared across all branches)
>
> Per-branch Visa/Instapay numbers shown on the Branches Sales page are **computed by aggregating `Sale` rows** filtered by `branchId` + `paymentMethod` + date range — they are **not** stored as balances per branch. The two global treasuries hold the true money balance.

Context I already pulled from the repo before asking:

- `Treasury` model has no `type` / `scope` field. `Branch.treasuryId` is `@unique` — stays as the branch's cash treasury. The two new treasuries will **not** have a branch FK (global scope).
- `SystemConfiguration` already has a `bankTreasuryId` (singular). Need to decide whether Visa repurposes it or both are new.
- `Sale.treasuryId` is a single FK (not nullable). `SalePaymentMethod` enum = `CASH | INSTAPAY | VISA | CARD`.
- [frontend/src/pages/sales/BranchesSalesPage.jsx](frontend/src/pages/sales/BranchesSalesPage.jsx) currently shows Main Treasury + Bank Treasury + per-branch cash/instapay balances. No date filters, no Visa card.
- `branchService.getBalances()` feeds branch rows — will need extension to return per-branch visa/instapay **sale totals** (not balances) respecting a date range.

---

## 1. Remaining data-model questions

### Q1.1 Historical sales backfill

Existing `Sale` rows with `paymentMethod = VISA` or `INSTAPAY` currently point to the **branch's cash treasury** (the only option before today). On migration, pick one:

- **(a)** Backfill — reassign `Sale.treasuryId` for all historical VISA/INSTAPAY sales to the new global treasuries, then recompute balances for cash treasuries (decrement) and the new treasuries (increment from zero).
- **(b)** Leave history as-is; only new sales from cutover date route correctly. New treasuries start at 0 and accumulate.
- **(c)** Backfill `Sale.treasuryId` only (no balance recompute) — preserves reporting continuity without moving money.

My recommendation: **(b)** — cleanest, avoids rewriting history. But (a) is necessary if your current cash-treasury balances are wrong because visa/instapay sales inflated them. yes

### Q1.2 Does the existing `SystemConfiguration.bankTreasuryId` represent one of these two?

- Is **Visa = current Bank Treasury** (just rename/repurpose)?
- Or are Visa + Instapay **both new**, and `bankTreasuryId` becomes legacy / removed?
- Add `visaTreasuryId` and `instapayTreasuryId` columns to `SystemConfiguration` so POS can look them up at sale time? yes

### Q1.3 How do we guarantee sales routing at the DB layer?

Options:

- **(a)** Application-layer only: POS/sales controller reads `SystemConfiguration.visaTreasuryId` / `instapayTreasuryId` and sets `Sale.treasuryId` accordingly.
- **(b)** Add a `Treasury.scope` enum (`BRANCH_CASH | GLOBAL_VISA | GLOBAL_INSTAPAY | MAIN | BANK`) to self-document and let queries filter cleanly.

My recommendation: **(b)** — cheap to add, makes the "global" intent explicit, and prevents someone accidentally assigning a branch to the visa treasury. yes

---

## 2. Sales routing logic

### Q2.1 When a POS sale is `paymentMethod = VISA`, which treasury receives the money?

Confirm the rule: `VISA` → global Visa treasury, `INSTAPAY` → global Instapay treasury, `CASH` → branch cash treasury, `CARD` → ??? (the `CARD` enum value already exists — is it dead or does it also route somewhere?).

### Q2.2 Mixed payments?

Does a sale ever split across methods (e.g., 100 cash + 50 visa)? Current schema has a single `paymentMethod` + single `treasuryId`, so the answer is presumably **no** — confirm. No there's no split payments

### Q2.3 Refunds, voids, and shift close-outs

- Do refunds/voids deduct from the same Visa/Instapay treasury? maybe cash maybe visa let cashier select
- Shift close-out currently reconciles cash — does it also need to reconcile Visa & Instapay card totals? Or are those automatically trusted (no physical count)? yes

---

## 3. UI — Branches Sales page (`BranchesSalesPage.jsx`)

### Q3.1 "Show every single branch's visa and instapay" — exactly what numbers?

For each branch row, show:

- **(a)** Today's Visa sales total + today's Instapay sales total? _(transactional view)_
- **(b)** All-time Visa + Instapay sales for the branch? _(running totals)_
- **(c)** Filter-range Visa + Instapay totals (respects the date filter below)?

My assumption: **(c)** — the filter drives the numbers. yes

### Q3.2 Date filter UX

You said "last day or select specific date". Concretely:

- **Quick chips**: Today, Yesterday, Last 7 days, Last 30 days, This month? yes
- **Custom**: single date picker, or date **range** picker (from/to)? yes
- **Default on load**: Today? Last 7 days? All-time?

### Q3.3 Two new main cards (Visa balance, Instapay balance)

- Do these show the **treasury balance** (running total of all money sitting there) — unaffected by the date filter?
- Or the **sum of Visa/Instapay sales in the selected date range**?
- Or **both** (big balance number + small "in range" subtitle)?

My recommendation: **balance is balance (always all-time)**, put the range total as secondary text. I think this is better

### Q3.4 Card placement & styling

- Next to the existing Main Treasury card, or as a separate row above the branch list?
- Same gradient style as Main Treasury card, or differentiated (e.g., blue for Visa, purple for Instapay)? yes
- Click behavior — drill into a treasury detail page, or static display?

### Q3.5 Per-branch row layout

Current row shows cash + instapay. New layout options:

- 4 columns: Cash / Visa / Instapay / Total
- Keep cash + instapay, add visa Yes
- Drop cash from this page and make it Visa + Instapay only (you said "I want to show every single branch visa and instapay")

Which?

---

## 4. Permissions & access

### Q4.1 Who can see the two new balance cards?

- Admin / General Manager only?
- Branch managers see only their own branch's contribution, but not the global balance?
- Same `requireAnyPermission(["TREASURIES", ...])` gate as existing treasury routes? Yes

### Q4.2 Can these two treasuries be transferred from/to like normal treasuries?

- Appear in the cash-transfer dropdowns?
- Or locked as display-only (no manual transfers, only sales/refunds mutate)?

--- transfer money from cash to visa and instapay only one direction

## 5. Seeding

### Q5.1 Seeding mechanism

- **Prisma seed script** (`backend/prisma/seed.js`) — runs on `prisma db seed`? Yes
- **One-off migration** SQL that inserts the two rows? Yes
- **Manual creation** via an admin UI and then set in System Config?

### Q5.2 Exact names & starting balance

- Treasury name in Arabic or English? (existing data has both — e.g., "الخزينة الرئيسية")
- Suggestions: `"خزينة فيزا"` / `"خزينة انستاباي"` vs `"Visa Treasury"` / `"Instapay Treasury"`
- Starting balance = 0 for both?

--- Arabic names

## 6. Scope of this PR

Confirm the deliverable for **this** change — all of the below, or a subset?

- [x] Schema change (new FKs / columns) + migration
- [x] Seed the two treasuries
- [x] `SystemConfiguration` update (add `visaTreasuryId`, `instapayTreasuryId`)
- [x] POS / Sale creation routing logic update (VISA → visa treasury, INSTAPAY → instapay treasury)
- [x] Backfill historical sales (per Q1.3)
- [x] `branchService.getBalances` extension to return per-branch visa/instapay totals with date filter
- [x] `BranchesSalesPage.jsx` — two new cards + date filter + per-branch visa/instapay columns
- [x] Tests (unit + integration)

---

## My default plan if you just say "go"

If you don't answer and tell me to proceed, I will assume:

1. **Locked model**: one cash treasury per branch (unchanged) + two global singleton treasuries (Visa, Instapay) shared by all branches. Per-branch visa/instapay breakdowns on the sales page come from aggregating `Sale` rows by `branchId` + `paymentMethod` + date range.
2. `SystemConfiguration` gains `visaTreasuryId` + `instapayTreasuryId`; `bankTreasuryId` kept for backward compat but deprecated. Add `Treasury.scope` enum to make global vs branch-cash explicit.
3. New sales route by `paymentMethod` (CASH → branch cash, VISA → global visa, INSTAPAY → global instapay); historical sales left untouched; balances on new treasuries start at 0 and accumulate from cutover.
4. Branches Sales page: add 2 top cards (always all-time balance, with range total as subtitle), add a date-range picker with chips (Today / Yesterday / Last 7 / Last 30 / Custom range), default **Today**. Per-branch rows show Cash / Visa / Instapay columns.
5. Permissions mirror existing treasury routes.
6. Seeded via `prisma/seed.js` with Arabic names, balance = 0.

Tell me which assumptions to flip.
