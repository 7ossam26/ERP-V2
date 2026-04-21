import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { treasuryService } from "../../services/domainServices";
import { useSystemSettings } from "../../contexts/SystemSettingsContext";

const AddExpenseModal = ({ onClose, onAdd, onUpdate, expenseToEdit }) => {
  const { settings } = useSystemSettings();
  const [treasuries, setTreasuries] = useState([]);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    description: "",
    amount: "",
    treasuryId: "",
    paymentMethod: "CASH",
  });

  const taxEnabled = Boolean(settings.taxEnabledOnExpenses) && !expenseToEdit;
  const taxRate = Number(settings.taxRate) || 0;
  const baseAmount = Number(formData.amount || 0);
  const taxAmount = taxEnabled ? baseAmount * (taxRate / 100) : 0;
  const finalAmount = baseAmount + taxAmount;

  useEffect(() => {
    let cancelled = false;

    const fetchTreasuries = async () => {
      try {
        const data = await treasuryService.getAll();
        if (!cancelled) {
          setTreasuries(data);
          setFormData((current) => ({
            ...current,
            treasuryId:
              expenseToEdit?.treasuryId || current.treasuryId || data[0]?.id || "",
          }));
        }
      } catch (error) {
        if (!cancelled) {
          toast.error("فشل تحميل الخزائن");
        }
      }
    };

    fetchTreasuries();

    return () => {
      cancelled = true;
    };
  }, [expenseToEdit]);

  useEffect(() => {
    if (expenseToEdit) {
      setFormData({
        date: new Date(expenseToEdit.date).toISOString().split("T")[0],
        description: expenseToEdit.description,
        amount: expenseToEdit.amount,
        treasuryId: expenseToEdit.treasuryId,
        paymentMethod: expenseToEdit.paymentMethod,
      });
    }
  }, [expenseToEdit]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = () => {
    if (!formData.description.trim()) {
      toast.error("يرجى إدخال وصف المصروف");
      return;
    }

    if (!formData.amount || Number(formData.amount) <= 0) {
      toast.error("يرجى إدخال مبلغ صحيح أكبر من صفر");
      return;
    }

    if (!formData.treasuryId) {
      toast.error("يرجى اختيار الخزينة");
      return;
    }

    const payload = {
      ...formData,
      amount: taxEnabled ? finalAmount.toFixed(2) : formData.amount,
      baseAmount: formData.amount,
      taxAmount: taxEnabled ? taxAmount.toFixed(2) : "0.00",
    };

    if (expenseToEdit) {
      onUpdate(expenseToEdit.id, payload);
    } else {
      onAdd(payload);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-light/35 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-border-light bg-surface-light shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-light px-5 py-4">
          <h2 className="flex items-center gap-2 text-xl font-bold text-text-light">
            <span className="material-symbols-outlined text-primary">
              {expenseToEdit ? "edit" : "add_circle"}
            </span>
            {expenseToEdit ? "تعديل المصروف" : "إضافة مصروف جديد"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1 text-text-light/55 transition-colors hover:bg-red-50 hover:text-red-500">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-text-light">
                الخزينة
              </label>
              <select
                name="treasuryId"
                value={formData.treasuryId}
                onChange={handleChange}
                className="w-full rounded-xl border border-border-light bg-background-light px-4 py-2.5 text-text-light outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20">
                {treasuries.map((treasury) => (
                  <option key={treasury.id} value={treasury.id}>
                    {treasury.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-text-light">
                طريقة الدفع
              </label>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                className="w-full rounded-xl border border-border-light bg-background-light px-4 py-2.5 text-text-light outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20">
                <option value="CASH">نقدي</option>
                <option value="CARD">بطاقة بنكية</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-text-light">
              التاريخ
            </label>
            <input
              name="date"
              type="date"
              value={formData.date}
              onChange={handleChange}
              className="w-full rounded-xl border border-border-light bg-background-light px-4 py-2.5 text-text-light outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-text-light">
              الوصف
            </label>
            <input
              name="description"
              type="text"
              value={formData.description}
              onChange={handleChange}
              placeholder="مثال: فاتورة كهرباء أو خدمات صيانة"
              className="w-full rounded-xl border border-border-light bg-background-light px-4 py-2.5 text-text-light outline-none transition-all placeholder:text-text-light/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-text-light">
              {taxEnabled ? "المبلغ قبل الضريبة" : "المبلغ"}
            </label>
            <div className="relative">
              <input
                name="amount"
                type="number"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full rounded-xl border border-border-light bg-background-light px-4 py-2.5 pl-12 text-left text-text-light outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                style={{ direction: "ltr" }}
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-text-light/50">
                ج.م
              </span>
            </div>
          </div>

          {taxEnabled ? (
            <div className="rounded-[22px] border border-border-light bg-background-light px-4 py-4">
              <div className="mb-3 text-sm font-bold text-text-light">
                ملخص الضريبة
              </div>
              <div className="space-y-2 text-sm text-text-light/75">
                <div className="flex items-center justify-between">
                  <span>المبلغ الأساسي</span>
                  <span className="font-bold text-text-light">
                    {baseAmount.toFixed(2)} ج.م
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>الضريبة ({taxRate}%)</span>
                  <span className="font-bold text-text-light">
                    {taxAmount.toFixed(2)} ج.م
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-border-light pt-2 text-base font-bold text-primary">
                  <span>الإجمالي النهائي</span>
                  <span>{finalAmount.toFixed(2)} ج.م</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-3 border-t border-border-light bg-background-light/40 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border-light bg-surface-light px-5 py-2.5 font-bold text-text-light transition-colors hover:bg-accent/15">
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 font-bold text-white transition-colors hover:bg-primary-hover">
            <span className="material-symbols-outlined text-[20px]">
              {expenseToEdit ? "save" : "check"}
            </span>
            <span>{expenseToEdit ? "حفظ التعديلات" : "إضافة"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddExpenseModal;
