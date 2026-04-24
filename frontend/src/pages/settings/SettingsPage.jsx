import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import {
  settingsService,
  treasuryService,
  warehouseService,
} from "../../services/domainServices";
import { useSystemSettings } from "../../contexts/SystemSettingsContext";

const TABS = [
  { value: "company", label: "الشركة" },
  { value: "taxes", label: "الضرائب" },
  { value: "shifts", label: "الورديات" },
  { value: "features", label: "الخصائص" },
  { value: "appearance", label: "المظهر" },
  { value: "security", label: "الأمان" },
];

function buildFormState(settings) {
  return {
    companyName: settings.companyName || "",
    companyNameEnglish: settings.companyNameEnglish || "",
    taxNumber: settings.taxNumber || "",
    address: settings.address || "",
    phone: settings.phone || "",
    logoUrl: settings.logoUrl || "",
    mainWarehouseId: settings.mainWarehouseId || "",
    mainTreasuryId: settings.mainTreasuryId || "",
    bankTreasuryId: settings.bankTreasuryId || "",
    taxRate: settings.taxRate ?? 14,
    taxEnabledOnSales: settings.taxEnabledOnSales ?? true,
    taxEnabledOnPurchases: settings.taxEnabledOnPurchases ?? false,
    taxEnabledOnExpenses: settings.taxEnabledOnExpenses ?? false,
    shiftStartTime: settings.shiftStartTime || "09:00",
    shiftEndTime: settings.shiftEndTime || "17:00",
    morningShiftStart: settings.morningShiftStart || "09:00",
    morningShiftEnd: settings.morningShiftEnd || "17:00",
    eveningShiftStart: settings.eveningShiftStart || "17:00",
    eveningShiftEnd: settings.eveningShiftEnd || "01:00",
    landedCostFeatureEnabled: settings.landedCostFeatureEnabled ?? false,
    themeKey: settings.themeKey || "ramex-store",
    sessionTimeoutMinutes: settings.sessionTimeoutMinutes ?? 720,
    passwordMinLength: settings.passwordPolicy?.minLength ?? 8,
    passwordRequireUppercase:
      settings.passwordPolicy?.requireUppercase ?? true,
    passwordRequireLowercase:
      settings.passwordPolicy?.requireLowercase ?? true,
    passwordRequireNumber: settings.passwordPolicy?.requireNumber ?? true,
    passwordRequireSpecialChar:
      settings.passwordPolicy?.requireSpecialChar ?? true,
  };
}

function SectionCard({ title, description, children }) {
  return (
    <Paper
      elevation={0}
      className="rounded-[24px] border border-border-light bg-surface-light p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-col gap-1">
        <Typography variant="h6" className="font-bold text-text-light">
          {title}
        </Typography>
        {description ? (
          <Typography variant="body2" className="text-text-light/70">
            {description}
          </Typography>
        ) : null}
      </div>
      {children}
    </Paper>
  );
}

