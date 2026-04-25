import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { inventoryAdjustmentService } from "../../services/inventoryAdjustmentService";
import toast from "react-hot-toast";
import Icon from "../../components/ui/Icon";

const REASON_LABELS = {
  DAMAGE: "تلف", THEFT: "سرقة", CORRECTION: "تصحيح",
  RETURN: "مرتجع", COUNT_VARIANCE: "فرق جرد", OTHER: "أخرى",
};

const InventoryAdjustmentDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [adj, setAdj] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inventoryAdjustmentService.getById(id)
      .then((data) => setAdj(data))
      .catch(() => toast.error("فشل تحميل بيانات التسوية"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <Icon name="sync" className="animate-spin text-primary text-4xl" />
    </div>
  );

  if (!adj) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <Icon name="error_outline" className="text-6xl text-gray-300" />
      <p className="text-gray-500">التسوية غير موجودة</p>
    </div>
  );

  const isOut = adj.direction === "OUT";

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen p-4 sm:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/inventory-adjustments")}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <Icon name="arrow_forward" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-text-main dark:text-text-dark flex items-center gap-2">
              <Icon name="tune" className="text-primary" />
              تسوية {adj.adjustmentNumber}
            </h2>
          </div>
        </div>

        {/* Header Info */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-6 mb-5 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-xs text-gray-500">المخزن</span>
              <p className="font-medium">{adj.warehouse?.name}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">الاتجاه</span>
              <p className={`font-bold ${isOut ? "text-red-600" : "text-green-600"}`}>
                {isOut ? "خصم (OUT)" : "إضافة (IN)"}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500">السبب</span>
              <p className="font-medium">{REASON_LABELS[adj.reasonCode] || adj.reasonCode}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">التاريخ</span>
              <p className="font-medium">{new Date(adj.createdAt).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">المستخدم</span>
              <p className="font-medium">{adj.user?.name}</p>
            </div>
            <div>
              <span className="text-xs text-gray-500">الفرع</span>
              <p className="font-medium">{adj.branch?.name}</p>
            </div>
            {adj.reasonNote && (
              <div className="col-span-2">
                <span className="text-xs text-gray-500">ملاحظة السبب</span>
                <p className="font-medium">{adj.reasonNote}</p>
              </div>
            )}
            {adj.notes && (
              <div className="col-span-2">
                <span className="text-xs text-gray-500">ملاحظات</span>
                <p className="font-medium">{adj.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border-light dark:border-border-dark">
            <h3 className="text-lg font-bold">الأصناف ({adj.items?.length || 0})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">الصنف</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">الكمية</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">تكلفة الوحدة</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">الإجمالي</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">قطعات اللفات</th>
                </tr>
              </thead>
              <tbody>
                {adj.items?.map((item) => (
                  <tr key={item.id} className="border-b border-border-light dark:border-border-dark">
                    <td className="px-4 py-3">
                      <span className="font-medium">{item.item?.name}</span>
                      <span className="text-xs text-gray-400 mr-2">({item.item?.unit})</span>
                      {item.item?.itemType === "FABRIC" && (
                        <span className="inline-flex mr-2 px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 text-[10px] border border-purple-200">قماش</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-center font-bold ${isOut ? "text-red-600" : "text-green-600"}`}>
                      {isOut ? "-" : "+"}{Number(item.quantity).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">{Number(item.unitCostAtTime).toFixed(2)}</td>
                    <td className="px-4 py-3 text-center font-medium">
                      {(Number(item.quantity) * Number(item.unitCostAtTime)).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      {item.fabricRollCuts?.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.fabricRollCuts.map((cut) => (
                            <span key={cut.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs border border-blue-200">
                              {cut.fabricRoll?.rollNumber}: {Number(cut.lengthCut).toFixed(2)}م
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryAdjustmentDetailPage;
