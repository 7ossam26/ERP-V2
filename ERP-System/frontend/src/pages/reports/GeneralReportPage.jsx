import React from "react";
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

const GeneralReportPage = () => {
  // --- Chart Data & Options ---
  const salesData = {
    labels: [
      "8:00",
      "10:00",
      "12:00",
      "14:00",
      "16:00",
      "18:00",
      "20:00",
      "22:00",
    ],
    datasets: [
      {
        label: "المبيعات اليومية (ر.س)",
        data: [120, 450, 1200, 980, 2400, 3100, 2800, 1400],
        borderColor: "#6F4E37",
        backgroundColor: "rgba(111, 78, 55, 0.1)",
        tension: 0.4,
        fill: true,
        pointBackgroundColor: "#FFFFFF",
        pointBorderColor: "#6F4E37",
        pointBorderWidth: 2,
        pointRadius: 4,
      },
    ],
  };

  const salesOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
          borderDash: [5, 5],
        },
        ticks: { color: "#9CA3AF" },
      },
      x: {
        grid: { display: false },
        ticks: { color: "#9CA3AF" },
      },
    },
  };

  const pieData = {
    labels: ["بن برازيلي", "بن إثيوبي", "إضافات"],
    datasets: [
      {
        data: [45, 30, 25],
        backgroundColor: ["#6F4E37", "#A1887F", "#D7CCC8"],
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
            ملخص أداء المبيعات والمخزون لليوم الحالي
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
          <div className="w-full sm:w-auto flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              الفترة الزمنية
            </label>
            <div className="relative">
              <select className="block w-full rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-[#3E332F] py-2.5 pr-3 pl-10 text-sm focus:border-primary focus:ring-primary dark:text-text-dark shadow-sm">
                <option>اليوم (24 أكتوبر 2023)</option>
                <option>أمس</option>
                <option>آخر 7 أيام</option>
                <option>هذا الشهر</option>
                <option>مخصص</option>
              </select>
              <span className="material-icons-round absolute left-3 top-2.5 text-gray-400 pointer-events-none text-lg">
                calendar_today
              </span>
            </div>
          </div>
          <div className="w-full sm:w-auto flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              الفرع
            </label>
            <div className="relative">
              <select className="block w-full rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-[#3E332F] py-2.5 pr-3 pl-10 text-sm focus:border-primary focus:ring-primary dark:text-text-dark shadow-sm">
                <option>الفرع الرئيسي -الدقي</option>
                <option>فرع مول مصر</option>
                <option>فرع مول العرب</option>
                <option>الكل</option>
              </select>
              <span className="material-icons-round absolute left-3 top-2.5 text-gray-400 pointer-events-none text-lg">
                store
              </span>
            </div>
          </div>
          <div>
            <button className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors font-medium shadow-md shadow-primary/20 flex items-center justify-center gap-2">
              <span className="material-icons-round text-lg">refresh</span>
              تحديث التقرير
            </button>
          </div>
        </div>
      </div>

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
                12,450 ج.م
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
          <div className="absolute top-0 right-0 w-2 h-full bg-success group-hover:w-3 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                صافي الربح
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                4,200 ج.م
              </h3>
            </div>
            <div className="p-2 bg-success/10 rounded-lg">
              <span className="material-icons-round text-success text-xl">
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
                145
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
          <div className="absolute top-0 right-0 w-2 h-full bg-warning group-hover:w-3 transition-all"></div>
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                تنبيهات المخزون
              </p>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                3 أصناف
              </h3>
            </div>
            <div className="p-2 bg-warning/10 rounded-lg">
              <span className="material-icons-round text-warning text-xl">
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
            <h3 className="text-lg font-bold text-primary">
              حركة المبيعات (بالساعة)
            </h3>
            <button className="text-gray-400 hover:text-primary transition-colors">
              <span className="material-icons-round">more_horiz</span>
            </button>
          </div>
          <div className="h-64 w-full">
            <Line data={salesData} options={salesOptions} />
          </div>
        </div>
        <div className="bg-surface-light dark:bg-surface-dark p-6 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-primary">
              توزيع المبيعات حسب الصنف
            </h3>
            <button className="text-gray-400 hover:text-primary transition-colors">
              <span className="material-icons-round">more_horiz</span>
            </button>
          </div>
          <div className="h-48 w-full relative flex justify-center">
            <Doughnut data={pieData} options={pieOptions} />
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#6F4E37]"></span>
                <span className="text-gray-600 dark:text-gray-300">
                  بن برازيلي
                </span>
              </div>
              <span className="font-bold text-gray-800 dark:text-white">
                45%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#A1887F]"></span>
                <span className="text-gray-600 dark:text-gray-300">
                  بن إثيوبي
                </span>
              </div>
              <span className="font-bold text-gray-800 dark:text-white">
                30%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#D7CCC8]"></span>
                <span className="text-gray-600 dark:text-gray-300">إضافات</span>
              </div>
              <span className="font-bold text-gray-800 dark:text-white">
                25%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sales by Branch Table */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm mb-8 overflow-hidden">
        <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-gray-50/50 dark:bg-[#3E332F]/50">
          <h3 className="text-lg font-bold text-primary flex items-center gap-2">
            <span className="material-icons-round">store</span>
            تفاصيل المبيعات حسب الفرع
          </h3>
          <Link to="/branches-sales">
            <button className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
              <span>تقرير مفصل</span>
              <span className="material-icons-round text-sm rtl:rotate-180">
                arrow_forward
              </span>
            </button>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-gray-50 dark:bg-[#2C2522] text-gray-500 dark:text-gray-400 font-medium">
              <tr>
                <th className="px-6 py-3">اسم الفرع</th>
                <th className="px-6 py-3">المبيعات (ج.م)</th>
                <th className="px-6 py-3 w-1/4">نسبة الإنجاز</th>
                <th className="px-6 py-3">عدد الفواتير</th>
                <th className="px-6 py-3">متوسط الفاتورة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light dark:divide-border-dark">
              <tr className="hover:bg-gray-50 dark:hover:bg-[#3E332F] transition-colors group">
                <td className="px-6 py-4 font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#6F4E37]/10 flex items-center justify-center text-[#6F4E37]">
                    <span className="material-icons-round text-sm">
                      apartment
                    </span>
                  </div>
                  الفرع الرئيسي - الدقي
                </td>
                <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                  6,850
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium w-8">55%</span>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-[#6F4E37] h-2 rounded-full"
                        style={{ width: "55%" }}></div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                  82
                </td>
                <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                  83.5 ر.س
                </td>
              </tr>
              {/* Additional rows here would be dynamic or repeated */}
            </tbody>
          </table>
        </div>
      </div>

      {/* Profitability & Inventory grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
        {/* Profitability */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-[#3E332F]/50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-primary flex items-center gap-2">
              <span className="material-icons-round">analytics</span>
              تحليل الربحية
            </h3>
          </div>
          <div className="p-6 grid grid-cols-3 gap-4 border-b border-border-light dark:border-border-dark">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                الإيرادات
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                12,450
              </p>
            </div>
            <div className="text-center border-r border-l border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                تكلفة البضاعة (COGS)
              </p>
              <p className="text-lg font-bold text-danger">8,250</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                صافي الربح
              </p>
              <p className="text-lg font-bold text-success">4,200</p>
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 dark:bg-[#2C2522] text-gray-500 dark:text-gray-400 font-medium">
                <tr>
                  <th className="px-6 py-3">الصنف</th>
                  <th className="px-6 py-3">المبيعات</th>
                  <th className="px-6 py-3">الربح</th>
                  <th className="px-6 py-3">% هامش</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                <tr className="hover:bg-gray-50 dark:hover:bg-[#3E332F] transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    بن برازيلي (سانتوس)
                  </td>
                  <td className="px-6 py-4">5,400 ج.م</td>
                  <td className="px-6 py-4 text-success font-medium">
                    2,100 ج.م
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                    38%
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 dark:hover:bg-[#3E332F] transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    بن إثيوبي (يرقاشيف)
                  </td>
                  <td className="px-6 py-4">3,200 ج.م</td>
                  <td className="px-6 py-4 text-success font-medium">
                    950 ج.م
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                    29%
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 dark:hover:bg-[#3E332F] transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    خلطة الغنيمي الخاصة
                  </td>
                  <td className="px-6 py-4">2,800 ج.م</td>
                  <td className="px-6 py-4 text-success font-medium">
                    1,150 ج.م
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-300">
                    41%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Inventory Status */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-[#3E332F]/50 flex justify-between items-center">
            <h3 className="text-lg font-bold text-primary flex items-center gap-2">
              <span className="material-icons-round">warehouse</span>
              حالة المخزون اليومية
            </h3>
            <Link to="/inventory">
              <button className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
                <span>تقرير مفصل</span>
                <span className="material-icons-round text-sm rtl:rotate-180">
                  arrow_forward
                </span>
              </button>
            </Link>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm text-right">
              <thead className="bg-gray-50 dark:bg-[#2C2522] text-gray-500 dark:text-gray-400 font-medium">
                <tr>
                  <th className="px-6 py-3">الصنف</th>
                  <th className="px-6 py-3">الحالي (كجم)</th>
                  <th className="px-6 py-3">وارد اليوم</th>
                  <th className="px-6 py-3">منصرف اليوم</th>
                  <th className="px-6 py-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                <tr className="hover:bg-gray-50 dark:hover:bg-[#3E332F] transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    بن برازيلي أخضر
                  </td>
                  <td className="px-6 py-4 font-bold">145 كجم</td>
                  <td className="px-6 py-4 text-success">+50</td>
                  <td className="px-6 py-4 text-danger">-22</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 rounded-full text-xs font-medium">
                      متوفر
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-gray-50 dark:hover:bg-[#3E332F] transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    هيل أمريكي رقم 1
                  </td>
                  <td className="px-6 py-4 font-bold">4.5 كجم</td>
                  <td className="px-6 py-4 text-gray-400">0</td>
                  <td className="px-6 py-4 text-danger">-1.2</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 rounded-full text-xs font-medium flex items-center gap-1 w-fit">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
                      منخفض
                    </span>
                  </td>
                </tr>
                {/* More rows... */}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GeneralReportPage;
