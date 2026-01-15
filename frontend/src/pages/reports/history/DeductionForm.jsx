import React, { useState, useEffect } from "react";

const DeductionForm = ({ initialData, onSave, onClose, isSaving }) => {
  const [formData, setFormData] = useState({
    amount: "",
    reason: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (initialData) {
      // Parse original date for input field (YYYY-MM-DD local)
      let dateStr = new Date().toISOString().split("T")[0];
      if (initialData.originalDate) {
        const d = new Date(initialData.originalDate);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        dateStr = `${year}-${month}-${day}`;
      }

      setFormData({
        amount: initialData.amount || "",
        reason: initialData.reason || "",
        date: dateStr,
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Combine selected date (YYYY-MM-DD) with original time
    let finalDate = formData.date;
    if (initialData?.originalDate) {
      const [y, m, d] = formData.date.split("-").map(Number);
      const original = new Date(initialData.originalDate);
      // Create date with original time components (Local)
      const dateWithTime = new Date(
        y,
        m - 1,
        d,
        original.getHours(),
        original.getMinutes(),
        original.getSeconds()
      );
      finalDate = dateWithTime.toISOString(); // Convert back to ISO for backend
    } else {
      // Fallback for new items (though this form is edit-only mostly)
      finalDate = new Date(formData.date).toISOString();
    }

    onSave({ ...formData, date: finalDate });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
      {/* Employee Name (Read Only) */}
      {initialData?.employeeName && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
            الموظف
          </label>
          <input
            type="text"
            value={initialData.employeeName}
            disabled
            className="w-full p-2 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 border border-transparent"
          />
        </div>
      )}

      {/* Amount */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
          المبلغ
        </label>
        <input
          type="number"
          name="amount"
          value={formData.amount}
          onChange={handleChange}
          required
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
        />
      </div>

      {/* Reason */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
          السبب
        </label>
        <textarea
          name="reason"
          value={formData.reason}
          onChange={handleChange}
          required
          rows="3"
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none"
        />
      </div>

      {/* Date */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-bold text-gray-700 dark:text-gray-300">
          التاريخ
        </label>
        <input
          type="date"
          name="date"
          value={formData.date}
          onChange={handleChange}
          required
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-4">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="px-4 py-2 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          إلغاء
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-6 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          {isSaving ? "جاري الحفظ..." : "حفظ"}
        </button>
      </div>
    </form>
  );
};

export default DeductionForm;
