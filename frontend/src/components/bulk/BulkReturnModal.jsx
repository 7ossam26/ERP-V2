import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { treasuryService } from "../../services/treasuryService";
import { formatEGP } from "../../utils/bulkMoney";

export default function BulkReturnModal({ order, onSuccess, onClose }) {
  const [treasuries, setTreasuries] = useState([]);
  const [method, setMethod] = useState("CREDIT_NOTE");
  const [amount, setAmount] = useState(String(Number(order?.paidAmount ?? 0).toFixed(2)));
  const [treasuryId, setTreasuryId] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    treasuryService.getAll().then((list) => {
      const active = list.filter((t) => t.isActive !== false);
      setTreasuries(active);
      if (active.length > 0) setTreasuryId(String(active[0].id));
    }).catch(() => {});
  }, []);

  const onSubmit = async (e) => {
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
    setSaving(true);
    try {
      const body = { method, amount: amt, reason: reason.trim() || undefined };
      if (method === "CASH_REFUND") body.treasuryId = Number(treasuryId);
      const updated = await bulkService.returnOrder(order.id, body);
      toast.success("تم الإرجاع");
      onSuccess && onSuccess(updated);
    } catch (err) {
      toast.error(err?.data?.error || "تعذر الإرجاع");
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
          المدفوع: <strong className="text-green-700 dark:text-green-400">{formatEGP(order.paidAmount)}</strong>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="text-sm">طريقة الإرجاع</span>
            <select
              className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-gray-900"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="CREDIT_NOTE">إشعار دائن (credit note)</option>
              <option value="CASH_REFUND">استرداد نقدي</option>
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
    </div>
  );
}
