import { useCallback, useEffect, useRef, useState } from "react";
import { reportService } from "../../services/reportService";

/**
 * Why التقرير العام and مبيعات الفروع show different totals for the same filter.
 *
 * The two pages measure different things on purpose — one is what was INVOICED,
 * the other is what was COLLECTED — but the gap is neither small nor stable
 * (on production it swung from −75,120 to +40,470 inside a single day), so from
 * the UI a real bug and a legitimate wholesale timing difference looked
 * identical. This panel walks the difference term by term and names the
 * wholesale invoices behind it.
 *
 * One component, mounted on both pages, so the two screens can never render
 * different explanations of the same gap. `side` only decides which end of the
 * waterfall is highlighted as "this page".
 *
 * It fetches on first expand, never on mount: neither page pays for it unless
 * the user actually asks the question.
 */

const fmt = (n) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

function BasisRow({ label, basis, amount, active }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 rounded-xl px-3 py-2.5 ${
        active
          ? "bg-primary/10 dark:bg-primary/20 ring-1 ring-primary/30"
          : "bg-gray-50 dark:bg-gray-800/40"
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
          {label}
          {active && (
            <span className="mr-2 text-[10px] font-black uppercase tracking-wider text-primary">
              هذه الصفحة
            </span>
          )}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{basis}</p>
      </div>
      <p className="shrink-0 text-base font-black tabular-nums text-gray-900 dark:text-white">
        {fmt(amount)}
        <span className="mr-1 text-[10px] font-normal opacity-60">ج.م</span>
      </p>
    </div>
  );
}

