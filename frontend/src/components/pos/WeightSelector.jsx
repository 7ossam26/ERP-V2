import React, { useState } from "react";

const WeightSelector = ({ isOpen, onClose, onSelect, itemName }) => {
  const [selectedWeight, setSelectedWeight] = useState(null);
  const [customWeight, setCustomWeight] = useState("");

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
    setCustomWeight("");
  };

  const handleCustomWeightChange = (e) => {
    setCustomWeight(e.target.value);
    setSelectedWeight(null);
  };

  const handleConfirm = () => {
    const weight = customWeight ? parseFloat(customWeight) : selectedWeight;
    if (weight && weight > 0) {
      onSelect(weight);
      setSelectedWeight(null);
      setCustomWeight("");
      onClose();
    }
  };

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
          اختر الوزن (كجم)
        </p>

        {/* Weight Dial */}
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

        {/* Custom Weight Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            أو أدخل وزن مخصص:
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={customWeight}
            onChange={handleCustomWeightChange}
            placeholder="0.00"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-center text-xl font-bold focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        {/* Selected Weight Display */}
        {(selectedWeight || customWeight) && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4 text-center">
            <div className="text-sm text-green-700 dark:text-green-400">
              الوزن المحدد:
            </div>
            <div className="text-2xl font-bold text-green-800 dark:text-green-300">
              {customWeight || selectedWeight} كجم
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-3 rounded-lg transition-all">
            إلغاء
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedWeight && !customWeight}
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
