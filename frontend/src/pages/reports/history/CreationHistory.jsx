import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  employeeService,
  supplierService,
  clientService,
  itemService,
  warehouseService,
  categoryService,
  treasuryService,
  branchService,
} from "../../../services/domainServices";

const CreationHistory = () => {
  const navigate = useNavigate();
  const [allCreations, setAllCreations] = useState([]);
  const [filteredCreations, setFilteredCreations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Entity type configurations
  const entityTypes = [
    { service: employeeService, type: "موظف", icon: "badge" },
    { service: supplierService, type: "مورد", icon: "local_shipping" },
    { service: clientService, type: "عميل", icon: "groups" },
    { service: itemService, type: "صنف", icon: "inventory_2" },
    { service: warehouseService, type: "مخزن", icon: "warehouse" },
    { service: categoryService, type: "تصنيف", icon: "category" },
    { service: treasuryService, type: "خزينة", icon: "savings" },
    { service: branchService, type: "فرع", icon: "storefront" },
  ];

  // Fetch all creations from different services
  useEffect(() => {
    const fetchAllCreations = async () => {
      setLoading(true);
      try {
        const creationsPromises = entityTypes.map(
          async ({ service, type, icon }) => {
            try {
              const data = await service.getAll();
              return data.map((item) => ({
                id: `${type}-${item.id}`,
                type: type,
                icon: icon,
                name: item.name,
                createdAt: item.createdAt,
                createdBy: item.createdBy || "النظام",
              }));
            } catch (error) {
              console.error(`Error fetching ${type}:`, error);
              return [];
            }
          }
        );

        const results = await Promise.all(creationsPromises);
        const combined = results.flat();

        // Sort by creation date (newest first)
        combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setAllCreations(combined);
        setFilteredCreations(combined);
      } catch (error) {
        console.error("Error fetching creations:", error);
      }
      setLoading(false);
    };

    fetchAllCreations();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...allCreations];

    // Type filter
    if (selectedType) {
      filtered = filtered.filter((item) => item.type === selectedType);
    }

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.type.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Date range filter
    if (startDate) {
      filtered = filtered.filter(
        (item) => new Date(item.createdAt) >= new Date(startDate)
      );
    }
    if (endDate) {
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (item) => new Date(item.createdAt) <= endDateTime
      );
    }

    setFilteredCreations(filtered);
  }, [searchQuery, selectedType, startDate, endDate, allCreations]);

  // Format date: dd-mm-yy hh:mm
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  };

  return (
    <div className="bg-surface-light dark:bg-surface-dark w-full rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-140px)] transition-colors duration-200">
      {/* Header */}
      <div className="px-6 py-5 sm:px-8 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-surface-dark z-10 shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-primary text-white w-12 h-12 flex items-center justify-center rounded-xl shadow-lg">
            <span className="material-icons-round text-2xl">history_edu</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              سجل الإنشاءات
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              تاريخ العمليات المسجلة
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate("/reports/detailed")}
          className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          <span className="material-icons-round text-2xl">close</span>
        </button>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search Bar */}
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              البحث
            </label>
            <div className="relative">
              <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                search
              </span>
              <input
                type="text"
                placeholder="ابحث بالاسم أو النوع..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* Type Filter */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              نوع السجل
            </label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent">
              <option value="">جميع الأنواع</option>
              {entityTypes.map((entity) => (
                <option key={entity.type} value={entity.type}>
                  {entity.type}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters Button (on right side) */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedType("");
                setStartDate("");
                setEndDate("");
              }}
              className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2">
              <span className="material-icons-round text-lg">clear_all</span>
              <span className="font-medium">مسح الفلاتر</span>
            </button>
          </div>
        </div>

        {/* Date Range Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              من تاريخ
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              إلى تاريخ
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          <div className="md:col-span-2"></div>
        </div>

        {/* Results Count */}
        <div className="mt-3 flex items-center gap-2">
          <span className="material-icons-round text-primary text-lg">
            filter_list
          </span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            عرض {filteredCreations.length} من {allCreations.length} سجل
          </span>
          {(searchQuery || selectedType || startDate || endDate) && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              (يتم تطبيق الفلاتر)
            </span>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="p-0 overflow-y-auto custom-scrollbar flex-grow bg-white dark:bg-surface-dark">
        <div className="overflow-x-auto">
          <table className="w-full text-center border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0 z-10 border-b border-gray-100 dark:border-gray-700">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">
                  نوع السجل
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">
                  الاسم
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">
                  أنشأ بواسطة
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">
                  تاريخ الإنشاء
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center p-10">
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
                      <p className="text-gray-500 dark:text-gray-400 font-medium">
                        جاري التحميل...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredCreations.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center p-10 text-gray-500 dark:text-gray-400">
                    {searchQuery || startDate || endDate
                      ? "لا توجد نتائج مطابقة للبحث"
                      : "لا توجد بيانات مضافة بعد."}
                  </td>
                </tr>
              ) : (
                filteredCreations.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-default">
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="material-icons-round text-primary text-lg">
                          {item.icon}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-200">
                          {item.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900 dark:text-gray-200 font-medium">
                        {item.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {item.createdBy}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="text-sm text-gray-900 dark:text-gray-200 font-mono">
                        {formatDate(item.createdAt)}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-5 sm:px-8 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-surface-dark/50 flex justify-end shrink-0">
        <button
          onClick={() => navigate("/reports/detailed")}
          className="bg-white dark:bg-transparent border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-bold py-3 px-8 rounded-xl transition-all">
          إغلاق
        </button>
      </div>
    </div>
  );
};

export default CreationHistory;
