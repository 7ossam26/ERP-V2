import React, { useState } from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import { employeeService } from "../../services/domainServices";

const EmployeeForm = ({ initialData, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    id: initialData?.id || "#",
    name: initialData?.name || "",
    branch: initialData?.branch || "",
    phone: initialData?.phone || "",
    nationalId: initialData?.nationalId || "",
    workDays: initialData?.workDays || "26",
    workHours: initialData?.workHours || "8",
    weekend: initialData?.weekend || "الجمعة",
    salary: initialData?.salary || "",
    title: initialData?.title || "",
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          الرقم التعريفي
        </label>
        <div className="relative">
          <input
            className="w-full bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-500 dark:text-gray-400 focus:ring-0 cursor-not-allowed"
            name="id"
            value={formData.id}
            readOnly
            placeholder="ID تلقائي"
            type="text"
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            tag
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          الفرع
        </label>
        <div className="relative">
          <select
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow appearance-none"
            name="branch"
            value={formData.branch}
            onChange={handleChange}>
            <option value="">اختر الفرع...</option>
            <option value="الفرع الرئيسي">الفرع الرئيسي</option>
            <option value="فرع وسط البلد">فرع وسط البلد</option>
          </select>
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            store
          </span>
          <span className="material-icons-round absolute left-10 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
            expand_more
          </span>
        </div>
      </div>

      <div className="space-y-2 col-span-1 md:col-span-1">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          الاسم بالكامل
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="أدخل اسم الموظف"
            type="text"
            required
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            badge
          </span>
        </div>
      </div>

      <div className="space-y-2 col-span-1 md:col-span-1">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          المسمى الوظيفي
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="مثال: محاسب، باريستا"
            type="text"
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            work
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          رقم البطاقة
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
            name="nationalId"
            value={formData.nationalId}
            onChange={handleChange}
            placeholder="رقم البطاقة"
            type="text"
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            fingerprint
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          رقم الهاتف
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-right"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            dir="ltr"
            placeholder="01xxxxxxxxx"
            type="tel"
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            call
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          ايام الشغل في الشهر
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-center"
            name="workDays"
            value={formData.workDays}
            onChange={handleChange}
            placeholder="26"
            type="number"
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            calendar_today
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          عدد ساعات العمل
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-center"
            name="workHours"
            value={formData.workHours}
            onChange={handleChange}
            placeholder="8"
            type="number"
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            schedule
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          الاجازة الاسبوعية
        </label>
        <div className="relative">
          <select
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow appearance-none"
            name="weekend"
            value={formData.weekend}
            onChange={handleChange}>
            <option value="الجمعة">الجمعة</option>
            <option value="السبت">السبت</option>
            <option value="الأحد">الأحد</option>
          </select>
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            weekend
          </span>
          <span className="material-icons-round absolute left-10 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
            expand_more
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          الراتب
        </label>
        <div className="relative">
          <input
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-right"
            name="salary"
            value={formData.salary}
            onChange={handleChange}
            dir="ltr"
            placeholder="0.00"
            type="number"
            step="0.01"
          />
          <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
            attach_money
          </span>
        </div>
      </div>

      <div className="md:col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <button
          type="button"
          onClick={onClose}
          className="px-6 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-text-light dark:text-text-dark font-bold text-sm hover:bg-background-light dark:hover:bg-background-dark transition-all">
          إلغاء
        </button>
        <button
          type="submit"
          className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2">
          <span className="material-icons-round text-lg">save</span>
          <span>حفظ التغييرات</span>
        </button>
      </div>
    </form>
  );
};

const EmployeeManager = () => {
  const columns = [
    {
      header: "الرقم التعريفي",
      accessor: "id",
      render: (item) => (
        <span className="font-mono text-gray-900 dark:text-white font-bold text-sm">
          {item.id}
        </span>
      ),
    },
    {
      header: "الموظف",
      accessor: "name",
      render: (item) => (
        <div>
          <div className="font-bold text-gray-900 dark:text-white">
            {item.name}
          </div>
          <div className="text-xs text-gray-500">
            {item.branch || "الفرع الرئيسي"}
          </div>
        </div>
      ),
    },
    {
      header: "المسمى الوظيفي",
      accessor: "title",
      render: (item) => (
        <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">
          {item.title || "-"}
        </span>
      ),
    },
    {
      header: "رقم الهاتف",
      accessor: "phone",
      render: (item) => (
        <span
          dir="ltr"
          className="text-gray-600 dark:text-gray-300 font-mono text-xs">
          {item.phone}
        </span>
      ),
    },
    {
      header: "الرقم القومي",
      accessor: "nationalId",
      render: (item) => (
        <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">
          {item.nationalId}
        </span>
      ),
    },
    {
      header: "ايام العمل",
      accessor: "workDays",
      render: (item) => (
        <span className="text-gray-700 dark:text-gray-300">
          {item.workDays} يوم
        </span>
      ),
    },
    {
      header: "ساعات العمل",
      accessor: "workHours",
      render: (item) => (
        <span className="text-gray-700 dark:text-gray-300">
          {item.workHours} ساعة
        </span>
      ),
    },
    {
      header: "الاجازة",
      accessor: "weekend",
      render: (item) => (
        <span className="text-gray-700 dark:text-gray-300">{item.weekend}</span>
      ),
    },
    {
      header: "الراتب",
      accessor: "salary",
      render: (item) => (
        <span className="font-mono text-green-600 font-bold">
          {item.salary} ج.م
        </span>
      ),
    },
  ];

  return (
    <GenericPageManager
      title="إدارة الموظفين"
      subtitle="قائمة بجميع الموظفين المسجلين في النظام"
      icon="badge"
      service={employeeService}
      columns={columns}
      FormComponent={EmployeeForm}
      emptyMessage="لا يوجد موظفين مسجلين."
    />
  );
};

export default EmployeeManager;
