import React, { useState } from "react";

const PieceQuantitySelector = ({ isOpen, onClose, onSelect, itemName }) => {
  const [quantity, setQuantity] = useState("");

  if (!isOpen) return null;

  const handleNumberClick = (num) => {
    setQuantity((prev) => prev + num);
  };

  const handleClear = () => {
    setQuantity("");
  };

  const handleConfirm = () => {
    const qty = parseInt(quantity) || 1;
    if (qty > 0) {
      onSelect(qty);
      setQuantity("");
      onClose();
    }
  };

  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}></div>
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2">
          {itemName}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
          اختر الكمية (قطعة)
        </p>

        {/* Display */}
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4 text-center">
          <div className="text-3xl font-bold text-gray-800 dark:text-gray-100">
            {quantity || "0"}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            قطعة
          </div>
        </div>

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {numbers.map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num.toString())}
              className="bg-gray-100 dark:bg-gray-700 hover:bg-primary hover:text-white text-gray-800 dark:text-gray-100 font-bold py-4 rounded-lg transition-all text-xl">
              {num}
            </button>
          ))}
          <button
            onClick={handleClear}
            className="bg-red-100 dark:bg-red-900/30 hover:bg-red-500 hover:text-white text-red-600 dark:text-red-400 font-bold py-4 rounded-lg transition-all">
            C
          </button>
          <button
            onClick={() => handleNumberClick("0")}
            className="bg-gray-100 dark:bg-gray-700 hover:bg-primary hover:text-white text-gray-800 dark:text-gray-100 font-bold py-4 rounded-lg transition-all text-xl">
            0
          </button>
          <button
            onClick={handleConfirm}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-lg transition-all flex items-center justify-center">
            <span className="material-icons-round">check</span>
          </button>
        </div>

        {/* Cancel Button */}
        <button
          onClick={onClose}
          className="w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-bold py-3 rounded-lg transition-all">
          إلغاء
        </button>
      </div>
    </div>
  );
};

export default PieceQuantitySelector;
