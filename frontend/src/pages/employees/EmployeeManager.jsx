import React, { useState } from "react";
import GenericPageManager from "../../components/shared/GenericPageManager";
import { employeeService, branchService } from "../../services/domainServices";
import AuthService from "../../services/authService";
import { validateEgyptianPhone } from "../../utils/validationUtils";
import Icon from "../../components/ui/Icon";

const EmployeeForm = ({ initialData, onClose, onSave, isSaving, data, showToast }) => {
  // Calculate next ID if creating new employee
  const nextId =
    data && data.length > 0
      ? Math.max(...data.map((d) => parseInt(d.id) || 0)) + 1
      : 1;

  const [branches, setBranches] = useState([]);
  const _rawHours = parseFloat(initialData?.workHours || "8");
  const [formData, setFormData] = useState({
    id: initialData?.id || nextId,
    name: initialData?.name || "",
    branchId: initialData?.branchId || "",
    phone: initialData?.phone || "",
    nationalId: initialData?.nationalId || "",
    workDays: initialData?.workDays || "26",
    workHours: Math.floor(_rawHours).toString(),
    workMinutes: Math.round((_rawHours % 1) * 60).toString(),
    weekend: initialData?.weekend || "الجمعة",
    salary: initialData?.salary || "",
    title: initialData?.title || "",
  });
  const [keepOpen, setKeepOpen] = useState(false);

  React.useEffect(() => {
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === "branchId" ? parseInt(value) || "" : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Manual HTML5 Validation Check
    if (!e.target.checkValidity()) {
      if (showToast) {
        showToast("برجاء ملء جميع الحقول المطلوبة بشكل صحيح", "error");
      }
      return;
    }

    // Phone validation
    const phoneValidation = validateEgyptianPhone(formData.phone);
    if (!phoneValidation.isValid) {
      if (showToast) {
        showToast(phoneValidation.message, "error");
      }
      return;
    }

    // Combine hours + minutes into decimal before saving
    const combinedHours = (
      parseInt(formData.workHours || "0") +
      parseInt(formData.workMinutes || "0") / 60
    ).toFixed(4);
    await onSave({ ...formData, workHours: combinedHours }, !keepOpen);

    if (keepOpen) {
      setFormData((prev) => ({
        ...prev,
        id: parseInt(prev.id) + 1,
        name: "",
        phone: "",
        nationalId: "",
        salary: "",
        // Keep branch, title, workDays, workHours, workMinutes, weekend as sticky
      }));
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
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
          <Icon name="tag" className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          الفرع
        </label>
        <div className="relative">
          <select
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-10 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow appearance-none"
            name="branchId"
            value={formData.branchId}
            onChange={handleChange}
            required>
            <option value="">اختر الفرع...</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          <Icon name="store" className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Icon name="expand_more" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
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
            maxLength={100}
          />
          <Icon name="badge" className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
            required
            maxLength={100}
          />
          <Icon name="work" className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
            placeholder="14 رقم"
            type="text"
            maxLength={14}
            inputMode="numeric"
            pattern="[0-9]*"
          />
          <Icon name="fingerprint" className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
            maxLength={14}
          />
          <Icon name="call" className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
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
            min={1}
            max={31}
            step={1}
          />
          <Icon name="calendar_today" className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          عدد ساعات العمل
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-3 pl-10 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-center"
              name="workHours"
              value={formData.workHours}
              onChange={handleChange}
              placeholder="8"
              type="number"
              min={0}
              max={23}
              step={1}
            />
            <Icon name="schedule" className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-base" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">ساعة</span>
          </div>
          <div className="relative flex-1">
            <input
              className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-3 pl-10 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-center"
              name="workMinutes"
              value={formData.workMinutes}
              onChange={handleChange}
              placeholder="0"
              type="number"
              min={0}
              max={59}
              step={1}
            />
            <Icon name="timer" className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-base" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">دقيقة</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          الاجازة الاسبوعية
        </label>
        <div className="relative">
          <select
            className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-10 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow appearance-none"
            name="weekend"
            value={formData.weekend}
            onChange={handleChange}>
            <option value="الجمعة">الجمعة</option>
            <option value="السبت">السبت</option>
            <option value="الأحد">الأحد</option>
          </select>
          <Icon name="weekend" className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <Icon name="expand_more" className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none" />
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
            min={0}
            max={9999999}
          />
          <Icon name="attach_money" className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
        </div>
      </div>

      <div className="md:col-span-2 flex flex-col sm:flex-row justify-end gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
        <button
          type="button"
          onClick={onClose}
          disabled={isSaving}
          className="px-6 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-text-light dark:text-text-dark font-bold text-sm hover:bg-background-light dark:hover:bg-background-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          إلغاء
        </button>

        {!initialData && (
          <button
            type="submit"
            onClick={() => setKeepOpen(true)}
            disabled={isSaving}
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary dark:text-accent font-bold text-sm transition-all flex items-center justify-center gap-2 min-h-touch border border-primary/20 disabled:opacity-50 disabled:cursor-not-allowed">
            <Icon name="playlist_add" className="text-lg" />
            <span>حفظ وإضافة آخر</span>
          </button>
        )}

        <button
          type="submit"
          onClick={() => setKeepOpen(false)}
          disabled={isSaving}
          className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
          {isSaving ? (
            <>
              <Icon name="refresh" className="text-lg animate-spin" />
              <span>جاري الحفظ...</span>
            </>
          ) : (
            <>
              <Icon name="save" className="text-lg" />
              <span>{initialData ? "حفظ التغييرات" : "حفظ وإغلاق"}</span>
            </>
          )}
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
            {item.branch?.name || "-"}
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
      render: (item) => {
        const total = parseFloat(item.workHours || 0);
        const h = Math.floor(total);
        const m = Math.round((total % 1) * 60);
        return (
          <span className="text-gray-700 dark:text-gray-300">
            {h} ساعات{m > 0 ? ` ${m} دقيقة` : ""}
          </span>
        );
      },
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
      hideAddButton={!AuthService.hasPermission("CREATES_EMPLOYEES")}
    />
  );
};

export default EmployeeManager;
