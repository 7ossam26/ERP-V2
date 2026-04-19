import React from "react";
import GenericPageManager from "../../../components/shared/GenericPageManager";
import { salesService, branchService } from "../../../services/domainServices";
import ReportFilterForm from "../../../components/shared/ReportFilterForm";
import AuthService from "../../../services/authService";
import BranchFilterHelper from "../../../utils/BranchFilterHelper";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import SaleDetailsModal from "./SaleDetailsModal";

const DailyTransactions = () => {
  const currentUser = AuthService.getCurrentUser();
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    searchTerm: "",
    branchId: BranchFilterHelper.getDefaultBranchId(currentUser),
  });
  const [selectedSale, setSelectedSale] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("all"); // "all" | "POS" | "CALL_CENTER"

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const data = await branchService.getAll();
        setBranches(data);
      } catch (error) {
        console.error("Failed to fetch branches", error);
      }
    };
    fetchBranches();
  }, []);

  const handleViewDetails = (sale) => {
    setSelectedSale(sale);
    setIsModalOpen(true);
  };

  const handleFilter = (newFilters) => {
    setFilters(newFilters);
  };

  const columns = [
    {
      header: "رقم العملية",
      accessor: "saleNumber",
    },
    {
      header: "العميل",
      accessor: "client",
      render: (item) => (
        <span className="text-gray-900 dark:text-gray-100 font-medium">
          {item.client?.name || "عميل غير مسجل"}
        </span>
      ),
    },
    {
      header: "الفرع",
      accessor: "branch",
      render: (item) => (
        <span className="text-gray-600 dark:text-gray-400 text-sm">
          {item.branch?.name || "غير محدد"}
        </span>
      ),
    },
    {
      header: "النوع",
      accessor: "paymentMethod",
      render: (item) => (
        <span
          className={`px-2 py-1 rounded text-xs font-bold ${
            item.paymentMethod === "CASH"
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
          }`}>
          {item.paymentMethod === "CASH" ? "نقدي" : "بطاقة"}
        </span>
      ),
    },
    {
      header: "المبلغ",
      accessor: "total",
      render: (item) => `${parseFloat(item.total).toFixed(2)} ج.م`,
    },
    {
      header: "التفاصيل",
      accessor: "details",
      render: (item) => (
        <span className="text-gray-600 dark:text-gray-400 text-sm">
          {item.items?.length || 0} أصناف
        </span>
      ),
    },
    {
      header: "المصدر",
      accessor: "source",
      render: (item) => {
        const channel = item.order?.channel ?? "POS";
        const isCC = channel === "CALL_CENTER";
        return (
          <span className={`px-2 py-1 rounded text-xs font-bold ${
            isCC
              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
              : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
          }`}>
            {isCC ? "كول سنتر" : "POS"}
          </span>
        );
      },
    },
    {
      header: "التوقيت",
      accessor: "createdAt",
      render: (item) => new Date(item.createdAt).toLocaleString("ar-EG"),
    },
  ];

  const customActions = (item) => [
    {
      icon: "visibility",
      label: "عرض التفاصيل",
      onClick: () => handleViewDetails(item),
      color: "text-blue-600 dark:text-blue-400",
      hoverColor: "hover:bg-blue-50 dark:hover:bg-blue-900/20",
    },
  ];

  // Custom service wrapper to apply filters
  const filteredSalesService = {
    ...salesService,
    getAll: async () => {
      let data = await salesService.getAll();

      // Apply branch filter (from Unified Form)
      if (filters.branchId && filters.branchId !== "all") {
        data = data.filter(
          (item) => item.branchId === parseInt(filters.branchId)
        );
      } else if (selectedBranch !== "all") {
        // Fallback for initial state if needed, though filters.branchId covers it
        data = data.filter(
          (item) => item.branchId === parseInt(selectedBranch)
        );
      }

      // Apply search filter (from form)
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        data = data.filter(
          (item) =>
            item.saleNumber.toLowerCase().includes(term) ||
            item.client?.name?.toLowerCase().includes(term) ||
            item.branch?.name?.toLowerCase().includes(term) ||
            item.total.toString().includes(term)
        );
      }

      // Apply date filters
      if (filters.startDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0); // Start of day
        data = data.filter((item) => new Date(item.createdAt) >= start);
      }

      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999); // End of day
        data = data.filter((item) => new Date(item.createdAt) <= end);
      }

      // Validate date range
      if (filters.startDate && filters.endDate) {
        if (new Date(filters.startDate) > new Date(filters.endDate)) {
          toast.error("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
          return [];
        }
      }

      // Apply source/channel filter
      if (sourceFilter !== "all") {
        data = data.filter(
          (item) => (item.order?.channel ?? "POS") === sourceFilter
        );
      }

      if (data.length > 0) {
        // Only show toast if it's a specific filter search, not just initial load
        if (
          filters.searchTerm ||
          filters.startDate ||
          filters.endDate ||
          (filters.branchId && filters.branchId !== "all")
        ) {
          toast.success(`تم العثور على ${data.length} عملية`, {
            id: "search-results",
          }); // Use ID to prevent stacking
        }
      } else {
        toast(`لا توجد نتائج مطابقة`, { icon: "🔍", id: "no-results" });
      }

      return data;
    },
    // Preserve other methods although GenericPageManager primarily uses getAll for lists
    create: salesService.create,
    update: salesService.update,
    delete: salesService.delete,
  };

  const sourceChips = [
    { label: "الكل", value: "all" },
    { label: "POS", value: "POS" },
    { label: "كول سنتر", value: "CALL_CENTER" },
  ];

  return (
    <>
      {/* Source filter chips */}
      <div className="flex gap-2 px-4 pt-4" dir="rtl">
        {sourceChips.map((chip) => (
          <button
            key={chip.value}
            onClick={() => setSourceFilter(chip.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              sourceFilter === chip.value
                ? "bg-primary text-white border-primary"
                : "bg-white dark:bg-surface-dark text-gray-600 dark:text-gray-300 border-border-light dark:border-border-dark hover:border-primary hover:text-primary"
            }`}>
            {chip.label}
          </button>
        ))}
      </div>
      <GenericPageManager
        key={`${filters.branchId}-${JSON.stringify(filters)}-${sourceFilter}`} // Force reload when filters change
        title="سجل المبيعات"
        subtitle="سجل المبيعات والفواتير"
        icon="receipt_long"
        service={filteredSalesService}
        columns={columns}
        // Pass the filter form as FilterComponent so it renders above the table
        FilterComponent={() => (
          <ReportFilterForm onFilter={handleFilter} branches={branches} />
        )}
        backPath="/reports/detailed"
        hideAddButton={true}
        // Removed headerActions={BranchFilter} as it's now in the form
        customActions={customActions}
      />

      <SaleDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sale={selectedSale}
      />
    </>
  );
};

export default DailyTransactions;
