import React from "react";

const HRPage = () => {
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
      {/* Header removed */}

      <div className="flex-1 overflow-y-auto px-8 pb-8 custom-scrollbar pt-6">
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
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    الحالة
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    إجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {employees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="hover:bg-background-light dark:hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div
                          className="size-10 rounded-full bg-cover bg-center shrink-0 border border-gray-200"
                          style={{
                            backgroundImage: `url('${employee.image}')`,
                          }}></div>
                        <div className="mr-4">
                          <div className="text-sm font-bold text-text-light dark:text-text-dark">
                            {employee.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {employee.role}
                          </div>
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
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${employee.statusColor}`}>
                        {employee.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          className="text-gray-500 hover:text-primary transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-white/10"
                          title="تعديل">
                          <span className="material-symbols-outlined text-[20px]">
                            edit
                          </span>
                        </button>
                        <button
                          className="text-gray-500 hover:text-red-600 transition-colors p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="حذف">
                          <span className="material-symbols-outlined text-[20px]">
                            delete
                          </span>
                        </button>
                      </div>
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
    </div>
  );
};

export default HRPage;
