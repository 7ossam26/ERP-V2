import React, { useCallback, useEffect, useRef } from "react";

// `autoProducible` is what the item's BOM can still make from raw materials.
// Made-to-order products sit at zero on-hand, so without it they'd all read نفد.
const StockBadge = ({ stock, autoProducible = 0 }) => {
  const producible = Number(autoProducible) || 0;
  const madeToOrder = producible > 0 && (
    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
      +{Math.floor(producible)} إنتاج تلقائي
    </span>
  );

  if (stock >= 5)
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-xs px-1.5 py-0.5 rounded bg-stock-ok/15 text-stock-ok font-medium tabular-nums">
          متوفر {stock}
        </span>
        {madeToOrder}
      </span>
    );
  if (stock >= 1)
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-xs px-1.5 py-0.5 rounded bg-stock-low/15 text-stock-low font-medium tabular-nums">
          أخير {stock}
        </span>
        {madeToOrder}
      </span>
    );
  if (producible > 0)
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-stock-low/15 text-stock-low font-medium">
        يُحضَّر عند الطلب
      </span>
    );
  return (
    <span className="text-xs px-1.5 py-0.5 rounded bg-stock-out/15 text-stock-out font-medium">
      نفد
    </span>
  );
};

const SkeletonCards = () => (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div
        key={i}
        className="rounded-lg border border-border-light dark:border-border-dark p-3 animate-pulse"
      >
        <div className="h-4 bg-accent/60 dark:bg-accent-dark/60 rounded mb-2 w-3/4" />
        <div className="h-3 bg-accent/40 dark:bg-accent-dark/40 rounded w-1/2" />
      </div>
    ))}
  </div>
);

