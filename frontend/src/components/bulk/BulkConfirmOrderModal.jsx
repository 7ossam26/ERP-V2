import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { treasuryService } from "../../services/treasuryService";
import { formatEGP } from "../../utils/bulkMoney";

const METHOD_LABELS = {
  CASH: "نقدي",
  BANK_TRANSFER: "تحويل بنكي",
  CHEQUE: "شيك",
  CREDIT: "آجل (بدون دفع الآن)",
};

const CASH_METHODS = new Set(["CASH", "BANK_TRANSFER", "CHEQUE"]);

// BulkConfirmOrderModal — collects payment details before confirming an order.
//
// Props:
//   totalAmount   — order total (number)
//   customerName  — displayed in summary
//   orderRef      — order number/id string (optional; absent in POS pre-create mode)
//   onConfirm(body) — async fn; called with { paidAmount, method, treasuryId?, ... }
//   onClose       — called when user clicks السابق / ×
export default function BulkConfirmOrderModal({
  totalAmount,
  customerName,
  orderRef,
  onConfirm,
  onClose,
}) {
  const [treasuries, setTreasuries] = useState([]);
  const [method, setMethod] = useState("CASH");
  const [amount, setAmount] = useState(String(Number(totalAmount ?? 0).toFixed(2)));
  const [treasuryId, setTreasuryId] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDueDate, setChequeDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [creditError, setCreditError] = useState(null);

  useEffect(() => {
    treasuryService.getAll().then((list) => {
      const active = list.filter((t) => t.isActive !== false);
      setTreasuries(active);
      if (active.length > 0) setTreasuryId(String(active[0].id));
    }).catch(() => {});
  }, []);

  // Sync amount when method changes
  useEffect(() => {
    if (method === "CREDIT") {
      setAmount("0");
    } else {
      setAmount(String(Number(totalAmount ?? 0).toFixed(2)));
    }
  }, [method, totalAmount]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setCreditError(null);

    const amt = method === "CREDIT" ? 0 : Number(amount);
    if (method !== "CREDIT" && (!Number.isFinite(amt) || amt <= 0)) {
      toast.error("أدخل مبلغًا صحيحًا");
      return;
    }
    if (CASH_METHODS.has(method) && amt > 0 && !treasuryId) {
      toast.error("اختر الخزينة");
      return;
    }
    if (method === "CHEQUE") {
      if (!chequeNumber.trim()) { toast.error("أدخل رقم الشيك"); return; }
      if (!chequeDueDate) { toast.error("أدخل تاريخ استحقاق الشيك"); return; }
    }

    setSaving(true);
    try {
      const body = {
        paidAmount: amt,
        method,
        notes: notes.trim() || undefined,
      };
      if (CASH_METHODS.has(method) && amt > 0) {
        body.treasuryId = Number(treasuryId);
      }
      if (method === "BANK_TRANSFER") body.bankReference = bankReference.trim() || undefined;
      if (method === "CHEQUE") {
        body.chequeNumber = chequeNumber.trim();
        body.chequeDueDate = chequeDueDate;
      }
      await onConfirm(body);
    } catch (err) {
      const code = err?.data?.error;
      if (code === "CREDIT_LIMIT_EXCEEDED") {
        setCreditError(
          `تم تجاوز حد الائتمان (مفتوح: ${formatEGP(err.data?.open)}، الحد: ${formatEGP(err.data?.limit)})`
        );
      } else {
        toast.error(err?.data?.message || err?.message || "تعذر التأكيد");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-md border border-border-light dark:border-border-dark">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light dark:border-border-dark bg-accent/5 dark:bg-primary/5 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="material-icons-round text-primary text-xl">check_circle</span>
            <h2 className="text-lg font-bold text-primary dark:text-text-dark">تأكيد الطلب</h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-light/40 hover:text-red-500 dark:text-text-dark/40 dark:hover:text-red-400 transition-colors rounded-full p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <span className="material-icons-round text-xl">close</span>
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4">
          {/* Order summary */}
          <div className="text-sm bg-accent/10 dark:bg-primary/10 rounded-xl p-3 space-y-1">
            <div className="flex justify-between text-text-light/70 dark:text-text-dark/70">
              <span>العميل</span>
              <span className="font-medium text-text-light dark:text-text-dark">{customerName}</span>
            </div>
            {orderRef && (
              <div className="flex justify-between text-text-light/70 dark:text-text-dark/70">
                <span>الطلب</span>
                <span className="font-medium text-text-light dark:text-text-dark">{orderRef}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-primary dark:text-accent pt-1 border-t border-border-light/50 dark:border-border-dark/50 mt-1">
              <span>الإجمالي</span>
              <span>{formatEGP(totalAmount)}</span>
            </div>
          </div>

          {/* Credit limit error banner */}
          {creditError && (
            <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-200 dark:border-red-800">
              <span className="material-icons-round text-base mt-0.5">warning</span>
              <span>{creditError}</span>
            </div>
          )}

          {/* Method selector — pill buttons */}
          <div>
            <label className="block text-sm font-medium text-text-light dark:text-text-dark mb-2">
              طريقة الدفع
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(METHOD_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setMethod(k)}
                  className={`rounded-xl px-3 py-2 text-sm font-medium border transition-colors duration-150 ${
                    method === k
                      ? "bg-primary text-white border-primary shadow-sm"
                      : "border-border-light dark:border-border-dark text-text-light/70 dark:text-text-dark/70 hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/10"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          {method !== "CREDIT" && (
            <label className="block">
              <span className="text-sm font-medium text-text-light dark:text-text-dark">
                المبلغ المدفوع
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="mt-1 w-full border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
          )}

          {/* Treasury */}
          {CASH_METHODS.has(method) && (
            <label className="block">
              <span className="text-sm font-medium text-text-light dark:text-text-dark">
                الخزينة <span className="text-red-500">*</span>
              </span>
              <select
                className="mt-1 w-full border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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

          {/* Bank reference */}
          {method === "BANK_TRANSFER" && (
            <label className="block">
              <span className="text-sm font-medium text-text-light dark:text-text-dark">
                رقم المرجع البنكي
              </span>
              <input
                type="text"
                className="mt-1 w-full border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                value={bankReference}
                onChange={(e) => setBankReference(e.target.value)}
                placeholder="رقم التحويل..."
              />
            </label>
          )}

          {/* Cheque fields */}
          {method === "CHEQUE" && (
            <>
              <label className="block">
                <span className="text-sm font-medium text-text-light dark:text-text-dark">
                  رقم الشيك <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  className="mt-1 w-full border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  value={chequeNumber}
                  onChange={(e) => setChequeNumber(e.target.value)}
                  required
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-text-light dark:text-text-dark">
                  تاريخ استحقاق الشيك <span className="text-red-500">*</span>
                </span>
                <input
                  type="date"
                  className="mt-1 w-full border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  value={chequeDueDate}
                  onChange={(e) => setChequeDueDate(e.target.value)}
                  required
                />
              </label>
            </>
          )}

          {/* Credit info */}
          {method === "CREDIT" && (
            <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
              <span className="material-icons-round text-base mt-0.5">info</span>
              <span>
                الآجل: سيُسجَّل مبلغ {formatEGP(totalAmount)} مديونية على العميل بدون حركة خزينة.
              </span>
            </div>
          )}

          {/* Notes */}
          <label className="block">
            <span className="text-sm font-medium text-text-light dark:text-text-dark">ملاحظات</span>
            <input
              type="text"
              className="mt-1 w-full border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اختياري..."
            />
          </label>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-border-light dark:border-border-dark rounded-xl py-2.5 text-sm text-text-light/70 dark:text-text-dark/70 hover:bg-accent/10 dark:hover:bg-primary/10 transition-colors"
            >
              السابق
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-primary hover:bg-primary-hover text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-60 transition-colors"
            >
              {saving
                ? "جارٍ التأكيد..."
                : method === "CREDIT"
                ? "تأكيد آجل"
                : "تأكيد الطلب"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
