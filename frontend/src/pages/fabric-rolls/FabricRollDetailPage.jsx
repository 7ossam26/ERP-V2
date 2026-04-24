import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { fabricRollService } from "../../services/fabricRollService";
import toast from "react-hot-toast";

const STATUS_LABELS = {
  AVAILABLE:     { label: "متاح",         color: "bg-green-100 text-green-800 border-green-200" },
  PARTIALLY_CUT: { label: "مقطوع جزئياً", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  DEPLETED:      { label: "مستنفذ",        color: "bg-gray-100 text-gray-700 border-gray-300" },
  DAMAGED:       { label: "تالف",           color: "bg-red-100 text-red-800 border-red-200" },
  RESERVED:      { label: "محجوز",          color: "bg-blue-100 text-blue-800 border-blue-200" },
  SOLD:          { label: "مباع",           color: "bg-purple-100 text-purple-800 border-purple-200" },
  RETURNED:      { label: "مرتجع",          color: "bg-orange-100 text-orange-800 border-orange-200" },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_LABELS[status] || { label: status, color: "bg-gray-100 text-gray-700 border-gray-200" };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-sm font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

const FabricRollDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [roll, setRoll] = useState(null);
  const [loading, setLoading] = useState(true);

  // Damage modal
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [damageNotes, setDamageNotes] = useState("");
  const [damaging, setDamaging] = useState(false);

  const fetchRoll = () => {
    setLoading(true);
    fabricRollService
      .getById(id)
      .then(setRoll)
      .catch(() => toast.error("فشل تحميل بيانات اللفة"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRoll(); }, [id]);

  const handleMarkDamaged = async () => {
    setDamaging(true);
    try {
      await fabricRollService.markDamaged(id, damageNotes);
      toast.success("تم تعليم اللفة كتالفة");
      setShowDamageModal(false);
      fetchRoll();
    } catch (err) {
      toast.error(err.message || "فشل تعليم اللفة كتالفة");
    } finally {
      setDamaging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="material-icons-round animate-spin text-primary text-4xl">sync</span>
      </div>
    );
  }

  if (!roll) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" dir="rtl">
        <span className="material-icons-round text-6xl text-gray-300">inventory_2</span>
        <p className="text-gray-500">اللفة غير موجودة</p>
        <button onClick={() => navigate("/fabric-rolls")} className="text-primary hover:underline text-sm">
          العودة للقائمة
        </button>
      </div>
    );
  }

  const usedPct = roll.originalLength > 0
    ? ((Number(roll.originalLength) - Number(roll.remainingLength)) / Number(roll.originalLength)) * 100
    : 0;

  const canMarkDamaged = !["DAMAGED", "DEPLETED"].includes(roll.status);

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen p-4 sm:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb / back */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
          <Link to="/fabric-rolls" className="hover:text-primary transition-colors">لفات الأقمشة</Link>
          <span className="material-icons-round text-[14px]">chevron_left</span>
          <span className="text-text-main dark:text-text-dark font-medium font-mono">{roll.rollNumber}</span>
        </div>

        {/* Header card */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-6 shadow-sm mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="material-icons-round text-primary text-3xl">inventory_2</span>
                <div>
                  <h2 className="text-2xl font-bold font-mono text-text-main dark:text-text-dark">
                    {roll.rollNumber}
                  </h2>
                  {roll.barcode && (
                    <p className="text-sm text-gray-400">{roll.barcode}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <StatusBadge status={roll.status} />
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm border border-border-light dark:border-border-dark text-gray-600 dark:text-gray-400">
                  {roll.item?.name}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-sm border border-border-light dark:border-border-dark text-gray-600 dark:text-gray-400">
                  <span className="material-icons-round text-[14px] ml-1">warehouse</span>
                  {roll.warehouse?.name}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0">
              <Link to={`/fabric-rolls/${id}/edit`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border-light dark:border-border-dark text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <span className="material-icons-round text-[16px]">edit</span>
                تعديل
              </Link>
              {canMarkDamaged && (
                <button onClick={() => setShowDamageModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <span className="material-icons-round text-[16px]">report</span>
                  تعليم كتالف
                </button>
              )}
            </div>
          </div>

          {/* Length progress */}
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-500">المتبقي</span>
              <span className="font-bold text-text-main dark:text-text-dark">
                {Number(roll.remainingLength).toFixed(2)} م
                <span className="text-gray-400 font-normal mr-1">
                  / {Number(roll.originalLength).toFixed(2)} م
                </span>
              </span>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usedPct >= 100 ? "bg-gray-400" :
                  usedPct >= 80 ? "bg-red-500" :
                  usedPct >= 50 ? "bg-yellow-500" : "bg-green-500"
                }`}
                style={{ width: `${Math.max(0, 100 - usedPct)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>مستخدم: {usedPct.toFixed(1)}%</span>
              <span>متبقي: {(100 - usedPct).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: "تكلفة الوحدة", value: roll.unitCost ? `${Number(roll.unitCost).toFixed(2)} ج.م` : "—" },
            { label: "العرض", value: roll.widthCm ? `${roll.widthCm} سم` : "—" },
            { label: "الوزن", value: roll.weightKg ? `${roll.weightKg} كجم` : "—" },
            { label: "آخر قطع", value: roll.lastCutAt ? new Date(roll.lastCutAt).toLocaleDateString("ar-EG") : "لم يقطع بعد" },
            { label: "تاريخ الإضافة", value: new Date(roll.createdAt).toLocaleDateString("ar-EG") },
            { label: "عدد القطوع", value: String(roll.cuts?.length || 0) },
          ].map((item) => (
            <div key={item.label}
              className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{item.label}</p>
              <p className="font-bold text-text-main dark:text-text-dark">{item.value}</p>
            </div>
          ))}
        </div>

        {/* Notes */}
        {roll.notes && (
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-4 mb-6 shadow-sm">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">ملاحظات</p>
            <p className="text-text-main dark:text-text-dark whitespace-pre-wrap text-sm">{roll.notes}</p>
          </div>
        )}

        {/* Cut history */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
          <div className="p-4 border-b border-border-light dark:border-border-dark">
            <h3 className="font-bold text-text-main dark:text-text-dark flex items-center gap-2">
              <span className="material-icons-round text-primary">content_cut</span>
              سجل القطوع
              <span className="text-sm font-normal text-gray-400">({roll.cuts?.length || 0})</span>
            </h3>
          </div>
          {!roll.cuts || roll.cuts.length === 0 ? (
            <div className="py-10 text-center text-gray-400">
              <span className="material-icons-round text-3xl mb-2 block">content_cut</span>
              لا توجد قطوع سابقة
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                  <th className="px-4 py-3 text-right font-medium text-gray-500">التاريخ</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">الطول (م)</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">مصدر القطع</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {roll.cuts.map((cut) => (
                  <tr key={cut.id} className="border-b border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark transition-colors">
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(cut.createdAt).toLocaleString("ar-EG")}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-text-main dark:text-text-dark">
                      {Number(cut.lengthCut).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {cut.saleItem ? (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                          <span className="material-icons-round text-[14px]">point_of_sale</span>
                          فاتورة #{cut.saleItem?.sale?.saleNumber || cut.saleItem?.saleId}
                        </span>
                      ) : cut.adjustment ? (
                        <span className="inline-flex items-center gap-1 text-xs text-orange-600">
                          <span className="material-icons-round text-[14px]">tune</span>
                          تعديل مخزن
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">يدوي</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{cut.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Mark Damaged Modal */}
      {showDamageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" dir="rtl">
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-2xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <span className="material-icons-round text-red-600">report</span>
              </div>
              <div>
                <h3 className="font-bold text-text-main dark:text-text-dark">تعليم اللفة كتالفة</h3>
                <p className="text-xs text-gray-500">اللفة: {roll.rollNumber}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              سيتم خصم المتبقي ({Number(roll.remainingLength).toFixed(2)} م) من المخزون وتسجيل تعديل تلف.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                سبب التلف (اختياري)
              </label>
              <textarea
                value={damageNotes}
                onChange={(e) => setDamageNotes(e.target.value)}
                rows={3}
                placeholder="مثال: تلف أثناء النقل"
                className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm text-text-main dark:text-text-dark focus:ring-1 focus:ring-red-400 outline-none resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDamageModal(false)}
                className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors">
                إلغاء
              </button>
              <button onClick={handleMarkDamaged} disabled={damaging}
                className="px-5 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-2">
                {damaging && <span className="material-icons-round animate-spin text-[14px]">sync</span>}
                {damaging ? "جارٍ..." : "تأكيد التلف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FabricRollDetailPage;
