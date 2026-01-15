import React, { useState, useEffect } from "react";
import AddDepositModal from "./AddDepositModal";
import { depositService } from "../../services/depositService";
import toast from "react-hot-toast";

const DepositPage = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [deposits, setDeposits] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Derived state for filtering and pagination
    const filteredDeposits = deposits.filter(deposit => {
        const matchesSearch = deposit.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            deposit.treasury?.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDate = selectedDate ? new Date(deposit.date).toISOString().split('T')[0] === selectedDate : true;
        return matchesSearch && matchesDate;
    });

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredDeposits.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredDeposits.length / itemsPerPage);

    const fetchDeposits = async () => {
        try {
            const data = await depositService.getAll();
            setDeposits(data);
        } catch (error) {
            console.error("Failed to fetch deposits", error);
            toast.error("فشل تحميل الإيداعات");
        }
    };

    useEffect(() => {
        fetchDeposits();
    }, []);

    const handleAddDeposit = async (newDeposit) => {
        try {
            await depositService.create(newDeposit);
            await fetchDeposits();
            toast.success("تم إضافة الإيداع بنجاح");
        } catch (error) {
            console.error("Failed to add deposit", error);
            toast.error("فشل إضافة الإيداع");
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] overflow-hidden">
            {/* Mobile Header */}
            <header className="h-16 flex md:hidden items-center justify-between px-4 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark shrink-0">
                <div className="flex items-center gap-2">
                    <button className="p-2 -mr-2 text-text-light dark:text-text-dark">
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                    <h1 className="font-bold text-lg text-text-light dark:text-text-dark">
                        الإيداعات
                    </h1>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-text-light dark:text-text-dark text-3xl font-bold tracking-tight">
                            لوحة الإيداعات
                        </h1>
                        <p className="text-text-light/70 dark:text-text-dark/70 text-sm">
                            إدارة الإيداعات المالية المباشرة
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-text-dark px-5 py-2 rounded-lg text-sm font-bold shadow-md hover:shadow-lg transition-all">
                            <span className="material-symbols-outlined text-[20px]">add</span>
                            <span>إضافة إيداع</span>
                        </button>
                    </div>
                </div>

                {/* Search and Filters */}
                <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-xl border border-border-light dark:border-border-dark shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <span className="material-symbols-outlined absolute top-1/2 right-3 -translate-y-1/2 text-text-light/70 dark:text-text-dark/70 pointer-events-none text-[20px]">
                            search
                        </span>
                        <input
                            className="w-full pr-10 pl-4 py-2.5 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg text-sm text-text-light dark:text-text-dark focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-text-light/50 dark:placeholder:text-text-dark/50"
                            placeholder="بحث في الوصف أو الخزينة..."
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
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
                                    <th className="px-6 py-4 rounded-tr-lg" scope="col">التاريخ</th>
                                    <th className="px-6 py-4 w-1/3" scope="col">الوصف</th>
                                    <th className="px-6 py-4" scope="col">الخزينة</th>
                                    <th className="px-6 py-4" scope="col">المبلغ</th>
                                    <th className="px-6 py-4 rounded-tl-lg text-center" scope="col">بواسطة</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                {currentItems.length > 0 ? (
                                    currentItems.map((deposit) => (
                                        <tr key={deposit.id} className="hover:bg-accent/20 dark:hover:bg-accent/5 transition-colors group">
                                            <td className="px-6 py-3 font-medium text-text-light/70 dark:text-text-dark/70 font-numbers whitespace-nowrap">
                                                {new Date(deposit.date).toLocaleDateString("en-CA")}
                                            </td>
                                            <td className="px-6 py-3 font-bold text-text-light dark:text-text-dark">
                                                {deposit.description || "-"}
                                            </td>
                                            <td className="px-6 py-3 text-text-light/70 dark:text-text-dark/70">
                                                {deposit.treasury?.name || "-"}
                                            </td>
                                            <td className="px-6 py-3 font-bold text-success font-numbers">
                                                {Number(deposit.amount).toLocaleString()}{" "}
                                                <span className="text-xs font-normal text-text-light/70 dark:text-text-dark/70">
                                                    ج.م
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-center text-text-light/70 dark:text-text-dark/70">
                                                {deposit.createdBy?.name || "-"}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="text-center py-8 text-gray-500">
                                            لا توجد إيداعات لعرضها
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
                                عرض <span className="font-bold text-text-light dark:text-text-dark font-numbers">{indexOfFirstItem + 1}</span> إلى <span className="font-bold text-text-light dark:text-text-dark font-numbers">{Math.min(indexOfLastItem, filteredDeposits.length)}</span> من أصل <span className="font-bold text-text-light dark:text-text-dark font-numbers">{filteredDeposits.length}</span> سجل
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg hover:bg-background-light dark:hover:bg-background-dark text-text-light/70 dark:text-text-dark/70 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <span className="material-symbols-outlined text-[18px] transform rotate-180">chevron_right</span>
                                </button>
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                    let pageNum = i + 1;
                                    if (totalPages > 5) {
                                        if (currentPage > 3) {
                                            pageNum = currentPage - 2 + i;
                                        }
                                        if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                                    }
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
                                    <span className="material-symbols-outlined text-[18px] transform rotate-180">chevron_left</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <AddDepositModal
                    onClose={() => setIsModalOpen(false)}
                    onAdd={handleAddDeposit}
                />
            )}
        </div>
    );
};

export default DepositPage;
