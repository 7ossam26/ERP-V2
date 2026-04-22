# Bulk Module — Brand Alignment & Information-Architecture Plan

> **Scope:** restyle the 7 bulk pages to the coffee-house brand identity, merge POS + Collections under a single "الجملة" entry, move bulk customers into the Creates (تكويدات) dashboard, and move bulk reports into the Detailed Reports page at `/reports/detailed`.
>
> **Status:** design approved pending 3 open confirmations in §8.
> **No code has been written yet** — this document is the execution contract.

---

## 1. Design Direction Summary

**Aesthetic name:** *Café-Ledger* — warm coffeehouse minimalism meets ledger-precision typography.

**DFII Score: 13 / 15**

| Dimension | Score | Note |
|---|---|---|
| Aesthetic Impact | 4 | Coffee palette is already the brand anchor; doubling down in bulk makes it ownable. |
| Context Fit | 5 | ERP for a coffee shop — identity should be legible on every screen. |
| Implementation Feasibility | 4 | All tokens already exist in `frontend/tailwind.config.js`. |
| Performance Safety | 4 | No new animation libs, CSS-only. |
| Consistency Risk | −4 | Pattern already proven in `MainDashboard.jsx`, `DetailedReportsPage.jsx`. |

**Differentiation anchor** — what makes a screenshot recognizable without the logo:

- Primary coffee `#6F4E37` replaces every `blue-600` CTA — **no generic blue anywhere in bulk**.
- Pill-shaped status chips with an inset ring replace flat `bg-blue-100` boxes.
- Brand tokens (`bg-surface-light`, `border-border-light`, `shadow-soft`) replace raw `white / gray-100 / border`.
- `hover:-translate-y-0.5` on action cards + `ring-primary/30` focus — the same micro-motion the dashboard already uses.

> **This avoids generic SaaS/Tailwind defaults by removing every `blue-*`, `gray-*`, and raw `border` class from bulk and remapping them to the coffee design tokens already defined in `tailwind.config.js`.**

---

## 2. Design System Snapshot (reuse-only, no new tokens)

All tokens live in `frontend/tailwind.config.js` today. The plan uses them exclusively — it does **not** introduce new tokens.

| Role | Token | Used for |
|---|---|---|
| Primary CTA | `bg-primary hover:bg-primary-hover text-white` | "فاتورة جديدة", "حفظ", "تأكيد نقدي", "عرض" |
| Secondary / outline | `border border-primary/30 text-primary hover:bg-primary/5` | "عرض سعر", "مسودة", "تعديل", tab-active |
| Destructive | `border border-red-300 text-red-700 hover:bg-red-50` | "إلغاء الطلب", "حذف" |
| Warning / quote | `border border-amber-400/60 text-amber-700 hover:bg-amber-50` | "تأكيد آجل", quote status |
| Success (state, not CTA) | `text-emerald-700`, `bg-emerald-50` | paid-amount cells, "مسجلة" chip |
| Surface | `bg-surface-light dark:bg-surface-dark` | cards, form panels |
| Card border | `border border-border-light dark:border-border-dark` | every card + table wrapper |
| Elevation | `shadow-soft dark:shadow-soft-dark` | every card |
| Filter input | `bg-surface-light border-border-light rounded-xl focus:ring-2 focus:ring-primary/30 focus:border-primary` | all selects/inputs |
| Table header | `bg-accent/30 dark:bg-primary/10 text-text-light/80` | replaces `bg-gray-100` |
| Row hover | `hover:bg-accent/20 dark:hover:bg-primary/10` | replaces `hover:bg-gray-50` |
| Tab active | `border-b-2 border-primary text-primary` | replaces `border-blue-600 text-blue-600` |
| Status chip | `inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ring-1 ring-inset` + per-state hue | table status cells |
| KPI card | `bg-surface-light border border-border-light rounded-xl p-4 shadow-soft`, `text-text-light/60` label + `text-primary font-bold text-xl` value; highlight: `bg-primary/5 border-primary/30` | summary cards |

