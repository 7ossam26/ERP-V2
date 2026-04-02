import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaFilter,
  FaSearch,
  FaTimes,
  FaCheck,
  FaEye,
  FaFileAlt,
  FaTruck,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import apiClient from "../../services/apiClient";
import { branchService } from "../../services/branchService";
import shiftService from "../../services/shiftService";
import ShiftApprovalModal from "./components/ShiftApprovalModal";
import ShiftReportModal from "./components/ShiftReportModal";
import POSReportModal from "../pos/POSReportModal";

const ShiftManagementPage = () => {
  const navigate = useNavigate();
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    branchId: "all",
    status: "all",
    limit: 20,
    page: 1,
  });
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pages: 1,
  });
  const [branches, setBranches] = useState([]);

  // Modal States
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [selectedShiftForApproval, setSelectedShiftForApproval] =
    useState(null);

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [selectedShiftReportId, setSelectedShiftReportId] = useState(null);

  const [shiftReportForApprovalOpen, setShiftReportForApprovalOpen] = useState(false);
  const [shiftReportForApprovalData, setShiftReportForApprovalData] = useState(null);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [filters]);

  const fetchBranches = async () => {
    try {
      const res = await branchService.getAll();
      setBranches(res.data || []);
    } catch (error) {
      console.error("Error fetching branches:", error);
    }
  };

  const fetchShifts = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filters.branchId !== "all")
        queryParams.append("branchId", filters.branchId);
      if (filters.status !== "all")
        queryParams.append("status", filters.status);
      queryParams.append("page", filters.page);
      queryParams.append("limit", filters.limit);

      const res = await apiClient.get(`/shifts?${queryParams.toString()}`);
      setShifts(res.data || []);
      setPagination(res.pagination || { total: 0, page: 1, pages: 1 });
    } catch (error) {
      console.error("Error fetching shifts:", error);
      toast.error(error.message || "فشل تحميل الورديات");
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const openApproveModal = async (shift) => {
    try {
      const report = await shiftService.getReport(shift.id);
      setSelectedShiftForApproval(shift);
      setShiftReportForApprovalData(report);
      setShiftReportForApprovalOpen(true);
    } catch (error) {
      toast.error("فشل تحميل تقرير الوردية");
    }
  };

  const openReportModal = (shiftId) => {
    setSelectedShiftReportId(shiftId);
    setReportModalOpen(true);
  };

  const handleApprovalSuccess = () => {
    fetchShifts(); // Refresh list
    setApprovalModalOpen(false);
    setSelectedShiftForApproval(null);
  };

  const statusColors = {
    OPEN: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    CLOSED: "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-400",
    PENDING_REVIEW:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  };

  const statusLabels = {
    OPEN: "مفتوحة",
    CLOSED: "مغلقة",
    PENDING_REVIEW: "بانتظار الموافقة",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-cairo">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            إدارة الورديات
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            متابعة ومراجعة ورديات الموظفين
          </p>
        </div>

        {/* Quick Access Button */}
        <button
          onClick={() => navigate("/delivery-settlement")}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg font-medium"
          title="الانتقال إلى تسوية الطيارين">
          <FaTruck className="text-lg" />
          <span>تسوية الطيارين</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap gap-4 items-end">
        {/* Branch Filter */}
        <div className="w-full md:w-48">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            الفرع
          </label>
          <select
            value={filters.branchId}
            onChange={(e) => handleFilterChange("branchId", e.target.value)}
            className="w-full p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary-500">
            <option value="all">كل الفروع</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="w-full md:w-48">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            الحالة
          </label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
            className="w-full p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-primary-500">
            <option value="all">كل الحالات</option>
            <option value="OPEN">مفتوحة (Active)</option>
            <option value="PENDING_REVIEW">معلقة (Pending)</option>
            <option value="CLOSED">مغلقة (Closed)</option>
          </select>
        </div>

        <button
          onClick={fetchShifts}
          className="mr-auto p-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          title="تحديث البيانات">
          <FaSearch />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300">
              <tr>
                <th className="p-4 font-bold"># ID</th>
                <th className="p-4 font-bold">الموظف</th>
                <th className="p-4 font-bold">الفرع</th>
                <th className="p-4 font-bold">الحالة</th>
                <th className="p-4 font-bold">وقت البداية</th>
                <th className="p-4 font-bold">وقت النهاية</th>
                <th className="p-4 font-bold">أدوات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center">
                    جاري التحميل...
                  </td>
                </tr>
              ) : shifts.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-500">
                    لا توجد ورديات مطابقة
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => (
                  <tr
                    key={shift.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4 font-mono text-gray-500">#{shift.id}</td>
                    <td className="p-4 font-bold">{shift.user.name}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">
                      {shift.branch.name}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${statusColors[shift.status] || "bg-gray-100"}`}>
                        {statusLabels[shift.status] || shift.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-mono" dir="ltr">
                      {new Date(shift.startTime).toLocaleString("ar-EG")}
                    </td>
                    <td className="p-4 text-sm font-mono" dir="ltr">
                      {shift.endTime
                        ? new Date(shift.endTime).toLocaleString("ar-EG")
                        : "-"}
                    </td>
                    <td className="p-4 flex gap-2">
                      {/* View Report Button */}
                      <button
                        className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                        title="عرض التقرير"
                        onClick={() => openReportModal(shift.id)}>
                        <FaFileAlt />
                      </button>

                      {/* Approve Button (Only for Pending) */}
                      {shift.status === "PENDING_REVIEW" && (
                        <button
                          className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200 transition-colors animate-pulse"
                          title="مراجعة واعتماد"
                          onClick={() => openApproveModal(shift)}>
                          <FaCheck />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center text-sm text-gray-500">
          <span>
            الصفحة {pagination.page} من {pagination.pages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() =>
                setFilters((prev) => ({ ...prev, page: prev.page - 1 }))
              }
              className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50">
              السابق
            </button>
            <button
              disabled={pagination.page >= pagination.pages}
              onClick={() =>
                setFilters((prev) => ({ ...prev, page: prev.page + 1 }))
              }
              className="px-3 py-1 bg-gray-100 rounded disabled:opacity-50">
              التالي
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <POSReportModal
        isOpen={shiftReportForApprovalOpen}
        onClose={() => {
          setShiftReportForApprovalOpen(false);
          setShiftReportForApprovalData(null);
        }}
        onConfirm={() => {
          setShiftReportForApprovalOpen(false);
          setApprovalModalOpen(true);
        }}
        reportData={shiftReportForApprovalData}
        confirmLabel="متابعة واعتماد الوردية"
      />

      <ShiftApprovalModal
        isOpen={approvalModalOpen}
        onClose={() => setApprovalModalOpen(false)}
        shift={selectedShiftForApproval}
        onSuccess={handleApprovalSuccess}
      />

      <ShiftReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        shiftId={selectedShiftReportId}
      />
    </div>
  );
};

export default ShiftManagementPage;
