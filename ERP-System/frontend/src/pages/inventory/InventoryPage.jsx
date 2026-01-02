import React, { useState } from "react";

const InventoryPage = () => {
  const [filter, setFilter] = useState("الكل");

  const inventoryItems = [
    {
      id: 1,
      name: "اسبريسو غامق",
      code: "CF-001",
      category: "بن القهوة",
      categoryColor: "bg-primary",
      quantity: 45,
      unit: "كجم",
      purchasePrice: 280,
      sellPrice: 450,
      status: "متوفر",
      statusColor: "bg-green-50 text-green-700 border-green-200",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuAZAoZmkwZyH2TdUSGj3-yPf895fUr3F-u-s9LLWqaTONineDda9iXdLONis9YgeCYtotWHHDIZF1Ie8b7wCISWbURtKN7GWcSAmW6m3AuHsxSAGYnWxF59DzNtTs7E1-PKXhNnrBxTyQN1E8ZKUVdHPfcNaO0mt7rUQaMyckXYzvMP8Wn7CpZWdpH6t_KQj04mhA_M5uhpHcN5On3Dk7HKIaEhdCuQuanYi3gFUk6jXfdiTRPW4er9rDAUlJdFh_uGimu-gTpqIi4N",
    },
    {
      id: 2,
      name: "شراب الفانيليا",
      code: "SY-042",
      category: "مستلزمات",
      categoryColor: "bg-blue-700",
      quantity: 2,
      unit: "نقص بالمخزون",
      unitIsAlert: true,
      purchasePrice: 120,
      sellPrice: 180,
      status: "نقص بالمخزون",
      statusColor: "bg-primary/10 text-primary border-primary/20",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuB0d9jLSepehzP-XfUpMlaxyPFCK5yERbmAiXOFfSouYTiB39FlQkNNqiVc2QJ1IE5KW9Cgrbxv_i93IMKDfdNS2Ict03pi7fs3g5lnRCGJS77WBuusuMsNB57wTEKw6zQSh616lF79VNvBtFjC02ZawpiwCsTmy-y4uo4du3WGxx7yNT47kNs0G93VWxpxH83NVtufCYyHH4t2eHbxAi6lI-IxVwXr9-bUeWd6_78B_8i76gB6-EslV3ynjM4sNZ3H6maSUPPNCU57",
    },
    {
      id: 3,
      name: "كرواسون بالزبدة",
      code: "PA-105",
      category: "مخبوزات",
      categoryColor: "bg-yellow-600",
      quantity: 12,
      unit: "قطعة",
      purchasePrice: 15,
      sellPrice: 35,
      status: "متوفر",
      statusColor: "bg-green-50 text-green-700 border-green-200",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuA6iJfh0cXzI4NNeSoTl0uZI-O0OwgdbNf-6kmTBKZtoRrQIWRcFRb7Xz9v-Ut_30mTZAi8xIEZ0ZbMlMvmI7tx2gtca7Puo8ujDB7OGxkyx6PFiqZopLmB_tt5ci3224-1R1ZY73k-_xpW42siFyEDBirT99Z6DIteF_f2SD9W_uUe8nYtgYvqfOBcxXR_JQovfxxHVyF4X9VEggqgl8ls7zbiSo_XR5YYb5BR7BXnGaWSSF0SPLsk4HKqOs9nyJVE4FTyd1dp_nfN",
    },
    {
      id: 4,
      name: "أكواب تيك أواي (12oz)",
      code: "SU-882",
      category: "مستلزمات",
      categoryColor: "bg-blue-700",
      quantity: 500,
      unit: "قطعة",
      purchasePrice: 2.5,
      sellPrice: "-",
      status: "متوفر",
      statusColor: "bg-green-50 text-green-700 border-green-200",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuB25LHJMYmjYVyTpzw6pENRhQ4_zihPoPWr0Giw8yELR_6cG05jkENK8qBkI0LntbFxCbTS48ILLgsySuIT-P6qXv2YhcluKHvg-RtoYaI6ODIOh7KfpW0Qt1M00Kizbej0uGLc6HO4FelPdo2YCl4dVpuRN4rNbT5wlbegr9T6DjKEjK-A8FmTLnvbU2K4zJxynJFsVgKpLI4r0lyc3YxnugwMCYS6RJamA7WYPZnWXLWx1eIcBkTDyfVmcNzM5lsQ7OteAumWiImc",
    },
    {
      id: 5,
      name: "كولومبي وسط",
      code: "CF-003",
      category: "بن القهوة",
      categoryColor: "bg-primary",
      quantity: 22,
      unit: "كجم",
      purchasePrice: 310,
      sellPrice: 520,
      status: "متوفر",
      statusColor: "bg-green-50 text-green-700 border-green-200",
      image:
        "https://lh3.googleusercontent.com/aida-public/AB6AXuDuGUI0zrmKbp5GHC-q-0BghLmvY6XYEF41CYyu3YFZ329xs3tvlB0w4GW9yoZJpS6cJH5XgyClBxiEcUFxYASFx-vLOo_HoF_CjdGrA74Fd0CuKopL3Ok2g7ZcKNcBMkFxwoNP9swlYkc5I5Jp7hGHU8J7kgNxJcGa7v5uPwsrlruGHZvffco3J-91fBIZw5k4BAClA0rhUHNmkNK5OahW3Hqdk81p7bLK8YBW2nXnOZzZ2_Ax6I4WONgK-HHnyrsVZ5cVHZZ5Rf-y",
    },
  ];

  const categories = ["الكل", "بن القهوة", "مخبوزات", "مشروبات", "مستلزمات"];

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] overflow-hidden bg-background-light dark:bg-background-dark text-text-main dark:text-text-dark">
      <header className="flex-shrink-0 border-b border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark z-10">
        <div className="px-6 py-5 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="bg-center bg-no-repeat bg-cover rounded-full size-12 shrink-0 border-2 border-primary"
                style={{
                  backgroundImage:
                    "url('https://lh3.googleusercontent.com/aida-public/AB6AXuDdgIyPoegrwJd7qWdy8nq62FE1SAuNgwBlxs-5IRPQzUFpop5fqAiRkJ7hz1pL3Cc12rUZQAAcEqnd6XeOLFgC5RQwp2BtxnGEnZDQlBIX1dcZwUSTYEsjQHn6oK-VY6-HML_qwqUVCfK6f961O1a_tJSCDYcPJGV9v-A4mEWvr7UWD0GiXBqgYNzwVsYw1cPhk8qGOZ48_hcNAZuoYS-XsJ6V4ISqXguw5HF9A0xOOp5uZS-q2guzcQOTXlz4LEvWtzKAhroQrIMv')",
                }}></div>
              <div className="flex flex-col">
                <h1 className="text-text-main dark:text-text-dark text-lg font-bold leading-tight">
                  بن الغنيمي
                </h1>
                <p className="text-text-muted dark:text-gray-400 text-xs font-normal">
                  نظام نقاط البيع v2.4
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label
                  className="text-text-muted dark:text-gray-400 text-sm font-medium"
                  htmlFor="branch-select">
                  اختر الفرع:
                </label>
                <select
                  className="bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark text-text-main dark:text-text-dark text-sm rounded-lg focus:ring-primary focus:border-primary block p-2.5 min-w-[200px]"
                  id="branch-select">
                  <option defaultValue>الفرع الرئيسي - وسط البلد</option>
                  <option value="1">فرع مدينة نصر</option>
                  <option value="2">فرع المهندسين</option>
                  <option value="3">فرع الإسكندرية</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-text-main dark:text-text-dark text-3xl font-bold tracking-tight flex items-center gap-2">
                إدارة المخزون
                <span className="text-text-muted dark:text-gray-400 font-normal text-xl opacity-80">
                  - الجرد
                </span>
              </h2>
              <p className="text-text-muted dark:text-gray-400 text-sm mt-1">
                إدارة مستويات المخزون، الأسعار وتفاصيل المنتجات.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" dir="rtl">
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-4 border border-border-light dark:border-border-dark flex items-center justify-between group hover:border-primary transition-colors shadow-sm">
              <div>
                <p className="text-text-muted dark:text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">
                  إجمالي الأصناف
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-bold text-text-main dark:text-text-dark">
                    145
                  </h3>
                  <span className="text-green-800 text-xs font-medium flex items-center bg-green-100 px-1.5 py-0.5 rounded">
                    <span className="material-symbols-outlined text-[14px]">
                      trending_up
                    </span>
                    12%
                  </span>
                </div>
              </div>
              <div className="bg-[#EFEBE9] dark:bg-primary/20 p-2.5 rounded-lg text-primary">
                <span className="material-symbols-outlined">dataset</span>
              </div>
            </div>
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-4 border border-border-light dark:border-border-dark flex items-center justify-between group hover:border-primary transition-colors shadow-sm">
              <div>
                <p className="text-text-muted dark:text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">
                  نواقص المخزون
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-bold text-text-main dark:text-text-dark">
                    3
                  </h3>
                  <span className="text-red-800 text-xs font-medium flex items-center bg-red-100 px-1.5 py-0.5 rounded">
                    إجراء مطلوب
                  </span>
                </div>
              </div>
              <div className="bg-red-50 p-2.5 rounded-lg text-red-700">
                <span className="material-symbols-outlined">warning</span>
              </div>
            </div>
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl p-4 border border-border-light dark:border-border-dark flex items-center justify-between group hover:border-primary transition-colors shadow-sm">
              <div>
                <p className="text-text-muted dark:text-gray-400 text-xs font-medium uppercase tracking-wider mb-1">
                  القيمة الإجمالية
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-bold text-text-main dark:text-text-dark">
                    45 ألف
                    <span className="text-sm font-normal text-text-muted dark:text-gray-400 mr-1">
                      ج.م
                    </span>
                  </h3>
                  <span className="text-green-800 text-xs font-medium flex items-center bg-green-100 px-1.5 py-0.5 rounded">
                    +5%
                  </span>
                </div>
              </div>
              <div className="bg-green-50 p-2.5 rounded-lg text-green-700">
                <span className="material-symbols-outlined">attach_money</span>
              </div>
            </div>
          </div>
        </div>
      </header>
      <div className="flex-1 overflow-auto bg-background-light dark:bg-background-dark p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div className="relative w-full lg:max-w-md group">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-text-muted dark:text-gray-400 group-focus-within:text-primary transition-colors">
                search
              </span>
            </div>
            <input
              className="block w-full pr-10 pl-3 py-2.5 rounded-lg leading-5 bg-surface-light dark:bg-surface-dark text-text-main dark:text-text-dark placeholder-text-muted/60 dark:placeholder-gray-500 border border-border-light dark:border-border-dark focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm shadow-sm text-right"
              placeholder="ابحث بالاسم، الكود، أو التصنيف..."
              type="text"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 lg:pb-0 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  filter === cat
                    ? "bg-primary text-surface-light border-transparent shadow-md shadow-[#3E2723]/10 hover:bg-primary-hover"
                    : "bg-surface-light dark:bg-surface-dark text-text-muted dark:text-gray-400 hover:text-primary hover:bg-[#EFEBE9] dark:hover:bg-primary/10 border-border-light dark:border-border-dark"
                }`}>
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-[#F5F5F0] dark:bg-primary/5 border-b border-border-light dark:border-border-dark text-text-muted dark:text-gray-400 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-medium">اسم الصنف</th>
                  <th className="px-6 py-4 font-medium">التصنيف</th>
                  <th className="px-6 py-4 font-medium text-center">
                    الكمية المتاحة
                  </th>
                  <th className="px-6 py-4 font-medium text-left">
                    سعر الشراء
                  </th>
                  <th className="px-6 py-4 font-medium text-left">سعر البيع</th>
                  <th className="px-6 py-4 font-medium text-center">الحالة</th>
                  <th className="px-6 py-4 font-medium text-left">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-light dark:divide-border-dark text-sm">
                {inventoryItems.map((item) => (
                  <tr
                    key={item.id}
                    className="group hover:bg-[#EFEBE9]/50 dark:hover:bg-primary/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-lg bg-cover bg-center shrink-0 border border-border-light dark:border-border-dark"
                          style={{
                            backgroundImage: `url('${item.image}')`,
                          }}></div>
                        <div>
                          <p className="text-text-main dark:text-text-dark font-medium">
                            {item.name}
                          </p>
                          <p className="text-text-muted dark:text-gray-400 text-xs">
                            كود: {item.code}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#EFEBE9] dark:bg-primary/10 text-text-muted dark:text-gray-300 text-xs font-medium border border-[#D7CCC8] dark:border-primary/20">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${item.categoryColor}`}></span>
                        {item.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.unitIsAlert ? (
                        <div className="flex flex-col items-center">
                          <span className="text-primary font-bold">
                            {item.quantity}
                          </span>
                          <span className="text-[10px] text-primary uppercase font-bold">
                            {item.unit}
                          </span>
                        </div>
                      ) : (
                        <>
                          <span className="text-text-main dark:text-text-dark font-bold">
                            {item.quantity}
                          </span>
                          <span className="text-xs text-text-muted dark:text-gray-400 mr-1">
                            {item.unit}
                          </span>
                        </>
                      )}
                    </td>
                    <td className="px-6 py-4 text-left text-text-muted dark:text-gray-400">
                      {item.purchasePrice} ج.م
                    </td>
                    <td className="px-6 py-4 text-left text-text-main dark:text-text-dark font-medium">
                      {item.sellPrice === "-" ? "-" : `${item.sellPrice} ج.م`}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${item.statusColor}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-left">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 hover:bg-[#D7CCC8]/30 dark:hover:bg-primary/20 rounded-md text-text-muted dark:text-gray-400 hover:text-primary transition-colors">
                          <span className="material-symbols-outlined text-[20px]">
                            edit
                          </span>
                        </button>
                        <button className="p-1.5 hover:bg-red-50 rounded-md text-red-400 hover:text-red-700 transition-colors">
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
          <div className="bg-[#F5F5F0] dark:bg-primary/5 border-t border-border-light dark:border-border-dark px-6 py-4 flex items-center justify-between">
            <p className="text-sm text-text-muted dark:text-gray-400">
              عرض{" "}
              <span className="font-medium text-text-main dark:text-text-dark">
                1
              </span>{" "}
              إلى
              <span className="font-medium text-text-main dark:text-text-dark">
                5
              </span>{" "}
              من
              <span className="font-medium text-text-main dark:text-text-dark">
                145
              </span>{" "}
              نتيجة
            </p>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded-md border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-muted dark:text-gray-400 hover:text-primary hover:bg-[#EFEBE9] dark:hover:bg-primary/10 disabled:opacity-50 transition-colors text-sm">
                السابق
              </button>
              <button className="px-3 py-1 rounded-md border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-muted dark:text-gray-400 hover:text-primary hover:bg-[#EFEBE9] dark:hover:bg-primary/10 transition-colors text-sm">
                التالي
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryPage;
