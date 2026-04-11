import React, { useState, useRef, useEffect } from "react";
import { importService } from "../../services/importService";
import toast from "react-hot-toast";

// ── Entity config ────────────────────────────────────────────────────────────
const ENTITIES = [
  {
    key: "items",
    label: "الأصناف",
    icon: "inventory_2",
    description: "استيراد الأصناف مع السعر والوحدة وحد إعادة الطلب",
    fields: ["name *", "price *", "costPrice", "unit *", "reorderPoint", "showInPos"],
  },
  {
    key: "clients",
    label: "العملاء",
    icon: "people",
    description: "استيراد بيانات العملاء مع أرقام الهواتف والعناوين",
    fields: ["name *", "phoneNumber *", "address"],
  },
  {
    key: "suppliers",
    label: "الموردين",
    icon: "local_shipping",
    description: "استيراد بيانات الموردين",
    fields: ["name *", "phoneNumber *"],
  },
  {
    key: "employees",
    label: "الموظفين",
    icon: "badge",
    description: "استيراد بيانات الموظفين مع الرواتب والفروع",
    fields: ["name *", "position *", "branchId *", "phoneNumber *", "nationalId", "workingDaysPerMonth", "workingHoursPerDay", "weeklyHoliday", "salary *"],
    hasBranchNote: true,
  },
  {
    key: "inventory",
    label: "المخزون الافتتاحي",
    icon: "warehouse",
    description: "تعيين الكميات الافتتاحية للأصناف في المستودعات",
    fields: ["itemName *", "warehouseName *", "quantity *"],
  },
  {
    key: "treasury",
    label: "الخزائن",
    icon: "account_balance",
    description: "إنشاء خزائن مع الأرصدة الافتتاحية",
    fields: ["name *", "balance"],
  },
];

// ── Result banner ────────────────────────────────────────────────────────────
function ResultBanner({ result, onClear }) {
  const hasErrors = result.errors && result.errors.length > 0;
  return (
    <div className={`rounded-xl border p-4 mt-4 ${
      result.imported === result.total
        ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700"
        : hasErrors && result.imported === 0
        ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-700"
        : "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-700"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`material-icons-round text-xl ${
            result.imported === result.total ? "text-green-600" : hasErrors && result.imported === 0 ? "text-red-600" : "text-yellow-600"
          }`}>
            {result.imported === result.total ? "check_circle" : hasErrors && result.imported === 0 ? "cancel" : "warning"}
          </span>
          <div>
            <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">
              تم استيراد {result.imported} من أصل {result.total} سجل
              {result.skipped > 0 && ` • تم تخطي ${result.skipped}`}
            </p>
          </div>
        </div>
        <button
          onClick={onClear}
          className="text-slate-400 hover:text-slate-600 transition-colors">
          <span className="material-icons-round text-lg">close</span>
        </button>
      </div>

      {hasErrors && (
        <div className="mt-3 max-h-48 overflow-y-auto space-y-1">
          {result.errors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
              <span className="material-icons-round text-xs mt-0.5">error_outline</span>
              <span>صف {e.row}: {e.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Single entity import card ────────────────────────────────────────────────
function ImportCard({ entity, branches }) {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await importService.downloadTemplate(entity.key);
      toast.success("تم تحميل القالب");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await importService.exportData(entity.key);
      toast.success("تم تصدير البيانات");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setExporting(false);
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("يُسمح فقط بملفات Excel (.xlsx, .xls) أو CSV");
      return;
    }
    setResult(null);
    setLoading(true);
    try {
      const res = await importService.importFile(entity.key, file);
      setResult(res);
      if (res.imported > 0) toast.success(`تم استيراد ${res.imported} سجل بنجاح`);
      else toast.error("لم يتم استيراد أي سجلات");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="material-icons-round text-primary text-xl">{entity.icon}</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100">{entity.label}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{entity.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50">
            <span className="material-icons-round text-sm">{exporting ? "hourglass_empty" : "upload_file"}</span>
            {exporting ? "جاري التصدير..." : "تصدير البيانات"}
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors disabled:opacity-50">
            <span className="material-icons-round text-sm">{downloading ? "hourglass_empty" : "download"}</span>
            {downloading ? "جاري التحميل..." : "تحميل القالب"}
          </button>
        </div>
      </div>

      {/* Fields hint */}
      <div className="flex flex-wrap gap-1">
        {entity.fields.map((f) => (
          <span key={f} className={`px-2 py-0.5 text-xs rounded-full font-mono ${
            f.endsWith("*")
              ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
          }`}>{f}</span>
        ))}
        <span className="text-xs text-slate-400 self-center">* إلزامي</span>
      </div>

      {/* Branch info for employees */}
      {entity.hasBranchNote && branches.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1">أرقام الفروع المتاحة:</p>
          <div className="flex flex-wrap gap-2">
            {branches.map((b) => (
              <span key={b.id} className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full font-mono">
                {b.id} — {b.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => !loading && fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-slate-200 dark:border-slate-600 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-700/50"
        } ${loading ? "cursor-not-allowed opacity-60" : ""}`}>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        {loading ? (
          <div className="flex flex-col items-center gap-2 text-primary">
            <span className="material-icons-round text-3xl animate-spin">autorenew</span>
            <span className="text-sm font-medium">جاري الاستيراد...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <span className="material-icons-round text-3xl">upload_file</span>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">اسحب الملف هنا أو انقر للاختيار</span>
            <span className="text-xs">.xlsx / .xls / .csv</span>
          </div>
        )}
      </div>

      {/* Result */}
      {result && <ResultBanner result={result} onClear={() => setResult(null)} />}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function DataImportPage() {
  const [branches, setBranches] = useState([]);
  const [activeTab, setActiveTab] = useState(ENTITIES[0].key);

  useEffect(() => {
    importService.getBranches().then(setBranches).catch(() => {});
  }, []);

  const activeEntity = ENTITIES.find((e) => e.key === activeTab);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <span className="material-icons-round text-primary text-2xl">upload</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">استيراد وتصدير البيانات</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">رفع وتحميل البيانات بصيغة Excel أو CSV</p>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <span className="material-icons-round text-base">info</span>
          كيفية الاستخدام
        </h2>
        <ol className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400 list-decimal list-inside">
          <li>اضغط <strong>"تحميل القالب"</strong> للحصول على ملف Excel جاهز لكل نوع بيانات</li>
          <li>افتح الملف وأدخل بياناتك من الصف الثاني فصاعداً (لا تعدّل الصف الأول)</li>
          <li>احفظ الملف وارفعه باستخدام منطقة الرفع أدناه</li>
          <li>ستظهر نتائج الاستيراد فوراً مع تفاصيل أي أخطاء</li>
        </ol>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {ENTITIES.map((e) => (
          <button
            key={e.key}
            onClick={() => setActiveTab(e.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              activeTab === e.key
                ? "bg-primary text-white shadow-sm"
                : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary/50 hover:text-primary"
            }`}>
            <span className="material-icons-round text-base">{e.icon}</span>
            {e.label}
          </button>
        ))}
      </div>

      {/* Active entity card */}
      {activeEntity && (
        <ImportCard key={activeEntity.key} entity={activeEntity} branches={branches} />
      )}
    </div>
  );
}
