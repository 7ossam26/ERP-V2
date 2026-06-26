import React, { useState, useEffect } from "react";
import { expenseService } from "../../../services/domainServices";
import { expenseCategoryService } from "../../../services/expenseCategoryService";
import { branchService } from "../../../services/branchService";
import AuthService from "../../../services/authService";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const ExpenseAnalysisReport = () => {
    const navigate = useNavigate();
    const [branches, setBranches] = useState([]);
    const [categories, setCategories] = useState([]);
    const [filters, setFilters] = useState({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            .toISOString().split("T")[0],
        endDate: new Date().toISOString().split("T")[0],
        branchId: "all",
        categoryId: "all",
        paymentMethod: "all",
    });
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);

    useEffect(() => {
        const fetchLookups = async () => {
            try {
                const [branchData, catData] = await Promise.all([
                    branchService.getAll(),
                    expenseCategoryService.getAll(),
                ]);
                setBranches(Array.isArray(branchData) ? branchData : branchData.data || []);
                setCategories(Array.isArray(catData) ? catData : []);
            } catch (err) {
                console.error("Failed to load lookups", err);
            }
        };
        fetchLookups();
    }, []);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const params = {};
            if (filters.startDate) params.startDate = filters.startDate;
            if (filters.endDate) params.endDate = filters.endDate;
            if (filters.branchId !== "all") params.branchId = filters.branchId;
            if (filters.categoryId !== "all") params.categoryId = filters.categoryId;
            if (filters.paymentMethod !== "all") params.paymentMethod = filters.paymentMethod;

            const data = await expenseService.getReport(params);
            setReport(data);
            setHasLoaded(true);
        } catch (err) {
            toast.error(err.message || "فشل تحميل التقرير");
        } finally {
            setLoading(false);
        }
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleReset = () => {
        setFilters({
            startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                .toISOString().split("T")[0],
            endDate: new Date().toISOString().split("T")[0],
            branchId: "all",
            categoryId: "all",
            paymentMethod: "all",
        });
        setReport(null);
        setHasLoaded(false);
    };

    const fmtAmount = (n) => Number(n || 0).toLocaleString("ar-EG");
    const isAdmin = AuthService.hasSensitiveAccess();

    return (
        <div className="bg-surface-light dark:bg-surface-dark w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-100px)] transition-colors duration-200 print:h-auto print:shadow-none print:rounded-none">
            {/* Header */}
            <div className="px-6 py-5 sm:px-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-surface-dark z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="bg-primary text-white w-12 h-12 flex items-center justify-center rounded-xl shadow-lg print:hidden">
                        <span className="material-icons-round text-2xl">analytics</span>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                            تحليل المصروفات
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            إجماليات المصروفات حسب التصنيف والفرع خلال فترة محددة
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                    <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-bold transition-colors">
                        <span className="material-symbols-outlined text-[18px]">print</span>
                        طباعة
                    </button>
                    <button
                        onClick={() => navigate("/reports/detailed")}
                        className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                        <span className="material-icons-round text-2xl">close</span>
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="px-6 py-4 sm:px-8 bg-gray-50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-700 shrink-0 print:hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">من تاريخ</label>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={(e) => handleFilterChange("startDate", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm focus:ring-2 focus:ring-primary/30 outline-none font-numbers"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">إلى تاريخ</label>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={(e) => handleFilterChange("endDate", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm focus:ring-2 focus:ring-primary/30 outline-none font-numbers"
                        />
                    </div>
                    {isAdmin && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">الفرع</label>
                            <select
                                value={filters.branchId}
                                onChange={(e) => handleFilterChange("branchId", e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm focus:ring-2 focus:ring-primary/30 outline-none">
                                <option value="all">كل الفروع</option>
                                {branches.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">التصنيف</label>
                        <select
                            value={filters.categoryId}
                            onChange={(e) => handleFilterChange("categoryId", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm focus:ring-2 focus:ring-primary/30 outline-none">
                            <option value="all">كل التصنيفات</option>
                            <option value="uncategorized">غير مصنف</option>
                            {categories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">طريقة الدفع</label>
                        <select
                            value={filters.paymentMethod}
                            onChange={(e) => handleFilterChange("paymentMethod", e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm focus:ring-2 focus:ring-primary/30 outline-none">
                            <option value="all">الكل</option>
                            <option value="CASH">نقدي</option>
                            <option value="CARD">بطاقة بنكية</option>
                        </select>
                    </div>
                </div>
                <div className="flex gap-3 mt-3">
                    <button
                        onClick={fetchReport}
                        disabled={loading}
                        className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-5 py-2 rounded-lg text-sm font-bold transition-colors shadow-sm disabled:opacity-50">
                        <span className="material-symbols-outlined text-[18px]">filter_list</span>
                        {loading ? "جاري التحميل..." : "تطبيق الفلتر"}
                    </button>
                    <button
                        onClick={handleReset}
                        className="flex items-center gap-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-5 py-2 rounded-lg text-sm font-bold transition-colors">
                        <span className="material-symbols-outlined text-[18px]">restart_alt</span>
                        إعادة تعيين
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {!hasLoaded && !loading && (
                    <div className="text-center py-16 text-gray-400">
                        <span className="material-symbols-outlined text-6xl block mb-3">analytics</span>
                        <p className="text-lg font-medium">اختر الفترة الزمنية وانقر على "تطبيق الفلتر" لعرض التقرير</p>
                    </div>
                )}

                {loading && (
                    <div className="text-center py-16 text-gray-400">
                        <p>جاري تحميل البيانات...</p>
                    </div>
                )}

                {!loading && hasLoaded && report && (
                    <>
                        {/* Summary Total */}
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500 dark:text-gray-400">إجمالي المصروفات</p>
                                <p className="text-3xl font-bold text-primary mt-1 font-numbers">
                                    {fmtAmount(report.total)} <span className="text-base font-normal">ج.م</span>
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-500">عدد العمليات</p>
                                <p className="text-2xl font-bold text-gray-700 dark:text-gray-200 font-numbers">{report.rows?.length || 0}</p>
                            </div>
                        </div>

                        {/* By Category Summary */}
                        {report.byCategory && report.byCategory.length > 0 && (
                            <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="bg-gray-50 dark:bg-gray-800 px-5 py-3 font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-[20px]">label</span>
                                    إجمالي حسب التصنيف
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-right text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
                                            <tr>
                                                <th className="p-4">التصنيف</th>
                                                <th className="p-4 text-center">عدد العمليات</th>
                                                <th className="p-4">الإجمالي (ج.م)</th>
                                                <th className="p-4">النسبة</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {report.byCategory.map((cat, i) => (
                                                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                                                    <td className="p-4 font-bold text-gray-800 dark:text-gray-200">
                                                        <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">
                                                            {cat.name}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-center text-gray-500 font-numbers">{cat.count}</td>
                                                    <td className="p-4 font-bold text-red-600 font-numbers">
                                                        {fmtAmount(cat.total)}
                                                    </td>
                                                    <td className="p-4 text-gray-500 font-numbers">
                                                        {report.total > 0
                                                            ? `${((cat.total / report.total) * 100).toFixed(1)}%`
                                                            : "0%"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                                            <tr>
                                                <td className="p-4 font-bold text-gray-800 dark:text-gray-200">الإجمالي</td>
                                                <td className="p-4 text-center font-bold text-gray-800 dark:text-gray-200 font-numbers">
                                                    {report.rows?.length || 0}
                                                </td>
                                                <td className="p-4 font-bold text-red-600 font-numbers">
                                                    {fmtAmount(report.total)}
                                                </td>
                                                <td className="p-4 font-bold text-gray-500">100%</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* By Category × Branch */}
                        {report.byCategoryBranch && report.byCategoryBranch.length > 0 && isAdmin && (
                            <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="bg-gray-50 dark:bg-gray-800 px-5 py-3 font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-[20px]">store</span>
                                    تفصيل حسب التصنيف والفرع
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-right text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
                                            <tr>
                                                <th className="p-4">التصنيف</th>
                                                <th className="p-4">الفرع</th>
                                                <th className="p-4 text-center">عدد العمليات</th>
                                                <th className="p-4">الإجمالي (ج.م)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {report.byCategoryBranch.map((row, i) => (
                                                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                                                    <td className="p-4">
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                                                            {row.name}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-gray-700 dark:text-gray-300">{row.branchName}</td>
                                                    <td className="p-4 text-center text-gray-500 font-numbers">{row.count}</td>
                                                    <td className="p-4 font-bold text-red-600 font-numbers">
                                                        {fmtAmount(row.total)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Detail Table */}
                        {report.rows && report.rows.length > 0 ? (
                            <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="bg-gray-50 dark:bg-gray-800 px-5 py-3 font-bold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                    <span className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-primary text-[20px]">receipt_long</span>
                                        تفاصيل المصروفات
                                    </span>
                                    <span className="text-xs font-normal bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded-full">
                                        {report.rows.length} عملية
                                    </span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-right text-sm">
                                        <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700">
                                            <tr>
                                                <th className="p-4">التاريخ</th>
                                                <th className="p-4">الوصف</th>
                                                <th className="p-4">التصنيف</th>
                                                {isAdmin && <th className="p-4">الفرع</th>}
                                                <th className="p-4">طريقة الدفع</th>
                                                <th className="p-4">المبلغ (ج.م)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                            {report.rows.map((row, i) => (
                                                <tr key={i} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                                                    <td className="p-4 text-gray-500 font-numbers whitespace-nowrap">
                                                        {new Date(row.date).toLocaleDateString("en-CA")}
                                                    </td>
                                                    <td className="p-4 font-medium text-gray-800 dark:text-gray-200">
                                                        {row.description}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                                                            {row.categoryName}
                                                        </span>
                                                    </td>
                                                    {isAdmin && (
                                                        <td className="p-4 text-gray-600 dark:text-gray-400">{row.branchName}</td>
                                                    )}
                                                    <td className="p-4">
                                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${row.paymentMethod === "CASH" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                                                            {row.paymentMethod === "CASH" ? "نقدي" : "بطاقة"}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-bold text-red-600 font-numbers">
                                                        {fmtAmount(row.amount)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
                                            <tr>
                                                <td colSpan={isAdmin ? 5 : 4} className="p-4 font-bold text-gray-800 dark:text-gray-200">
                                                    الإجمالي
                                                </td>
                                                <td className="p-4 font-bold text-red-600 text-lg font-numbers">
                                                    {fmtAmount(report.total)} ج.م
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-gray-400">
                                <span className="material-symbols-outlined text-5xl block mb-2">search_off</span>
                                <p>لا توجد مصروفات تطابق هذه الفلاتر</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default ExpenseAnalysisReport;
