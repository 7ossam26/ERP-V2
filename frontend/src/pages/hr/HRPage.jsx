import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import { branchService, employeeService } from "../../services/domainServices";
import AuthService from "../../services/authService";
import BranchFilterHelper from "../../utils/BranchFilterHelper";
import Modal from "../../components/ui/Modal";

const TransactionForm = ({
  type,
  employees,
  isSingleEmployee,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    employeeId: isSingleEmployee && employees.length > 0 ? employees[0].id : "",
    amount: "",
    reason: "",
    type:
      type === "entry"
        ? "ADVANCE"
        : type === "advance"
        ? "ADVANCE"
        : "DEDUCTION",
  });

  // Searchable Select State
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState("");

  useEffect(() => {
    if (isSingleEmployee && employees.length > 0) {
      setFormData((prev) => ({ ...prev, employeeId: employees[0].id }));
      setSelectedEmployeeName(employees[0].name);
    }
  }, [isSingleEmployee, employees]);

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.id.toString().includes(searchTerm)
  );

  const handleSelectEmployee = (emp) => {
    setFormData({ ...formData, employeeId: emp.id });
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

      {/* Type Selection if 'entry' mode */}
      {type === "entry" && (
        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
            نوع المعاملة
          </label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="type"
                checked={formData.type === "ADVANCE"}
                onChange={() => setFormData({ ...formData, type: "ADVANCE" })}
                className="w-4 h-4 text-orange-600"
              />
              <span>سلفة</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="type"
                checked={formData.type === "DEDUCTION"}
                onChange={() => setFormData({ ...formData, type: "DEDUCTION" })}
                className="w-4 h-4 text-red-600"
              />
              <span>خصم</span>
            </label>
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
            formData.type === "ADVANCE"
              ? "bg-[#FF7043] hover:bg-[#F4511E]"
              : "bg-red-600 hover:bg-red-700"
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
  const [modalType, setModalType] = useState(null); // 'advance', 'deduction', 'history', 'transaction_entry'
  const [selectedEmployee, setSelectedEmployee] = useState(null);

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

  const openModal = (type, employee = null) => {
    setModalType(type);
    setSelectedEmployee(employee);
    setIsModalOpen(true);
  };

  const handleSaveTransaction = async (data) => {
    try {
      const transactionData = {
        type:
          modalType === "advance" ||
          (modalType === "transaction_entry" && data.type === "ADVANCE")
            ? "ADVANCE"
            : "DEDUCTION",
        amount: parseFloat(data.amount),
        reason: data.reason,
        date: new Date().toISOString(), // Or user selected date
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

      await employeeService.addTransaction(empId, transactionData);

      await fetchData(); // Refresh data
      setIsModalOpen(false);
      toast.success("تم تسجيل المعاملة بنجاح");
    } catch (error) {
      console.error("Failed to save transaction", error);
      toast.error(error.message || "حدث خطأ أثناء حفظ المعاملة");
    }
  };

  const handlePaySalary = (employee) => {
    setSelectedEmployee(employee);
    setModalType("confirm_payment");
    setIsModalOpen(true);
  };

  const confirmPaySalary = async () => {
    if (!selectedEmployee) return;
    try {
      await employeeService.paySalary(selectedEmployee.id, {
        month: selectedMonth,
        year: selectedYear,
      });
      toast.success("تم دفع الراتب بنجاح");
      fetchData();
      setIsModalOpen(false);
    } catch (error) {
      console.error("Payment failed", error);
      toast.error(error.message || "فشل دفع الراتب");
    }
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
              إدارة الموظفين والرواتب والسلف
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
              onClick={() => openModal("advance")}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#FF7043] hover:bg-[#F4511E] text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all hover:shadow-md">
              <span className="material-symbols-outlined text-[20px]">
                money_off
              </span>
              <span>إضافة سلفة</span>
            </button>

            <button
              onClick={() => openModal("deduction")}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all hover:shadow-md">
              <span className="material-symbols-outlined text-[20px]">
                remove_circle
              </span>
              <span>إضافة خصم</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
        </div>

        <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden flex flex-col">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[900px]">
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
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="دفع الراتب">
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
                            className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                            title="إضافة سلفة/خصم">
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
                      colSpan="8"
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
          modalType === "advance"
            ? "إضافة سلفة عامة"
            : modalType === "deduction"
            ? "إضافة خصم عام"
            : modalType === "history"
            ? `سجل معاملات ${selectedEmployee?.name}`
            : modalType === "confirm_payment"
            ? "تأكيد دفع الراتب"
            : "تسجيل معاملة مالية"
        }>
        {modalType === "history" && selectedEmployee ? (
          <div className="space-y-4">
            <div className="flex justify-between bg-gray-50 p-3 rounded-lg">
              <span>
                الراتب الأساسي: <strong>{selectedEmployee.salary}</strong>
              </span>
              <span>
                المتبقي:{" "}
                <strong className="text-green-600">
                  {selectedEmployee.remaining}
                </strong>
              </span>
              {selectedEmployee.isPaid && (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full flex items-center gap-1">
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
                      <td
                        className={`p-2 font-bold ${
                          t.type === "ADVANCE"
                            ? "text-orange-600"
                            : "text-red-600"
                        }`}>
                        {t.type === "ADVANCE" ? "سلفة" : "خصم"}
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
                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-md">
                تأكيد الدفع
              </button>
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
            isSingleEmployee={
              modalType === "transaction_entry" && selectedEmployee
            }
            onClose={() => setIsModalOpen(false)}
            onSave={handleSaveTransaction}
          />
        )}
      </Modal>
    </div>
  );
};

export default HRPage;
