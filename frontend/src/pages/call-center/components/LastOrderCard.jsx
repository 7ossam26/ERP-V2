import React, { useState } from "react";
import { ChevronDown, History, Info, Lock, RotateCcw } from "lucide-react";
import { formatQty } from "../callCenterReorder";

const VISIBLE_LINES = 4;

const CHANNEL_LABELS = {
  CALL_CENTER: "كول سنتر",
  POS: "الكاشير",
  WHATSAPP: "واتساب",
  WEB: "الموقع",
  AGGREGATOR: "تطبيقات التوصيل",
};

const formatRelative = (date) => {
  const rtf = new Intl.RelativeTimeFormat("ar-EG", { numeric: "auto" });
  const minutes = Math.round((new Date(date).getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return rtf.format(months, "month");
  return rtf.format(Math.round(months / 12), "year");
};

const isOrderable = (line) => line.status === "ok" || line.status === "partial";

const StatusBadge = ({ line }) => {
  if (line.status === "partial") {
    return (
      <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums bg-stock-low/10 text-stock-low">
        متوفر {formatQty(line.available, line.unit)}
      </span>
    );
  }
  if (line.status === "unavailable" || line.status === "missing") {
    return (
      <span className="flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold bg-stock-out/10 text-stock-out">
        غير متوفر
      </span>
    );
  }
  return null;
};

const LineRow = ({ line }) => {
  const dimmed = line.status === "unavailable" || line.status === "missing";
  return (
    <li className={`flex items-center gap-2.5 py-2 ${dimmed ? "opacity-55" : ""}`}>
      <span className="flex h-6 min-w-[2.25rem] flex-shrink-0 items-center justify-center rounded-md bg-primary/10 px-1.5 text-[11px] font-bold tabular-nums text-primary dark:bg-primary/25 dark:text-text-dark">
        {line.unit === "kg" ? `${formatQty(line.quantity, "kg")} كجم` : `×${formatQty(line.quantity)}`}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-light dark:text-text-dark" title={line.name}>
        {line.name}
      </span>
      <StatusBadge line={line} />
      <span className="flex-shrink-0 text-xs font-bold tabular-nums text-text-light/60 dark:text-text-dark/60">
        {Number(line.total).toFixed(2)}
      </span>
    </li>
  );
};

const LastOrderSkeleton = () => (
  <div className="mb-3 rounded-lg border border-border-light bg-surface-raised p-3.5 dark:border-border-dark dark:bg-gray-800/60" aria-busy="true" aria-label="جارٍ تحميل آخر طلب">
    <div className="flex animate-pulse items-center gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-accent/50 dark:bg-accent-dark/50" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-24 rounded bg-accent/50 dark:bg-accent-dark/50" />
        <div className="h-2.5 w-40 rounded bg-accent/40 dark:bg-accent-dark/40" />
      </div>
    </div>
    <div className="mt-3 animate-pulse space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-3 rounded bg-accent/40 dark:bg-accent-dark/40" style={{ width: `${88 - i * 18}%` }} />
      ))}
    </div>
  </div>
);

/**
 * The selected customer's most recent order, with a one-click reorder.
 * `lines` are already resolved against the selected branch's catalog
 * (see resolveReorderLines), so each one knows whether it can be sold now.
 */
