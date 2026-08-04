import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { treasuryService } from "../../services/treasuryService";
import { formatEGP } from "../../utils/bulkMoney";
import ManagerAuthModal from "../common/ManagerAuthModal";

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

export default function BulkReturnModal({ order, onSuccess, onClose }) {
  const refundable = cashRefundable(order);
  const voidedTotal = (order?.payments || [])
    .filter((p) => p.voidedAt)
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const [treasuries, setTreasuries] = useState([]);
  const [method, setMethod] = useState("CREDIT_NOTE");
  const [amount, setAmount] = useState(String(Number(order?.paidAmount ?? 0).toFixed(2)));
  const [treasuryId, setTreasuryId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    treasuryService.getAll().then((list) => {
      const active = list.filter((t) => t.isActive !== false);
      setTreasuries(active);
      if (active.length > 0) setTreasuryId(String(active[0].id));
    }).catch(() => {});
  }, []);

  // Validate the return details, then hand off to manager approval — executing
  // the return is manager-gated, preparing it is not.
  const onSubmit = (e) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("أدخل مبلغًا صحيحًا");
      return;
    }
    if (method === "CASH_REFUND" && !treasuryId) {
      toast.error("اختر الخزينة");
      return;
    }
    // Mirrors the server-side guard so the operator is stopped here, with the
    // reason, rather than by a 400 after the manager has already signed off.
    if (method === "CASH_REFUND" && amt > refundable + 0.005) {
      toast.error(
        refundable <= 0
          ? "لا يوجد مبلغ نقدي قابل للاسترداد على هذا الطلب — اختر «إشعار دائن»"
          : `أقصى مبلغ نقدي يمكن استرداده هو ${formatEGP(refundable)}`,
      );
      return;
    }
    setIsAuthOpen(true);
  };

  const handleVerificationSuccess = async (managerUsername, managerPassword) => {
    setIsAuthOpen(false);
    setSaving(true);
    try {
      const body = {
        method,
        amount: Number(amount),
        reason: reason.trim() || undefined,
        managerUsername,
        managerPassword,
      };
      if (method === "CASH_REFUND") body.treasuryId = Number(treasuryId);
      const updated = await bulkService.returnOrder(order.id, body);
      toast.success("تم الإرجاع");
      onSuccess && onSuccess(updated);
    } catch (err) {
      toast.error(err?.message || err?.data?.error || "تعذر الإرجاع");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">إرجاع الطلب</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          الطلب: <strong>{order.orderNumber || `#${order.id}`}</strong> ·
          الإجمالي: <strong>{formatEGP(order.total)}</strong> ·
          المدفوع: <strong className="text-green-700 dark:text-green-400">{formatEGP(order.paidAmount)}</strong> ·
          قابل للاسترداد نقدًا:{" "}
          <strong className={refundable > 0 ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
            {formatEGP(refundable)}
          </strong>
        </div>

        {/* The trap this modal used to walk into: the payment is voided, the
            treasury has already given the money back, and a cash refund would
            take it out a second time. */}
        {voidedTotal > 0 && refundable <= 0 && (
          <div className="mb-3 text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-3">
            <strong>الدفعة على هذا الطلب ملغاة ({formatEGP(voidedTotal)}).</strong>
            <span className="block mt-1">
              الإلغاء رجّع الفلوس للخزينة بالفعل، فالاسترداد النقدي هنا هيخصمها
              مرة تانية. ارجع البضاعة بـ«إشعار دائن».
            </span>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="text-sm">طريقة الإرجاع</span>
            <select
              className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-gray-900"
              value={method}
              onChange={(e) => {
                const next = e.target.value;
                setMethod(next);
                // Switching to cash snaps the amount to what can actually be
                // handed back, so the default is never an impossible figure.
                if (next === "CASH_REFUND") setAmount(refundable.toFixed(2));
              }}
            >
              <option value="CREDIT_NOTE">إشعار دائن (credit note)</option>
              <option value="CASH_REFUND" disabled={refundable <= 0}>
                استرداد نقدي{refundable <= 0 ? " — لا يوجد مبلغ قابل للاسترداد" : ""}
              </option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm">مبلغ الإرجاع</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-gray-900"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>

          {method === "CASH_REFUND" && (
            <label className="block">
              <span className="text-sm">الخزينة *</span>
              <select
                className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-gray-900"
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

          {method === "CREDIT_NOTE" && (
            <div className="text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-md p-2">
              سيُصدر إشعار دائن برقم تسلسلي وتُعكس الكمية في المخزون.
            </div>
          )}

          <label className="block">
            <span className="text-sm">سبب الإرجاع</span>
            <input
              type="text"
              className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-gray-900"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اختياري..."
            />
          </label>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border rounded-md py-2">
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-md py-2 disabled:opacity-60"
            >
              {saving ? "جارٍ الإرجاع..." : "تأكيد الإرجاع"}
            </button>
          </div>
        </form>
      </div>

      <ManagerAuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onVerify={handleVerificationSuccess}
        title="تأكيد الإرجاع"
        message="عملية الإرجاع تتطلب موافقة المدير. يرجى إدخال البيانات."
        actionLabel="تأكيد الإرجاع"
      />
    </div>
  );
}
