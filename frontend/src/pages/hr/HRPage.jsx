import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { branchService, employeeService } from "../../services/domainServices";
import { treasuryService } from "../../services/treasuryService";
import shiftService from "../../services/shiftService";
import AuthService from "../../services/authService";
import BranchFilterHelper from "../../utils/BranchFilterHelper";
import Modal from "../../components/ui/Modal";
import NoShiftModal from "../expenses/NoShiftModal";
import PrintableReport from "../../components/shared/PrintableReport";
import NewTransactionMenu from "./NewTransactionMenu";
import {
  EMPLOYEE_TRANSACTION_TYPES,
  EMPLOYEE_TRANSACTION_TYPE_ORDER,
  MODAL_TO_TYPE,
  TYPE_TO_MODAL,
  txTypeLabel,
  txTypeTextClass,
} from "../../utils/employeeTransactionTypes";

// Static modal titles. The 'history'/'report' titles interpolate state, so they
// stay inline at the call site.
const MODAL_TITLES = {
  advance: "إضافة سلفة عامة",
  deduction: "إضافة خصم عام",
  overtime: "إضافة اضافي",
  bonus: "إضافة مكافأة",
  confirm_payment: "تأكيد دفع الراتب",
};

const TransactionForm = ({
  type,
  employees,
  branches = [],
  isSingleEmployee,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    employeeId: isSingleEmployee && employees.length > 0 ? employees[0].id : "",
    amount: "",
    reason: "",
    // Branch the operation belongs to. Defaults to the selected employee's
    // branch (editable below).
    branchId:
      isSingleEmployee && employees.length > 0 ? employees[0].branchId : "",
    // "entry" is the per-employee modal, which lets the user pick the type
    // below; every other modal locks it to the one its slug names.
    type: type === "entry" ? "ADVANCE" : MODAL_TO_TYPE[type] ?? "ADVANCE",
  });

  // Searchable Select State
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState("");

  useEffect(() => {
    if (isSingleEmployee && employees.length > 0) {
      setFormData((prev) => ({
        ...prev,
        employeeId: employees[0].id,
        branchId: employees[0].branchId ?? prev.branchId,
      }));
      setSelectedEmployeeName(employees[0].name);
    }
  }, [isSingleEmployee, employees]);

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.id.toString().includes(searchTerm)
  );

  const handleSelectEmployee = (emp) => {
    // Auto-select the employee's branch by default (still editable).
    setFormData({ ...formData, employeeId: emp.id, branchId: emp.branchId });
    setSelectedEmployeeName(emp.name);
    setSearchTerm("");
    setIsDropdownOpen(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Employee Selection */}
      <div className="space-y-2 relative">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          اسم الموظف أو الرقم الوظيفي
        </label>
        {isSingleEmployee ? (
          <div className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-700 dark:text-gray-200">
            {employees[0]?.name}
          </div>
        ) : (
          <div className="relative">
            <div
              className="w-full bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-700 dark:text-gray-200 focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent cursor-text flex justify-between items-center"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
              <span className={!formData.employeeId ? "text-gray-400" : ""}>
                {formData.employeeId
                  ? employees.find((e) => e.id === formData.employeeId)?.name
                  : "ابحث بالاسم أو الرقم..."}
              </span>
              <span className="material-symbols-outlined text-gray-400 text-[20px]">
                expand_more
              </span>
            </div>

            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                <div className="p-2 sticky top-0 bg-white dark:bg-surface-dark border-b border-gray-100 dark:border-gray-700">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary"
                    placeholder="ابحث..."
                    autoFocus
                  />
                </div>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp) => (
                    <div
                      key={emp.id}
                      onClick={() => handleSelectEmployee(emp)}
                      className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex justify-between items-center border-b border-gray-50 dark:border-gray-800 last:border-0">
                      <div>
                        <div className="font-bold text-sm text-text-light dark:text-text-dark">
                          {emp.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {emp.role || emp.position}
                        </div>
                      </div>
                      <div className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs font-mono text-gray-600 dark:text-gray-300">
                        #{emp.id}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    لا توجد نتائج
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Read-only ID Field */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          الرقم الوظيفي (ID)
        </label>
        <input
          type="text"
          value={formData.employeeId || ""}
          readOnly
          className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-500 dark:text-gray-400 font-mono cursor-not-allowed"
          placeholder="يظهر تلقائياً عند اختيار الموظف"
        />
      </div>

      {/* Branch Selection — defaults to the employee's branch, editable */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          الفرع
        </label>
        <select
          value={formData.branchId || ""}
          onChange={(e) =>
            setFormData({
              ...formData,
              branchId: e.target.value ? parseInt(e.target.value) : "",
            })
          }
          className="w-full bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none">
          <option value="">اختر الفرع...</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      {/* Type Selection if 'entry' mode */}
      {type === "entry" && (
        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
            نوع المعاملة
          </label>
          {/* grid, not a flex row: four options overflow the modal width */}
          <div className="grid grid-cols-2 gap-3">
            {EMPLOYEE_TRANSACTION_TYPE_ORDER.map((txType) => (
              <label
                key={txType}
                className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="type"
                  checked={formData.type === txType}
                  onChange={() => setFormData({ ...formData, type: txType })}
                  className="w-4 h-4"
                />
                <span
                  className={`material-symbols-outlined text-[18px] ${EMPLOYEE_TRANSACTION_TYPES[txType].text}`}>
                  {EMPLOYEE_TRANSACTION_TYPES[txType].icon}
                </span>
                <span>{EMPLOYEE_TRANSACTION_TYPES[txType].label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          المبلغ
        </label>
        <div className="relative">
          <input
            type="number"
            value={formData.amount}
            onChange={(e) =>
              setFormData({ ...formData, amount: e.target.value })
            }
            className="w-full bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-600 rounded-xl pl-4 pr-14 py-2.5 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            placeholder="0.00"
            required
            min="0"
            step="0.01"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">
            ج.م
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          السبب <span className="text-red-500">*</span>
        </label>
        <textarea
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          className="w-full bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none h-24"
          placeholder="سبب المعاملة..."
          required></textarea>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          إلغاء
        </button>
        <button
          type="submit"
          className={`flex-1 py-2.5 rounded-xl text-white font-bold shadow-md hover:shadow-lg transition-all ${
            EMPLOYEE_TRANSACTION_TYPES[formData.type]?.button ??
            "bg-primary hover:bg-primary-hover"
          }`}>
          تأكيد
        </button>
      </div>
    </form>
  );
};

const HRPage = () => {
  const currentUser = AuthService.getCurrentUser();
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState(
    BranchFilterHelper.getDefaultBranchId(currentUser)
  );

  // Date Filter State
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [isModalOpen, setIsModalOpen] = useState(false);
  // 'advance' | 'deduction' | 'overtime' | 'bonus' (the four type-locked entry
  // modals, opened from the معاملة جديدة menu), plus 'history',
  // 'transaction_entry', 'confirm_payment', 'report'.
  const [modalType, setModalType] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Shift gating (mirrors the Expenses page): non-managers must have an OPEN
  // shift to record employee transactions or pay salaries.
  const [activeShift, setActiveShift] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(true);
  const [showNoShiftModal, setShowNoShiftModal] = useState(false);
  const isManager = AuthService.hasSensitiveAccess();
  const canOperate = isManager || !!activeShift;

  // Treasury selection for salary payments (choose any system treasury).
  const [treasuries, setTreasuries] = useState([]);
  const [selectedTreasuryId, setSelectedTreasuryId] = useState("");

  // Monthly operations report.
  const [reportRows, setReportRows] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);

  // Filter available branches based on user role
  const filteredBranches = useMemo(() => {
    return BranchFilterHelper.getAvailableBranches(branches, currentUser);
  }, [branches, currentUser]);

  const fetchData = async () => {
    try {
      const [branchesData, employeesData] = await Promise.all([
        branchService.getAll(),
        employeeService.getAll({ month: selectedMonth, year: selectedYear }),
      ]);
      setBranches(branchesData);
      setEmployees(employeesData);
    } catch (error) {
      console.error("Failed to fetch data", error);
      toast.error(error.message || "فشل في تحميل البيانات");
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedYear]);

  // Shift gate on page init (same pattern as ExpensesPage). Managers bypass.
  useEffect(() => {
    if (isManager) {
      setShiftLoading(false);
      return;
    }
    const checkShift = async () => {
      try {
        const user = AuthService.getCurrentUser();
        if (!user) return;
        const shift = await shiftService.checkActive(user.id);
        setActiveShift(shift);
        if (!shift) {
          setShowNoShiftModal(true);
        }
      } catch (err) {
        console.error("Failed to check active shift", err);
        setActiveShift(null);
      } finally {
        setShiftLoading(false);
      }
    };
    checkShift();
  }, [isManager]);

  // Calculations based on fetched data (which already has this month's stats)
  const processedEmployees = employees.filter(
    (emp) =>
      selectedBranch === "all" || emp.branchId === parseInt(selectedBranch)
  );

  const totalEmployees = processedEmployees.length;
  const totalRemainingSalaries = processedEmployees.reduce(
    (sum, emp) => sum + Number(emp.remaining),
    0
  );
  const totalAdvances = processedEmployees.reduce(
    (sum, emp) => sum + Number(emp.advances),
    0
  );
  const totalDeductions = processedEmployees.reduce(
    (sum, emp) => sum + Number(emp.deductions),
    0
  );
  // اضافي + مكافئة, summed by the backend into `additions`.
  const totalAdditions = processedEmployees.reduce(
    (sum, emp) => sum + Number(emp.additions ?? 0),
    0
  );

  const openModal = (type, employee = null) => {
    setModalType(type);
    setSelectedEmployee(employee);
    setIsModalOpen(true);
  };

  const handleSaveTransaction = async (data) => {
    try {
      // Pass the type through. This used to be a ternary that collapsed
      // anything-not-ADVANCE into DEDUCTION, which would have silently turned
      // every اضافي and مكافئة into a خصم.
      const resolvedType =
        modalType === "transaction_entry"
          ? data.type
          : MODAL_TO_TYPE[modalType];

      if (!resolvedType) {
        toast.error("نوع المعاملة غير صالح");
        return;
      }

      const transactionData = {
        type: resolvedType,
        amount: parseFloat(data.amount),
        reason: data.reason,
        date: new Date().toISOString(), // Or user selected date
        branchId: data.branchId || null, // defaults to employee branch, editable
      };

      let empId = data.employeeId;
      if (modalType === "transaction_entry" && selectedEmployee) {
        // If called from table action for a specific employee
        empId = selectedEmployee.id;
      }

      if (!empId) {
        toast.error("يرجى اختيار موظف أولاً");
        return;
      }

      const result = await employeeService.addTransaction(
        empId,
        transactionData
      );

      await fetchData(); // Refresh data
      setIsModalOpen(false);
      if (transactionData.type === "ADVANCE" && result?.shiftId) {
        toast.success(
          `تم صرف السلفة وربطها بالوردية رقم ${result.shiftId}`
        );
      } else {
        toast.success("تم تسجيل المعاملة بنجاح");
      }
    } catch (error) {
      console.error("Failed to save transaction", error);
      toast.error(error.message || "حدث خطأ أثناء حفظ المعاملة");
    }
  };

  const handlePaySalary = async (employee) => {
    setSelectedEmployee(employee);
    setSelectedTreasuryId("");
    setModalType("confirm_payment");
    setIsModalOpen(true);
    // Load all system treasuries so the payer can pick which one to debit.
    try {
      const data = await treasuryService.getAllUnfiltered();
      setTreasuries(data || []);
    } catch (error) {
      console.error("Failed to load treasuries", error);
      toast.error(error.message || "فشل في تحميل الخزائن");
    }
  };

  const confirmPaySalary = async () => {
    if (!selectedEmployee) return;
    if (Number(selectedEmployee.remaining) > 0 && !selectedTreasuryId) {
      toast.error("يرجى اختيار الخزينة أولاً");
      return;
    }
    try {
      await employeeService.paySalary(selectedEmployee.id, {
        month: selectedMonth,
        year: selectedYear,
        treasuryId: selectedTreasuryId || null,
      });
      toast.success("تم دفع الراتب بنجاح");
      fetchData();
      setIsModalOpen(false);
    } catch (error) {
      console.error("Payment failed", error);
      toast.error(error.message || "فشل دفع الراتب");
    }
  };

  // Build the monthly operations report: all employee transactions (سلف،
  // خصومات، اضافي، مكافآت) + salary payments for the selected month/year,
  // honoring the branch filter.
  const handleOpenReport = async () => {
    setModalType("report");
    setIsModalOpen(true);
    setReportLoading(true);
    setReportRows([]);
    try {
      const startDate = new Date(
        selectedYear,
        selectedMonth - 1,
        1
      ).toISOString();
      const endDate = new Date(
        selectedYear,
        selectedMonth,
        0,
        23,
        59,
        59,
        999
      ).toISOString();
      const branchId = selectedBranch; // "all" or a branch id

      const [transactions, payrolls] = await Promise.all([
        employeeService.getAllTransactions({ startDate, endDate, branchId }),
        employeeService.getPayrolls({
          month: selectedMonth,
          year: selectedYear,
          branchId,
        }),
      ]);

      const txRows = transactions.map((t) => ({
        id: `t-${t.id}`,
        originalDate: t.originalDate,
        date: t.date,
        time: t.time,
        typeLabel: txTypeLabel(t.type),
        typeKey: t.type,
        employeeName: t.employeeName,
        branchName: t.branchName,
        amount: Number(t.amount),
        detail: t.reason || "-",
        createdBy: t.createdBy,
      }));

      const payRows = payrolls.map((p) => ({
        id: `p-${p.id}`,
        originalDate: p.originalDate,
        date: p.date,
        time: p.time,
        typeLabel: "دفع راتب",
        typeKey: "PAYROLL",
        employeeName: p.employeeName,
        branchName: p.branchName,
        amount: Number(p.netSalary),
        detail: p.treasuryName ? `خزينة: ${p.treasuryName}` : "-",
        createdBy: p.createdBy,
      }));

      const merged = [...txRows, ...payRows].sort(
        (a, b) => new Date(b.originalDate) - new Date(a.originalDate)
      );
      setReportRows(merged);
    } catch (error) {
      console.error("Failed to build report", error);
      toast.error(error.message || "فشل في تحميل التقرير");
    } finally {
      setReportLoading(false);
    }
  };

  const reportMonthLabel = `${new Date(0, selectedMonth - 1).toLocaleString(
    "ar-EG",
    { month: "long" }
  )} ${selectedYear}`;

  const reportColumns = [
    { header: "التاريخ", render: (r) => `${r.date} ${r.time}` },
    { header: "النوع", accessor: "typeLabel" },
    { header: "الموظف", accessor: "employeeName" },
    { header: "الفرع", accessor: "branchName" },
    {
      header: "المبلغ",
      render: (r) => `${Number(r.amount).toLocaleString()} ج.م`,
    },
    { header: "التفاصيل", accessor: "detail" },
    { header: "بواسطة", accessor: "createdBy" },
  ];

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark min-h-[calc(100vh-6rem)] flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 custom-scrollbar">
        {/* Header & Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">
              إدارة الموارد البشرية
            </h1>
            <p className="text-sm text-text-light/60 dark:text-text-dark/60 mt-2">
              إدارة الموظفين والرواتب والسلف والخصومات والاضافي والمكافآت
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Date Filters */}
            <div className="flex gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(0, m - 1).toLocaleString("ar-EG", {
                      month: "long",
                    })}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none">
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Branch Filter */}
            <div className="relative">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="appearance-none bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 pr-10 text-sm font-bold text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer">
                {BranchFilterHelper.canSeeAllBranches(currentUser) && (
                  <option value="all">كل الفروع</option>
                )}
                {filteredBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[20px]">
                store
              </span>
              <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[20px]">
                expand_more
              </span>
            </div>

            <div className="h-8 w-[1px] bg-border-light dark:bg-border-dark mx-1 hidden md:block"></div>

            {/* Action Buttons */}
            <button
              onClick={handleOpenReport}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all hover:shadow-md">
              <span className="material-symbols-outlined text-[20px]">
                description
              </span>
              <span>تقرير</span>
            </button>

            <NewTransactionMenu
              disabled={!canOperate || shiftLoading}
              disabledTitle={!canOperate ? "يجب فتح وردية أولاً" : undefined}
              onSelect={(txType) => openModal(TYPE_TO_MODAL[txType])}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {/* Card 1 */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-sm border border-border-light dark:border-border-dark flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                <span className="material-symbols-outlined">groups</span>
              </div>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">
                إجمالي الموظفين
              </p>
              <p className="text-3xl font-black text-text-light dark:text-text-dark">
                {totalEmployees}
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-sm border border-border-light dark:border-border-dark flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 rounded-lg bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
                <span className="material-symbols-outlined">payments</span>
              </div>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">
                الرواتب المستحقة
              </p>
              <p className="text-3xl font-black text-text-light dark:text-text-dark">
                {totalRemainingSalaries.toLocaleString()}{" "}
                <span className="text-lg font-normal text-gray-400">ج.م</span>
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-sm border border-border-light dark:border-border-dark flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 rounded-lg bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">
                <span className="material-symbols-outlined">
                  account_balance_wallet
                </span>
              </div>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">
                إجمالي السلف
              </p>
              <p className="text-3xl font-black text-text-light dark:text-text-dark">
                {totalAdvances.toLocaleString()}{" "}
                <span className="text-lg font-normal text-gray-400">ج.م</span>
              </p>
            </div>
          </div>

          {/* Card 4 - Total Deductions */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-sm border border-border-light dark:border-border-dark flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
                <span className="material-symbols-outlined">Remove_circle</span>
              </div>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">
                إجمالي الخصومات
              </p>
              <p className="text-3xl font-black text-text-light dark:text-text-dark">
                {totalDeductions.toLocaleString()}{" "}
                <span className="text-lg font-normal text-gray-400">ج.م</span>
              </p>
            </div>
          </div>

          {/* Card 5 - Total Additions (اضافي + مكافئة) */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-sm border border-border-light dark:border-border-dark flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400">
                <span className="material-symbols-outlined">trending_up</span>
              </div>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">
                إجمالي الإضافات
              </p>
              <p className="text-3xl font-black text-text-light dark:text-text-dark">
                {totalAdditions.toLocaleString()}{" "}
                <span className="text-lg font-normal text-gray-400">ج.م</span>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden flex flex-col">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[1020px]">
              <thead>
                <tr className="bg-gray-50/50 dark:bg-surface-dark border-b border-border-light dark:border-border-dark">
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    الموظف
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    الرقم الوظيفي
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    رقم الهاتف
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    الراتب الأساسي
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    السلف
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    الخصومات
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    الإضافات
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    المرتب المتبقي
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {processedEmployees.length > 0 ? (
                  processedEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="hover:bg-background-light dark:hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-bold text-text-light dark:text-text-dark">
                            {employee.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {employee.role || employee.title}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 font-mono">
                        {employee.id}
                      </td>
                      <td
                        className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600 dark:text-gray-300 font-mono"
                        dir="ltr">
                        {employee.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-light dark:text-text-dark">
                        {Number(employee.salary).toLocaleString()} ج.م
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                          employee.advances > 0
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}>
                        {Number(employee.advances).toLocaleString()} ج.م
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 dark:text-gray-500">
                        {Number(employee.deductions).toLocaleString()} ج.م
                      </td>
                      <td
                        className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                          employee.additions > 0
                            ? "text-teal-600 dark:text-teal-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}>
                        {Number(employee.additions ?? 0).toLocaleString()} ج.م
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600 dark:text-green-400">
                        {Number(employee.remaining).toLocaleString()} ج.م
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Pay Button / Status */}
                          {employee.isPaid ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">
                              تم الدفع
                            </span>
                          ) : (
                            <button
                              onClick={() => handlePaySalary(employee)}
                              disabled={!canOperate || shiftLoading}
                              className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              title={
                                !canOperate ? "يجب فتح وردية أولاً" : "دفع الراتب"
                              }>
                              <span className="material-symbols-outlined text-[20px]">
                                payments
                              </span>
                            </button>
                          )}

                          <button
                            onClick={() => openModal("history", employee)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="التفاصيل">
                            <span className="material-symbols-outlined text-[20px]">
                              visibility
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              openModal("transaction_entry", employee)
                            }
                            disabled={!canOperate || shiftLoading}
                            className="p-1 text-orange-600 hover:bg-orange-50 rounded disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            title={
                              !canOperate
                                ? "يجب فتح وردية أولاً"
                                : "تسجيل معاملة"
                            }>
                            <span className="material-symbols-outlined text-[20px]">
                              add_circle
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="9"
                      className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      لا يوجد موظفين في هذا الفرع.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {/* Removed Pagination for now as we are filtering client side */}
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          MODAL_TITLES[modalType] ??
          (modalType === "history"
            ? `سجل معاملات ${selectedEmployee?.name}`
            : modalType === "report"
            ? `تقرير العمليات - ${reportMonthLabel}`
            : "تسجيل معاملة مالية")
        }>
        {modalType === "history" && selectedEmployee ? (
          <div className="space-y-4">
            {/* Grid, not a flex row: the four per-type totals overflow otherwise.
                This is where the اضافي / مكافئة split stays visible — the main
                table combines them into a single "الإضافات" column. */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg text-sm">
              <span>
                الراتب الأساسي: <strong>{selectedEmployee.salary}</strong>
              </span>
              <span>
                السلف:{" "}
                <strong className={txTypeTextClass("ADVANCE")}>
                  {Number(selectedEmployee.advances ?? 0).toLocaleString()}
                </strong>
              </span>
              <span>
                الخصومات:{" "}
                <strong className={txTypeTextClass("DEDUCTION")}>
                  {Number(selectedEmployee.deductions ?? 0).toLocaleString()}
                </strong>
              </span>
              <span>
                اضافي:{" "}
                <strong className={txTypeTextClass("OVERTIME")}>
                  {Number(selectedEmployee.overtime ?? 0).toLocaleString()}
                </strong>
              </span>
              <span>
                مكافآت:{" "}
                <strong className={txTypeTextClass("BONUS")}>
                  {Number(selectedEmployee.bonuses ?? 0).toLocaleString()}
                </strong>
              </span>
              <span>
                المتبقي:{" "}
                <strong className="text-green-600">
                  {selectedEmployee.remaining}
                </strong>
              </span>
              {selectedEmployee.isPaid && (
                <span className="col-span-2 md:col-span-3 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full flex items-center gap-1 w-fit">
                  <span className="material-symbols-outlined text-[14px]">
                    check_circle
                  </span>
                  تم تاكيد الدفع بواسطه{" "}
                  <strong>{selectedEmployee.paidBy || "غير معروف"}</strong>
                </span>
              )}
            </div>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-right">النوع</th>
                    <th className="p-2 text-right">المبلغ</th>
                    <th className="p-2 text-right">السبب</th>
                    <th className="p-2 text-right">بواسطة</th>
                    <th className="p-2 text-right">التاريخ</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedEmployee.transactions?.map((t, idx) => (
                    <tr key={idx} className="border-b">
                      <td className={`p-2 font-bold ${txTypeTextClass(t.type)}`}>
                        {txTypeLabel(t.type)}
                      </td>
                      <td className="p-2">{t.amount}</td>
                      <td className="p-2">{t.reason}</td>
                      <td className="p-2 text-gray-600 font-medium">
                        {t.createdBy?.name || "غير معروف"}
                      </td>
                      <td className="p-2">
                        {new Date(t.date || t.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {(!selectedEmployee.transactions ||
                    selectedEmployee.transactions.length === 0) && (
                    <tr>
                      <td colSpan="5" className="p-4 text-center text-gray-500">
                        لا توجد معاملات هذا الشهر
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : modalType === "confirm_payment" && selectedEmployee ? (
          <div className="space-y-6">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl flex items-center gap-4">
              <div className="bg-green-100 dark:bg-green-800 p-2 rounded-full text-green-600 dark:text-green-300">
                <span className="material-symbols-outlined text-2xl">
                  payments
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  تأكيد دفع راتب
                </p>
                <p className="font-bold text-lg text-text-light dark:text-text-dark">
                  {selectedEmployee.name}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">الشهر/السنة</p>
                <p className="font-bold">
                  {new Date(0, selectedMonth - 1).toLocaleString("ar-EG", {
                    month: "long",
                  })}{" "}
                  {selectedYear}
                </p>
              </div>
              <div className="bg-pink-50 dark:bg-pink-900/20 p-3 rounded-lg">
                <p className="text-xs text-pink-600 mb-1">
                  صافي الراتب المستحق
                </p>
                <p className="font-bold text-pink-700">
                  {selectedEmployee.remaining.toLocaleString()} ج.م
                </p>
              </div>
            </div>

            {/* Treasury selector — pick any system treasury to debit */}
            {Number(selectedEmployee.remaining) > 0 && (
              <div className="space-y-2">
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                  الخزينة المدفوع منها <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedTreasuryId}
                  onChange={(e) =>
                    setSelectedTreasuryId(
                      e.target.value ? parseInt(e.target.value) : ""
                    )
                  }
                  className="w-full bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none">
                  <option value="">اختر الخزينة...</option>
                  {treasuries.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.name} — {Number(tr.balance).toLocaleString()} ج.م
                    </option>
                  ))}
                </select>
              </div>
            )}

            <p className="text-sm text-gray-500 dark:text-gray-400">
              هل أنت متأكد من دفع الراتب؟ سيتم تسجيله كمدفوع ولن يمكن تعديل
              المعاملات الخاصة بهذا الشهر بعد ذلك.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 font-bold hover:bg-gray-50 dark:hover:bg-gray-800">
                إلغاء
              </button>
              <button
                onClick={confirmPaySalary}
                disabled={
                  Number(selectedEmployee.remaining) > 0 && !selectedTreasuryId
                }
                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600">
                تأكيد الدفع
              </button>
            </div>
          </div>
        ) : modalType === "report" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {reportLoading
                  ? "جاري تحميل التقرير..."
                  : `عدد العمليات: ${reportRows.length}`}
              </div>
              <button
                onClick={handlePrintReport}
                disabled={reportLoading || reportRows.length === 0}
                className="flex items-center gap-2 bg-primary hover:opacity-90 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                <span className="material-symbols-outlined text-[20px]">
                  print
                </span>
                <span>طباعة</span>
              </button>
            </div>

            <div className="max-h-[55vh] overflow-auto custom-scrollbar border border-border-light dark:border-border-dark rounded-xl">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="bg-gray-100 dark:bg-gray-800 sticky top-0">
                  <tr>
                    {reportColumns.map((col, i) => (
                      <th
                        key={i}
                        className="p-2 text-right font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border-light dark:border-border-dark">
                      {reportColumns.map((col, i) => (
                        <td
                          key={i}
                          className={`p-2 text-right whitespace-nowrap ${
                            col.header === "النوع"
                              ? `${txTypeTextClass(row.typeKey)} font-bold`
                              : "text-gray-700 dark:text-gray-200"
                          }`}>
                          {col.render ? col.render(row) : row[col.accessor]}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!reportLoading && reportRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={reportColumns.length}
                        className="p-6 text-center text-gray-500">
                        لا توجد عمليات في هذا الشهر
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <TransactionForm
            type={modalType === "transaction_entry" ? "entry" : modalType}
            employees={
              modalType === "transaction_entry" && selectedEmployee
                ? [selectedEmployee]
                : employees
            }
            branches={filteredBranches}
            isSingleEmployee={
              modalType === "transaction_entry" && selectedEmployee
            }
            onClose={() => setIsModalOpen(false)}
            onSave={handleSaveTransaction}
          />
        )}
      </Modal>

      {/* Shift gate — soft block for non-managers with no open shift */}
      <NoShiftModal
        isOpen={showNoShiftModal}
        onViewOnly={() => setShowNoShiftModal(false)}
        subtitle="يجب فتح وردية أولاً لتسجيل معاملات الموظفين"
        bodyTitle="تسجيل المعاملات محظور"
        bodyText="لا يمكن تسجيل معاملات الموظفين أو دفع رواتب بدون وردية مفتوحة. توجه إلى نقطة البيع لبدء وردية جديدة."
        footerSecondary="أو الاستمرار لعرض البيانات فقط."
        viewOnlyLabel="عرض البيانات فقط"
      />

      {/* Hidden printable surface for the monthly report (A4). */}
      <PrintableReport
        title="تقرير عمليات الموارد البشرية"
        subtitle={`الشهر: ${reportMonthLabel}`}
        data={reportRows}
        columns={reportColumns}
      />

      {/* Scoped print isolation: hide everything except the report and force A4,
          overriding the global 78mm thermal @page from index.css. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body * { visibility: hidden !important; }
          #printable-report, #printable-report * { visibility: visible !important; }
          #printable-report {
            display: block !important;
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default HRPage;
