import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { treasuryService } from "../../services/treasuryService";
import AuthService from "../../services/authService";
import { formatEGP } from "../../utils/bulkMoney";

// Global treasuries are not branch-bound and stay visible for all users
// (used by Bank Transfer & Cheque methods).
const GLOBAL_SCOPES = new Set(["GLOBAL_VISA", "GLOBAL_INSTAPAY", "MAIN"]);

const METHOD_LABELS = {
  CASH: "نقدي",
  BANK_TRANSFER: "تحويل بنكي",
  CHEQUE: "شيك",
  CREDIT: "آجل (بدون دفع)",
};

const CASH_METHODS = new Set(["CASH", "BANK_TRANSFER", "CHEQUE"]);

export default function BulkPaymentModal({ order, onSuccess, onClose }) {
  const [treasuries, setTreasuries] = useState([]);
  const [method, setMethod] = useState("CASH");
  const [amount, setAmount] = useState(String(Number(order?.balanceDue ?? 0).toFixed(2)));
  const [treasuryId, setTreasuryId] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDueDate, setChequeDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Only show cash boxes for the branch(es) the current user is assigned to,
    // plus the shared global treasuries. This tightens the admin case, where the
    // /treasuries endpoint would otherwise return every branch's cash box.
    const user = AuthService.getCurrentUser();
    const assignedBranchIds = new Set();
    if (user?.branch?.id) assignedBranchIds.add(user.branch.id);
    (user?.accessibleBranches || []).forEach((b) => b?.id && assignedBranchIds.add(b.id));

    treasuryService.getAll().then((list) => {
      const visible = list.filter(
        (t) =>
          t.isActive !== false &&
          (GLOBAL_SCOPES.has(t.scope) ||
            (t.branch?.id != null && assignedBranchIds.has(t.branch.id)))
      );
      setTreasuries(visible);
      // Default to the branch cash box so CASH payments target the drawer, not a global box.
      const defaultTreasury = visible.find((t) => t.scope === "BRANCH_CASH") || visible[0];
      if (defaultTreasury) setTreasuryId(String(defaultTreasury.id));
    }).catch(() => {});
  }, []);

  const balanceDue = Number(order?.balanceDue ?? 0);

  const onSubmit = async (e) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("أدخل مبلغًا صحيحًا");
      return;
    }
    if (method === "CREDIT" && amt > 0) {
      // CREDIT is valid but doesn't record actual cash
    }
    setSaving(true);
    try {
      const body = {
        method,
        amount: amt,
        notes: notes.trim() || undefined,
      };
      if (CASH_METHODS.has(method)) {
        body.treasuryId = Number(treasuryId);
      }
      if (method === "BANK_TRANSFER") body.bankReference = bankReference.trim() || undefined;
      if (method === "CHEQUE") {
        body.chequeNumber = chequeNumber.trim() || undefined;
        body.chequeDueDate = chequeDueDate || undefined;
      }
      const result = await bulkService.createPayment(order.id, body);
      toast.success("تم تسجيل الدفعة");
      onSuccess && onSuccess(result);
    } catch (err) {
      const msg = err?.data?.error || "تعذر تسجيل الدفعة";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">تسجيل دفعة</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
          الطلب: <strong>{order.orderNumber || `#${order.id}`}</strong> · المتبقي: <strong className="text-red-600">{formatEGP(balanceDue)}</strong>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="text-sm">طريقة الدفع</span>
            <select
              className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-gray-900"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {Object.entries(METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>

          {method !== "CREDIT" && (
            <label className="block">
              <span className="text-sm">المبلغ</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={balanceDue}
                className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-gray-900"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
          )}

          {CASH_METHODS.has(method) && (
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

          {method === "BANK_TRANSFER" && (
            <label className="block">
              <span className="text-sm">رقم المرجع البنكي</span>
              <input
                type="text"
                className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-gray-900"
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value)}
                placeholder="رقم التحويل..."
              />
            </label>
          )}

          {method === "CHEQUE" && (
            <>
              <label className="block">
                <span className="text-sm">رقم الشيك</span>
                <input
                  type="text"
                  className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-gray-900"
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm">تاريخ استحقاق الشيك</span>
                <input
                  type="date"
                  className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-gray-900"
                  value={chequeDueDate}
                  onChange={(e) => setChequeDueDate(e.target.value)}
                />
              </label>
            </>
          )}

          {method === "CREDIT" && (
            <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-md p-2">
              الآجل: سيُسجَّل المبلغ كـ {formatEGP(balanceDue)} مديونية على العميل بدون حركة خزينة.
            </div>
          )}

          <label className="block">
            <span className="text-sm">ملاحظات</span>
            <input
              type="text"
              className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-gray-900"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اختياري..."
            />
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border rounded-md py-2"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-md py-2 disabled:opacity-60"
            >
              {saving ? "جارٍ الحفظ..." : method === "CREDIT" ? "تأكيد الآجل" : "تسجيل الدفعة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
