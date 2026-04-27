# 04 — Components

Each new or modified component, with prop sketch, states, and behaviour. All components live under `frontend/src/pages/call-center/components/` unless otherwise noted.

---

## 4.1 `OrderCommandBar` (new)

**Location:** sticky top of the page.
**Purpose:** ambient state + jump-nav for the four primary order facets.

```jsx
<OrderCommandBar
  branch={branch}            // { id, name } | null
  customer={customer}        // { name, totalOrders } | null
  itemCount={cart.length}
  total={total}
  onJumpToBranch={() => focusSection('branch')}
  onJumpToCustomer={() => focusSection('customer')}
  onJumpToCart={() => expandCartDrawer()}
  onShowShortcuts={() => setShortcutsOpen(true)}
/>
```

**States per segment:**
- `unset` — label dimmed (`text-text-light/60`), small amber dot before the label.
- `set` — label in normal weight, value in `font-semibold`.
- The `total` segment is always set (defaults to `0.00`) and never shows a dot.

**Why a chip-style bar instead of breadcrumbs:** breadcrumbs imply hierarchy. These four facets are peers, all editable at any time.

---

## 4.2 Customer block

The biggest behavioural rework. Replaces [`CallCenterNewOrderPage.jsx:250-293`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L250-L293).

### `PhoneField`
- Height `h-14` (vs. today's `~h-10`), font `text-lg`, `tabular-nums`.
- Trailing phone icon (lucide `Phone`).
- Autofocus when branch becomes set.
- `onKeyDown` Enter → pick first result if exactly one match.

### `CustomerResults`
Live dropdown (debounced 300ms, same as today). Each row shows:

```
┌──────────────────────────────────────────────────┐
│ أحمد سعيد                          ٤ طلبات       │
│ 01XXXXXXXXX  ·  آخر طلب: ٢٥-٠٤-٢٠٢٦              │
└──────────────────────────────────────────────────┘
```

The last row is always **`+ عميل جديد بهذا الرقم`** as a CTA — no separate "new customer" mode. Clicking it inline-reveals the name + address fields below the phone.

**Backend dependency:** `callCenterService.searchClients` currently returns `{ id, name, phoneNumber, address }`. We need to add `lastOrderDate` and `totalOrders`. Cheap query in the existing controller.

### `SelectedCustomerChip`
When a customer is picked, collapse the results and show a single chip:

```
┌─────────────────────────────────────────┐
│ ✓ أحمد سعيد · ٤ طلبات      [تعديل][✕]  │
└─────────────────────────────────────────┘
```

`tعديل` re-opens the editable fields prefilled. `✕` clears.

---

## 4.3 `BranchChips`

Replaces the `<select>` at [`CallCenterNewOrderPage.jsx:236-248`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L236-L248).

```jsx
<div className="flex flex-wrap gap-2">
  {branches.map(b => (
    <button
      className={selected ? "bg-primary text-white" : "bg-white border border-border-light"}
      ...
    >
      {b.name}
    </button>
  ))}
</div>
```

If branches.length > 12, fall back to a search-as-you-type combobox (open question — see [06](06-phases-and-metrics.md#open-questions)).

---

## 4.4 `ZoneChips`

Same pattern as branch chips, but with the fee inline:

```
┌────────────────────┐  ┌────────────────────┐
│ المعادي  ١٥ ج.م   │  │ المهندسين  ٢٠ ج.م │
└────────────────────┘  └────────────────────┘
```

Selected chip uses `bg-primary text-white`. Fee badge uses `tabular-nums text-xs`. Saves a click vs. the current `<select>` and lets the agent quote fees from a glance.

---

## 4.5 `NotesCollapsible`

```jsx
{!notesOpen ? (
  <button onClick={() => setNotesOpen(true)} className="text-sm text-primary">
    + أضف ملاحظة
  </button>
) : (
  <textarea ... />
)}
```

Removes vertical noise from the ~80% of orders that have no special notes.

---

## 4.6 Items catalog (`ItemsGrid`)

Replaces [`CallCenterNewOrderPage.jsx:332-397`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L332-L397).

### `SearchInput`
- Autofocus when branch is selected.
- Lucide `Search` icon trailing.
- Clears on `Esc` (handled by global keyboard layer — see [05](05-keyboard-and-a11y.md)).

### `CategoryTabs`
Segmented control with item counts:

```
┌───────────────┐ ┌───────────────────┐ ┌───────────────────┐
│ الكل  ٤٢      │ │ مشروبات  ١٢      │ │ حلويات  ٨        │
└───────────────┘ └───────────────────┘ └───────────────────┘
```

Counts come from the same `categories` memo — just precomputed per category.

### `ItemCard`
```
┌────────────────────────────────────┐
│ كابتشينو                           │  ← text-base font-semibold
│ ٤٥.٠٠ ج.م           [متوفر ١٢]    │  ← price text-sm tabular-nums + StockBadge
└────────────────────────────────────┘
```

**Stock badge tokens** (added to tailwind config):
- `bg-stock-ok/15 text-stock-ok` for `stock ≥ 5`
- `bg-stock-low/15 text-stock-low` for `1 ≤ stock ≤ 4`
- `bg-stock-out/15 text-stock-out` for `stock = 0`

Out-of-stock cards use `grayscale opacity-60` and disable click. Card stays visible so the agent can tell the customer "we're out of that today."

### Loading state
Replace the centered spinner with **6 skeleton cards** using `animate-pulse bg-accent/40`. Conveys "items are coming" without a layout shift on load.

### Empty state when no branch
```
┌────────────────────────────────────┐
│  ابدأ بـاختيار فرع                  │  ← text-lg font-semibold
│  ستظهر هنا الأصناف المتاحة         │  ← text-sm text-text-light/70
│  في المخزون                         │
└────────────────────────────────────┘
```

No illustration, no icon. Type-only.

---

## 4.7 `CartDrawer` (new)

Replaces [`CallCenterNewOrderPage.jsx:399-476`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L399-L476). Sticky-bottom container.

### Collapsed (default `h-16`)
```
┌─────────────────────────────────────────────────────────────┐
│  ٣ أصناف  ·  خصم ٠.٠٠  ·  توصيل ١٥.٠٠  ·  الإجمالي ١٢٥.٠٠ │  [إرسال →]
└─────────────────────────────────────────────────────────────┘
```

The cart-pulse animation fires on `total` when an item is added — `@keyframes cart-pulse { 0% { transform: scale(1) } 50% { transform: scale(1.06) } 100% { transform: scale(1) } }` for 200ms.

### Expanded (`max-h-96`, scroll inside)
- Header: total summary + close (`✕`).
- Line items, each with a `− qty +` stepper (44px touch targets) replacing today's `<input type="number">`.
- Per-line subtotal in `tabular-nums`.
- Remove icon (`Trash2` lucide).
- Discount panel (uses the existing `DiscountPanel compact` from [`components/pos/DiscountPanel`](../../../frontend/src/components/pos/DiscountPanel.jsx)) with type/value/reason on one row.

### Submit button
- Always visible in collapsed state, leading-side.
- Uses `bg-primary text-white` with `disabled:opacity-50` (today's behaviour).
- **Smart-disabled with reason:** instead of letting the user click and seeing a toast, render the disabled state and show a tooltip:
  > "اختر فرعاً أولاً" / "أضف صنف إلى السلة" / "أدخل رقم هاتف العميل" / etc.

  Reason is derived from the same checks as today's `handleSubmit` guards at [`CallCenterNewOrderPage.jsx:156-162`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L156-L162) — but moved to a `useMemo` `submitBlocker`.

### `Ctrl+Enter`
Triggers submit if `submitBlocker === null`. Keyboard handler lives at the page level — see [05](05-keyboard-and-a11y.md).

---

## 4.8 `Step` wrapper (new)

Tiny presentational component that gives column A its sequence cue:

```jsx
<Step number={1} label="الفرع" complete={!!branchId}>
  <BranchChips ... />
</Step>
```

Renders:
- A small numbered circle (active = `bg-primary text-white`, complete = `bg-stock-ok text-white` with check, pending = `border-border-light text-text-light/60`).
- Label in `text-sm font-medium`.
- A faint vertical line connects step circles.

Subtle, but turns a flat form into a journey.

---

## 4.9 Tailwind config additions

Append to `theme.extend.colors`:

```js
stock: {
  ok:  "#16A34A",   // green-600
  low: "#D97706",   // amber-600
  out: "#DC2626",   // red-600
},
"surface-raised": "#FAF8F5", // command bar bg, slightly lifted from #F5F5F0
```

Append to `theme.extend.keyframes` and `theme.extend.animation`:

```js
keyframes: {
  "cart-pulse": {
    "0%, 100%": { transform: "scale(1)" },
    "50%":      { transform: "scale(1.06)" },
  },
},
animation: {
  "cart-pulse": "cart-pulse 200ms ease-out",
},
```

No new fonts, no new shadows, no new breakpoints.

---

## 4.10 What stays unchanged

- `callCenterService` API contract (except the optional new fields on `searchClients`).
- `deliveryZoneService.getAll` filtering logic at [`CallCenterNewOrderPage.jsx:60-63`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L60-L63).
- `DiscountPanel` component itself — we just reposition it.
- Submission payload shape at [`CallCenterNewOrderPage.jsx:175-196`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L175-L196).
- Post-submit reset + items refresh at [`CallCenterNewOrderPage.jsx:200-214`](../../../frontend/src/pages/call-center/CallCenterNewOrderPage.jsx#L200-L214).

This is a **frontend-only** redesign with one minor optional backend tweak (customer search response).
