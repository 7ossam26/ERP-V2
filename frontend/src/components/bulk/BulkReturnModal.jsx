import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { treasuryService } from "../../services/treasuryService";
import { formatEGP } from "../../utils/bulkMoney";

/**
 * What can still be handed back in CASH: money actually held against this order,
 * less anything already refunded in cash.
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
 * Return a bulk order. No manager password: SALES_RETURNS is checked at the
 * route, so anyone who can open this can complete it.
 *
 * The two methods are presented as cards rather than a dropdown because they do
 * different things to cash, and picking the wrong one is what this screen has
 * to prevent — a dropdown made them look like two labels for one action.
 */
export default function BulkReturnModal({ order, onSuccess, onClose }) {
  const refundable = cashRefundable(order);
  const voidedTotal = (order?.payments || [])
    .filter((p) => p.voidedAt)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const cashBlocked = refundable <= 0;

  const [treasuries, setTreasuries] = useState([]);
  const [method, setMethod] = useState("CREDIT_NOTE");
  const [amount, setAmount] = useState(String(Number(order?.total ?? 0).toFixed(2)));
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

  const pickMethod = (next) => {
    if (next === "CASH_REFUND" && cashBlocked) return;
    setMethod(next);
    // Snap to what each method can actually move, so the default is never a
    // figure the server will reject.
    setAmount(
      next === "CASH_REFUND"
        ? refundable.toFixed(2)
        : Number(order?.total ?? 0).toFixed(2),
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("أدخل مبلغًا صحيحًا");
      return;
    }
    if (method === "CASH_REFUND") {
      if (!treasuryId) {
        toast.error("اختر الخزينة");
        return;
      }
      // Mirrors the server-side cap so the operator is stopped here, with the
      // reason, instead of by a 400 after committing to the action.
      if (amt > refundable + 0.005) {
        toast.error(
          cashBlocked
            ? "لا يوجد مبلغ نقدي قابل للاسترداد على هذا الطلب — اختر «إشعار دائن»"
            : `أقصى مبلغ نقدي يمكن استرداده هو ${formatEGP(refundable)}`,
        );
        return;
      }
    }

    setSaving(true);
    try {
      const body = { method, amount: amt, reason: reason.trim() || undefined };
      if (method === "CASH_REFUND") body.treasuryId = Number(treasuryId);
      const updated = await bulkService.returnOrder(order.id, body);
      toast.success("تم إرجاع الطلب");
      onSuccess && onSuccess(updated);
    } catch (err) {
      toast.error(err?.message || err?.data?.error || "تعذر الإرجاع");
    } finally {
      setSaving(false);
    }
  };

  const METHODS = [
    {
      key: "CREDIT_NOTE",
      icon: "receipt_long",
      title: "إشعار دائن",
      line: "البضاعة ترجع للمخزن، والمبلغ يتحسب رصيد للعميل",
      cash: "لا تخرج أي نقدية",
    },
    {
      key: "CASH_REFUND",
      icon: "payments",
      title: "استرداد نقدي",
      line: "البضاعة ترجع للمخزن، والعميل يستلم فلوسه",
      cash: cashBlocked ? "غير متاح — لا يوجد مبلغ مدفوع" : `يخرج ${formatEGP(refundable)} من الخزينة`,
    },
  ];

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
            <h2 className="text-base font-bold text-text-light dark:text-text-dark">
              إرجاع الطلب
            </h2>
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
                "قابل للاسترداد نقدًا",
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

          {/* The trap: the payment is voided, the treasury has already given the
              money back, and a cash refund would take it out a second time. */}
          {voidedTotal > 0 && cashBlocked && (
            <div className="flex gap-2 text-xs text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
              <span className="material-symbols-outlined text-[18px] shrink-0">warning</span>
              <span>
                الدفعة على هذا الطلب <strong>ملغاة ({formatEGP(voidedTotal)})</strong>، والإلغاء
                رجّع الفلوس للخزينة بالفعل. الاسترداد النقدي هنا كان هيخصمها مرة تانية، فهو
                مقفول — ارجع البضاعة بـ«إشعار دائن».
              </span>
            </div>
          )}

          {/* method */}
          <div>
            <p className="text-sm font-medium text-text-light dark:text-text-dark mb-2">
              طريقة الإرجاع
            </p>
            <div className="grid gap-2">
              {METHODS.map((mth) => {
                const active = method === mth.key;
                const disabled = mth.key === "CASH_REFUND" && cashBlocked;
                return (
                  <button
                    type="button"
                    key={mth.key}
                    onClick={() => pickMethod(mth.key)}
                    disabled={disabled}
                    className={`w-full text-right rounded-xl border p-3 transition-colors ${
                      disabled
                        ? "opacity-45 cursor-not-allowed border-border-light dark:border-border-dark"
                        : active
                        ? "border-primary bg-primary/5 dark:bg-primary/10"
                        : "border-border-light dark:border-border-dark hover:bg-accent/20 dark:hover:bg-primary/5"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`material-symbols-outlined text-[20px] mt-0.5 ${
                          active ? "text-primary dark:text-accent" : "text-text-light/40 dark:text-text-dark/40"
                        }`}
                      >
                        {mth.icon}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-text-light dark:text-text-dark">
                          {mth.title}
                        </p>
                        <p className="text-xs text-text-light/60 dark:text-text-dark/60 mt-0.5">
                          {mth.line}
                        </p>
                        <p
                          className={`text-xs font-medium mt-1 ${
                            mth.key === "CASH_REFUND" && !disabled
                              ? "text-red-600 dark:text-red-400"
                              : "text-text-light/50 dark:text-text-dark/50"
                          }`}
                        >
                          {mth.cash}
                        </p>
                      </div>
                      {active && (
                        <span className="material-symbols-outlined text-[20px] text-primary dark:text-accent">
                          check_circle
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* amount */}
          <label className="block">
            <span className="text-sm font-medium text-text-light dark:text-text-dark">
              مبلغ الإرجاع
            </span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={method === "CASH_REFUND" ? refundable : undefined}
              className="mt-1 w-full rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-2.5 ltr-numbers text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>

          {method === "CASH_REFUND" && (
            <label className="block">
              <span className="text-sm font-medium text-text-light dark:text-text-dark">
                الخزينة اللي هتخرج منها الفلوس <span className="text-red-500">*</span>
              </span>
              <select
                className="mt-1 w-full rounded-xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark p-2.5 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary/30"
                value={treasuryId}
                onChange={(e) => setTreasuryId(e.target.value)}
                required
              >
                <option value="">اختر خزينة...</option>
                {treasuries.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
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
            disabled={saving}
            className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 text-white py-2.5 text-sm font-bold disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">assignment_return</span>
            {saving ? "جارٍ الإرجاع..." : "تأكيد الإرجاع"}
          </button>
        </div>
      </div>
    </div>
  );
}
