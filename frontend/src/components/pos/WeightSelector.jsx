import React, { useState } from "react";

const WeightSelector = ({ isOpen, onClose, onSelect, itemName }) => {
  const [selectedWeight, setSelectedWeight] = useState(null);
  const [customKg, setCustomKg] = useState("");
  const [customGm, setCustomGm] = useState("");

  if (!isOpen) return null;

  const weights = [
    { value: 0.125, label: "1/8" },
    { value: 0.25, label: "1/4" },
    { value: 0.5, label: "1/2" },
    { value: 1, label: "1" },
    { value: 2, label: "2" },
    { value: 3, label: "3" },
  ];

  const handleWeightClick = (weight) => {
    setSelectedWeight(weight);
    setCustomKg("");
    setCustomGm("");
  };

  const handleCustomChange = () => {
    setSelectedWeight(null);
  };

  const handleConfirm = () => {
    let weight;
    if (selectedWeight !== null) {
      weight = selectedWeight;
    } else {
      const kg = parseFloat(customKg) || 0;
      const gm = Math.min(999, parseInt(customGm) || 0);
      weight = parseFloat((kg + gm / 1000).toFixed(3));
    }
    if (weight > 0) {
      onSelect(weight);
      setSelectedWeight(null);
      setCustomKg("");
      setCustomGm("");
      onClose();
    }
  };

  // Computed preview value for display
  const previewWeight =
    selectedWeight !== null
      ? selectedWeight
      : customKg || customGm
      ? parseFloat(
          ((parseFloat(customKg) || 0) +
            (Math.min(999, parseInt(customGm) || 0)) / 1000
          ).toFixed(3)
        )
      : null;

  const inputCls =
    "px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-center text-xl font-bold focus:ring-2 focus:ring-primary focus:border-transparent w-full";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}></div>
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2">
          {itemName}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
          اختر الوزن
        </p>

        {/* Preset Weights */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {weights.map((weight) => (
            <button
              key={weight.value}
              onClick={() => handleWeightClick(weight.value)}
              className={`py-6 rounded-lg font-bold text-xl transition-all ${
                selectedWeight === weight.value
                  ? "bg-primary text-white shadow-lg scale-105"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}>
              {weight.label}
              <div className="text-xs font-normal opacity-70">كجم</div>
            </button>
          ))}
        </div>

        {/* Custom kg + grams input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            أو أدخل وزن مخصص:
          </label>
          <div className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              <span className="text-xs font-bold text-primary block text-center">
                كيلوجرام
              </span>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={customKg}
                  onChange={(e) => {
                    setCustomKg(e.target.value);
                    handleCustomChange();
                  }}
                  placeholder="0"
                  className={inputCls}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-primary pointer-events-none">
                  ك
                </span>
              </div>
            </div>
            <span className="text-2xl font-bold text-gray-400 pb-3">+</span>
            <div className="flex-1 space-y-1">
              <span className="text-xs font-bold text-green-600 block text-center">
                جرام (0–999)
              </span>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="999"
                  step="1"
                  value={customGm}
                  onChange={(e) => {
                    setCustomGm(
                      String(Math.min(999, parseInt(e.target.value) || 0))
                    );
                    handleCustomChange();
                  }}
                  placeholder="0"
                  className={inputCls}
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-green-600 pointer-events-none">
                  جم
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        {previewWeight !== null && previewWeight > 0 && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4 text-center">
            <div className="text-sm text-green-700 dark:text-green-400">
              الوزن المحدد:
            </div>
            <div className="text-2xl font-bold text-green-800 dark:text-green-300">
              {previewWeight >= 1
                ? `${Math.floor(previewWeight)} ك ${Math.round((previewWeight % 1) * 1000)} جم`
                : `${Math.round(previewWeight * 1000)} جم`}
            </div>
            <div className="text-xs text-green-600 dark:text-green-500 mt-0.5">
              ({previewWeight} كجم)
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-3 rounded-lg transition-all">
            إلغاء
          </button>
          <button
            onClick={handleConfirm}
            disabled={!previewWeight || previewWeight <= 0}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2">
            <span className="material-icons-round">check</span>
            <span>تأكيد</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WeightSelector;
