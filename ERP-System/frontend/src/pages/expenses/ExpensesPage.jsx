import React, { useState, useEffect } from "react";
import AddExpenseModal from "./AddExpenseModal";
import { expenseService } from "../../services/domainServices";
import AuthService from "../../services/authService";
import toast from "react-hot-toast";
import { confirmAction } from "../../utils/toastUtils";

const ExpensesPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [expenses, setExpenses] = useState([]);
    const [editingExpense, setEditingExpense] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Derived state for filtering and pagination
    const filteredExpenses = (expenses || []).filter(expense => {
        const matchesSearch = (expense.description || "").toLowerCase().includes(searchQuery.toLowerCase());

        let matchesDate = true;
        if (selectedDate && expense.date) {
            try {
                const expenseDate = new Date(expense.date).toISOString().split('T')[0];
                matchesDate = expenseDate === selectedDate;
            } catch (e) {
                console.error("Invalid date encountered:", expense.date);
                matchesDate = false;
            }
        }

        return matchesSearch && matchesDate;
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredExpenses.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);

    const fetchExpenses = async () => {
        try {
            const data = await expenseService.getAll();
            setExpenses(data);
        } catch (error) {
            console.error("Failed to fetch expenses", error);
        }
    };

    useEffect(() => {
        fetchExpenses();
    }, []);

    const handleAddExpense = async (newExpense) => {
        try {
            await expenseService.create(newExpense);
            await fetchExpenses();
            toast.success("تم إضافة المصروف بنجاح");
        } catch (error) {
            console.error("Failed to add expense", error);
            toast.error("فشل إضافة المصروف");
        }
    };

    const handleUpdateExpense = async (id, updatedExpense) => {
        try {
            await expenseService.update(id, updatedExpense);
            await fetchExpenses();
            toast.success("تم تحديث المصروف بنجاح");
            setEditingExpense(null);
        } catch (error) {
            console.error("Failed to update expense", error);
            toast.error("فشل تحديث المصروف");
        }
    };

    const openEditModal = (expense) => {
        setEditingExpense(expense);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingExpense(null);
    };

    const handleDelete = (id) => {
        confirmAction("هل أنت متأكد من حذف هذا المصروف؟", async () => {
            try {
                await expenseService.delete(id);
                setExpenses((prev) => prev.filter((item) => item.id !== id));
                toast.success("تم حذف المصروف بنجاح");
            } catch (error) {
                console.error("Failed to delete expense", error);
                toast.error("فشل حذف المصروف");
            }
        });
    };


    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] overflow-hidden">
            {/* Mobile Header (if needed distinct from MainLayout, otherwise optional) */}
            <header className="h-16 flex md:hidden items-center justify-between px-4 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark shrink-0">
                <div className="flex items-center gap-2">
                    <button className="p-2 -mr-2 text-text-light dark:text-text-dark">
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                    <h1 className="font-bold text-lg text-text-light dark:text-text-dark">
                        المصروفات
                    </h1>
                </div>
                <div
                    className="bg-center bg-no-repeat bg-cover rounded-full size-8"
                    style={{
                        backgroundImage:
                            'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCnoRhqBbt6lR2z8y-C-Hh1nNUmvPfFgKHxkBKFt9Z3cub_vUoy4BbsKAulil81qv5j2qfXYqT9ObJkuJM--9Ch1-wA_tFjnnx-MXQ0tzfZWLzwAqvJqqLVUI7fjmt9qtWbq-yZAX2XSk6LmjMC4pzaF83ulSJU0t8d7vHrvh81qpMjG6mgR2ZV8EJTvq4c5q9JQKzYwbM9DxNPftyFCHu1Iw1HsC1b_YFmiaZZvs0vq34DD5O9jW5U7Wsu_57exeFlw6d7OH21BoPe")',
                    }}></div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-text-light dark:text-text-dark text-3xl font-bold tracking-tight">
                            لوحة المصروفات
                        </h1>
                        <p className="text-text-light/70 dark:text-text-dark/70 text-sm">
                            نظرة عامة على النفقات المالية وإدارتها لشهر يناير 2024
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => window.print()}
                            className="flex items-center gap-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark hover:bg-accent/20 text-text-light/70 dark:text-text-dark/70 hover:text-primary px-4 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm">
                            <span className="material-symbols-outlined text-[20px]">
                                download
                            </span>
                            <span>تصدير تقرير</span>
                        </button>
                        <button
                            onClick={() => setIsModalOpen(true)} // This is fine, editingExpense is null by default
                            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-text-dark px-5 py-2 rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all">
                            <span className="material-symbols-outlined text-[20px]">add</span>
                            <span>إضافة مصروف</span>
                        </button>
                    </div>
                </div>

                // Search and Filters
                <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-border-light dark:border-border-dark shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <span className="material-symbols-outlined absolute top-1/2 right-3 -translate-y-1/2 text-text-light/70 dark:text-text-dark/70 pointer-events-none text-[20px]">
                            search
                        </span>
                        <input
                            className="w-full pr-10 pl-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-text-light dark:text-text-dark focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-text-light/50 dark:placeholder:text-text-dark/50"
                            placeholder="بحث في الوصف..."
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1); // Reset to first page on search
                            }}
                        />
                    </div>
                    <div className="flex w-full md:w-auto gap-3 overflow-x-auto pb-1 md:pb-0">
                        <div className="relative min-w-[160px]">
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                <span className="material-symbols-outlined text-text-light/70 dark:text-text-dark/70 text-[18px]">
                                    calendar_month
                                </span>
                            </div>
                            <input
                                className="bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-sm rounded-lg focus:ring-primary focus:border-primary block w-full pr-10 p-2.5 outline-none font-numbers"
                                type="date"
                                value={selectedDate}
                                onChange={(e) => {
                                    setSelectedDate(e.target.value);
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        {/* Clear Filters Button */}
                        {(searchQuery || selectedDate) && (
                            <button
                                onClick={() => {
                                    setSearchQuery("");
                                    setSelectedDate("");
                                    setCurrentPage(1);
                                }}
                                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors whitespace-nowrap">
                                مسح الفلاتر
                            </button>
                        )}
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden flex flex-col">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-right">
                            <thead className="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark font-bold border-b border-border-light dark:border-border-dark">
                                <tr>
                                    <th className="px-6 py-4 rounded-tr-lg" scope="col">
                                        التاريخ
                                    </th>
                                    <th className="px-6 py-4 w-1/3" scope="col">
                                        الوصف
                                    </th>
                                    <th className="px-6 py-4" scope="col">
                                        طريقة الدفع
                                    </th>
                                    <th className="px-6 py-4" scope="col">
                                        الخزينة
                                    </th>
                                    <th className="px-6 py-4" scope="col">
                                        المبلغ
                                    </th>
                                    <th
                                        className="px-6 py-4 rounded-tl-lg text-center"
                                        scope="col">
                                        إجراءات
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                {currentItems.length > 0 ? (
                                    currentItems.map((expense) => (
                                        <tr
                                            key={expense.id}
                                            className="hover:bg-accent/20 dark:hover:bg-accent/5 transition-colors group">
                                            <td className="px-6 py-3 font-medium text-text-light/70 dark:text-text-dark/70 font-numbers whitespace-nowrap">
                                                {new Date(expense.date).toLocaleDateString("en-CA")}
                                            </td>
                                            <td className="px-6 py-3 font-bold text-text-light dark:text-text-dark">
                                                <div className="flex items-center gap-2">
                                                    {expense.description}
                                                    {expense.type === "PURCHASE" && (
                                                        <span className="px-2 py-0.5 rounded text-xs font-normal bg-purple-100 text-purple-700 border border-purple-200">
                                                            مشتريات
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-text-light/70 dark:text-text-dark/70">
                                                {expense.paymentMethod === "CASH" ? "نقدي" : "بطاقة/أخرى"}
                                            </td>
                                            <td className="px-6 py-3 text-text-light/70 dark:text-text-dark/70">
                                                {expense.treasury?.name || "-"}
                                            </td>
                                            <td className="px-6 py-3 font-bold text-text-light dark:text-text-dark font-numbers">
                                                {Number(expense.amount).toLocaleString()}{" "}
                                                <span className="text-xs font-normal text-text-light/70 dark:text-text-dark/70">
                                                    ج.م
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                {expense.type === "MANUAL" && AuthService.hasSensitiveAccess() && (
                                                    <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {/* Edit button removed to enforce immutability */}
                                                        <button
                                                            onClick={() => handleDelete(expense.id)}
                                                            className="text-text-light/70 hover:text-red-600 dark:text-text-dark/70 dark:hover:text-red-400 transition-colors bg-surface-light dark:bg-surface-dark hover:bg-surface-light dark:hover:bg-surface-dark border border-transparent hover:border-red-100 dark:hover:border-red-900/30 rounded p-1"
                                                            title="حذف">
                                                            <span className="material-symbols-outlined text-[18px]">
                                                                delete
                                                            </span>
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" className="text-center py-8 text-gray-500">
                                            لا توجد مصروفات لعرضها
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 0 && (
                        <div className="p-4 bg-surface-light dark:bg-surface-dark border-t border-border-light dark:border-border-dark flex items-center justify-between">
                            <span className="text-sm text-text-light/70 dark:text-text-dark/70">
                                عرض{" "}
                                <span className="font-bold text-text-light dark:text-text-dark font-numbers">
                                    {indexOfFirstItem + 1}
                                </span>{" "}
                                إلى{" "}
                                <span className="font-bold text-text-light dark:text-text-dark font-numbers">
                                    {Math.min(indexOfLastItem, filteredExpenses.length)}
                                </span>{" "}
                                من أصل{" "}
                                <span className="font-bold text-text-light dark:text-text-dark font-numbers">
                                    {filteredExpenses.length}
                                </span>{" "}
                                سجل
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg hover:bg-background-light dark:hover:bg-background-dark text-text-light/70 dark:text-text-dark/70 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <span className="material-symbols-outlined text-[18px] transform rotate-180">
                                        chevron_right
                                    </span>
                                </button>

                                {/* Page Numbers */}
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    // Simple logic to show a window of pages around current or just first 5 for now
                                    // Doing a simple 1..N loop for simplicity as "paging in it wrong" implies functional brokenness
                                    let pageNum = i + 1;
                                    if (totalPages > 5) {
                                        if (currentPage > 3) {
                                            pageNum = currentPage - 2 + i;
                                        }
                                        if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                                    }

                                    // Ensure we don't go out of bounds
                                    if (pageNum < 1) pageNum = i + 1;

                                    return (
                                        <button
                                            key={pageNum}
                                            onClick={() => setCurrentPage(pageNum)}
                                            className={`px-3 py-1 rounded-lg text-sm font-bold font-numbers transition-colors ${currentPage === pageNum
                                                ? "bg-primary text-text-dark"
                                                : "hover:bg-background-light dark:hover:bg-background-dark text-text-light dark:text-text-dark"
                                                }`}>
                                            {pageNum}
                                        </button>
                                    );
                                })}

                                <button
                                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg hover:bg-background-light dark:hover:bg-background-dark text-text-light/70 dark:text-text-dark/70 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <span className="material-symbols-outlined text-[18px] transform rotate-180">
                                        chevron_left
                                    </span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <AddExpenseModal
                    onClose={closeModal}
                    onAdd={handleAddExpense}
                    onUpdate={handleUpdateExpense}
                    expenseToEdit={editingExpense}
                />
            )}
        </div>
    );
};

export default ExpensesPage;