**Typography:** Cairo is already global (`font-body`). Page titles move from `text-2xl font-bold` to `text-2xl sm:text-3xl font-bold text-text-light dark:text-text-dark` plus the 24-wide `h-1.5 bg-primary rounded-full` underline used on `MainDashboard.jsx:69`, to tie bulk to the rest of the app visually.

**Motion:** only two — `transition-colors duration-200` on interactive elements, `hover:-translate-y-0.5` on action cards/chips only. No shadow pulsing, no scale-102.

---

## 3. Information-Architecture Changes (structural — land first)

### 3.1 Consolidate under "جملة"

In `frontend/src/config/modules.js`:

- **Delete** management entries: `bulk_customers`, `bulk_collections`, `bulk_reports`.
- **Rename** `bulk_pos` → label `"الجملة"`, description `"نقاط البيع والتحصيلات"`, keep `icon: "store"`, keep `path: "/bulk/pos"`.
- **Add** a CREATION entry `bulk_customers` → label `"عملاء الجملة"`, icon `business`, path `/bulk/customers`, code `BULK_CUSTOMERS`. It will appear on `CreatesDashboard` automatically because that page reads `getCreationModules()`.

### 3.2 Internal sub-nav for POS ↔ Collections

One sidebar entry, two routes. Add a tiny branded tab strip rendered at the top of both pages:

- **نقطة البيع** → `/bulk/pos`
- **التحصيلات** → `/bulk/collections`
- auxiliary link: **الطلبات** → `/bulk/orders`

Keeps both pages as **separate URLs** (deep links preserved), but visually grouped. Implemented as `frontend/src/components/bulk/BulkSectionTabs.jsx` using `NavLink` with `border-b-2 border-primary` active state.

### 3.3 Move bulk reports into detailed reports

- **Remove** `/bulk/reports` route from `App.jsx`.
- Remove the `BulkReportsPage` import there.
- **Add** one entry to the `reports` array in `DetailedReportsPage.jsx`:

```js
{
  title: "تقارير الجملة",
  description: "مبيعات وتقادم الذمم وكشف الحساب",
  icon: "analytics",
  path: "/reports/bulk",
  color: "text-amber-700",
  bg: "bg-amber-100",
  darkBg: "dark:bg-amber-900/20",
}
```

- **Re-register** the page at `/reports/bulk` under the `REPORTS` permission (the same ACL the other detailed reports use — **not** `BULK_POS`).
- The page body itself adopts the `DetailedReportsPage` container (`bg-background-light min-h-screen p-6`, `max-w-7xl mx-auto`) and gets a back-link `← عودة للسجلات التفصيلية` → `/reports/detailed`.

### 3.4 Route summary after the change

| Path | Status | Sidebar label | ACL |
|---|---|---|---|
| `/bulk/pos` | kept | "الجملة" → POS tab | `BULK_POS` |
| `/bulk/collections` | kept | "الجملة" → Collections tab | `BULK_POS` |
| `/bulk/orders`, `/bulk/orders/:id` | kept | (deep-link from POS) | `BULK_POS` |
| `/bulk/customers`, `/bulk/customers/:id` | moved to Creates card | CreatesDashboard | `BULK_POS` / `BULK_CUSTOMERS` |
| `/reports/bulk` | **new** | from DetailedReports card | `REPORTS` |
| `/bulk/reports` | **removed** | — | — |

---

## 4. Global Class Remap (applied everywhere in bulk)

| Old | New |
|---|---|
| `bg-blue-600 hover:bg-blue-700 text-white` | `bg-primary hover:bg-primary-hover text-white` |
| `text-blue-600 hover:underline` | `text-primary hover:text-primary-hover font-medium` |
| `bg-green-600 hover:bg-green-700 text-white` | `bg-primary hover:bg-primary-hover text-white` (primary CTA) or `bg-emerald-600 hover:bg-emerald-700` only when semantically "success" (e.g. confirm-cash) |
| `border rounded-md p-2` (inputs) | `border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary` |
| `bg-white dark:bg-gray-800 border rounded-lg` (cards) | `bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-soft dark:shadow-soft-dark` |
| `bg-gray-100 dark:bg-gray-700` (table head) | `bg-accent/30 dark:bg-primary/10 text-text-light/80` |
| `hover:bg-gray-50 dark:hover:bg-gray-700` (rows) | `hover:bg-accent/20 dark:hover:bg-primary/10` |
| inline `{bg-gray-200, bg-amber-100, bg-blue-100, bg-green-100, bg-red-100, bg-purple-100}` chips | `<StatusChip status={...} />` (see §5) |

