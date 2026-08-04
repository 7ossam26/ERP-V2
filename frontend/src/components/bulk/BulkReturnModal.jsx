import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { treasuryService } from "../../services/treasuryService";
import { formatEGP } from "../../utils/bulkMoney";

/**
 * What can still be handed back in CASH: money actually held against this order,
 * less anything already refunded.
 *
 * A VOIDED payment has already been reversed on the treasury, so it is not
 * refundable — refunding it again takes the same money out twice while the stock
 * comes back once. That is exactly what happened to BULK-0025 on 03/08/2026.
 */
function cashRefundable(order) {
  const livePaid = (order?.payments || [])
    .filter((p) => !p.voidedAt)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const alreadyRefunded = (order?.refunds || [])
    .filter((r) => r.method === "CASH_REFUND")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  return Math.round((livePaid - alreadyRefunded) * 100) / 100;
}

/**
 * Return a bulk order. One method only — cash back to the customer, goods back
 * to the warehouse they shipped from.
 *
 * إشعار دائن used to sit next to it as a second choice. It was picked once in
 * the life of the system, by a correction script, so it was serving mainly as a
 * wrong answer parked beside the right one. What is left is a single action, and
 * the panel below the amount states its two consequences by name: which treasury
 * loses the cash, and which warehouse gets the stock.
 *
 * No manager password: SALES_RETURNS is checked at the route, so anyone who can
 * open this can complete it.
 */
