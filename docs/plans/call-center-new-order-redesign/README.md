# Call Center — New Order Page Redesign

**Branch:** `feat/call-center-phase-1`
**Target page:** [`frontend/src/pages/call-center/CallCenterNewOrderPage.jsx`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx)
**Route:** `/call-center/new`
**Status:** Draft — pending approval before execution.

---

## Why this redesign

The current page is a 3-equal-column form wall. Call-center agents work at conversation speed; this layout fights them. They have to ping-pong across columns, the most-used field (customer phone) gets the same weight as cosmetic fields, and validation only fires on submit.

The redesign reframes the page as a **Warm Operator Console** — a focused, keyboard-first workspace dressed in the existing coffee palette (`#6F4E37`, Cairo, `#D7CCC8`). Same brand, sharper tool.

---

## Plan documents

| # | Doc | What it covers |
|---|---|---|
| 01 | [Diagnosis](01-diagnosis.md) | Concrete pain points in the current page, ranked by impact. |
| 02 | [Design thesis](02-design-thesis.md) | Aesthetic direction, differentiation anchor, DFII scoring. |
| 03 | [Layout](03-layout.md) | New 2-column layout + sticky command bar + bottom cart drawer. |
| 04 | [Components](04-components.md) | Component-by-component spec: behaviour, states, props. |
| 05 | [Keyboard & a11y](05-keyboard-and-a11y.md) | Shortcut map, focus order, screen-reader contract. |
| 06 | [Phases & metrics](06-phases-and-metrics.md) | Sequenced phases, effort estimates, success metrics, open questions. |

---

## Quick summary

- **Layout:** 3 equal columns → 2 columns (form 40% / catalog 60%) + sticky **Order Command Bar** on top + sticky **Cart Drawer** on bottom.
- **Customer block:** phone-first, 1.5× input height, live results show last-order date and order count, "+ new customer" inline (no mode toggle).
- **Branch picker:** chips, not `<select>`.
- **Items:** larger cards, stock-color badges, skeleton loaders, keyboard-navigable grid.
- **Cart:** bottom drawer with `− qty +` steppers, expanded discount panel, smart-disabled submit with reason tooltip.
- **Keyboard:** `/` focus search, `Enter` pick first customer, `Ctrl+Enter` submit, arrow keys navigate items.
- **Validation:** per-step inline checks, not on-submit-only.

---

## Out of scope

- Multi-order / parallel-call drafts (proposed as a P7 follow-up if confirmed).
- Backend changes beyond exposing `lastOrderDate` / `totalOrders` on customer search results (P2 dependency, see [04-components.md](04-components.md#42-customer-block)).
- Mobile-first redesign — desktop-first with graceful tablet fallback. Phone is not a target.

---

## Approval gate

Before any code lands: confirm aesthetic direction (02), layout (03), and Phase 1 scope (06). Each phase is independently mergeable so we can stop after any phase without leaving the page broken.
