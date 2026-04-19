import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { inventoryCountService } from "../../services/inventoryCountService";
import { warehouseService } from "../../services/warehouseService";
import toast from "react-hot-toast";

const InventoryCountStartPage = () => {
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    warehouseService.getAll()
      .then((w) => setWarehouses(Array.isArray(w) ? w : []))
      .catch(() => {});
  }, []);

  const handleStart = async (e) => {
    e.preventDefault();
    if (!warehouseId) { toast.error("يرجى تحديد المخزن"); return; }

    setSubmitting(true);
    try {
      const result = await inventoryCountService.start({
        warehouseId: parseInt(warehouseId),
        notes: notes || undefined,
      });
      toast.success(`تم بدء جلسة الجرد ${result.countNumber}`);
      navigate(`/inventory-counts/${result.id}/session`);
    } catch (err) {
      toast.error(err.response?.data?.error || "فشل بدء الجرد");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedWarehouse = warehouses.find((w) => w.id === parseInt(warehouseId));

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen p-4 sm:p-8" dir="rtl">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/inventory-counts")}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <span className="material-icons-round">arrow_forward</span>
          </button>
          <h2 className="text-2xl font-bold text-text-main dark:text-text-dark flex items-center gap-2">
            <span className="material-icons-round text-primary">assignment</span>
            بدء جرد جديد
          </h2>
        </div>

        <form onSubmit={handleStart}>
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-6 mb-5 shadow-sm">
            {/* Step 1: Pick Warehouse */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-primary text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                <h3 className="text-lg font-bold">اختر المخزن</h3>
              </div>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required
                className="w-full py-3 px-4 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm focus:ring-2 focus:ring-primary outline-none">
                <option value="">اختر المخزن للجرد...</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>

            {/* Step 2: Notes */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-primary text-white w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                <h3 className="text-lg font-bold">ملاحظات (اختياري)</h3>
              </div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                rows={3} placeholder="ملاحظات عن جلسة الجرد..."
                className="w-full py-3 px-4 rounded-xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm focus:ring-2 focus:ring-primary outline-none resize-none" />
            </div>

            {/* Preview */}
            {selectedWarehouse && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-icons-round text-blue-600">info</span>
                  <span className="text-sm font-bold text-blue-800 dark:text-blue-300">معلومات</span>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  سيتم أخذ لقطة من المخزون الحالي في "<strong>{selectedWarehouse.name}</strong>" وبدء جلسة جرد مفتوحة.
                  يمكنك تسجيل الكميات الفعلية ثم إنهاء الجرد لإنشاء تسوية تلقائية للفروقات.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => navigate("/inventory-counts")}
              className="px-6 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700">
              إلغاء
            </button>
            <button type="submit" disabled={submitting || !warehouseId}
              className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {submitting && <span className="material-icons-round animate-spin text-[16px]">sync</span>}
              بدء الجرد
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InventoryCountStartPage;
