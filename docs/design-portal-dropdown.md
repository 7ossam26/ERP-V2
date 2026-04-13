# Design: Portal-Rendered Item Dropdown (Purchase Invoice)

## Understanding Summary

- **What**: Fix the item search dropdown in the purchase invoice items table so it is never clipped or unreachable
- **Why**: The current dropdown is absolute-positioned inside each table row — it gets clipped by ancestor overflow/z-index when multiple rows exist, making item selection impossible
- **Who**: ERP purchasing staff filling in purchase invoices
- **Constraint**: React + Tailwind, no new dependencies, white/light mode only
- **Non-goal**: Redesigning the invoice layout, changing item loading logic, or adding dark mode to the dropdown

## Assumptions

- White/light mode only — all `dark:` classes removed from the portal dropdown
- No third-party UI libraries added
- Existing search-as-you-type behavior preserved exactly
- `getAvailableItems`, `handleItemSelect`, `itemSearches`, `openItemDropdown` logic unchanged
- Max 40 items shown in dropdown (existing behavior kept)

---

## Decision Log

| # | Decision | Alternatives Considered | Reason |
|---|----------|------------------------|--------|
| 1 | Portal-rendered dropdown | Modal item picker, CSS overflow fix | Minimal UX disruption — users see no change, the dropdown just stops getting clipped. Modal adds extra click; CSS fix is fragile and layout-dependent |
| 2 | `position: fixed` with `getBoundingClientRect()` | `position: absolute` with portal | Fixed positioning is simpler — no need to account for scroll offsets in positioning math |
| 3 | White mode only | Full dark mode support | User confirmed white mode is sufficient |
| 4 | Scroll/resize listeners while open | No repositioning | Dropdown must track the input if the page scrolls while it's open |

---

## Final Design

### File to modify

`frontend/src/pages/purchases/PurchasesPage.jsx`

### Changes Overview

#### 1. Add import

```js
import { createPortal } from "react-dom";
```

#### 2. Add new state and refs (alongside existing state)

```js
const inputRefs = useRef({});
const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
```

#### 3. Add position calculator helper

```js
const updateDropdownPos = (rowId) => {
  const el = inputRefs.current[rowId];
  if (!el) return;
  const rect = el.getBoundingClientRect();
  setDropdownPos({
    top: rect.bottom + 4,
    left: rect.left,
    width: rect.width,
  });
};
```

#### 4. Add scroll/resize effect

```js
useEffect(() => {
  if (!openItemDropdown) return;

  const reposition = () => updateDropdownPos(openItemDropdown);

  window.addEventListener("scroll", reposition, true); // capture phase
  window.addEventListener("resize", reposition);

  return () => {
    window.removeEventListener("scroll", reposition, true);
    window.removeEventListener("resize", reposition);
  };
}, [openItemDropdown]);
```

#### 5. Update each item row's search input

Add ref callback:

```jsx
ref={(el) => (inputRefs.current[item.id] = el)}
```

Update `onFocus` to also calculate position:

```jsx
onFocus={() => {
  setOpenItemDropdown(item.id);
  updateDropdownPos(item.id);
}}
```

#### 6. Replace inline dropdown with portal

Remove the current `{openItemDropdown === item.id && <div className="absolute z-50 ...">}` block from inside each table row.

Add a single portal render **outside the table** (at the end of the component return, before the closing fragment):

```jsx
{openItemDropdown &&
  createPortal(
    <div
      style={{
        position: "fixed",
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        zIndex: 9999,
      }}
      className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto"
    >
      {getAvailableItems(openItemDropdown)
        .filter((ai) =>
          ai.name
            .toLowerCase()
            .includes(
              (itemSearches[openItemDropdown] || "").toLowerCase()
            )
        )
        .slice(0, 40)
        .map((ai) => (
          <div
            key={ai.id}
            onMouseDown={() =>
              handleItemSelect(openItemDropdown, ai)
            }
            className="px-3 py-2 cursor-pointer hover:bg-primary/10 flex justify-between items-center text-sm border-b border-gray-100 last:border-0"
          >
            <span className="font-medium text-text-light">
              {ai.name}
            </span>
            <span className="text-xs text-gray-400 shrink-0 mr-2">
              {parseFloat(ai.costPrice) > 0
                ? `${parseFloat(ai.costPrice).toFixed(2)} ج.م`
                : ai.unit}
            </span>
          </div>
        ))}
      {getAvailableItems(openItemDropdown).filter((ai) =>
        ai.name
          .toLowerCase()
          .includes(
            (itemSearches[openItemDropdown] || "").toLowerCase()
          )
      ).length === 0 && (
        <div className="px-3 py-3 text-center text-gray-400 text-sm">
          لا توجد نتائج
        </div>
      )}
    </div>,
    document.body
  )}
```

### What stays the same

- `allItems` loading from API
- `itemSearches` state and onChange handler
- `openItemDropdown` state (open/close logic)
- `handleItemSelect` function
- `getAvailableItems` filtering (excludes already-selected items)
- `onBlur` with 150ms delay to allow click
- Search icon inside input
- All input styling

---

## Implementation Checklist

- [ ] Add `createPortal` import
- [ ] Add `inputRefs` ref and `dropdownPos` state
- [ ] Add `updateDropdownPos` helper
- [ ] Add scroll/resize `useEffect`
- [ ] Add `ref` callback to each item search input
- [ ] Update `onFocus` to call `updateDropdownPos`
- [ ] Remove inline dropdown from inside each table row
- [ ] Add single portal dropdown render outside the table
- [ ] Remove `dark:` classes from dropdown markup
- [ ] Test with 1 row, 3+ rows, and scrolled page
