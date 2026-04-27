# 06 — Phases, Metrics, and Open Questions

## Implementation phases

Each phase is independently mergeable. After any phase the page must remain fully functional — we can stop, ship, and resume later if priorities shift.

### Phase 1 — Skeleton & flow (≈1 day)

**Goal:** the new layout shell, no behavioural changes yet.

- Add `OrderCommandBar` (read-only — segments not yet clickable as jump-nav).
- Refactor body to `lg:grid-cols-12` with 5/7 split.
- Add `CartDrawer` sticky-bottom container, collapsed-only state — wraps today's cart logic verbatim.
- Add `Step` wrapper around the three column-A sections.
- Replace branch `<select>` with `BranchChips`.
- Update `tailwind.config.js` (stock colors, surface-raised, cart-pulse).

**Risk:** zero business-logic risk. All state hooks unchanged.

**Done when:** an agent completes an order on the new layout with no functional regressions.

---

### Phase 2 — Customer block (≈1 day)

**Goal:** make returning-customer flow the obvious fastest path.

- Build `PhoneField` (large, autofocus on branch select).
- Build `CustomerResults` with name + last-order-date + total-orders.
- **Backend:** extend `callCenterService.searchClients` response to include `lastOrderDate` and `totalOrders`. Single `Order` aggregation per customer in the SQL.
- Replace mode-toggle pattern with inline `+ عميل جديد` row in results.
- Build `SelectedCustomerChip` (replaces today's bordered box at [`CallCenterNewOrderPage.jsx:276-283`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L276-L283)).
- Wire `Enter` in phone field → first result.

**Risk:** backend change must be deployed before frontend Phase 2 can ship. Or feature-flag the new fields and fall back gracefully.

**Done when:** agent can find an existing customer in <2 keystrokes after typing a known phone number.

---

### Phase 3 — Catalog polish (≈0.5 day)

**Goal:** make the items grid skim-readable.

- Larger cards, responsive `sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4`.
- `StockBadge` with green/amber/red tints.
- Skeleton cards while loading.
- Improved empty state ("ابدأ بـاختيار فرع").
- `CategoryTabs` with item counts.

**Risk:** stock-color contrast verification (see [05](05-keyboard-and-a11y.md#color-contrast)).

**Done when:** an agent can scan a 60-item catalog and locate any item in <3 seconds.

---

### Phase 4 — Cart drawer (≈1 day)

**Goal:** replace the most error-prone UI on the page.

- Drawer expand/collapse with `slide-down`.
- `−  qty  +` steppers (44px touch, replace number input).
- Move `DiscountPanel` into the expanded drawer header row.
- Smart-disabled submit button with `submitBlocker` reason tooltip.
- Move `discountReason` validation from `handleSubmit` into the drawer (prevent submission rather than fail it).
- `cart-pulse` animation on add.

**Risk:** medium — touches the submit path. Must regression-test all existing toast errors at [`CallCenterNewOrderPage.jsx:217-221`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L217-L221).

**Done when:** zero "missing field" toasts on the test set; submit is reachable from any scroll position.

---

### Phase 5 — Keyboard & a11y (≈0.5 day)

**Goal:** lock in the operator-console feel.

- Implement the shortcut map from [05](05-keyboard-and-a11y.md#shortcut-map).
- Roving tabindex on `BranchChips`, `ZoneChips`, `ItemsGrid`.
- ARIA roles per the screen-reader contract.
- `prefers-reduced-motion` handling.
- Focus rings audit.

**Risk:** RTL arrow-key direction is the trickiest part — needs explicit testing.

**Done when:** an agent can submit an order with mouse fully unplugged.

---

### Phase 6 — Polish (≈0.5 day)

**Goal:** memorability anchor.

- Command-bar segments become clickable jump-nav.
- Amber dot indicators for unset segments.
- Cheat sheet modal (`?`).
- Microcopy pass on empty states and tooltips.
- Final screenshot review against the [02 design thesis](02-design-thesis.md#what-memorable-looks-like-here) memorability test.

**Risk:** none.

**Done when:** the screenshot test passes — without the logo, the page is recognisably ours.

---

## Total budget

**~4.5 dev-days** across 6 phases. Phases can be reordered if priorities shift, except Phase 1 must precede 2–6.

---

## Success metrics

To be instrumented in Phase 1 via simple `console.time`-style markers reported through whatever telemetry channel we already have (or as `performance.mark` events the team can inspect manually).

| Metric | Today (assumed baseline) | Target | How we measure |
|---|---|---|---|
| Time-to-submit per order | ~90s (estimate) | ≤ 60s (−30%) | `performance.mark` at branch-select and at submit-success. |
| First-attempt validation errors | ~1 in 4 submissions | ≤ 1 in 10 (−60%) | Count of `toast.error` calls in `handleSubmit` guards / total submits. |
| Returning-customer pick rate | unknown | ≥ 75% | Count of `selectedClient !== null` at submit / total submits. |
| Keyboard-only submission rate | ~0% | ≥ 50% (trained agents) | Track whether `lastInputType === 'keyboard'` at submit (simple session flag). |

If we can't get clean instrumentation in time, fall back to a single 30-minute observed agent session per phase and a written note.

---

## Open questions

These need answers before some phases can begin. Numbered for easy reference in PR review.

1. **Branch count.** How many active branches in production? If >12, Phase 1 should ship a search-as-you-type combobox instead of chips.
2. **Customer history fields.** Is exposing `lastOrderDate` and `totalOrders` on `searchClients` acceptable? If perf is a concern, we can compute them lazily and cache.
3. **Multi-tab call handling.** Can one agent handle two calls at once? If yes, we need a "draft order" persistence layer (localStorage or a backend draft table) — adds ~1 dev-day as a P7.
4. **Stock badge thresholds.** Is `< 5` a sensible "low stock" cutoff, or should it be a per-item threshold from the items table?
5. **Mobile/tablet usage.** Is this used on tablets in branches, or strictly desktop in the call center? Affects whether Phase 6 invests in the full-screen sheet for the cart drawer.
6. **Notes default.** Is the notes field ever pre-required by a manager? If yes, the collapsed-by-default UX needs a per-branch override flag.
7. **Discount reason list.** The current `reasonLabel` set in [`DiscountPanel`](../../../frontend/src/components/pos/DiscountPanel.jsx) — is it final? The redesign surfaces reason more prominently, so any churn there blocks Phase 4 polish.
8. **Telemetry.** Do we already have a frontend telemetry channel (Sentry, custom backend, GA), or should I scope a minimal `console.timeline`-style logger for the success metrics?

---

## Stop conditions

Reasons to pause and re-plan:

- Phase 2 backend change is rejected → fall back to showing only what's currently returned (degrades Phase 2 value but doesn't block it).
- Q1 (branch count) > 50 → reconsider the chip pattern entirely; possibly a search-only picker.
- Q3 (multi-tab) is a hard requirement → reorder Phase 1 to include draft persistence.

---

## Approval gate

Reviewer should confirm three things before we start coding:

1. Aesthetic direction in [02](02-design-thesis.md) is the desired tone.
2. Layout in [03](03-layout.md) is the right structure.
3. Phase 1 scope in this doc is what to build first.

Once those three are nodded through, code starts. Anything beyond Phase 1 can be reviewed phase-by-phase as PRs.
