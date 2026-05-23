import React from "react";
import { Trash2, Send, ShoppingCart, Scale } from "lucide-react";
import DiscountPanel from "../../../components/pos/DiscountPanel";

const formatQty = (qty, unit) => {
  const n = Number(qty) || 0;
  if (unit === "kg") {
    return n % 1 === 0
      ? n.toFixed(0)
      : n.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }
  return String(n);
};

const LineItem = ({ c, onUpdateQty, onEditKg }) => {
  const isKg = c.unit === "kg";
  return (
    <li
      className="flex items-start gap-2 py-3 border-b border-dashed border-border-light/70 dark:border-border-dark/70 last:border-b-0"
      dir="rtl"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-light dark:text-text-dark leading-tight truncate">
          {c.name}
        </p>
        <p className="text-[11px] text-text-light/50 dark:text-text-dark/50 tabular-nums mt-0.5">
          {Number(c.price).toFixed(2)} × {formatQty(c.quantity, c.unit)}
          {isKg ? " كجم" : ""}
        </p>
      </div>

      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <span className="text-sm font-bold tabular-nums text-text-light dark:text-text-dark">
          {(c.price * c.quantity).toFixed(2)}
        </span>
        <div className="flex items-center gap-0.5">
          {isKg ? (
            <>
              <button
                type="button"
                onClick={() => onEditKg?.(c.itemId)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-primary hover:bg-primary hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label={`تعديل وزن ${c.name}`}
                title="تعديل الوزن"
              >
                <Scale size={11} />
                <span>{formatQty(c.quantity, "kg")} كجم</span>
              </button>
              <button
                type="button"
                onClick={() => onUpdateQty(c.itemId, 0)}
                className="ml-1 w-6 h-6 flex items-center justify-center rounded text-text-light/30 dark:text-text-dark/30 hover:text-stock-out hover:bg-stock-out/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stock-out"
                aria-label={`حذف ${c.name}`}
              >
                <Trash2 size={11} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onUpdateQty(c.itemId, c.quantity - 1)}
                className="w-6 h-6 flex items-center justify-center rounded text-text-light/60 dark:text-text-dark/60 hover:bg-primary hover:text-white text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                aria-label={`تقليل ${c.name}`}
              >
                −
              </button>
              <span className="w-5 text-center text-xs font-bold tabular-nums">
                {c.quantity}
              </span>
              <button
                type="button"
                onClick={() => onUpdateQty(c.itemId, c.quantity + 1)}
                disabled={c.quantity >= c.stock}
                className="w-6 h-6 flex items-center justify-center rounded text-text-light/60 dark:text-text-dark/60 hover:bg-primary hover:text-white text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-light/60"
                aria-label={`زيادة ${c.name}`}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => onUpdateQty(c.itemId, 0)}
                className="ml-1 w-6 h-6 flex items-center justify-center rounded text-text-light/30 dark:text-text-dark/30 hover:text-stock-out hover:bg-stock-out/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stock-out"
                aria-label={`حذف ${c.name}`}
              >
                <Trash2 size={11} />
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
};

const CartDrawer = ({
  cart,
  onUpdateQty,
  onEditKg,
  subtotal,
  deliveryFee,
  discountType,
  discountInput,
  discountReason,
  discountAmount,
  total,
  onDiscountChange,
  onSubmit,
  submitting,
  submitBlocker,
  lastAddedId,
}) => {
  const hasItems = cart.length > 0;

  return (
    <aside
      role="region"
      aria-label="ملخص الطلب"
      className="flex flex-col h-full bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-soft overflow-hidden"
    >
      {/* Receipt header — typewriter section label */}
      <header
        className="flex-shrink-0 flex items-baseline justify-between px-5 pt-4 pb-3 bg-surface-raised dark:bg-surface-dark/60 border-b border-dashed border-border-light dark:border-border-dark"
        dir="rtl"
      >
        <div className="flex items-center gap-2">
          <ShoppingCart size={13} className="text-primary" />
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-light dark:text-text-dark">
            السلة
          </h2>
        </div>
        {hasItems && (
          <span className="text-[10px] font-mono tabular-nums text-text-light/50 dark:text-text-dark/50">
            #{String(cart.length).padStart(2, "0")}
          </span>
        )}
      </header>

      {/* Items list — scrollable */}
      <div className="flex-1 overflow-y-auto px-5" dir="rtl">
        {hasItems ? (
          <ul className="list-none m-0 p-0">
            {cart.map((c) => (
              <LineItem
                key={c.itemId}
                c={c}
                onUpdateQty={onUpdateQty}
                onEditKg={onEditKg}
              />
            ))}
          </ul>
        ) : (
          <div className="my-5 flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-border-light bg-surface-raised/60 px-5 py-12 text-center dark:border-border-dark dark:bg-surface-dark/40">
            <ShoppingCart
              size={32}
              strokeWidth={1.25}
              className="text-text-light/15 dark:text-text-dark/15 mb-3"
            />
            <p className="text-xs text-text-light/40 dark:text-text-dark/40 leading-relaxed max-w-[180px]">
              ابدأ بإضافة الأصناف من الكتالوج لتظهر هنا
            </p>
          </div>
        )}
      </div>

      {/* Discount panel */}
      {hasItems && (
        <div
          className="flex-shrink-0 px-5 py-3 border-t border-dashed border-border-light dark:border-border-dark"
          dir="rtl"
        >
          <DiscountPanel
            subtotal={subtotal}
            discountType={discountType}
            discountValue={discountInput}
            discountReason={discountReason}
            onChange={onDiscountChange}
            compact
          />
        </div>
      )}

      {/* Totals strip — double border = receipt ledger separator */}
      <div
        className="flex-shrink-0 px-5 py-3 bg-primary/[0.04] dark:bg-primary/[0.08] border-t-2 border-double border-primary/30"
        dir="rtl"
      >
        {hasItems && (
          <div className="space-y-1 text-xs tabular-nums text-text-light/70 dark:text-text-dark/70">
            <div className="flex justify-between">
              <span>المجموع</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-stock-out">
                <span>خصم</span>
                <span>−{discountAmount.toFixed(2)}</span>
              </div>
            )}
            {deliveryFee > 0 && (
              <div className="flex justify-between">
                <span>توصيل</span>
                <span>+{deliveryFee.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}
        <div
          className={`flex items-baseline justify-between mt-2 pt-2 border-t border-dashed border-primary/30 ${
            lastAddedId ? "animate-cart-pulse" : ""
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-text-light dark:text-text-dark">
            الإجمالي
          </span>
          <span className="text-2xl font-bold tabular-nums text-text-light dark:text-text-dark leading-none">
            {total.toFixed(2)}
            <span className="text-xs font-medium text-text-light/50 dark:text-text-dark/50 mr-1">
              ج.م
            </span>
          </span>
        </div>
      </div>

      {/* Submit zone */}
      <div className="flex-shrink-0 p-3 bg-surface-raised dark:bg-surface-dark/80 border-t border-border-light dark:border-border-dark">
        <div className="relative group">
          <button
            type="button"
            onClick={!submitBlocker ? onSubmit : undefined}
            disabled={!!submitBlocker || submitting}
            aria-disabled={!!submitBlocker || submitting}
            aria-describedby={submitBlocker ? "submit-blocker-tip" : undefined}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-primary text-white text-sm font-bold tracking-wide shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {submitting ? (
              <span>جارٍ الإرسال...</span>
            ) : (
              <>
                <Send size={14} />
                <span>إرسال الطلب</span>
              </>
            )}
          </button>
          {submitBlocker && (
            <span
              id="submit-blocker-tip"
              role="tooltip"
              className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-text-light dark:bg-text-dark text-white dark:text-text-light text-xs rounded-md px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-md"
            >
              {submitBlocker}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
};

export default CartDrawer;