function ThemePreviewPanel({ theme, settings }) {
  return (
    <div
      className="overflow-hidden rounded-[28px] border shadow-lg"
      style={{
        borderColor: `${theme.preview.hero}2B`,
        background: `linear-gradient(135deg, ${theme.preview.surface}, #ffffff 72%)`,
      }}>
      <div
        className="px-5 py-5 text-white"
        style={{
          background: `linear-gradient(135deg, ${theme.preview.hero}, ${theme.preview.accent})`,
        }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.24em] opacity-80">
              {theme.aesthetic}
            </div>
            <div className="mt-2 text-2xl font-extrabold">
              {settings.companyName || "رامكس ستور"}
            </div>
            <div className="mt-1 text-sm opacity-85">
              {settings.companyNameEnglish || "Ramex Store"}
            </div>
          </div>
          <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
            {theme.label}
          </div>
        </div>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-[1.3fr_1fr]">
        <div
          className="rounded-[22px] border p-4"
          style={{
            borderColor: `${theme.preview.hero}1A`,
            backgroundColor: "#FFFFFF",
          }}>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold" style={{ color: theme.preview.text }}>
              مبيعات اليوم
            </div>
            <div
              className="rounded-full px-3 py-1 text-xs font-bold text-white"
              style={{ backgroundColor: theme.preview.hero }}>
              مباشر
            </div>
          </div>
          <div
            className="mb-3 text-3xl font-extrabold"
            style={{ color: theme.preview.text }}>
            128,540 ج.م
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { title: "الفواتير", value: "48" },
              { title: "متوسط السلة", value: "2,678" },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl px-3 py-3"
                style={{ backgroundColor: `${theme.preview.hero}10` }}>
                <div className="text-xs" style={{ color: `${theme.preview.text}CC` }}>
                  {item.title}
                </div>
                <div
                  className="mt-1 text-lg font-bold"
                  style={{ color: theme.preview.text }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div
            className="rounded-[22px] border px-4 py-4"
            style={{
              borderColor: `${theme.preview.accent}44`,
              backgroundColor: `${theme.preview.accent}16`,
            }}>
            <div className="text-xs font-bold" style={{ color: theme.preview.text }}>
              الشعار المعتمد
            </div>
            <div className="mt-2 text-sm" style={{ color: `${theme.preview.text}CC` }}>
              {settings.logoUrl ? "تم رفع شعار الشركة" : "لم يتم رفع شعار بعد"}
            </div>
          </div>

          <div
            className="rounded-[22px] px-4 py-4 text-white"
            style={{
              background: `linear-gradient(135deg, ${theme.preview.accent}, ${theme.preview.hero})`,
            }}>
            <div className="text-xs font-bold uppercase tracking-[0.24em] opacity-75">
              Theme Live
            </div>
            <div className="mt-2 text-base font-bold">واجهة الإعدادات</div>
            <div className="mt-2 text-sm opacity-90">{theme.description}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SettingsPage = () => {
  const fileInputRef = useRef(null);
  const {
    settings,
    themeOptions,
    activeTheme,
    setPreviewThemeKey,
    clearThemePreview,
    applySettingsUpdate,
  } = useSystemSettings();

  const [currentTab, setCurrentTab] = useState("company");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [formState, setFormState] = useState(buildFormState(settings));
  const [warehouses, setWarehouses] = useState([]);
  const [treasuries, setTreasuries] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const loadReferences = async () => {
      setLoading(true);
      try {
        const [warehouseRows, treasuryRows] = await Promise.all([
          warehouseService.getAll(),
          treasuryService.getAll(),
        ]);

        if (!cancelled) {
          setWarehouses(warehouseRows);
          setTreasuries(treasuryRows);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error.message || "فشل تحميل بيانات الإعدادات المرجعية");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadReferences();

    return () => {
      cancelled = true;
      clearThemePreview();
    };
  }, [clearThemePreview]);

  useEffect(() => {
    setFormState(buildFormState(settings));
  }, [settings]);

  useEffect(() => {
    if (formState.themeKey) {
      setPreviewThemeKey(formState.themeKey);
    }
  }, [formState.themeKey, setPreviewThemeKey]);

  const selectedTheme =
    themeOptions.find((theme) => theme.key === formState.themeKey) ||
    activeTheme;

  const handleFieldChange = (field) => (event) => {
    const nextValue =
      event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setFormState((current) => ({
      ...current,
      [field]: nextValue,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...formState,
        mainWarehouseId: formState.mainWarehouseId || null,
        mainTreasuryId: formState.mainTreasuryId || null,
        bankTreasuryId: formState.bankTreasuryId || null,
      };
      const savedSettings = await settingsService.update(payload);
      applySettingsUpdate(savedSettings);
      toast.success("تم حفظ إعدادات النظام بنجاح");
    } catch (error) {
      toast.error(error.message || "تعذر حفظ إعدادات النظام");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoSelection = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploadingLogo(true);
    try {
      const result = await settingsService.uploadLogo(file);
      setFormState((current) => ({
        ...current,
        logoUrl: result.logoUrl,
      }));
      applySettingsUpdate({ logoUrl: result.logoUrl });
      toast.success("تم تحديث شعار الشركة");
    } catch (error) {
      toast.error(error.message || "فشل رفع الشعار");
    } finally {
      setUploadingLogo(false);
      event.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-border-light bg-surface-light px-6 py-4 shadow-sm">
          <CircularProgress size={24} />
          <span className="text-sm font-bold text-text-light">
            جارٍ تحميل صفحة الإعدادات...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-14">
      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.95fr]">
        <SectionCard
          title="لوحة إعدادات النظام"
          description="صفحة موحدة لتحديث بيانات الشركة، الضرائب، الورديات، الخصائص، الثيم، وسياسات الأمان.">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <Typography variant="h4" className="font-extrabold text-text-light">
                {formState.companyName || "رامكس ستور"}
              </Typography>
              <div className="flex flex-wrap items-center gap-2">
                <Chip
                  label={`الثيم الحالي: ${selectedTheme.label}`}
                  className="!bg-accent/40 !font-bold !text-text-light"
                />
                <Chip
                  label={`مهلة الجلسة: ${formState.sessionTimeoutMinutes} دقيقة`}
                  className="!bg-background-light !font-bold !text-text-light"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                variant="outlined"
                className="!rounded-2xl !border-border-light !px-5 !py-2.5 !font-bold !text-text-light"
                onClick={() => {
                  setFormState(buildFormState(settings));
                  clearThemePreview();
                }}>
                استرجاع القيم
              </Button>
              <Button
                variant="contained"
                disableElevation
                className="!rounded-2xl !bg-primary !px-6 !py-2.5 !font-bold"
                onClick={handleSave}
                disabled={saving}
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : null}>
                {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
              </Button>
            </div>
          </div>
        </SectionCard>

        <ThemePreviewPanel theme={selectedTheme} settings={formState} />
      </div>

      <Paper
        elevation={0}
        className="overflow-hidden rounded-[28px] border border-border-light bg-surface-light shadow-sm">
        <Tabs
          value={currentTab}
          onChange={(_, nextValue) => setCurrentTab(nextValue)}
          variant="scrollable"
          scrollButtons="auto"
          className="border-b border-border-light px-2">
          {TABS.map((tab) => (
            <Tab
              key={tab.value}
              value={tab.value}
              label={tab.label}
              className="!min-h-[64px] !font-bold"
            />
          ))}
        </Tabs>

        <div className="p-4 sm:p-6">
          {currentTab === "company" ? (
            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <SectionCard
                title="هوية الشركة"
                description="تُستخدم هذه البيانات في الترويسة، الفواتير، وشاشة تسجيل الدخول.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    fullWidth
                    label="اسم الشركة بالعربية"
                    value={formState.companyName}
                    onChange={handleFieldChange("companyName")}
                  />
                  <TextField
                    fullWidth
                    label="اسم الشركة بالإنجليزية"
                    value={formState.companyNameEnglish}
                    onChange={handleFieldChange("companyNameEnglish")}
                  />
                  <TextField
                    fullWidth
                    label="الرقم الضريبي"
                    value={formState.taxNumber}
                    onChange={handleFieldChange("taxNumber")}
                  />
                  <TextField
                    fullWidth
                    label="هاتف الشركة"
                    value={formState.phone}
                    onChange={handleFieldChange("phone")}
                  />
                  <TextField
                    fullWidth
                    multiline
                    minRows={3}
                    className="sm:col-span-2"
                    label="العنوان"
                    value={formState.address}
                    onChange={handleFieldChange("address")}
                  />
                </div>

                <Divider className="!my-5" />

                <div className="grid gap-4 sm:grid-cols-3">
                  <TextField
                    select
                    fullWidth
                    label="المخزن الافتراضي"
                    value={formState.mainWarehouseId}
                    onChange={handleFieldChange("mainWarehouseId")}>
                    <MenuItem value="">بدون تحديد</MenuItem>
                    {warehouses.map((warehouse) => (
                      <MenuItem key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    fullWidth
                    label="الخزينة الافتراضية"
                    value={formState.mainTreasuryId}
                    onChange={handleFieldChange("mainTreasuryId")}>
                    <MenuItem value="">بدون تحديد</MenuItem>
                    {treasuries.map((treasury) => (
                      <MenuItem key={treasury.id} value={treasury.id}>
                        {treasury.name}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    select
                    fullWidth
                    label="خزينة البنك"
                    value={formState.bankTreasuryId}
                    onChange={handleFieldChange("bankTreasuryId")}>
                    <MenuItem value="">بدون تحديد</MenuItem>
                    {treasuries.map((treasury) => (
                      <MenuItem key={treasury.id} value={treasury.id}>
                        {treasury.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </div>
              </SectionCard>

              <SectionCard
                title="الشعار الرسمي"
                description="المسموح: PNG أو SVG بحد أقصى 500 كيلوبايت، وبنسبة أبعاد قريبة من المربع.">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[28px] border border-dashed border-border-light bg-background-light">
                      {formState.logoUrl ? (
                        <img
                          src={formState.logoUrl}
                          alt="شعار الشركة"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs font-bold text-text-light/55">
                          بدون شعار
                        </span>
                      )}
                    </div>
                    <div className="space-y-3">
                      <Button
                        variant="contained"
                        disableElevation
                        className="!rounded-2xl !bg-primary !px-5 !py-2.5 !font-bold"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingLogo}>
                        {uploadingLogo ? "جارٍ الرفع..." : "رفع شعار جديد"}
                      </Button>
                      <Typography variant="body2" className="text-text-light/70">
                        إذا كان الشعار موجودًا مسبقًا، سيتم استبداله تلقائيًا.
                      </Typography>
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    hidden
                    accept=".png,.svg,image/png,image/svg+xml"
                    type="file"
                    onChange={handleLogoSelection}
                  />

                  <Alert severity="info" className="!rounded-2xl">
                    يظهر الشعار على الإيصالات المطبوعة وعلى شريط التنقل العلوي.
                  </Alert>
                </div>
              </SectionCard>
            </div>
          ) : null}

          {currentTab === "taxes" ? (
            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <SectionCard
                title="سياسات الضريبة"
                description="تفعيل أو إيقاف احتساب الضريبة مباشرة من شاشة الإعدادات.">
                <div className="grid gap-4">
                  <TextField
                    type="number"
                    label="نسبة الضريبة"
                    value={formState.taxRate}
                    onChange={handleFieldChange("taxRate")}
                    inputProps={{ min: 0, max: 100, step: 0.01 }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formState.taxEnabledOnSales}
                        onChange={handleFieldChange("taxEnabledOnSales")}
                      />
                    }
                    label="تطبيق الضريبة على المبيعات والإيصالات"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formState.taxEnabledOnPurchases}
                        onChange={handleFieldChange("taxEnabledOnPurchases")}
                      />
                    }
                    label="تطبيق الضريبة على شاشة المشتريات"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formState.taxEnabledOnExpenses}
                        onChange={handleFieldChange("taxEnabledOnExpenses")}
                      />
                    }
                    label="تطبيق الضريبة على شاشة المصروفات"
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="أثر التفعيل"
                description="المعاينة التالية توضح كيف ستتصرف الشاشات الحساسة بعد تغيير الإعدادات.">
                <div className="grid gap-4">
                  {[
                    {
                      title: "المبيعات",
                      enabled: formState.taxEnabledOnSales,
                      text: formState.taxEnabledOnSales
                        ? "سيتم عرض الضريبة في الإيصال النهائي وحسابها مباشرة داخل نقطة البيع."
                        : "سيتم إخفاء سطر الضريبة من الإيصال وتصبح الفاتورة بدون ضريبة.",
                    },
                    {
                      title: "المشتريات",
                      enabled: formState.taxEnabledOnPurchases,
                      text: formState.taxEnabledOnPurchases
                        ? "سيظهر احتساب الضريبة ضمن ملخص الفاتورة في شاشة المشتريات."
                        : "سيتم اعتماد المشتريات بدون بند ضريبة إضافي في الملخص.",
                    },
                    {
                      title: "المصروفات",
                      enabled: formState.taxEnabledOnExpenses,
                      text: formState.taxEnabledOnExpenses
                        ? "سيتاح إدخال مبلغ أساس وضريبة للمصروف اليدوي قبل الحفظ."
                        : "سيتم حفظ المصروف بالمبلغ المباشر فقط دون ضريبة.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-[22px] border border-border-light bg-background-light px-4 py-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-sm font-bold text-text-light">
                          {item.title}
                        </div>
                        <Chip
                          size="small"
                          label={item.enabled ? "مفعّل" : "غير مفعّل"}
                          className={
                            item.enabled
                              ? "!bg-green-100 !text-green-700"
                              : "!bg-red-100 !text-red-700"
                          }
                        />
                      </div>
                      <div className="text-sm leading-7 text-text-light/75">
                        {item.text}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          ) : null}

          {currentTab === "shifts" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <SectionCard
                title="الورديات العامة"
                description="وقت الدوام الافتراضي المستخدم في إعدادات الموارد البشرية.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    type="time"
                    label="بداية الدوام"
                    value={formState.shiftStartTime}
                    onChange={handleFieldChange("shiftStartTime")}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    type="time"
                    label="نهاية الدوام"
                    value={formState.shiftEndTime}
                    onChange={handleFieldChange("shiftEndTime")}
                    InputLabelProps={{ shrink: true }}
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="وردية نقطة البيع"
                description="تُستخدم هذه الأوقات لتصنيف الورديات الصباحية والمسائية تلقائيًا.">
                <div className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      type="time"
                      label="بداية الوردية الصباحية"
                      value={formState.morningShiftStart}
                      onChange={handleFieldChange("morningShiftStart")}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      type="time"
                      label="نهاية الوردية الصباحية"
                      value={formState.morningShiftEnd}
                      onChange={handleFieldChange("morningShiftEnd")}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      type="time"
                      label="بداية الوردية المسائية"
                      value={formState.eveningShiftStart}
                      onChange={handleFieldChange("eveningShiftStart")}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      type="time"
                      label="نهاية الوردية المسائية"
                      value={formState.eveningShiftEnd}
                      onChange={handleFieldChange("eveningShiftEnd")}
                      InputLabelProps={{ shrink: true }}
                    />
                  </div>

                  <Alert severity="warning" className="!rounded-2xl">
                    يمكن أن تمتد الوردية المسائية بعد منتصف الليل. احرص على توافقها مع سياسة إغلاق الفروع.
                  </Alert>
                </div>
              </SectionCard>
            </div>
          ) : null}

          {currentTab === "features" ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
              <SectionCard
                title="خصائص قابلة للتبديل"
                description="تشغيل أو إخفاء الوحدات التي لا يجب أن تظهر لكل العملاء.">
                <Stack spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formState.landedCostFeatureEnabled}
                        onChange={handleFieldChange("landedCostFeatureEnabled")}
                      />
                    }
                    label="تفعيل التكاليف الإضافية للمشتريات الدولية"
                  />
                  <Alert severity="info" className="!rounded-2xl">
                    عند إيقاف هذه الخاصية، يتم إخفاء قسم التكاليف الإضافية من شاشة المشتريات.
                  </Alert>
                </Stack>
              </SectionCard>

              <SectionCard
                title="خريطة الخصائص"
                description="مهيأة لاستيعاب خصائص مستقبلية دون إعادة تصميم الصفحة.">
                <div className="grid gap-3">
                  {[
                    {
                      title: "Landed Cost",
                      state: formState.landedCostFeatureEnabled,
                      note: "مخصص لمرحلة الاستيراد وتوزيع المصروفات الإضافية.",
                    },
                    {
                      title: "Future Flags",
                      state: false,
                      note: "مكان مخصص لإضافة خصائص لاحقة مثل الطباعة الموسعة أو سياسات الموافقات.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-[22px] border border-border-light bg-background-light px-4 py-4">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="text-sm font-bold text-text-light">
                          {item.title}
                        </div>
                        <Chip
                          size="small"
                          label={item.state ? "نشط" : "غير نشط"}
                          className={
                            item.state
                              ? "!bg-emerald-100 !text-emerald-700"
                              : "!bg-slate-200 !text-slate-700"
                          }
                        />
                      </div>
                      <div className="text-sm text-text-light/75">{item.note}</div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          ) : null}

          {currentTab === "appearance" ? (
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <SectionCard
                title="مكتبة الثيمات"
                description="الاختيار يطبّق معاينة مباشرة على كامل التطبيق قبل الحفظ.">
                <div className="grid gap-4">
                  {themeOptions.map((theme) => {
                    const isSelected = formState.themeKey === theme.key;
                    return (
                      <button
                        key={theme.key}
                        type="button"
                        onClick={() =>
                          setFormState((current) => ({
                            ...current,
                            themeKey: theme.key,
                          }))
                        }
                        className={`rounded-[24px] border px-4 py-4 text-right transition-transform hover:-translate-y-0.5 ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-border-light bg-background-light"
                        }`}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-base font-bold text-text-light">
                              {theme.label}
                            </div>
                            <div className="text-sm text-text-light/70">
                              {theme.aesthetic}
                            </div>
                          </div>
                          {isSelected ? (
                            <Chip label="محدد" className="!bg-primary !text-white" />
                          ) : null}
                        </div>
                        <div className="mt-4 flex gap-2">
                          {[theme.preview.hero, theme.preview.accent, theme.preview.surface].map(
                            (color) => (
                              <span
                                key={color}
                                className="h-8 w-8 rounded-full border border-white/70 shadow-sm"
                                style={{ backgroundColor: color }}
                              />
                            ),
                          )}
                        </div>
                        <div className="mt-3 text-sm leading-7 text-text-light/75">
                          {theme.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </SectionCard>

              <div className="space-y-6">
                <SectionCard
                  title="المعاينة الحية"
                  description="يتم تحديث ألوان الصفحة الحالية مباشرة مع كل اختيار.">
                  <ThemePreviewPanel theme={selectedTheme} settings={formState} />
                </SectionCard>
                <Alert severity="success" className="!rounded-2xl">
                  يتم حفظ `themeKey` داخل إعدادات النظام ليظهر نفس الثيم لكل المستخدمين بعد تسجيل الدخول.
                </Alert>
              </div>
            </div>
          ) : null}

          {currentTab === "security" ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <SectionCard
                title="سياسة كلمات المرور"
                description="تُطبق عند تغيير كلمة المرور وعند إعداد الحسابات الجديدة.">
                <div className="grid gap-4">
                  <TextField
                    type="number"
                    label="أقل عدد أحرف"
                    value={formState.passwordMinLength}
                    onChange={handleFieldChange("passwordMinLength")}
                    inputProps={{ min: 8, max: 32 }}
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formState.passwordRequireUppercase}
                        onChange={handleFieldChange("passwordRequireUppercase")}
                      />
                    }
                    label="يشترط حرف إنجليزي كبير"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formState.passwordRequireLowercase}
                        onChange={handleFieldChange("passwordRequireLowercase")}
                      />
                    }
                    label="يشترط حرف إنجليزي صغير"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formState.passwordRequireNumber}
                        onChange={handleFieldChange("passwordRequireNumber")}
                      />
                    }
                    label="يشترط رقم واحد على الأقل"
                  />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formState.passwordRequireSpecialChar}
                        onChange={handleFieldChange("passwordRequireSpecialChar")}
                      />
                    }
                    label="يشترط رمز خاص"
                  />
                </div>
              </SectionCard>

              <SectionCard
                title="مهلة الجلسة"
                description="تُستخدم لتسجيل الخروج التلقائي بعد فترة من عدم النشاط.">
                <div className="grid gap-4">
                  <TextField
                    type="number"
                    label="مهلة الجلسة بالدقائق"
                    value={formState.sessionTimeoutMinutes}
                    onChange={handleFieldChange("sessionTimeoutMinutes")}
                    inputProps={{ min: 15, max: 1440 }}
                  />
                  <Alert severity="warning" className="!rounded-2xl">
                    يتم تطبيق المهلة على جميع المستخدمين بعد الحفظ، ويبدأ العداد من آخر نشاط داخل المتصفح.
                  </Alert>
                </div>
              </SectionCard>
            </div>
          ) : null}
        </div>
      </Paper>
    </div>
  );
};

export default SettingsPage;