const ItemsGrid = ({ items, cart, loading, branchId, readyForPos, lockedReason, onAdd }) => {
  // Roving tabindex: track the focused card index
  const focusedIndexRef = useRef(0);
  const gridRef = useRef(null);

  // Keep data-cols in sync with actual computed column count
  useEffect(() => {
    if (!gridRef.current || typeof ResizeObserver === "undefined") return;
    const updateCols = () => {
      const grid = gridRef.current;
      if (!grid) return;
      const computed = getComputedStyle(grid).gridTemplateColumns;
      const cols = computed.split(" ").length;
      grid.dataset.cols = String(cols);
    };
    const ro = new ResizeObserver(updateCols);
    ro.observe(gridRef.current);
    updateCols();
    return () => ro.disconnect();
  }, []);

  const getCards = () =>
    gridRef.current ? Array.from(gridRef.current.querySelectorAll("[data-card]")) : [];

  const moveFocus = useCallback((delta) => {
    const cards = getCards();
    if (!cards.length) return;
    const next = Math.max(0, Math.min(cards.length - 1, focusedIndexRef.current + delta));
    focusedIndexRef.current = next;
    // Reset all tabindex, set active
    cards.forEach((el, i) => el.setAttribute("tabindex", i === next ? "0" : "-1"));
    cards[next]?.focus();
  }, []);

  const handleGridKeyDown = useCallback(
    (e) => {
      // Number of columns depends on grid layout — use data-col-count attr or default 3
      const cols = parseInt(gridRef.current?.dataset.cols || "3");
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          moveFocus(cols);
          break;
        case "ArrowUp":
          e.preventDefault();
          moveFocus(-cols);
          break;
        // RTL: ArrowLeft = forward (higher index), ArrowRight = back (lower index)
        case "ArrowLeft":
          e.preventDefault();
          moveFocus(1);
          break;
        case "ArrowRight":
          e.preventDefault();
          moveFocus(-1);
          break;
        default:
          break;
      }
    },
    [moveFocus]
  );

  const handleCardFocus = (index) => {
    focusedIndexRef.current = index;
  };

  if (!branchId)
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-light bg-surface-raised/60 px-6 py-16 text-center dark:border-border-dark dark:bg-surface-dark/40">
        <p className="text-base font-semibold text-text-light/60 dark:text-text-dark/60">
          ابدأ باختيار فرع
        </p>
        <p className="text-sm text-text-light/40 dark:text-text-dark/40">
          ستظهر الأصناف المتاحة في المخزون هنا
        </p>
      </div>
    );

  if (!readyForPos)
    return (
      <div className="flex min-h-[340px] flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-primary/25 bg-primary/[0.04] px-6 py-16 text-center dark:bg-primary/[0.08]">
        <p className="text-base font-extrabold text-text-light dark:text-text-dark">
          أكمل بيانات العميل والتوصيل أولاً
        </p>
        <p className="text-sm font-semibold text-primary">
          {lockedReason}
        </p>
      </div>
    );

  if (loading) return <SkeletonCards />;

  if (!items.length)
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-light bg-surface-raised/60 px-6 py-16 text-center dark:border-border-dark dark:bg-surface-dark/40">
        <p className="text-sm text-text-light/50 dark:text-text-dark/50">
          لا توجد أصناف تطابق البحث
        </p>
      </div>
    );

  return (
    <div
      ref={gridRef}
      role="grid"
      aria-label="الأصناف المتاحة"
      data-cols="3"
      className="grid grid-cols-3 gap-3"
      onKeyDown={handleGridKeyDown}
    >
      {items.map((it, index) => {
        const inCart = cart.find((c) => c.itemId === it.id);
        // Sellable = on-hand + what the BOM can still produce.
        const available = Number(it.available ?? ((it.stock || 0) + (it.autoProducible || 0)));
        const producible = Number(it.autoProducible) || 0;
        const outOfStock = available <= 0;
        const isFirstFocusable = index === 0;
        const isKg = it.unit === "kg";
        const formatCartQty = (n) =>
          isKg
            ? (n % 1 === 0 ? n.toFixed(0) : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, ""))
            : String(n);

        return (
          <button
            key={it.id}
            type="button"
            role="gridcell"
            data-card
            tabIndex={isFirstFocusable ? 0 : -1}
            disabled={outOfStock}
            onClick={() => !outOfStock && onAdd(it)}
            onFocus={() => handleCardFocus(index)}
            aria-label={`${it.name}، ${Number(it.price).toFixed(2)} جنيه${isKg ? " للكيلو" : ""}، ${
              outOfStock
                ? "نفد من المخزون"
                : it.stock > 0
                  ? `متاح ${available}`
                  : "يُحضَّر عند الطلب"
            }${inCart ? `، في السلة: ${formatCartQty(inCart.quantity)}${isKg ? " كجم" : ""}` : ""}`}
            className={`
              min-h-[96px] text-right p-3 rounded-lg border-2 transition-all duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1
              ${outOfStock
                ? "opacity-50 grayscale cursor-not-allowed border-border-light dark:border-border-dark"
                : inCart
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border-light dark:border-border-dark hover:border-primary/60 hover:bg-primary/5"
              }
            `}
          >
            <div className="flex items-start justify-between gap-1 mb-1.5">
              <p className="text-sm font-semibold text-text-light dark:text-text-dark leading-snug">
                {it.name}
              </p>
              {inCart && (
                <span
                  className={`flex-shrink-0 text-[10px] bg-primary text-white rounded-full px-1.5 h-5 inline-flex items-center justify-center font-bold tabular-nums ${isKg ? "min-w-[20px]" : "w-5"}`}
                >
                  {formatCartQty(inCart.quantity)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium tabular-nums text-text-light dark:text-text-dark">
                {Number(it.price).toFixed(2)}{" "}
                <span className="text-xs text-text-light/50 dark:text-text-dark/50">
                  ج.م{isKg ? " / كجم" : ""}
                </span>
              </span>
              <StockBadge stock={it.stock} autoProducible={producible} />
            </div>
          </button>
        );
      })}
    </div>
  );
};

export { StockBadge };
export default ItemsGrid;
