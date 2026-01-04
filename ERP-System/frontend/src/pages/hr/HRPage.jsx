import React, { useState, useEffect } from "react";
import { branchService } from "../../services/domainServices";
import Modal from "../../components/ui/Modal";

const TransactionForm = ({ type, employees, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    employeeId: "",
    amount: "",
    reason: "",
  });

  const handleEmployeeChange = (e) => {
    const empId = parseInt(e.target.value);
    const employee = employees.find((emp) => emp.id === empId);
    setFormData({
      ...formData,
      employeeId: empId,
      employeeCode: employee ? employee.code : "",
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          اسم الموظف
        </label>
        <select
          className="w-full bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          value={formData.employeeId}
          onChange={handleEmployeeChange}
          required>
          <option value="">اختر موظف...</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          الرقم الوظيفي
        </label>
        <input
          type="text"
          value={formData.employeeCode || ""}
          readOnly
          className="w-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-500 dark:text-gray-400 cursor-not-allowed"
        />
      </div>

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
            className="w-full bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            placeholder="0.00"
            required
            min="0"
            step="0.01"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">
            ج.م
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          السبب
        </label>
        <textarea
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
          className="w-full bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none h-24"
          placeholder={`سبب ${type === "advance" ? "السلفة" : "الخصم"}...`}
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
            type === "advance"
              ? "bg-[#FF7043] hover:bg-[#F4511E]"
              : "bg-red-600 hover:bg-red-700"
          }`}>
          {type === "advance" ? "تأكيد السلفة" : "تأكيد الخصم"}
        </button>
      </div>
    </form>
  );
};

const HRPage = () => {
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(null); // 'advance' or 'deduction'

  const openModal = (type) => {
    setModalType(type);
    setIsModalOpen(true);
  };

  const handleSaveTransaction = (data) => {
    console.log("Saving Transaction:", modalType, data);
    // Here you would call the API to save
    setIsModalOpen(false);
    alert(
      `تم إضافة ${modalType === "advance" ? "السلفة" : "الخصم"} للموظف بنجاح`
    );
  };

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
  const employees = [
    {
      id: 1,
      name: "أحمد محمد",
      role: "مدير فرع",
      code: "EMP-001",
      phone: "+20 101 234 5678",
      salary: "8,000",
      advances: "-",
      deductions: "-",
      remaining: "8,000",
      status: "نشط",
      statusColor:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCOPfWWWsWaHp3fUBScVZJLURjbDbIy3CGfqsP0NC9GP0dVWGfrL8MyCSJ4hbKqBCVMSQh5RDg-nFIwJ1a0HhvFDJUjGtKA9G1sFOURpzYbKjwNQzAixZncslP5BOdGCL1Pe5BRxXfix9NPlR5OmGg_UtveCqYUYtezAknVFWULQbv8XVa_J9gZm4osT9Pf0h-vjMEGcG9JxSKt5rvmp814zN9jIPaKJHlPwkTAYsgt_z-lDjPovK5v8ceBayfuUHjD6qu_ARzcjB9T",
    },
    {
      id: 2,
      name: "سارة علي",
      role: "محاسب",
      code: "EMP-002",
      phone: "+20 112 345 6789",
      salary: "6,000",
      advances: "500",
      deductions: "-",
      remaining: "5,500",
      status: "نشط",
      statusColor:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuBnQmwZAVuFwTfAZXF_6Lx3DqeL5TYGO5WFLjGH_iVfPnxuqlrDboHSEvIH3fmuGoO_zeL-uWnFFhEp2zQxwf_3cqpXUFcurjqlKbgPnXPXnefYcdRzqZnzGVQ4hMgCFHp_Fxj5sOIa1ZTOWeufQ6yaLDM_jxAkm31Z3ZwIcF8aLfmBdz4v41_pkoEtU_eaYj4O-_x5YkzvihACQ26aRJxMN-eIYFcPoQN2w-hJewJ5ucRyg6BFzf_o_s_1oO8TwE3Ic0RbxUP4l-Mq",
    },
    {
      id: 3,
      name: "محمد ابراهيم",
      role: "باريستا",
      code: "EMP-003",
      phone: "+20 123 456 7890",
      salary: "4,500",
      advances: "1,200",
      deductions: "-",
      remaining: "3,300",
      status: "نشط",
      statusColor:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuCy8TFAkz4QAq1iZhWKW_0inxs6Oz6sH80w8abhTmaY9Eci9oDqb_r-BKhDOZKMCZCwbYden5Sylvzf-240wqDpx_HLRq0ej67AV4mErCguRJ9X_TiMtFVsG4ZX0rUXKDMRJWS4iAeuK-9euG3yV-pjsU4imXSzmBqQc0z3Y4GOzx66UmMKkfpjXYwdoThz670lfwWmIM3oN2M23DjjGpjsLvBnt9iyq13ZFECTEq13fAkfEt1_-BBA0PmZhd1ezwXNt-WxGwBZ9Y_T",
    },
    {
      id: 4,
      name: "محمود حسن",
      role: "ويتر",
      code: "EMP-004",
      phone: "+20 155 555 5555",
      salary: "3,500",
      advances: "200",
      deductions: "-",
      remaining: "3,300",
      status: "إجازة",
      statusColor:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuD6GRmjro93q-zGCE-oOX2h4E3VLBVuXOLT00Sume17yj0f56qnrdLuiUQg4CA9gFklDRlRTXeaVKiZuc8y7uD3NQo3DiI8SGmyltESXmhQLHdyX9d-mvMKQugb17mWRrObH2HkbM8kig9q2iYNyQyVfwyr7lR4h7HjzxZWP7kCq0cPrsdf_WHX5WMyooTxDDe47jpVlDtnys83DtVezOmWAv1R-qrmqPr9OWTFJSzHYLMCT6YImqDsoyY7zpmgtCkStGABVODtJJAW",
    },
    {
      id: 5,
      name: "يوسف كمال",
      role: "كاشير",
      code: "EMP-005",
      phone: "+20 109 999 9999",
      salary: "4,000",
      advances: "-",
      deductions: "-",
      remaining: "4,000",
      status: "نشط",
      statusColor:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDdwoFZ9lRBlMVHRNrAoucX2lfsdolIBk41-HafPjbwIeFC79gPzNcaA-3SoTCSu_XvHz-zRemVDTn4BBTZgVeWzDykXgUwS-N8qeUOWj2_hbe-WMqy0CUe-zWxL4ZinmEXMSq81YRvNaDcpvY14wbwgxTNmeGsay19LkjfQvulmrWcNZ4o7-x2-UNv6xdL-27iDMhvxuMh8yh1LIaGhBqDi4dAUQSi7JjTQGebznLF5I2GgwLMYYTBdKl-B9SZfoK54qaupUPyR3bh",
    },
  ];

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
            {/* Branch Filter */}
            <div className="relative">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="appearance-none bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-2.5 pr-10 text-sm font-bold text-text-light dark:text-text-dark focus:ring-2 focus:ring-primary focus:border-transparent outline-none cursor-pointer">
                <option value="all">كل الفروع</option>
                {branches.map((branch) => (
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Card 1 */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-5 shadow-sm border border-border-light dark:border-border-dark flex flex-col justify-between">
            <div className="flex justify-between items-start mb-2">
              <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                <span className="material-symbols-outlined">groups</span>
              </div>
              <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                +2 هذا الشهر
              </span>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">
                إجمالي الموظفين
              </p>
              <p className="text-3xl font-black text-text-light dark:text-text-dark">
                12
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
                45,000{" "}
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
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-1 rounded-full">
                مرتفع
              </span>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">
                إجمالي السلف
              </p>
              <p className="text-3xl font-black text-text-light dark:text-text-dark">
                3,200{" "}
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
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {employees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="hover:bg-background-light dark:hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-bold text-text-light dark:text-text-dark">
                          {employee.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {employee.role}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 font-mono">
                      {employee.code}
                    </td>
                    <td
                      className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600 dark:text-gray-300 font-mono"
                      dir="ltr">
                      {employee.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-light dark:text-text-dark">
                      {employee.salary} ج.م
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${
                        employee.advances !== "-"
                          ? "text-orange-600 dark:text-orange-400"
                          : "text-gray-400 dark:text-gray-500"
                      }`}>
                      {employee.advances !== "-"
                        ? `${employee.advances} ج.م`
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 dark:text-gray-500">
                      {employee.deductions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-text-light dark:text-text-dark">
                      {employee.remaining} ج.م
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-surface-light dark:bg-surface-dark px-6 py-4 border-t border-border-light dark:border-border-dark flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              عرض 1 إلى 5 من أصل 12 موظف
            </span>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded border border-border-light dark:border-border-dark text-gray-500 dark:text-gray-400 hover:bg-background-light dark:hover:bg-white/5 disabled:opacity-50 text-sm">
                السابق
              </button>
              <button className="px-3 py-1 rounded border border-primary bg-primary text-white text-sm">
                1
              </button>
              <button className="px-3 py-1 rounded border border-border-light dark:border-border-dark text-gray-500 dark:text-gray-400 hover:bg-background-light dark:hover:bg-white/5 text-sm">
                2
              </button>
              <button className="px-3 py-1 rounded border border-border-light dark:border-border-dark text-gray-500 dark:text-gray-400 hover:bg-background-light dark:hover:bg-white/5 text-sm">
                3
              </button>
              <button className="px-3 py-1 rounded border border-border-light dark:border-border-dark text-gray-500 dark:text-gray-400 hover:bg-background-light dark:hover:bg-white/5 text-sm">
                التالي
              </button>
            </div>
          </div>
        </div>
      </div>
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalType === "advance" ? "إضافة سلفة جديدة" : "إضافة خصم للموظف"
        }>
        <TransactionForm
          type={modalType}
          employees={employees}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveTransaction}
        />
      </Modal>
    </div>
  );
};

export default HRPage;
