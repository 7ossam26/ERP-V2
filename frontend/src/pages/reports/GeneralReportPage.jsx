import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { reportService, branchService } from "../../services/domainServices";
import AuthService from "../../services/authService";
import BranchFilterHelper from "../../utils/BranchFilterHelper";
import { useSystemSettings } from "../../contexts/SystemSettingsContext";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
);

const getLocalToday = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date - offset).toISOString().slice(0, 10);
};

const hexToRgba = (hex, alpha) => {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => character + character)
          .join("")
      : normalized;

  const value = Number.parseInt(expanded, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const GeneralReportPage = () => {
  const currentUser = AuthService.getCurrentUser();
  const { activeTheme } = useSystemSettings();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [error, setError] = useState(null);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    startDate: getLocalToday(),
    endDate: getLocalToday(),
    branchId: BranchFilterHelper.getDefaultBranchId(currentUser),
  });

  const loadBranches = useCallback(async () => {
    try {
      const data = await branchService.getAll();
      const available = BranchFilterHelper.getAvailableBranches(
        data,
        currentUser,
      );
      const filteredBranches = available.filter(
        (branch) =>
          branch.name !== "Main Branch" && branch.name !== "All Branches",
      );
      setBranches(filteredBranches || []);
    } catch (err) {
      console.error("Failed to load branches", err);
    }
  }, [currentUser]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const formattedStart = filters.startDate;
      const formattedEnd = filters.endDate;

      const data = await reportService.getGeneralReport({
        startDate: formattedStart,
        endDate: formattedEnd,
        branchId: filters.branchId,
      });

      setReportData(data);
    } catch (err) {
      console.error("Error loading report:", err);
      // More friendly error message
      const msg =
        err.status === 403
          ? "غير مسموح لك بعرض هذا التقرير."
          : "فشل تحميل البيانات. تأكد من اتصال الخادم.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const primaryColor = activeTheme?.mui?.primary || "#325163";
  const secondaryColor = activeTheme?.mui?.secondary || "#4E7A98";
  const chartPalette = [
    primaryColor,
    secondaryColor,
    "#4F7BC9",
    "#E97132",
    "#34907D",
  ];

  // --- Chart Config ---
  // Ensure valid data structure even if reportData is null during transitions
  const salesChartData = {
    labels: reportData?.charts?.salesOverTime?.labels || [],
    datasets: [
      {
        label: "المبيعات (ر.س)",
        data: reportData?.charts?.salesOverTime?.data || [],
        borderColor: primaryColor,
        backgroundColor: hexToRgba(primaryColor, 0.12),
        tension: 0.4,
        fill: true,
        pointBackgroundColor: "#FFFFFF",
        pointBorderColor: primaryColor,
        pointBorderWidth: 2,
        pointRadius: 4,
      },
    ],
  };

  const salesOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: "rgba(0, 0, 0, 0.05)", borderDash: [5, 5] },
        ticks: { color: "#9CA3AF" },
      },
      x: {
        grid: { display: false },
        ticks: { color: "#9CA3AF" },
      },
    },
  };

  const pieChartData = {
    labels: reportData?.charts?.salesByItem?.labels || [],
    datasets: [
      {
        data: reportData?.charts?.salesByItem?.data || [],
        backgroundColor: chartPalette,
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "70%",
    plugins: {
      legend: { display: false },
    },
  };

  if (loading && !reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-primary font-bold">جاري تحميل التقرير...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="bg-background-light dark:bg-background-dark min-h-screen text-text-light dark:text-text-dark font-body transition-colors duration-300 p-4 sm:p-8"
      dir="rtl">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-primary mb-2">
            التقرير العام
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            ملخص أداء المبيعات والمخزون
          </p>
        </div>
        <Link
          to="/reports"
          className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors">
          <span className="material-icons-round rtl:rotate-180">
            arrow_forward
          </span>
          <span>العودة للتقارير</span>
        </Link>
      </div>

      {/* Filters Section */}
      <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl shadow-sm border border-border-light dark:border-border-dark mb-8">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full sm:w-auto flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              من تاريخ
            </label>
            <div className="relative">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  setFilters({ ...filters, startDate: e.target.value })
                }
                className="block w-full rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-surface-dark py-2.5 pr-3 pl-10 text-sm focus:border-primary focus:ring-primary dark:text-text-dark shadow-sm"
              />
              <span className="material-icons-round absolute left-3 top-2.5 text-gray-400 pointer-events-none text-lg">
                event
              </span>
            </div>
          </div>
          <div className="w-full sm:w-auto flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              إلى تاريخ
            </label>
            <div className="relative">
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) =>
                  setFilters({ ...filters, endDate: e.target.value })
                }
                className="block w-full rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-surface-dark py-2.5 pr-3 pl-10 text-sm focus:border-primary focus:ring-primary dark:text-text-dark shadow-sm"
              />
              <span className="material-icons-round absolute left-3 top-2.5 text-gray-400 pointer-events-none text-lg">
                event
              </span>
            </div>
          </div>
          <div className="w-full sm:w-auto flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              الفرع
            </label>
            <div className="relative">
              <select
                value={filters.branchId}
                onChange={(e) =>
                  setFilters({ ...filters, branchId: e.target.value })
                }
                className="block w-full rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-surface-dark py-2.5 pr-3 pl-10 text-sm focus:border-primary focus:ring-primary dark:text-text-dark shadow-sm">
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <span className="material-icons-round absolute left-3 top-2.5 text-gray-400 pointer-events-none text-lg">
                store
              </span>
            </div>
          </div>
          <div>
            <button
              onClick={fetchReport}
              className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors font-medium shadow-md shadow-primary/20 flex items-center justify-center gap-2">
              <span
                className={`material-icons-round text-lg ${
                  loading ? "animate-spin" : ""
                }`}>
                refresh
              </span>
              تحديث التقرير
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-8 border border-red-200">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-primary group-hover:w-3 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                إجمالي المبيعات
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {reportData?.summary?.totalSales?.toLocaleString()} ج.م
              </h3>
            </div>
            <div className="p-2 bg-primary/10 rounded-lg">
              <span className="material-icons-round text-primary text-xl">
                payments
              </span>
            </div>
          </div>
        </div>
        <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-emerald-500 group-hover:w-3 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                صافي الربح (تقريبي)
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {reportData?.summary?.netProfit?.toLocaleString()} ج.م
              </h3>
            </div>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <span className="material-icons-round text-emerald-600 dark:text-emerald-400 text-xl">
                savings
              </span>
            </div>
          </div>
        </div>
        <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-blue-500 group-hover:w-3 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                عدد الفواتير
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {reportData?.summary?.invoiceCount}
              </h3>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <span className="material-icons-round text-blue-600 dark:text-blue-400 text-xl">
                receipt_long
              </span>
            </div>
          </div>
        </div>
        <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-2 h-full bg-amber-500 group-hover:w-3 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                تنبيهات المخزون
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                {reportData?.summary?.stockAlerts} أصناف
              </h3>
            </div>
            <div className="p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
              <span className="material-icons-round text-amber-600 dark:text-amber-400 text-xl">
                inventory_2
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark p-6 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-primary">حركة المبيعات</h3>
          </div>
          <div className="h-64 w-full">
            <Line data={salesChartData} options={salesOptions} />
          </div>
        </div>
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-primary">
              توزيع المبيعات حسب الصنف
            </h3>
          </div>
          <div className="h-48 w-full relative flex justify-center">
            {/* If no data, show message */}
            {reportData?.charts?.salesByItem?.data?.length > 0 ? (
              <Doughnut data={pieChartData} options={pieOptions} />
            ) : (
              <div className="flex items-center justify-center text-gray-400">
                لا توجد بيانات
              </div>
            )}
          </div>
          {/* Custom Legend */}
          <div className="mt-4 space-y-2 max-h-40 overflow-y-auto">
            {reportData?.charts?.salesByItem?.labels?.map((label, index) => (
              <div key={index} className="flex justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        pieChartData.datasets[0].backgroundColor[index % 5],
                    }}></span>
                  <span className="text-gray-600 dark:text-gray-300">
                    {label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sales by Branch Table */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm mb-8 overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50/50 dark:bg-background-dark/60">
          <h3 className="text-lg font-bold text-primary flex items-center gap-2">
            <span className="material-icons-round">store</span>
            تفاصيل المبيعات حسب الفرع
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 dark:bg-background-dark/80 text-gray-500 dark:text-gray-400 font-medium">
              <tr>
                <th className="px-6 py-3">اسم الفرع</th>
                <th className="px-6 py-3">المبيعات (ج.م)</th>
                <th className="px-6 py-3 w-1/4">نسبة الإنجاز</th>
                <th className="px-6 py-3">عدد الفواتير</th>
                <th className="px-6 py-3">متوسط الفاتورة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {reportData?.tables?.salesByBranch?.map((branch, index) => (
                <tr
                  key={index}
                  className="hover:bg-gray-50 dark:hover:bg-surface-dark transition-colors group">
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <span className="material-icons-round text-sm">
                        apartment
                      </span>
                    </div>
                    {branch.name}
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                    {branch.totalSales?.toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium w-8">
                        {Math.round(branch.percentage)}%
                      </span>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full"
                          style={{ width: `${branch.percentage}%` }}></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                    {branch.invoiceCount}
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                    {Math.round(branch.averageInvoice)} ج.م
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory Alerts List */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm mb-8 overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50/50 dark:bg-background-dark/60">
          <h3 className="text-lg font-bold text-primary flex items-center gap-2">
            <span className="material-icons-round">warning</span>
            تنبيهات المخزون (أقل من حد الطلب)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 dark:bg-background-dark/80 text-gray-500 dark:text-gray-400 font-medium">
              <tr>
                <th className="px-6 py-3">الصنف</th>
                <th className="px-6 py-3">الكمية الحالية</th>
                <th className="px-6 py-3">حد الطلب</th>
                <th className="px-6 py-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              {reportData?.tables?.stockAlertsList?.map((item, index) => (
                <tr
                  key={index}
                  className="hover:bg-gray-50 dark:hover:bg-surface-dark transition-colors group">
                  <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                    {item.itemName}
                  </td>
                  <td className="px-6 py-4 font-bold text-rose-600 dark:text-rose-400">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {item.reorderPoint}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded-full text-xs">
                      منخفض جدًا
                    </span>
                  </td>
                </tr>
              ))}
              {(!reportData?.tables?.stockAlertsList ||
                reportData.tables.stockAlertsList.length === 0) && (
                <tr>
                  <td
                    colSpan="4"
                    className="px-6 py-8 text-center text-gray-500">
                    لا توجد تنبيهات مخزون حالياً
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default GeneralReportPage;