const LastOrderCard = ({ order, lines, loading, catalogLoading, canReorder, lockedReason, onReorder }) => {
  const [expanded, setExpanded] = useState(false);

  if (loading) return <LastOrderSkeleton />;
  if (!order || !lines?.length) return null;

  const orderableCount = lines.filter(isOrderable).length;
  const hiddenCount = Math.max(0, lines.length - VISIBLE_LINES);
  const visibleLines = expanded ? lines : lines.slice(0, VISIBLE_LINES);
  const anyPriceChanged = lines.some((l) => isOrderable(l) && l.priceChanged);

  const blockedReason = !canReorder
    ? lockedReason || "أكمل بيانات العميل أولاً"
    : catalogLoading
    ? "جارٍ التحقق من مخزون الفرع..."
    : orderableCount === 0
    ? "لا توجد أصناف متاحة من هذا الطلب في الفرع المختار"
    : null;

  const buttonLabel =
    orderableCount > 0 && orderableCount < lines.length
      ? `إعادة الطلب (${orderableCount} من ${lines.length} أصناف)`
      : "إعادة نفس الطلب";

  const createdAt = new Date(order.createdAt);
  const meta = [order.branch?.name, order.deliveryZone?.name].filter(Boolean);

  return (
    <section
      aria-label="آخر طلب للعميل"
      className="mb-3 overflow-hidden rounded-lg border border-primary/15 bg-surface-raised dark:border-border-dark dark:bg-gray-800/60"
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-3 px-3.5 pt-3 pb-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:bg-primary/25 dark:text-text-dark">
            <History size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-text-light dark:text-text-dark">
              آخر طلب
              <span
                className="mr-1.5 text-xs font-medium text-text-light/50 dark:text-text-dark/50"
                title={createdAt.toLocaleString("ar-EG", { dateStyle: "full", timeStyle: "short" })}
              >
                · {formatRelative(createdAt)}
              </span>
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-text-light/50 dark:text-text-dark/50">
              <span dir="ltr" className="font-mono tabular-nums">{order.saleNumber}</span>
              {meta.map((m) => (
                <React.Fragment key={m}>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{m}</span>
                </React.Fragment>
              ))}
            </p>
          </div>
        </div>
        <span className="flex-shrink-0 rounded-full border border-border-light bg-white px-2 py-0.5 text-[10px] font-bold text-text-light/60 dark:border-border-dark dark:bg-surface-dark dark:text-text-dark/60">
          {CHANNEL_LABELS[order.channel] || order.channel}
        </span>
      </header>

      {/* Lines */}
      <div className="border-y border-dashed border-border-light px-3.5 dark:border-border-dark">
        <ul className="divide-y divide-dashed divide-border-light/70 dark:divide-border-dark/70">
          {visibleLines.map((line, i) => (
            <LineRow key={line.itemId ?? `missing-${i}`} line={line} />
          ))}
        </ul>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mb-2 flex w-full items-center justify-center gap-1 rounded-md py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-text-dark/80"
          >
            {expanded ? "عرض أقل" : `عرض ${hiddenCount} ${hiddenCount === 1 ? "صنف آخر" : "أصناف أخرى"}`}
            <ChevronDown size={14} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="px-3.5 pt-2.5 pb-3">
        <div className="flex items-baseline justify-between text-xs text-text-light/60 dark:text-text-dark/60">
          <span>
            إجمالي الطلب السابق
            {order.deliveryFee > 0 && <span className="text-text-light/40 dark:text-text-dark/40"> (شامل التوصيل)</span>}
          </span>
          <span className="text-sm font-extrabold tabular-nums text-text-light dark:text-text-dark">
            {Number(order.total).toFixed(2)}
            <span className="mr-1 text-[11px] font-medium text-text-light/50 dark:text-text-dark/50">ج.م</span>
          </span>
        </div>

        {anyPriceChanged && !blockedReason && (
          <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug text-stock-low">
            <Info size={13} className="mt-px flex-shrink-0" />
            بعض الأسعار تغيرت — سيتم الاحتساب بالأسعار الحالية
          </p>
        )}

        <button
          type="button"
          onClick={onReorder}
          disabled={!!blockedReason}
          aria-describedby={blockedReason ? "last-order-blocker" : undefined}
          className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:bg-primary-hover hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none dark:focus-visible:ring-offset-surface-dark"
        >
          <RotateCcw size={15} />
          <span>{buttonLabel}</span>
          {!blockedReason && (
            <kbd className="mr-1 hidden rounded bg-white/15 px-1.5 py-0.5 font-mono text-[10px] font-medium sm:inline">Alt+R</kbd>
          )}
        </button>

        {blockedReason && (
          <p id="last-order-blocker" className="mt-1.5 flex items-center justify-center gap-1 text-[11px] text-text-light/50 dark:text-text-dark/50">
            <Lock size={11} />
            {blockedReason}
          </p>
        )}
      </div>
    </section>
  );
};

export default LastOrderCard;
