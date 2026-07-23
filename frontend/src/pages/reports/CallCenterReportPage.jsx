import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { reportService } from "../../services/reportService";
import { branchService } from "../../services/domainServices";
import AuthService from "../../services/authService";
import BranchFilterHelper from "../../utils/BranchFilterHelper";
import { reasonLabel } from "../../components/orders/CancelOrderDialog";
import toast from "react-hot-toast";

const getLocalToday = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date - offset).toISOString().slice(0, 10);
};

const StatCard = ({ label, value, icon, color, bg }) => (
  <div className="bg-surface-light dark:bg-surface-dark p-5 rounded-2xl border border-border-light dark:border-border-dark shadow-sm relative overflow-hidden group">
    <div className={`absolute top-0 right-0 w-2 h-full ${color} group-hover:w-3 transition-all`} />
    <div className="flex justify-between items-start">
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</h3>
      </div>
      <div className={`p-2 ${bg} rounded-lg`}>
        <span className={`material-icons-round text-xl ${color.replace("bg-", "text-")}`}>{icon}</span>
      </div>
    </div>
  </div>
);

const CallCenterReportPage = () => {
  const currentUser = AuthService.getCurrentUser();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    startDate: getLocalToday(),
    endDate: getLocalToday(),
    branchId: BranchFilterHelper.getDefaultBranchId(currentUser),
  });

  useEffect(() => {
    branchService.getAll().then((all) => {
      const available = BranchFilterHelper.getAvailableBranches(all, currentUser);
      // Filter out the legacy "Main Branch" seed row
      setBranches(available.filter((b) => b.name !== "Main Branch"));
    }).catch(() => {});
  }, []);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const result = await reportService.getCallCenterReport(filters);
      setData(result);
    } catch (err) {
      const msg = err.status === 403 ? "غير مسموح لك بعرض هذا التقرير." : "فشل تحميل البيانات.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  const summary = data?.summary;

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen text-text-light dark:text-text-dark font-body p-4 sm:p-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold text-primary mb-1">تقرير الكول سنتر</h2>
          <p className="text-gray-500 dark:text-gray-400">مؤشرات أداء طلبات الكول سنتر</p>
        </div>
        <Link to="/reports" className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors">
          <span className="material-icons-round rtl:rotate-180">arrow_forward</span>
          <span>العودة للتقارير</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl shadow-sm border border-border-light dark:border-border-dark mb-8">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">من تاريخ</label>
            <div className="relative">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="block w-full rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-[#3E332F] py-2.5 pr-3 pl-10 text-sm focus:border-primary focus:ring-primary dark:text-text-dark shadow-sm"
              />
              <span className="material-icons-round absolute left-3 top-2.5 text-gray-400 pointer-events-none text-lg">event</span>
            </div>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">إلى تاريخ</label>
            <div className="relative">
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="block w-full rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-[#3E332F] py-2.5 pr-3 pl-10 text-sm focus:border-primary focus:ring-primary dark:text-text-dark shadow-sm"
              />
              <span className="material-icons-round absolute left-3 top-2.5 text-gray-400 pointer-events-none text-lg">event</span>
            </div>
          </div>
          {branches.length > 0 && (
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الفرع</label>
              <div className="relative">
                <select
                  value={filters.branchId}
                  onChange={(e) => setFilters({ ...filters, branchId: e.target.value })}
                  className="block w-full rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-[#3E332F] py-2.5 pr-3 pl-10 text-sm focus:border-primary focus:ring-primary dark:text-text-dark shadow-sm">
                  <option value="all">جميع الفروع</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <span className="material-icons-round absolute left-3 top-2.5 text-gray-400 pointer-events-none text-lg">store</span>
              </div>
            </div>
          )}
          <button
            onClick={fetchReport}
            className="px-6 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors font-medium shadow-md shadow-primary/20 flex items-center gap-2">
            <span className={`material-icons-round text-lg ${loading ? "animate-spin" : ""}`}>refresh</span>
            تحديث
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            <StatCard label="إجمالي الطلبات" value={summary?.total ?? 0} icon="headset_mic" color="bg-primary" bg="bg-primary/10" />
            <StatCard label="مُسلَّمة" value={summary?.delivered ?? 0} icon="check_circle" color="bg-green-500" bg="bg-green-100 dark:bg-green-900/30" />
            <StatCard label="ملغية" value={summary?.cancelled ?? 0} icon="cancel" color="bg-red-500" bg="bg-red-100 dark:bg-red-900/30" />
            <StatCard
              label="نسبة الإلغاء"
              value={`${summary?.cancellationRate ?? 0}%`}
              icon="trending_down"
              color="bg-orange-500"
              bg="bg-orange-100 dark:bg-orange-900/30"
            />
            <StatCard
              label="الإيراد (ج.م)"
              value={(summary?.totalRevenue ?? 0).toLocaleString()}
              icon="payments"
              color="bg-blue-500"
              bg="bg-blue-100 dark:bg-blue-900/30"
            />
            <StatCard
              label="متوسط وقت التحضير"
              value={summary?.avgPrepMinutes != null ? `${summary.avgPrepMinutes} د` : "—"}
              icon="timer"
              color="bg-purple-500"
              bg="bg-purple-100 dark:bg-purple-900/30"
            />
          </div>

          {/* By Agent Table */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm mb-8 overflow-hidden">
            <div className="p-5 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-[#3E332F]/50 flex items-center gap-2">
              <span className="material-icons-round text-primary">person</span>
              <h3 className="text-lg font-bold text-primary">الأداء حسب الموظف</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 dark:bg-[#2C2522] text-gray-500 dark:text-gray-400 font-medium">
                  <tr>
                    <th className="px-6 py-3">الموظف</th>
                    <th className="px-6 py-3">إجمالي الطلبات</th>
                    <th className="px-6 py-3">مُسلَّمة</th>
                    <th className="px-6 py-3">ملغية</th>
                    <th className="px-6 py-3">نسبة الإلغاء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  {data?.byAgent?.length > 0 ? (
                    data.byAgent.map((agent, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#3E332F] transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="material-icons-round text-primary text-sm">person</span>
                          </div>
                          {agent.name}
                        </td>
                        <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{agent.total}</td>
                        <td className="px-6 py-4 text-green-600 dark:text-green-400 font-medium">{agent.delivered}</td>
                        <td className="px-6 py-4 text-red-600 dark:text-red-400 font-medium">{agent.cancelled}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                            agent.total > 0 && (agent.cancelled / agent.total) > 0.2
                              ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                              : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          }`}>
                            {agent.total > 0 ? `${Math.round((agent.cancelled / agent.total) * 100)}%` : "—"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-10 text-center text-gray-400">لا توجد بيانات للفترة المحددة</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cancellations by Reason */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm mb-8 overflow-hidden">
            <div className="p-5 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-[#3E332F]/50 flex items-center gap-2">
              <span className="material-icons-round text-red-500">cancel</span>
              <h3 className="text-lg font-bold text-red-600 dark:text-red-400">أسباب الإلغاء</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 dark:bg-[#2C2522] text-gray-500 dark:text-gray-400 font-medium">
                  <tr>
                    <th className="px-6 py-3">السبب</th>
                    <th className="px-6 py-3">عدد الطلبات</th>
                    <th className="px-6 py-3">النسبة من الإلغاءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  {data?.cancellationsByReason?.length > 0 ? (
                    data.cancellationsByReason.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#3E332F] transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                          {row.reason === "UNSPECIFIED" ? "غير محدد" : reasonLabel(row.reason)}
                        </td>
                        <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{row.count}</td>
                        <td className="px-6 py-4 text-gray-700 dark:text-gray-300">
                          {summary?.cancelled > 0
                            ? `${Math.round((row.count / summary.cancelled) * 100)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-6 py-10 text-center text-gray-400">
                        لا توجد طلبات ملغية للفترة المحددة
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* By Branch Table */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border-light dark:border-border-dark bg-gray-50/50 dark:bg-[#3E332F]/50 flex items-center gap-2">
              <span className="material-icons-round text-primary">store</span>
              <h3 className="text-lg font-bold text-primary">الأداء حسب الفرع</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-gray-50 dark:bg-[#2C2522] text-gray-500 dark:text-gray-400 font-medium">
                  <tr>
                    <th className="px-6 py-3">الفرع</th>
                    <th className="px-6 py-3">إجمالي الطلبات</th>
                    <th className="px-6 py-3">الإيراد (ج.م)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark">
                  {data?.byBranch?.length > 0 ? (
                    data.byBranch.map((branch, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-[#3E332F] transition-colors">
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="material-icons-round text-primary text-sm">apartment</span>
                          </div>
                          {branch.name}
                        </td>
                        <td className="px-6 py-4 text-gray-700 dark:text-gray-300">{branch.total}</td>
                        <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">
                          {branch.revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-6 py-10 text-center text-gray-400">لا توجد بيانات للفترة المحددة</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CallCenterReportPage;
