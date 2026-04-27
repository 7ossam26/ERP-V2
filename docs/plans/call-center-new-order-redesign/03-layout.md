# 03 — Layout

## Page structure (RTL, right-to-left reading)

```
┌──────────────────────────────────────────────────────────────────────┐
│  [Order Command Bar]   فرع: ٠ · عميل: — · أصناف: ٠ · الإجمالي: ٠.٠٠  │  sticky top — h-12
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──── COLUMN A (40%) ────┐  ┌────── COLUMN B (60%) ──────────────┐  │
│  │                        │  │                                    │  │
│  │  STEP 1  الفرع         │  │  ┌─ Tabs: الكل · مشروبات · ... ─┐  │  │
│  │  ▸ branch chips        │  │  │                              │  │  │
│  │                        │  │  ├─ Search bar (autofocus on    │  │  │
│  │  STEP 2  العميل        │  │  │    branch select)            │  │  │
│  │  ▸ phone (1.5×)        │  │  └──────────────────────────────┘  │  │
│  │  ▸ live results        │  │                                    │  │
│  │  ▸ inline new-customer │  │  Items grid 3–4 cols, large cards  │  │
│  │                        │  │  • name (text-base font-semibold)  │  │
│  │  STEP 3  التوصيل       │  │  • price (text-sm tabular-nums)    │  │
│  │  ▸ zone chips + fee    │  │  • stock badge (green/amber/red)   │  │
│  │  ▸ address textarea    │  │  • out-of-stock = desaturated      │  │
│  │  ▸ + add note          │  │                                    │  │
│  │                        │  │                                    │  │
│  └────────────────────────┘  └────────────────────────────────────┘  │
│                                                                      │
│  body: pb-24 to clear the bottom drawer                              │
├──────────────────────────────────────────────────────────────────────┤
│  [Cart Drawer] (sticky bottom, h-16 collapsed / max-h-96 expanded)   │
│  ٣ أصناف · خصم ٠.٠٠ · توصيل ١٥.٠٠ · الإجمالي ١٢٥.٠٠   [إرسال →]    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Why two columns instead of three

The current 3 equal columns force the items grid into 1/3 of the screen. Items are the densest content on the page (could be 60+ SKUs), so they should take the most space. Form fields are linear and benefit from a narrower column anyway.

**Sizing:**
- Column A: `lg:col-span-5` of a 12-col grid (~40%)
- Column B: `lg:col-span-7` (~60%)
- Mobile (`< lg`): single column, command bar stays sticky, cart drawer collapses to a thinner footer.

---

## Why a sticky command bar

The current page leaves "did I pick a branch?" as a question the agent has to answer by scrolling. The command bar makes the four most important pieces of order state ambient — visible without thought:

1. Branch
2. Customer
3. Item count
4. Total

It also doubles as a scrolling jump-nav: clicking a segment focuses its section.

---

## Why a bottom cart drawer

Two reasons:

1. **Submit must always be one click away.** When the cart grows past 4–5 items, the current third-column submit disappears below the fold on a 1080p screen. A sticky bottom drawer guarantees the CTA is reachable.
2. **Cart is a *result*, not a *form*.** Putting it at the bottom of the visual flow matches the mental model: form fields above, total below. The current layout (cart on the leading side, form fields trailing) inverts the natural order in RTL.

**Drawer states:**
- **Collapsed** (default): `h-16`, single line — `N أصناف · خصم · توصيل · الإجمالي · [إرسال]`.
- **Expanded** (clicked or `Ctrl+K`): line items, per-line steppers, full discount panel. Animates with `slide-down` reversed.
- Click outside or `Esc` collapses.

---

## Spacing rhythm

Use Tailwind's 4px base. Sections in column A separated by `space-y-6`. Inputs use `py-3` (instead of the current `p-2`) so touch targets clear the 44px floor (`minHeight: touch` already in config). Cards in column B use `gap-3`.

---

## Responsive behaviour

| Breakpoint | Layout |
|---|---|
| `lg` (≥1024px) | 2-column body, command bar sticky, drawer sticky bottom. **Primary target.** |
| `md` (768–1023px) | 1-column. Column A above, Column B below. Command bar still sticky. Drawer still sticky. |
| `sm` (<768px) | Same as md. Drawer becomes a full-screen sheet when expanded (`fixed inset-0`). |

We are not optimising for phones — agents work on desktops or tablets — but the page must not break on a Surface or iPad in landscape.

---

## What changes vs. today's layout

| Today | Tomorrow |
|---|---|
| 3 equal `lg:grid-cols-3` columns | `lg:grid-cols-12` with 5/7 split |
| Cart on leading side (RTL right→) | Cart at bottom (sticky drawer) |
| No persistent state indicator | Sticky `OrderCommandBar` |
| Items grid 2 cols | Items grid `sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4` |
| Notes always visible | Notes collapsed behind "+" link |
| Discount inside totals block | Discount in expanded cart drawer, prominent |

---

## Mock with token annotations

```
┌─────────────────────────────────────────────────┐
│ bg-surface-light  border-b border-border-light  │ ← OrderCommandBar
│ shadow-soft  h-12  px-6  text-sm                │
└─────────────────────────────────────────────────┘
┌──── bg-surface-light p-6 ────┐ ┌─ bg-surface-light p-6 ─┐
│ rounded-xl                   │ │ rounded-xl              │
│ border border-border-light   │ │ border border-border-l. │
│                              │ │                         │
│ <Step n=1 label="الفرع">     │ │ <SearchInput autofocus> │
│ <BranchChips>                │ │ <CategoryTabs>          │
│                              │ │ <ItemsGrid cols=3-4>    │
│ <Step n=2 label="العميل">    │ │                         │
│ <PhoneField large>           │ │                         │
│ <CustomerResults>            │ │                         │
│ <NewCustomerInline>          │ │                         │
│                              │ │                         │
│ <Step n=3 label="التوصيل">   │ │                         │
│ <ZoneChips>                  │ │                         │
│ <AddressTextarea>            │ │                         │
│ <NotesCollapsible>           │ │                         │
└──────────────────────────────┘ └─────────────────────────┘
┌─────────────────────────────────────────────────┐
│ bg-surface-light  border-t border-border-light  │ ← CartDrawer (collapsed)
│ shadow-soft (inverted)  h-16  px-6              │
└─────────────────────────────────────────────────┘
```