function TermRow({ term }) {
  const [open, setOpen] = useState(false);
  // Terms are signed as (accrual − cash). Reading the waterfall downward from
  // التقرير العام to مبيعات الفروع, a positive term is SUBTRACTED.
  const subtracts = term.amount >= 0;
  const orders = term.orders || [];
  const hasDetail = orders.length > 0;

  return (
    <div className="border-b border-dashed border-gray-200 dark:border-gray-700/60 last:border-0">
      <div className="flex items-start justify-between gap-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-black tabular-nums ${
                subtracts
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {subtracts ? "−" : "+"}
            </span>
            <p className="text-[13px] font-medium text-gray-700 dark:text-gray-200">
              {term.label}
            </p>
            {hasDetail && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/10"
              >
                {orders.length} فاتورة
                <span
                  className={`material-icons-round align-middle text-[13px] transition-transform ${
                    open ? "rotate-180" : ""
                  }`}
                >
                  expand_more
                </span>
              </button>
            )}
          </div>
          {term.hint && (
            <p className="mt-0.5 pr-5 text-[11px] leading-snug text-gray-400 dark:text-gray-500">
              {term.hint}
            </p>
          )}
          {open && hasDetail && (
            <ul className="mt-1.5 mr-5 space-y-1 border-r-2 border-primary/20 pr-3">
              {orders.map((o, i) => (
                <li
                  key={`${o.orderNumber || "order"}-${i}`}
                  className="flex items-baseline justify-between gap-3 text-[11px]"
                >
                  <span className="truncate text-gray-600 dark:text-gray-300">
                    <span className="font-bold">{o.orderNumber || "بدون رقم"}</span>
                    {o.branchName && (
                      <span className="opacity-70"> · {o.branchName}</span>
                    )}
                    {o.invoicedAt && (
                      <span className="opacity-70"> · فوترت {fmtDate(o.invoicedAt)}</span>
                    )}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums text-gray-700 dark:text-gray-200">
                    {fmt(Math.abs(o.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p
          className={`shrink-0 text-[13px] font-bold tabular-nums ${
            subtracts
              ? "text-rose-600 dark:text-rose-400"
              : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {fmt(Math.abs(term.amount))}
        </p>
      </div>
    </div>
  );
}

export default function SalesBasisBridge({
  startDate,
  endDate,
  branchId,
  side = "accrual",
  windowLabel,
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showZeros, setShowZeros] = useState(false);
  // Rapid preset clicks must not paint a stale window — same guard the branches
  // page uses for its own rows.
  const fetchSeq = useRef(0);

  const load = useCallback(async () => {
    if (!startDate || !endDate) return;
    const seq = ++fetchSeq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await reportService.getSalesBasis({
        startDate,
        endDate,
        branchId,
      });
      if (seq === fetchSeq.current) setData(res);
    } catch {
      if (seq === fetchSeq.current) {
        // Never blocks or toasts: this panel failing must not degrade the page
        // it is attached to.
        setError("تعذّر تحميل بيان التسوية");
      }
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  }, [startDate, endDate, branchId]);

  // Only refetch while open — closed, the panel costs the page nothing.
  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const isAccrual = side === "accrual";
  const otherPage = isAccrual ? "مبيعات الفروع" : "التقرير العام";
  const gap = data ? Math.abs(data.gap) : null;
  const matched = data && data.gap === 0;
  const visibleTerms = (data?.terms || []).filter(
    (t) => showZeros || t.amount !== 0,
  );
  const hasResidual = data && Math.abs(data.residual) >= 0.01;

  return (
    <div className="rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-right transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40"
      >
        <span className="material-icons-round text-primary text-[20px]">
          {matched ? "check_circle" : "compare_arrows"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-gray-900 dark:text-white">
            لماذا يختلف هذا الرقم عن {otherPage}؟
          </span>
          <span className="block text-[11px] text-gray-500 dark:text-gray-400">
            {data
              ? matched
                ? `الصفحتان متطابقتان${windowLabel ? ` — ${windowLabel}` : ""}`
                : `الفرق ${fmt(gap)} ج.م${windowLabel ? ` — ${windowLabel}` : ""}`
              : "بيان تسوية بالتفصيل بين المبيعات بالفوترة والمبيعات المُحصَّلة"}
          </span>
        </span>
        <span
          className={`material-icons-round text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        >
          expand_more
        </span>
      </button>

      {open && (
        <div className="border-t border-border-light dark:border-border-dark px-4 py-4">
          {loading && (
            <p className="py-6 text-center text-sm text-gray-400">
              جارٍ تحميل بيان التسوية…
            </p>
          )}

          {!loading && error && (
            <p className="py-6 text-center text-sm text-gray-400">{error}</p>
          )}

          {!loading && !error && data && (
            <>
              <BasisRow
                label={data.accrual.source}
                basis={data.accrual.basis}
                amount={data.accrual.total}
                active={isAccrual}
              />

              <div className="my-2 px-3">
                {visibleTerms.length === 0 ? (
                  <p className="py-3 text-center text-xs text-gray-400">
                    لا توجد فروق في هذه الفترة — الرقمان متطابقان.
                  </p>
                ) : (
                  visibleTerms.map((t) => <TermRow key={t.key} term={t} />)
                )}

                {hasResidual && (
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-rose-50 px-3 py-2 dark:bg-rose-900/20">
                    <span className="flex items-center gap-2 text-[12px] font-bold text-rose-700 dark:text-rose-300">
                      <span className="material-icons-round text-[16px]">warning</span>
                      فرق غير مُفسَّر — راجع الدعم الفني
                    </span>
                    <span className="text-[13px] font-black tabular-nums text-rose-700 dark:text-rose-300">
                      {fmt(data.residual)}
                    </span>
                  </div>
                )}
              </div>

              <BasisRow
                label={data.cash.source}
                basis={data.cash.basis}
                amount={data.cash.total}
                active={!isAccrual}
              />

              {/* The invoice-count gap is mostly definitional, so it is stated
                  rather than itemised — that is the whole fix for "709 vs 705". */}
              <div className="mt-4 rounded-xl bg-blue-50/60 px-3 py-2.5 dark:bg-blue-900/15">
                <p className="text-[11px] font-black uppercase tracking-wider text-blue-700/80 dark:text-blue-300/80">
                  عدد الفواتير
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
                  <span className="font-bold">{data.accrual.source}</span> يحسب{" "}
                  <span className="font-bold tabular-nums">
                    {data.accrual.retailInvoiceCount}
                  </span>{" "}
                  فاتورة تجزئة{" "}
                  {data.accrual.wholesaleOrderCount > 0 && (
                    <>
                      +{" "}
                      <span className="font-bold tabular-nums text-amber-700 dark:text-amber-400">
                        {data.accrual.wholesaleOrderCount}
                      </span>{" "}
                      أمر جملة{" "}
                    </>
                  )}
                  = <span className="font-bold tabular-nums">{data.accrual.invoiceCount}</span>.{" "}
                  <span className="font-bold">{data.cash.source}</span> يحسب{" "}
                  <span className="font-bold tabular-nums">{data.cash.invoiceCount}</span>{" "}
                  فاتورة تجزئة محصَّلة فقط — أوامر الجملة ليست فواتير تجزئة ولا
                  تُعد هنا.
                </p>
              </div>

              {data.diagnostics?.unattributedCollections !== 0 && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  تنبيه: <span className="font-bold tabular-nums">
                    {fmt(data.diagnostics.unattributedCollections)}
                  </span>{" "}
                  ج.م تحصيلات جملة لم تُنسب لأي فرع، ولا تظهر في أي من الصفحتين.
                </p>
              )}

              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowZeros((v) => !v)}
                  className="text-[11px] font-bold text-gray-400 hover:text-primary"
                >
                  {showZeros ? "إخفاء البنود الصفرية" : "إظهار كل البنود"}
                </button>
                <button
                  type="button"
                  onClick={load}
                  className="text-[11px] font-bold text-gray-400 hover:text-primary"
                >
                  تحديث
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
