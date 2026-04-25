import { useState } from "react";
import { Banknote, X } from "lucide-react";

const REASONS = [
  "خصم خاص",
  "سعر متفق عليه مسبقاً",
  "تالف جزئياً",
  "تصفية",
  "موافقة المدير",
];

export default function PriceOverrideModal({
  isOpen,
  onClose,
  itemName,
  currentPrice,
  resolvedPrice,
  onConfirm,
}) {
  const [newPrice, setNewPrice] = useState(currentPrice?.toString() || "");
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  if (!isOpen) return null;

  const priceDiffers =
    newPrice !== "" && Math.abs(parseFloat(newPrice) - resolvedPrice) > 0.01;
  const reasonValid = !priceDiffers || reason === "أخرى" ? customReason.trim() : reason;

  const handleConfirm = () => {
    const price = parseFloat(newPrice);
    if (isNaN(price) || price < 0) return;
    const finalReason = reason === "أخرى" ? customReason.trim() : reason;
    if (priceDiffers && !finalReason) return;
    onConfirm(price, finalReason || null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" dir="rtl">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote size={16} />
            <h3 className="font-bold text-sm">تعديل سعر: {itemName}</h3>
          </div>
          <button onClick={onClose} className="hover:bg-blue-700 rounded p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-xs text-gray-500">
            السعر الأصلي:{" "}
            <span className="font-bold text-gray-700">{resolvedPrice?.toFixed(2)} ج.م</span>
          </div>

          {/* New price input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">السعر الجديد</label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                className="w-full border rounded-lg p-2 text-left pr-12"
                dir="ltr"
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                ج.م
              </span>
            </div>
          </div>

          {/* Reason — only if price differs */}
          {priceDiffers && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                سبب التعديل *
              </label>
              <div className="space-y-1">
                {REASONS.map((r) => (
                  <label key={r} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="priceReason"
                      value={r}
                      checked={reason === r}
                      onChange={(e) => setReason(e.target.value)}
                    />
                    <span className="text-xs">{r}</span>
                  </label>
                ))}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priceReason"
                    value="أخرى"
                    checked={reason === "أخرى"}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <span className="text-xs">أخرى</span>
                </label>
                {reason === "أخرى" && (
                  <input
                    type="text"
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="اكتب السبب..."
                    className="w-full border rounded p-1.5 text-xs mt-1"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            إلغاء
          </button>
          <button
            onClick={handleConfirm}
            disabled={!newPrice || (priceDiffers && !reasonValid)}
            className="px-5 py-2 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            تأكيد
          </button>
        </div>
      </div>
    </div>
  );
}
