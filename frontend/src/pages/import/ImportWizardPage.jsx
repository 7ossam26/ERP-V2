import React, { useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { importService } from "../../services/importService";
import toast from "react-hot-toast";

const TYPE_META = {
  "fabric-items":      { label: "أقمشة", icon: "texture" },
  "clothes-items":     { label: "ملابس", icon: "checkroom" },
  "accessories":       { label: "إكسسوارات", icon: "watch" },
  "generic-items":     { label: "أصناف عامة", icon: "inventory_2" },
  "clients":           { label: "العملاء", icon: "people" },
  "suppliers":         { label: "الموردين", icon: "local_shipping" },
  "initial-inventory": { label: "المخزون الافتتاحي", icon: "warehouse" },
  "fabric-rolls":      { label: "لفات الأقمشة", icon: "rotate_right" },
  "employees":         { label: "الموظفين", icon: "badge" },
  "treasury":          { label: "الخزائن", icon: "account_balance" },
};

const STEPS = ["رفع الملف", "مراجعة", "تأكيد", "النتيجة"];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <React.Fragment key={i}>
          <div className="flex flex-col items-center gap-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              i < current ? "bg-green-500 text-white" :
              i === current ? "bg-primary text-white" :
              "bg-slate-200 dark:bg-slate-700 text-slate-400"
            }`}>
              {i < current ? <span className="material-icons-round text-sm">check</span> : i + 1}
            </div>
            <span className={`text-xs font-medium ${i === current ? "text-primary" : "text-slate-400"}`}>{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mb-5 mx-1 ${i < current ? "bg-green-400" : "bg-slate-200 dark:bg-slate-700"}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function ImportWizardPage() {
  const { type } = useParams();
  const meta = TYPE_META[type] || { label: type, icon: "upload" };

  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dryRunResult, setDryRunResult] = useState(null);
  const [finalResult, setFinalResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef();

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await importService.downloadTemplate(type);
      toast.success("تم تحميل القالب");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleFile = (f) => {
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error("يُسمح فقط بملفات Excel (.xlsx, .xls) أو CSV");
      return;
    }
    setFile(f);
  };

  const handleDryRun = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await importService.importFile(type, file, true);
      setDryRunResult(res);
      setStep(1);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    setLoading(true);
    try {
      const res = await importService.importFile(type, file, false);
      setFinalResult(res);
      setStep(3);
      if (res.imported > 0) toast.success(`تم استيراد ${res.imported} سجل بنجاح`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setStep(0);
    setFile(null);
    setDryRunResult(null);
    setFinalResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/import" className="text-slate-400 hover:text-primary transition-colors">
          <span className="material-icons-round">arrow_forward</span>
        </Link>
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <span className="material-icons-round text-primary">{meta.icon}</span>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">استيراد {meta.label}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">معالج الاستيراد — 4 خطوات</p>
        </div>
      </div>

      <StepIndicator current={step} />

      {/* Step 0: Upload */}
      {step === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-700 dark:text-slate-300">رفع الملف</h2>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-primary/30 text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              <span className="material-icons-round text-sm">{downloading ? "hourglass_empty" : "download"}</span>
              {downloading ? "جاري التحميل..." : "تحميل القالب"}
            </button>
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            onClick={() => !loading && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragOver ? "border-primary bg-primary/5" :
              file ? "border-green-400 bg-green-50 dark:bg-green-900/10" :
              "border-slate-200 dark:border-slate-600 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-700/50"
            }`}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            {file ? (
              <div className="flex flex-col items-center gap-2 text-green-600 dark:text-green-400">
                <span className="material-icons-round text-3xl">check_circle</span>
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB — انقر للتغيير</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <span className="material-icons-round text-3xl">upload_file</span>
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">اسحب الملف هنا أو انقر للاختيار</span>
                <span className="text-xs">.xlsx / .xls / .csv</span>
              </div>
            )}
          </div>

          <button
            onClick={handleDryRun}
            disabled={!file || loading}
            className="w-full py-2.5 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <span className="material-icons-round text-lg animate-spin">autorenew</span> : null}
            {loading ? "جاري التحقق..." : "التحقق من الملف →"}
          </button>
        </div>
      )}

      {/* Step 1: Dry-run review */}
      {step === 1 && dryRunResult && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
          <h2 className="font-semibold text-slate-700 dark:text-slate-300">مراجعة نتائج التحقق</h2>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-700 p-3 text-center">
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{dryRunResult.totalRows}</p>
              <p className="text-xs text-slate-500">إجمالي الصفوف</p>
            </div>
            <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-3 text-center">
              <p className="text-2xl font-bold text-green-600">{dryRunResult.validRows}</p>
              <p className="text-xs text-slate-500">صالح</p>
            </div>
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{dryRunResult.invalidRows}</p>
              <p className="text-xs text-slate-500">يحتوي أخطاء</p>
            </div>
          </div>

          {dryRunResult.errors && dryRunResult.errors.length > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/10 p-4 max-h-56 overflow-y-auto space-y-1.5">
              <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-2">الأخطاء المكتشفة:</p>
              {dryRunResult.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                  <span className="material-icons-round text-xs mt-0.5">error_outline</span>
                  <span>صف {e.row}{e.column ? ` — ${e.column}` : ""}: {e.message || e.reason}</span>
                </div>
              ))}
            </div>
          )}

          {dryRunResult.preview && dryRunResult.preview.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">معاينة الصفوف الأولى:</p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700">
                      {Object.keys(dryRunResult.preview[0] || {}).map((k) => (
                        <th key={k} className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dryRunResult.preview.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">{String(v ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              تغيير الملف
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={dryRunResult.validRows === 0}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm disabled:opacity-50 hover:bg-primary/90 transition-colors"
            >
              المتابعة ({dryRunResult.validRows} صف) →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Confirm */}
      {step === 2 && dryRunResult && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
          <h2 className="font-semibold text-slate-700 dark:text-slate-300">تأكيد الاستيراد</h2>
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-4">
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-300 flex items-center gap-2">
              <span className="material-icons-round text-base">warning</span>
              سيتم إدراج {dryRunResult.validRows} سجل في قاعدة البيانات. هذا الإجراء لا يمكن التراجع عنه.
            </p>
            {dryRunResult.invalidRows > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                سيتم تخطي {dryRunResult.invalidRows} صف يحتوي على أخطاء.
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              رجوع
            </button>
            <button
              onClick={handleCommit}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-green-600 text-white font-semibold text-sm disabled:opacity-50 hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <span className="material-icons-round text-lg animate-spin">autorenew</span> : null}
              {loading ? "جاري الاستيراد..." : "تأكيد الاستيراد"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Result */}
      {step === 3 && finalResult && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 space-y-5 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${finalResult.imported > 0 ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
              <span className={`material-icons-round text-3xl ${finalResult.imported > 0 ? "text-green-600" : "text-red-600"}`}>
                {finalResult.imported > 0 ? "check_circle" : "cancel"}
              </span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                {finalResult.imported > 0 ? "تم الاستيراد بنجاح" : "فشل الاستيراد"}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                تم استيراد <strong>{finalResult.imported}</strong> من أصل <strong>{finalResult.totalRows}</strong> سجل
                {finalResult.skipped > 0 && ` • تم تخطي ${finalResult.skipped}`}
              </p>
            </div>
          </div>

          {finalResult.errors && finalResult.errors.length > 0 && (
            <div className="rounded-xl border border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/10 p-4 text-right max-h-40 overflow-y-auto space-y-1">
              {finalResult.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
                  <span className="material-icons-round text-xs mt-0.5">error_outline</span>
                  <span>صف {e.row}: {e.message || e.reason}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={reset} className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              استيراد آخر
            </button>
            <Link to="/import" className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center">
              العودة للقائمة
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