export default function BulkReturnModal({ order, onSuccess, onClose }) {
  const refundable = cashRefundable(order);
  const voidedTotal = (order?.payments || [])
    .filter((p) => p.voidedAt)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const blocked = refundable <= 0;
  const warehouseName = order?.warehouse?.name || "—";

  const [treasuries, setTreasuries] = useState([]);
  const [amount, setAmount] = useState(refundable > 0 ? refundable.toFixed(2) : "");
  const [treasuryId, setTreasuryId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    treasuryService
      .getAll()
      .then((list) => {
        const active = list.filter((t) => t.isActive !== false);
        setTreasuries(active);
        if (active.length > 0) setTreasuryId(String(active[0].id));
      })
      .catch(() => {});
  }, []);

  const treasuryName =
    treasuries.find((t) => String(t.id) === String(treasuryId))?.name || "—";
  const amt = Number(amount);
  const amtValid = Number.isFinite(amt) && amt > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (blocked) return;
    if (!amtValid) {
      toast.error("أدخل مبلغًا صحيحًا");
      return;
    }
    if (!treasuryId) {
      toast.error("اختر الخزينة");
      return;
    }
    // Mirrors the server-side cap so the operator is stopped here, with the
    // reason, instead of by a 400 after committing to the action.
    if (amt > refundable + 0.005) {
      toast.error(`أقصى مبلغ يمكن استرداده هو ${formatEGP(refundable)}`);
      return;
    }

    setSaving(true);
    try {
      const updated = await bulkService.returnOrder(order.id, {
        method: "CASH_REFUND",
        amount: amt,
        treasuryId: Number(treasuryId),
        reason: reason.trim() || undefined,
      });
      toast.success("تم إرجاع الطلب");
      onSuccess && onSuccess(updated);
    } catch (err) {
      toast.error(err?.message || err?.data?.error || "تعذر الإرجاع");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      dir="rtl"
    >
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-2xl shadow-soft dark:shadow-soft-dark w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light dark:border-border-dark bg-accent/20 dark:bg-primary/10">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-red-600 dark:text-red-400">
              assignment_return
            </span>
            <div>
              <h2 className="text-base font-bold text-text-light dark:text-text-dark">
                إرجاع الطلب
              </h2>
              <p className="text-[11px] text-text-light/50 dark:text-text-dark/50">
                استرداد نقدي — العميل ياخد فلوسه والبضاعة ترجع المخزن
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg grid place-items-center text-text-light/50 dark:text-text-dark/50 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="إغلاق"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4 overflow-y-auto">
          {/* order summary */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ["الطلب", order.orderNumber || `#${order.id}`, "text-text-light dark:text-text-dark"],
              ["الإجمالي", formatEGP(order.total), "text-text-light dark:text-text-dark"],
              [
                "قابل للاسترداد",
                formatEGP(refundable),
                refundable > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
              ],
            ].map(([label, value, cls]) => (
              <div
                key={label}
                className="rounded-xl border border-border-light dark:border-border-dark p-2.5"
              >
                <p className="text-[11px] text-text-light/50 dark:text-text-dark/50 mb-0.5">{label}</p>
                <p className={`text-sm font-bold ltr-numbers ${cls}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Nothing was ever collected on this order, or the payment was already
              voided and the treasury has its money back. Either way there is no
              cash to hand over, so the action is closed rather than left to fail
              at submit. */}
          {blocked && (
            <div className="flex gap-2 text-xs text-red-900 dark:text-red-200 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
              <span className="material-symbols-outlined text-[18px] shrink-0">block</span>
              <span>
                {voidedTotal > 0 ? (
                  <>
                    الدفعة على هذا الطلب <strong>ملغاة ({formatEGP(voidedTotal)})</strong>، والإلغاء
                    رجّع الفلوس للخزينة بالفعل — مفيش مبلغ تاني يترد. الاسترداد هنا كان هيخصمها مرة
                    تانية.
                  </>
                ) : (
                  <>
                    الطلب ده <strong>مدفعش حاجة</strong>، فمفيش فلوس ترجع للعميل. لو البضاعة اترجعت
                    فعلًا، الغِ الطلب بدل الإرجاع.
                  </>
                )}
              </span>
            </div>
          )}

          {/* amount */}
          <label className="block">
            <span className="text-sm font-medium text-text-light dark:text-text-dark">
              مبلغ الاسترداد
            </span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={refundable}
              disabled={blocked}
              className="mt-1 w-full rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-2.5 ltr-numbers text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>

          {/* treasury */}
          <label className="block">
            <span className="text-sm font-medium text-text-light dark:text-text-dark">
              الخزينة اللي هتخرج منها الفلوس <span className="text-red-500">*</span>
            </span>
            <select
              className="mt-1 w-full rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-2.5 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              value={treasuryId}
              disabled={blocked}
              onChange={(e) => setTreasuryId(e.target.value)}
              required
            >
              <option value="">اختر خزينة...</option>
              {treasuries.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>

          {/* The whole point of the screen: both consequences, named, before the
              button is pressed. The warehouse is the order's own — a return can
              never send stock somewhere else. */}
          {!blocked && (
            <div className="rounded-xl border border-border-light dark:border-border-dark overflow-hidden">
              <div className="px-3 py-2 bg-accent/20 dark:bg-primary/10 border-b border-border-light dark:border-border-dark">
                <p className="text-xs font-bold text-text-light dark:text-text-dark flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  اللي هيحصل لما تأكد
                </p>
              </div>
              <div className="divide-y divide-border-light dark:divide-border-dark">
                <div className="flex items-start gap-2.5 p-3">
                  <span className="material-symbols-outlined text-[20px] text-red-600 dark:text-red-400 mt-0.5">
                    payments
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-text-light dark:text-text-dark">
                      يخرج{" "}
                      <strong className="ltr-numbers text-red-600 dark:text-red-400">
                        {formatEGP(amtValid ? amt : 0)}
                      </strong>{" "}
                      من <strong>{treasuryName}</strong>
                    </p>
                    <p className="text-[11px] text-text-light/50 dark:text-text-dark/50 mt-0.5">
                      رصيد الخزينة هينقص بالمبلغ ده فورًا
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 p-3">
                  <span className="material-symbols-outlined text-[20px] text-emerald-700 dark:text-emerald-400 mt-0.5">
                    warehouse
                  </span>
                  <div className="flex-1">
                    <p className="text-sm text-text-light dark:text-text-dark">
                      البضاعة ترجع لـ <strong>{warehouseName}</strong>
                    </p>
                    <p className="text-[11px] text-text-light/50 dark:text-text-dark/50 mt-0.5">
                      نفس المخزن اللي خرجت منه — كل أصناف الطلب بكمياتها
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium text-text-light dark:text-text-dark">
              سبب الإرجاع
            </span>
            <input
              type="text"
              className="mt-1 w-full rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-2.5 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اختياري..."
            />
          </label>
        </form>

        {/* actions */}
        <div className="flex gap-2 px-5 py-4 border-t border-border-light dark:border-border-dark bg-accent/10 dark:bg-primary/5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-border-light dark:border-border-dark py-2.5 text-sm font-medium text-text-light dark:text-text-dark hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || blocked}
            className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white py-2.5 text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">assignment_return</span>
            {saving ? "جارٍ الإرجاع..." : "تأكيد الإرجاع"}
          </button>
        </div>
      </div>
    </div>
  );
}