---

## 5. Per-File Styling Plan

### 5.1 `BulkPOSPage.jsx`

- Mount `<BulkSectionTabs active="pos" />` above the grid.
- Catalog buttons: `hover:bg-blue-50` → `hover:border-primary hover:bg-primary/5`; contract-price badge becomes `bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] ring-1 ring-primary/20`.
- Cart actions: `مسودة` = ghost primary; `عرض سعر` = amber outline (kept); `تأكيد` = primary (was green).
- Totals block: wrap in `bg-accent/20 rounded-xl p-3`; grand-total row uses `text-primary font-bold text-lg`.

### 5.2 `BulkCollectionsPage.jsx`

- Mount `<BulkSectionTabs active="collections" />`.
- Replace the bare red sum with a `<SummaryCard label="إجمالي المتبقي" tone="danger" />`.
- Filter `<select>` adopts the new input token.
- Status column → `<StatusChip status={o.status} />`.

### 5.3 `BulkOrdersListPage.jsx`

- "فاتورة جديدة" → `bg-primary`.
- Drop inline `STATUS_COLORS` dict — use the shared `<StatusChip>`.
- Row number link → `text-primary font-semibold`.

### 5.4 `BulkOrderDetailPage.jsx`

- Header action bar re-colored:
  - `إلغاء الطلب` → destructive outline (kept)
  - `تأكيد آجل` → amber outline (kept)
  - `تأكيد نقدي` → primary
  - `سجّل دفعة` → primary
  - `إرجاع` → orange outline (kept)
  - `طباعة` → `bg-primary/90 hover:bg-primary text-white`
- Info cards + totals card use `shadow-soft border-border-light rounded-xl`.
- Totals wrapped in the same accent block as §5.1.

### 5.5 `BulkCustomersListPage.jsx` *(now under Creates)*

- Page title block gets the `h-1.5 w-24 bg-primary` underline used on Creates pages.
- "إضافة عميل" → `bg-primary`. Inline form panel → `bg-surface-light shadow-soft rounded-xl`.
- Table head → accent tokens. "عرض" → `text-primary`.
- Empty state: `material-symbols-outlined` `business` at `text-6xl text-primary/20`.

### 5.6 `BulkCustomerDetailPage.jsx`

- Tabs: `border-primary` when active (currently `border-blue-600`). Same pattern as §5.7 tabs.
- "فاتورة جديدة", "تعديل", "حفظ" CTAs → primary.
- AR summary cards → shared `<SummaryCard>` from §5 so bulk reports and customer-AR render identically.
- Contract-prices tab: table-head accent tokens; "حفظ التغييرات" → primary.

### 5.7 `BulkReportsPage.jsx` *(now at `/reports/bulk`)*

- Wrap page body in the `DetailedReportsPage`-style container (`bg-background-light min-h-screen p-6`, `max-w-7xl mx-auto`) + back-link to `/reports/detailed`.
- Remap local `SummaryCard`: `highlight` from `border-blue-300 bg-blue-50` → `border-primary/40 bg-primary/5`; value text `text-gray-900` → `text-primary`.
- `DateRangeFilter` "عرض" button → primary. Inputs → token.
- Tab bar: blue → primary.
- Entry-type chips (ORDER / PAYMENT / REFUND) → shared `<StatusChip>` with neutral / emerald / purple tones.
- **No data-logic changes.**

---

## 6. Shared Primitives (introduced once, <30 LOC each)

All live in `frontend/src/components/bulk/`.

### 6.1 `StatusChip.jsx`

