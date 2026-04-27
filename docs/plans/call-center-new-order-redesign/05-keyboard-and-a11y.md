# 05 — Keyboard & Accessibility

Call-center work is keyboard-first. Every forced mouse trip is a tax. This doc defines the shortcut map, focus order, and the screen-reader contract.

---

## Shortcut map

Implemented as a single `useEffect` with a `keydown` listener at the page level. Skipped when focus is inside an input *unless* the shortcut explicitly applies to inputs (e.g. `Enter` in phone field).

| Key | Context | Action |
|---|---|---|
| `/` | Anywhere | Focus the items search input. |
| `Esc` | Items search focused | Clear the search query. |
| `Esc` | Cart drawer expanded | Collapse the drawer. |
| `Esc` | Customer results open | Close results, keep phone value. |
| `Enter` | Phone field, results visible | Pick the first matching customer. |
| `Enter` | Phone field, no results | Reveal new-customer fields, focus name. |
| `Ctrl+Enter` | Anywhere | Submit order (if `submitBlocker === null`). |
| `Ctrl+K` | Anywhere | Toggle cart drawer expanded/collapsed. |
| `↑` / `↓` | Items grid | Move focus up/down within the grid. |
| `←` / `→` | Items grid | Move focus left/right within the grid (RTL-aware). |
| `Enter` / `Space` | Items grid card focused | Add to cart (+1). |
| `+` / `=` | Items grid card focused | Add to cart (+1). |
| `-` | Items grid card focused | Remove one from cart (or 0). |
| `?` | Anywhere (no input focus) | Open shortcut cheat sheet modal. |

**RTL nuance:** `→` should move toward the beginning of the row in Arabic reading order. Test with `dir="rtl"` set on the grid container — browsers handle native arrow-key behaviour for elements but not for our custom roving-tabindex implementation. Code must invert manually.

---

## Focus order (Tab key)

1. Branch chip (first one, then arrow keys move within the chip group)
2. Phone field
3. (If results visible) first customer result, then arrow keys within results
4. (If new-customer revealed) Name → Address
5. Zone chip group
6. Address textarea
7. "+ أضف ملاحظة" toggle
8. Item search
9. Category tab group
10. Items grid (roving tabindex — only one card is tabbable at a time)
11. Cart drawer summary (`button` that toggles expand)
12. (If expanded) per-line stepper buttons → discount panel → reason select
13. Submit button
14. Command bar `?` shortcut help

---

## Roving tabindex pattern

Both the chip groups and the items grid use **roving tabindex**:
- Container has `role="group"` (chips) or `role="grid"` (items).
- Only the active element has `tabIndex=0`; others have `tabIndex=-1`.
- Arrow keys move focus and update the active element.
- Tab leaves the group.

Why: prevents 40+ tabstops on the items grid alone. Standard a11y pattern (used by combobox listboxes, gmail, etc.).

---

## Screen-reader contract

| Element | Markup |
|---|---|
| Order Command Bar | `<header role="status" aria-label="حالة الطلب الحالي">` — `role="status"` makes screen readers announce updates without interrupting. |
| Branch chips | `<div role="radiogroup" aria-label="الفرع">` with each chip as `<button role="radio" aria-checked={...}>`. |
| Customer phone | `<input aria-describedby="phone-help">` with help text "ابحث برقم الهاتف لاختيار عميل موجود". |
| Customer results | `<ul role="listbox" aria-label="نتائج البحث عن العملاء">`. |
| Items grid | `<div role="grid" aria-label="الأصناف المتاحة">` with each card as `<button role="gridcell">`. |
| Stock badge | `<span aria-label="متوفر: 12">[12]</span>` so SR doesn't read just "12". |
| Cart drawer | `<aside role="region" aria-label="السلة" aria-expanded={isExpanded}>`. |
| Submit button blocked | `aria-disabled="true"` with `aria-describedby` pointing to the reason text. |

---

## Visible focus

- Focus ring: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`. Applied via Tailwind class on every interactive element.
- Never `outline: none` without a replacement.
- Stepper `− qty +` buttons must show focus even when adjacent — gap of `2px` between them.

---

## Color contrast

All text combinations to meet **WCAG AA**:

| Foreground | Background | Ratio | OK? |
|---|---|---|---|
| `#3E2723` (text-light) | `#F5F5F0` (background-light) | 12.4 | ✓ |
| `#3E2723` | `#FFFFFF` (surface-light) | 13.5 | ✓ |
| `#FFFFFF` | `#6F4E37` (primary) | 6.6 | ✓ |
| `#16A34A` (stock.ok) | `rgba(22,163,74,0.15)` | check at impl | needs verification |
| `#D97706` (stock.low) | `rgba(217,119,6,0.15)` | check at impl | needs verification |

Stock badges may need a darker text variant on the tinted background — verify with a contrast tool before merging Phase 3.

---

## Reduced motion

Respect `@media (prefers-reduced-motion: reduce)`:
- `cart-pulse` → no transform, just a 1-frame opacity blink.
- `slide-down` → instant.
- No autoplay shimmers.

Tailwind doesn't ship a built-in for this, but we already have one keyframe — adding a `motion-reduce:animate-none` class to those elements is the lightest fix.

---

## Cheat sheet modal

Triggered by `?` or by clicking the trailing `?` in the command bar. A simple two-column list of shortcut → description, RTL-aware. No fancy chrome — `bg-surface-light`, `border-border-light`, `shadow-soft`. Closes on `Esc` or click-outside.

---

## Testing checklist (manual, pre-merge)

- [ ] Tab through the entire page in order without using a mouse, completing a full order.
- [ ] Same flow with `Ctrl+Enter` to submit instead of mouse.
- [ ] Screen-reader test (NVDA on Windows is fine) — every step's status is announced.
- [ ] `prefers-reduced-motion: reduce` set in browser — no animations play.
- [ ] Zoom to 200% — layout doesn't break, no horizontal scroll except the items grid.
- [ ] RTL arrow keys move focus in the right visual direction.
