import { useState } from "react";
import { FaTags, FaTimes } from "react-icons/fa";

const REASONS = [
  "طلب العميل",
  "عميل دائم",
  "تصفية مخزون",
  "عرض خاص",
  "موافقة المدير",
];

export default function TierOverrideModal({ isOpen, onClose, currentTier, onConfirm }) {
  const [selectedTier, setSelectedTier] = useState(
    currentTier === "WHOLESALE" ? "RETAIL" : "WHOLESALE"
  );
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    const finalReason = reason === "أخرى" ? customReason.trim() : reason;
    if (!finalReason) return;
    onConfirm(selectedTier, finalReason);
    setReason("");
    setCustomReason("");
  };

  const handleClear = () => {
    onConfirm(null, null);
    setReason("");
    setCustomReason("");
  };

  const isValid = reason && (reason !== "أخرى" || customReason.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="bg-amber-500 text-white p-4 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FaTags />
            <h3 className="font-bold">تغيير مستوى التسعير</h3>
          </div>
          <button onClick={onClose} className="hover:bg-amber-600 rounded p-1">
            <FaTimes />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tier selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">المستوى الجديد</label>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedTier("RETAIL")}
                className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition ${
                  selectedTier === "RETAIL"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-500"
                }`}
              >
                تجزئة (RETAIL)
              </button>
              <button
                onClick={() => setSelectedTier("WHOLESALE")}
                className={`flex-1 py-2 px-4 rounded-lg border-2 font-medium transition ${
                  selectedTier === "WHOLESALE"
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-200 text-gray-500"
                }`}
              >
                جملة (WHOLESALE)
              </button>
            </div>
          </div>

          {/* Reason selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">سبب التغيير *</label>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <label key={r} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    checked={reason === r}
                    onChange={(e) => setReason(e.target.value)}
                    className="text-amber-500"
                  />
                  <span className="text-sm">{r}</span>
                </label>
              ))}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="reason"
                  value="أخرى"
                  checked={reason === "أخرى"}
                  onChange={(e) => setReason(e.target.value)}
                  className="text-amber-500"
                />
                <span className="text-sm">أخرى</span>
              </label>
              {reason === "أخرى" && (
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="اكتب السبب..."
                  className="w-full border rounded-lg p-2 text-sm mt-1"
                  autoFocus
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex gap-3 justify-between">
          <button onClick={handleClear} className="px-4 py-2 text-sm text-gray-500 hover:text-red-500">
            إزالة التغيير
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isValid}
              className="px-6 py-2 text-sm text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50"
            >
              تأكيد
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
