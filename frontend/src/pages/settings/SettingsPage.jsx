import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Icon from "../../components/ui/Icon";
import {
  settingsService,
  warehouseService,
  treasuryService,
} from "../../services/domainServices";

const SettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    taxNumber: "",
    mainWarehouseId: "",
    mainTreasuryId: "",
    bankTreasuryId: "",
    taxRate: 14,
    salaryStartDay: 1,
    salaryEndDay: 30,
    shiftStartTime: "09:00",
    shiftEndTime: "17:00",
    // New POS shift times
    morningShiftStart: "09:00",
    morningShiftEnd: "17:00",
    eveningShiftStart: "17:00",
    eveningShiftEnd: "01:00",
  });

  const [warehouses, setWarehouses] = useState([]);
  const [treasuries, setTreasuries] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settings, warehousesData, treasuriesData] = await Promise.all([
        settingsService.get(),
        warehouseService.getAll(),
        treasuryService.getAll(),
      ]);

      console.log("📊 Settings loaded:", settings);
      console.log("📦 Warehouses loaded:", warehousesData);
      console.log("💰 Treasuries loaded:", treasuriesData);

      setFormData({
        companyName: settings.companyName || "",
        taxNumber: settings.taxNumber || "",
        mainWarehouseId: settings.mainWarehouseId || "",
        mainTreasuryId: settings.mainTreasuryId || "",
        bankTreasuryId: settings.bankTreasuryId || "",
        taxRate: settings.taxRate || 14,
        salaryStartDay: settings.salaryStartDay || 1,
        salaryEndDay: settings.salaryEndDay || 30,
        shiftStartTime: settings.shiftStartTime || "09:00",
        shiftEndTime: settings.shiftEndTime || "17:00",
        // POS shift times
        morningShiftStart: settings.morningShiftStart || "09:00",
        morningShiftEnd: settings.morningShiftEnd || "17:00",
        eveningShiftStart: settings.eveningShiftStart || "17:00",
        eveningShiftEnd: settings.eveningShiftEnd || "01:00",
      });

      setWarehouses(warehousesData);
      setTreasuries(treasuriesData);
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast.error(error.message || "فشل في تحميل الإعدادات");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await settingsService.update(formData);
      toast.success("تم حفظ الإعدادات بنجاح");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error(error.message || "فشل في حفظ الإعدادات");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary dark:text-text-dark mb-2">
          إعدادات النظام
        </h1>
        <p className="text-text-secondary dark:text-gray-400">
          إدارة التكويدات العامة والخيارات التشغيلية
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Operational Settings */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-sm border border-border-light dark:border-border-dark">
          <h2 className="text-xl font-bold text-primary dark:text-accent mb-6 flex items-center gap-2">
            <Icon name="settings_applications" />
            الإعدادات التشغيلية
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                اسم الشركة
              </label>
              <input
                type="text"
                name="companyName"
                value={formData.companyName}
                onChange={handleChange}
                className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                الرقم الضريبي
              </label>
              <input
                type="text"
                name="taxNumber"
                value={formData.taxNumber}
                onChange={handleChange}
                placeholder="مثال: 123-456-789"
                className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-xs text-text-secondary dark:text-gray-500 mt-1">
                سيظهر في جميع الفواتير المطبوعة
              </p>
            </div>
            <div>
              <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                الضريبة (%)
              </label>
              <input
                type="number"
                name="taxRate"
                value={formData.taxRate}
                onChange={handleChange}
                step="0.01"
                className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                المخزن الرئيسي (الافتراضي)
              </label>
              <select
                name="mainWarehouseId"
                value={formData.mainWarehouseId}
                onChange={handleChange}
                className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">اختر المخزن...</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                الخزينة الرئيسية (الافتراضية)
              </label>
              <select
                name="mainTreasuryId"
                value={formData.mainTreasuryId}
                onChange={handleChange}
                className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">اختر الخزينة...</option>
                {treasuries.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                خزينة البنك (الحساب البنكي)
              </label>
              <select
                name="bankTreasuryId"
                value={formData.bankTreasuryId}
                onChange={handleChange}
                className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50">
                <option value="">اختر الخزينة...</option>
                {treasuries.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-secondary dark:text-gray-500 mt-1">
                حدد الخزينة التي تمثل الحساب البنكي للشركة
              </p>
            </div>
          </div>
        </div>

        {/* HR Settings */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-sm border border-border-light dark:border-border-dark">
          <h2 className="text-xl font-bold text-primary dark:text-accent mb-6 flex items-center gap-2">
            <Icon name="access_time" />
            إعدادات الدوام والرواتب
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                بداية الوردية
              </label>
              <input
                type="time"
                name="shiftStartTime"
                value={formData.shiftStartTime}
                onChange={handleChange}
                className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                نهاية الوردية
              </label>
              <input
                type="time"
                name="shiftEndTime"
                value={formData.shiftEndTime}
                onChange={handleChange}
                className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                يوم بداية شهر الرواتب
              </label>
              <input
                type="number"
                min="1"
                max="31"
                name="salaryStartDay"
                value={formData.salaryStartDay}
                onChange={handleChange}
                className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                يوم نهاية شهر الرواتب
              </label>
              <input
                type="number"
                min="1"
                max="31"
                name="salaryEndDay"
                value={formData.salaryEndDay}
                onChange={handleChange}
                className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>

        {/* POS Shift Settings */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-6 shadow-sm border border-border-light dark:border-border-dark">
          <h2 className="text-xl font-bold text-primary dark:text-accent mb-4 flex items-center gap-2">
            <Icon name="store" />
            إعدادات ورديات نقاط البيع (POS)
          </h2>
          <p className="text-sm text-text-secondary dark:text-gray-400 mb-6">
            حدد أوقات بداية ونهاية الورديات الصباحية والمسائية
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Morning Shift */}
            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border-2 border-blue-200 dark:border-blue-800">
              <h3 className="font-bold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                <Icon name="wb_sunny" className="text-xl" />
                الوردية الصباحية
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                    وقت البداية
                  </label>
                  <input
                    type="time"
                    name="morningShiftStart"
                    value={formData.morningShiftStart}
                    onChange={handleChange}
                    className="w-full bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                    وقت النهاية
                  </label>
                  <input
                    type="time"
                    name="morningShiftEnd"
                    value={formData.morningShiftEnd}
                    onChange={handleChange}
                    className="w-full bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Evening Shift */}
            <div className="bg-orange-50 dark:bg-orange-900/10 p-4 rounded-xl border-2 border-orange-200 dark:border-orange-800">
              <h3 className="font-bold text-orange-700 dark:text-orange-300 mb-3 flex items-center gap-2">
                <Icon name="nights_stay" className="text-xl" />
                الوردية المسائية
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                    وقت البداية
                  </label>
                  <input
                    type="time"
                    name="eveningShiftStart"
                    value={formData.eveningShiftStart}
                    onChange={handleChange}
                    className="w-full bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-text-primary dark:text-text-dark mb-2">
                    وقت النهاية
                  </label>
                  <input
                    type="time"
                    name="eveningShiftEnd"
                    value={formData.eveningShiftEnd}
                    onChange={handleChange}
                    className="w-full bg-white dark:bg-gray-800 border border-border-light dark:border-border-dark rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>ملاحظة:</strong> يتم تحديد نوع الوردية (صباحية/مسائية) تلقائياً بناءً على الوقت الحالي عند بدء الوردية.
              الوردية المسائية يمكن أن تمتد بعد منتصف الليل (مثلاً من 17:00 إلى 01:00).
            </p>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary hover:bg-primary-hover text-white py-3 px-8 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all hover:translate-y-[-2px] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            {saving ? (
              <Icon name="refresh" className="animate-spin" />
            ) : (
              <Icon name="save" />
            )}
            حفظ التغييرات
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;
