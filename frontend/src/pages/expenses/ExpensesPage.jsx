import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import AddExpenseModal from "./AddExpenseModal";
import { expenseService } from "../../services/domainServices";
import AuthService from "../../services/authService";
import { confirmAction } from "../../utils/toastUtils";
import { formatArabicDate } from "../../utils/formatters";

const ITEMS_PER_PAGE = 8;

const formatAmount = (value) => Number(value || 0).toLocaleString("en-US");

const getPeriodLabel = (selectedDate) => {
  if (selectedDate) {
    return `بتاريخ: ${selectedDate}`;
  }

  return `الشهر الحالي: ${new Intl.DateTimeFormat("ar-EG", {
    month: "long",
    year: "numeric",
  }).format(new Date())}`;
};

const ExpensesPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [expenses, setExpenses] = useState([]);
  const [editingExpense, setEditingExpense] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredExpenses = useMemo(() => {
    return (expenses || []).filter((expense) => {
      const matchesSearch = (expense.description || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      if (!selectedDate || !expense.date) {
        return matchesSearch;
      }

      const expenseDate = new Date(expense.date).toISOString().slice(0, 10);
      return matchesSearch && expenseDate === selectedDate;
    });
  }, [expenses, searchQuery, selectedDate]);

  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentItems = filteredExpenses.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.max(Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE), 1);
  const totalAmount = filteredExpenses.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );

  const fetchExpenses = async () => {
    try {
      const data = await expenseService.getAll();
      setExpenses(data);
    } catch (error) {
      toast.error(error.message || "فشل تحميل المصروفات");
    }
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleAddExpense = async (newExpense) => {
    try {
      await expenseService.create(newExpense);
      await fetchExpenses();
      toast.success("تمت إضافة المصروف بنجاح");
    } catch (error) {
      toast.error(error.message || "فشل إضافة المصروف");
    }
  };

  const handleUpdateExpense = async (id, updatedExpense) => {
    try {
      await expenseService.update(id, updatedExpense);
      await fetchExpenses();
      toast.success("تم تحديث المصروف بنجاح");
      setEditingExpense(null);
    } catch (error) {
      toast.error(error.message || "فشل تحديث المصروف");
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
  };

  const handleDelete = (id) => {
    confirmAction("هل أنت متأكد من حذف هذا المصروف؟", async () => {
      try {
        await expenseService.delete(id);
        setExpenses((current) => current.filter((item) => item.id !== id));
        toast.success("تم حذف المصروف بنجاح");
      } catch (error) {
        toast.error(error.message || "فشل حذف المصروف");
      }
    });
  };

  return (
    <>
      <div className="hidden w-full bg-white p-8 text-black print:block">
        <div className="mb-6 flex flex-col items-center">
          <h1 className="mb-2 text-3xl font-bold">تقرير المصروفات</h1>
          <p className="text-sm text-gray-600">{getPeriodLabel(selectedDate)}</p>
        </div>

        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="w-[15%] px-2 py-2 font-bold">التاريخ</th>
              <th className="w-[35%] px-2 py-2 font-bold">الوصف</th>
              <th className="w-[15%] px-2 py-2 font-bold">طريقة الدفع</th>
              <th className="w-[15%] px-2 py-2 font-bold">الخزينة</th>
              <th className="w-[20%] px-2 py-2 text-left font-bold">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.map((expense) => (
              <tr key={expense.id} className="border-b border-gray-300">
                <td className="px-2 py-2 font-numbers">
                  {formatArabicDate(expense.date)}
                </td>
                <td className="px-2 py-2">
                  {expense.description}
                  {expense.type === "PURCHASE" ? " (مشتريات)" : ""}
                </td>
                <td className="px-2 py-2">
                  {expense.paymentMethod === "CASH" ? "نقدي" : "بطاقة/أخرى"}
                </td>
                <td className="px-2 py-2">{expense.treasury?.name || "-"}</td>
                <td className="px-2 py-2 text-left font-bold font-numbers">
                  {formatAmount(expense.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 text-lg font-bold">
              <td colSpan="4" className="px-2 py-3 text-right">
                الإجمالي
              </td>
              <td className="px-2 py-3 text-left font-numbers">
                {formatAmount(totalAmount)} ج.م
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-8 flex justify-end border-t pt-4 text-sm text-gray-600">
          <p>طباعة بواسطة: {AuthService.getCurrentUser()?.name || "مسؤول النظام"}</p>
        </div>
      </div>

      <div className="flex h-[calc(100vh-6rem)] flex-col overflow-hidden print:hidden">
        <header className="flex h-16 items-center justify-between border-b border-border-light bg-surface-light px-4 md:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 text-text-light"
              aria-label="القائمة">
              <span className="material-symbols-outlined">menu</span>
            </button>
            <h1 className="text-lg font-bold text-text-light">المصروفات</h1>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
            {AuthService.getCurrentUser()?.name?.slice(0, 1) || "ن"}
          </div>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-4 md:p-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="flex flex-col gap-1">
              <h1 className="text-3xl font-bold tracking-tight text-text-light">
                لوحة المصروفات
              </h1>
              <p className="text-sm text-text-light/70">
                متابعة المصروفات اليومية ومراجعة حركة الخزائن مع طباعة تقرير عربي موحد.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg border border-border-light bg-surface-light px-4 py-2 text-sm font-bold text-text-light/75 shadow-sm transition-colors hover:bg-accent/20 hover:text-primary">
                <span className="material-symbols-outlined text-[20px]">
                  download
                </span>
                <span>تصدير تقرير</span>
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white shadow-md transition-all hover:brightness-95">
                <span className="material-symbols-outlined text-[20px]">add</span>
                <span>إضافة مصروف</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-border-light bg-surface-light p-4 shadow-sm md:flex-row">
            <div className="relative w-full md:w-96">
              <label htmlFor="expenseSearch" className="sr-only">
                البحث في وصف المصروف
              </label>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[20px] text-text-light/70 material-symbols-outlined">
                search
              </span>
              <input
                id="expenseSearch"
                className="w-full rounded-lg border border-border-light bg-background-light py-2.5 pl-4 pr-10 text-sm text-text-light outline-none transition-all placeholder:text-text-light/50 focus:border-primary focus:ring-1 focus:ring-primary"
                placeholder="بحث في الوصف..."
                type="text"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>

            <div className="flex w-full gap-3 overflow-x-auto pb-1 md:w-auto md:pb-0">
              <div className="relative min-w-[160px]">
                <label htmlFor="expenseDate" className="sr-only">
                  التصفية حسب التاريخ
                </label>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <span className="text-[18px] text-text-light/70 material-symbols-outlined">
                    calendar_month
                  </span>
                </div>
                <input
                  id="expenseDate"
                  className="block w-full rounded-lg border border-border-light bg-background-light p-2.5 pr-10 text-sm text-text-light outline-none focus:border-primary focus:ring-primary"
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>

              {(searchQuery || selectedDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedDate("");
                  }}
                  className="whitespace-nowrap rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-200">
                  مسح الفلاتر
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-xl border border-border-light bg-surface-light shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="border-b border-border-light bg-background-light font-bold text-text-light">
                  <tr>
                    <th className="rounded-tr-lg px-6 py-4">التاريخ</th>
                    <th className="w-1/3 px-6 py-4">الوصف</th>
                    <th className="px-6 py-4">طريقة الدفع</th>
                    <th className="px-6 py-4">الخزينة</th>
                    <th className="px-6 py-4">المبلغ</th>
                    <th className="rounded-tl-lg px-6 py-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {currentItems.length > 0 ? (
                    currentItems.map((expense) => (
                      <tr
                        key={expense.id}
                        className="group transition-colors hover:bg-accent/20">
                        <td className="whitespace-nowrap px-6 py-3 font-medium font-numbers text-text-light/70">
                          {formatArabicDate(expense.date)}
                        </td>
                        <td className="px-6 py-3 font-bold text-text-light">
                          <div className="flex items-center gap-2">
                            {expense.description}
                            {expense.type === "PURCHASE" ? (
                              <span className="rounded border border-purple-200 bg-purple-100 px-2 py-0.5 text-xs font-normal text-purple-700">
                                مشتريات
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-text-light/70">
                          {expense.paymentMethod === "CASH" ? "نقدي" : "بطاقة/أخرى"}
                        </td>
                        <td className="px-6 py-3 text-text-light/70">
                          {expense.treasury?.name || "-"}
                        </td>
                        <td className="px-6 py-3 font-bold font-numbers text-text-light">
                          {formatAmount(expense.amount)}{" "}
                          <span className="text-xs font-normal text-text-light/70">
                            ج.م
                          </span>
                        </td>
                        <td className="px-6 py-3 text-center">
                          {expense.type === "MANUAL" ? (
                            AuthService.hasSensitiveAccess() ? (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingExpense(expense);
                                    setIsModalOpen(true);
                                  }}
                                  className="rounded p-1 text-text-light/70 transition-colors hover:bg-primary/10 hover:text-primary"
                                  title="تعديل">
                                  <span className="material-symbols-outlined text-[18px]">
                                    edit
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(expense.id)}
                                  className="rounded p-1 text-text-light/70 transition-colors hover:bg-red-50 hover:text-red-600"
                                  title="حذف">
                                  <span className="material-symbols-outlined text-[18px]">
                                    delete
                                  </span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">
                                لا توجد صلاحية
                              </span>
                            )
                          ) : (
                            <div
                              className="flex items-center justify-center gap-1 text-gray-400"
                              title="مصروف تلقائي مرتبط بالمشتريات">
                              <span className="material-symbols-outlined text-[16px]">
                                lock
                              </span>
                              <span className="text-[10px]">تلقائي</span>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-gray-500">
                        لا توجد مصروفات لعرضها
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredExpenses.length > 0 && (
              <div className="flex items-center justify-between border-t border-border-light bg-surface-light p-4">
                <span className="text-sm text-text-light/70">
                  عرض{" "}
                  <span className="font-bold font-numbers text-text-light">
                    {indexOfFirstItem + 1}
                  </span>{" "}
                  إلى{" "}
                  <span className="font-bold font-numbers text-text-light">
                    {Math.min(indexOfLastItem, filteredExpenses.length)}
                  </span>{" "}
                  من أصل{" "}
                  <span className="font-bold font-numbers text-text-light">
                    {filteredExpenses.length}
                  </span>{" "}
                  سجل
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((pageNumber) => Math.max(pageNumber - 1, 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg p-2 text-text-light/70 transition-colors hover:bg-background-light disabled:cursor-not-allowed disabled:opacity-50">
                    <span className="material-symbols-outlined rotate-180 text-[18px]">
                      chevron_right
                    </span>
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                    let pageNumber = index + 1;
                    if (totalPages > 5 && currentPage > 3) {
                      pageNumber = currentPage - 2 + index;
                    }
                    if (pageNumber > totalPages) {
                      pageNumber = totalPages - (4 - index);
                    }

                    return (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() => setCurrentPage(pageNumber)}
                        className={`rounded-lg px-3 py-1 text-sm font-bold font-numbers transition-colors ${
                          currentPage === pageNumber
                            ? "bg-primary text-white"
                            : "text-text-light hover:bg-background-light"
                        }`}>
                        {pageNumber}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentPage((pageNumber) => Math.min(pageNumber + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    className="rounded-lg p-2 text-text-light/70 transition-colors hover:bg-background-light disabled:cursor-not-allowed disabled:opacity-50">
                    <span className="material-symbols-outlined rotate-180 text-[18px]">
                      chevron_left
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {isModalOpen ? (
          <AddExpenseModal
            onClose={closeModal}
            onAdd={handleAddExpense}
            onUpdate={handleUpdateExpense}
            expenseToEdit={editingExpense}
          />
        ) : null}
      </div>
    </>
  );
};

export default ExpensesPage;
