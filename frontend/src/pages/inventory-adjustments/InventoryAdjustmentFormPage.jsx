import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { inventoryAdjustmentService } from "../../services/inventoryAdjustmentService";
import { warehouseService } from "../../services/warehouseService";
import { itemService } from "../../services/itemService";
import FabricRollPickerModal from "../../components/shared/FabricRollPickerModal";
import toast from "react-hot-toast";

const REASONS = [
  { value: "DAMAGE", label: "تلف" },
  { value: "THEFT", label: "سرقة" },
  { value: "CORRECTION", label: "تصحيح" },
  { value: "RETURN", label: "مرتجع" },
  { value: "OTHER", label: "أخرى" },
];

const InventoryAdjustmentFormPage = () => {
  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [warehouseId, setWarehouseId] = useState("");
  const [direction, setDirection] = useState("OUT");
  const [reason, setReason] = useState("DAMAGE");
  const [reasonNote, setReasonNote] = useState("");
  const [rows, setRows] = useState([{ itemId: "", quantity: "", rollAllocations: [] }]);

  // Fabric roll picker state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRowIdx, setPickerRowIdx] = useState(null);

  useEffect(() => {
    Promise.all([
      warehouseService.getAll().catch(() => []),
      itemService.getAll ? itemService.getAll().catch(() => []) : Promise.resolve([]),
    ]).then(([wh, it]) => {
      setWarehouses(Array.isArray(wh) ? wh : []);
      setAllItems(Array.isArray(it) ? it : []);
    });
  }, []);

  const updateRow = (idx, field, value) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, { itemId: "", quantity: "", rollAllocations: [] }]);

  const removeRow = (idx) => {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const getItemById = (id) => allItems.find((i) => i.id === parseInt(id));

  const openPicker = (idx) => {
    const row = rows[idx];
    if (!row.itemId || !warehouseId || !row.quantity) {
      toast.error("يرجى تحديد الصنف والمخزن والكمية أولاً");
      return;
    }
    setPickerRowIdx(idx);
    setPickerOpen(true);
  };

  const handlePickerSelect = (selection) => {
    if (pickerRowIdx !== null) {
      updateRow(pickerRowIdx, "rollAllocations", selection.map((s) => ({
        rollId: s.rollId,
        rollNumber: s.rollNumber,
        length: s.allocated,
      })));
    }
    setPickerOpen(false);
    setPickerRowIdx(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!warehouseId) { toast.error("يرجى تحديد المخزن"); return; }
    if (rows.some((r) => !r.itemId || !r.quantity)) { toast.error("يرجى ملء كل صفوف الأصناف"); return; }

    setSubmitting(true);
    try {
      const payload = {
        warehouseId: parseInt(warehouseId),
        reason,
        reasonNote: reasonNote || undefined,
        direction,
        items: rows.map((r) => ({
          itemId: parseInt(r.itemId),
          quantity: Number(r.quantity),
          rollAllocations: r.rollAllocations.length > 0 ? r.rollAllocations : undefined,
        })),
      };
      const result = await inventoryAdjustmentService.create(payload);
      toast.success(`تم إنشاء التسوية ${result.adjustmentNumber}`);
      navigate(`/inventory-adjustments/${result.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "فشل إنشاء التسوية");
    } finally {
      setSubmitting(false);
    }
  };

  const currentPickerRow = pickerRowIdx !== null ? rows[pickerRowIdx] : null;

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen p-4 sm:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate("/inventory-adjustments")}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <span className="material-icons-round">arrow_forward</span>
          </button>
          <h2 className="text-2xl font-bold text-text-main dark:text-text-dark flex items-center gap-2">
            <span className="material-icons-round text-primary">tune</span>
            تسوية مخزون جديدة
          </h2>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Header Fields */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-6 mb-5 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">المخزن *</label>
                <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required
                  className="w-full py-2 px-3 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm focus:ring-1 focus:ring-primary outline-none">
                  <option value="">اختر المخزن</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">الاتجاه *</label>
                <div className="flex gap-3">
                  <label className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border cursor-pointer transition-colors ${
                    direction === "OUT" ? "border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700" : "border-border-light dark:border-border-dark"
                  }`}>
                    <input type="radio" value="OUT" checked={direction === "OUT"} onChange={() => setDirection("OUT")} className="hidden" />
                    <span className="material-icons-round text-[18px]">remove_circle</span>
                    <span className="text-sm font-medium">خصم (OUT)</span>
                  </label>
                  <label className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border cursor-pointer transition-colors ${
                    direction === "IN" ? "border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700" : "border-border-light dark:border-border-dark"
                  }`}>
                    <input type="radio" value="IN" checked={direction === "IN"} onChange={() => setDirection("IN")} className="hidden" />
                    <span className="material-icons-round text-[18px]">add_circle</span>
                    <span className="text-sm font-medium">إضافة (IN)</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">السبب *</label>
                <select value={reason} onChange={(e) => setReason(e.target.value)} required
                  className="w-full py-2 px-3 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm focus:ring-1 focus:ring-primary outline-none">
                  {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">ملاحظة السبب</label>
                <input type="text" value={reasonNote} onChange={(e) => setReasonNote(e.target.value)}
                  placeholder="تفاصيل إضافية..."
                  className="w-full py-2 px-3 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>
            </div>
          </div>

          {/* Item Rows */}
          <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-6 mb-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">الأصناف</h3>
              <button type="button" onClick={addRow}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium hover:bg-primary/20">
                <span className="material-icons-round text-[16px]">add</span>
                إضافة صنف
              </button>
            </div>

            <div className="space-y-4">
              {rows.map((row, idx) => {
                const item = getItemById(row.itemId);
                const isFabric = item?.itemType === "FABRIC";
                const needsRolls = isFabric && direction === "OUT";

                return (
                  <div key={idx} className="flex flex-wrap items-start gap-3 p-3 bg-background-light dark:bg-background-dark rounded-xl border border-border-light dark:border-border-dark">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-xs text-gray-500 mb-1">الصنف</label>
                      <select value={row.itemId} onChange={(e) => updateRow(idx, "itemId", e.target.value)} required
                        className="w-full py-2 px-3 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-sm focus:ring-1 focus:ring-primary outline-none">
                        <option value="">اختر الصنف</option>
                        {allItems.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                    </div>
                    <div className="w-32">
                      <label className="block text-xs text-gray-500 mb-1">الكمية</label>
                      <input type="number" step="0.01" min="0.01" value={row.quantity}
                        onChange={(e) => updateRow(idx, "quantity", e.target.value)} required
                        className="w-full py-2 px-3 rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-sm focus:ring-1 focus:ring-primary outline-none" />
                    </div>

                    {needsRolls && (
                      <div className="flex items-end gap-2">
                        <button type="button" onClick={() => openPicker(idx)}
                          className="flex items-center gap-1 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 border border-blue-200">
                          <span className="material-icons-round text-[16px]">content_cut</span>
                          {row.rollAllocations.length > 0 ? `${row.rollAllocations.length} لفة` : "تخصيص لفات"}
                        </button>
                      </div>
                    )}

                    {needsRolls && row.rollAllocations.length > 0 && (
                      <div className="w-full mt-1">
                        <div className="flex flex-wrap gap-1">
                          {row.rollAllocations.map((a, ai) => (
                            <span key={ai} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs border border-blue-200">
                              {a.rollNumber}: {a.length}م
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <button type="button" onClick={() => removeRow(idx)} disabled={rows.length === 1}
                      className="p-2 text-red-400 hover:text-red-600 disabled:opacity-30 mt-5">
                      <span className="material-icons-round text-[18px]">delete</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => navigate("/inventory-adjustments")}
              className="px-6 py-2.5 rounded-xl border border-border-light dark:border-border-dark text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700">
              إلغاء
            </button>
            <button type="submit" disabled={submitting}
              className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {submitting && <span className="material-icons-round animate-spin text-[16px]">sync</span>}
              إنشاء التسوية
            </button>
          </div>
        </form>
      </div>

      {/* Fabric Roll Picker Modal */}
      {pickerOpen && currentPickerRow && (
        <FabricRollPickerModal
          isOpen={pickerOpen}
          onClose={() => { setPickerOpen(false); setPickerRowIdx(null); }}
          itemId={parseInt(currentPickerRow.itemId)}
          warehouseId={parseInt(warehouseId)}
          requestedLength={Number(currentPickerRow.quantity)}
          onPick={handlePickerSelect}
        />
      )}
    </div>
  );
};

export default InventoryAdjustmentFormPage;