```jsx
<StatusChip status="CONFIRMED" />      // blue-ish tone
<StatusChip status="PAID" />           // emerald
<StatusChip status="DRAFT" />          // neutral
<StatusChip status="QUOTED" />         // amber
<StatusChip status="CANCELLED" />      // red
<StatusChip status="RETURNED" />       // purple
<StatusChip status="PARTIALLY_PAID" /> // amber-warm
```

Internal lookup of `{label, tone}`; tone maps to `ring-1 ring-inset ring-<c>/30 bg-<c>/10 text-<c>-700`. Eliminates three drifting inline dicts across bulk.

### 6.2 `SummaryCard.jsx`

Moves the KPI card out of `BulkReportsPage.jsx:43` into a shared component using brand tokens. Consumed by `BulkReportsPage`, `BulkCollectionsPage` header, and `BulkCustomerDetailPage` AR tab.

### 6.3 `BulkSectionTabs.jsx`

Branded `<NavLink>` tab strip for POS ↔ Collections (+ orders link).
Active: `text-primary border-b-2 border-primary`. Inactive: `text-text-light/60 hover:text-text-light`.
Sits directly beneath the page `<h1>` on both pages.

---

## 7. Execution Order (one PR, 8 atomic commits)

1. **Modules & routing** — edit `modules.js` + `App.jsx`: change `/bulk/reports` → `/reports/bulk`, move `bulk_customers` to CREATION, collapse the three management entries into one `bulk_pos` labelled "الجملة".
2. **Add the three primitives** — `StatusChip.jsx`, `SummaryCard.jsx`, `BulkSectionTabs.jsx`.
3. **Add the bulk entry in `DetailedReportsPage.jsx`.**
4. Restyle `BulkPOSPage` + mount `BulkSectionTabs`.
5. Restyle `BulkCollectionsPage` + mount `BulkSectionTabs` + `SummaryCard`.
6. Restyle `BulkOrdersListPage` + `BulkOrderDetailPage` with the new token map + `StatusChip`.
7. Restyle `BulkCustomersListPage` + `BulkCustomerDetailPage` (Creates context).
8. Restyle `BulkReportsPage` under the new `/reports/bulk` shell + back-link.

After step 8: run `npm run dev`, click through each route once, verify no blue-600 / gray-100 / raw-border classes remain in the bulk folder, confirm RTL + dark-mode parity on each page.

---

## 8. Open Confirmations Before Code Starts

1. Green-light to **delete the `/bulk/reports` route entirely** and rebind the page at `/reports/bulk` under the `REPORTS` permission (not `BULK_POS`).
2. OK to keep **`/bulk/pos` and `/bulk/collections` as separate URLs** (linked by a sub-nav) vs. merging them into a single page with internal tabs. Separate URLs is safer and preserves deep links.
3. Green-light on the **coffee-primary replacing every blue CTA** in bulk — including "سجّل دفعة" and "فاتورة جديدة" which are currently blue.

---

## 9. Operator Checklist

- [x] Clear aesthetic direction stated (*Café-Ledger*)
- [x] DFII ≥ 8 (scored 13)
- [x] One memorable design anchor (primary-replaces-all-blue + inset-ring status chips)
- [x] No generic fonts/colors/layouts (Cairo + coffee tokens, no Inter/blue)
- [x] Code will match design ambition (token remap + 3 shared primitives)
- [x] Accessible and performant (CSS-only motion, proper focus rings, RTL + dark-mode parity)

---

## 10. Differentiation Callout

This plan avoids a "generic SaaS bulk module" by:

- **Killing every `blue-*` / `gray-*` class** in the bulk folder — all interactive surfaces route through `primary` + `accent` + `border-light` tokens.
- **Replacing raw `bg-white border rounded-lg`** (used ~30× across the files) with the `shadow-soft` + `border-border-light` + `rounded-xl` triad that the rest of the app already uses.
- **Consolidating four inline status-color dicts** into one branded `StatusChip` with ring-inset — a visual signature the sales/purchases pages don't have yet, giving bulk a recognisable chip style.
- **Anchoring "الجملة" as one destination** — one sidebar label with an internal branded sub-nav — so POS and Collections feel like one product, not four siblings.
