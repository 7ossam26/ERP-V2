// Shared cancel-order dialog: required reason dropdown + optional note.
// Used by the call-center list and the POS incoming-orders tray so both
// surfaces submit the same taxonomy (backend validates enum membership).

import React, { useState, useEffect } from "react";
import Modal from "../ui/Modal";

export const CANCELLATION_REASONS = [
  { value: "CUSTOMER_REQUEST", label: "العميل طلب الإلغاء" },
  { value: "OUT_OF_STOCK", label: "الصنف غير متوفر" },
  { value: "WRONG_ADDRESS", label: "عنوان غير صحيح" },
  { value: "NO_ANSWER", label: "العميل لا يرد" },
  { value: "DUPLICATE", label: "طلب مكرر" },
  { value: "OTHER", label: "سبب آخر" },
];

export const reasonLabel = (value) =>
  CANCELLATION_REASONS.find((r) => r.value === value)?.label || value || "-";

const CancelOrderDialog = ({ isOpen, onClose, onConfirm, submitting = false }) => {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (isOpen) {
      setReason("");
      setNote("");
    }
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!reason) return;
    onConfirm({ reason, note: note.trim() || null });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إلغاء الطلب">
      <form onSubmit={handleSubmit} dir="rtl" className="space-y-4 p-2">
        <div>
          <label className="block text-sm font-medium mb-1">
            سبب الإلغاء <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border rounded-md p-2 bg-white dark:bg-gray-800">
            <option value="">— اختر السبب —</option>
            {CANCELLATION_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            ملاحظات (اختياري)
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border rounded-md p-2 bg-white dark:bg-gray-800"
            placeholder="تفاصيل إضافية..."
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
            تراجع
          </button>
          <button
            type="submit"
            disabled={!reason || submitting}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
            {submitting ? "جارٍ الإلغاء..." : "تأكيد الإلغاء"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CancelOrderDialog;
