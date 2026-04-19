import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { inventoryCountService } from "../../services/inventoryCountService";
import FabricRollPickerModal from "../../components/shared/FabricRollPickerModal";
import toast from "react-hot-toast";

const InventoryCountSessionPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [search, setSearch] = useState("");

  // Local edits for counted quantities
  const [edits, setEdits] = useState({});
  // Fabric allocations for finalize: { itemId: [{rollId, length}] }
  const [fabricAllocations, setFabricAllocations] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerItemId, setPickerItemId] = useState(null);
  const [pickerLength, setPickerLength] = useState(0);

  const searchRef = useRef(null);

  useEffect(() => {
    inventoryCountService.getById(id)
      .then((data) => {
        setCount(data);
        // Pre-fill edits with current actualQty
        const initial = {};
        data.items?.forEach((item) => {
          initial[item.itemId] = Number(item.actualQty);
        });
        setEdits(initial);
      })
      .catch(() => toast.error("فشل تحميل جلسة الجرد"))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    const items = Object.entries(edits).map(([itemId, countedQuantity]) => ({
      itemId: parseInt(itemId),
      countedQuantity,
    }));
    if (items.length === 0) return;

    setSaving(true);
    try {
      await inventoryCountService.record(id, items);
      toast.success("تم حفظ العد بنجاح");
    } catch (err) {
      toast.error(err.response?.data?.error || "فشل حفظ العد");
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    // Check for fabric items with negative variance that need allocations
    const variances = count.items?.filter((item) => {
      const counted = edits[item.itemId] ?? Number(item.actualQty);
      const expected = Number(item.expectedQty);
      return counted !== expected;
    }) || [];

    const fabricNeedingAlloc = variances.filter((v) => {
      const counted = edits[v.itemId] ?? Number(v.actualQty);
      const expected = Number(v.expectedQty);
      return v.item?.itemType === "FABRIC" && counted < expected;
    });

    for (const fv of fabricNeedingAlloc) {
      const allocs = fabricAllocations[String(fv.itemId)];
      if (!allocs || allocs.length === 0) {
        toast.error(`الصنف "${fv.item.name}" يحتاج تخصيص لفات للفرق السالب`);
        return;
      }
    }

    // Save first, then finalize
    setSaving(true);
    try {
      const items = Object.entries(edits).map(([itemId, countedQuantity]) => ({
        itemId: parseInt(itemId),
        countedQuantity,
      }));
      if (items.length > 0) {
        await inventoryCountService.record(id, items);
      }
    } catch (err) {
      toast.error("فشل حفظ العد قبل الإنهاء");
      setSaving(false);
      return;
    }
    setSaving(false);

    setFinalizing(true);
    try {
      const allocPayload = Object.keys(fabricAllocations).length > 0 ? fabricAllocations : undefined;
      const result = await inventoryCountService.finalize(id, allocPayload);
      toast.success(result.message || "تم إنهاء الجرد بنجاح");
      if (result.adjustmentId) {
        navigate(`/inventory-adjustments/${result.adjustmentId}`);
      } else {
        navigate(`/inventory-counts/${id}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || "فشل إنهاء الجرد");
    } finally {
      setFinalizing(false);
    }
  };

  const openFabricPicker = (itemId, variance) => {
    setPickerItemId(itemId);
    setPickerLength(Math.abs(variance));
    setPickerOpen(true);
  };

  const handlePickerSelect = (selection) => {
    if (pickerItemId) {
      setFabricAllocations((prev) => ({
        ...prev,
        [String(pickerItemId)]: selection.map((s) => ({
          rollId: s.rollId,
          rollNumber: s.rollNumber,
          length: s.allocated,
        })),
      }));
    }
    setPickerOpen(false);
    setPickerItemId(null);
  };

  if (loading) return (
    <div className="flex justify-center items-center min-h-screen">
      <span className="material-icons-round animate-spin text-primary text-4xl">sync</span>
    </div>
  );

  if (!count) return null;

  const isOpen = count.status === "IN_PROGRESS";
  const filteredItems = count.items?.filter((item) =>
    !search || item.item?.name?.includes(search)
  ) || [];

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen p-4 sm:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/inventory-counts")}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
              <span className="material-icons-round">arrow_forward</span>
            </button>
            <div>
              <h2 className="text-2xl font-bold text-text-main dark:text-text-dark flex items-center gap-2">
                <span className="material-icons-round text-primary">assignment</span>
                جلسة الجرد {count.countNumber}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {count.warehouse?.name} — {new Date(count.createdAt).toLocaleDateString("ar-EG")}
              </p>
            </div>
          </div>
          {isOpen && (
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">
                {saving ? <span className="material-icons-round animate-spin text-[16px]">sync</span>
                  : <span className="material-icons-round text-[16px]">save</span>}
                حفظ العد
              </button>
              <button onClick={handleFinalize} disabled={finalizing || saving}
                className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 disabled:opacity-50">
                {finalizing ? <span className="material-icons-round animate-spin text-[16px]">sync</span>
                  : <span className="material-icons-round text-[16px]">check_circle</span>}
                إنهاء الجرد
              </button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-4 mb-5 shadow-sm">
          <div className="relative max-w-md">
            <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-gray-400 text-[18px]">search</span>
            </span>
            <input ref={searchRef} type="text" placeholder="بحث عن صنف..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm focus:ring-1 focus:ring-primary outline-none" />
          </div>
        </div>

        {/* Count Table */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-400">الصنف</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">المتوقع</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">الفعلي</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">الفرق</th>
                  {isOpen && <th className="px-4 py-3 text-center font-semibold text-gray-600 dark:text-gray-400">تخصيص لفات</th>}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const expected = Number(item.expectedQty);
                  const counted = edits[item.itemId] ?? Number(item.actualQty);
                  const variance = counted - expected;
                  const isFabric = item.item?.itemType === "FABRIC";
                  const needsAlloc = isFabric && variance < 0 && isOpen;
                  const hasAlloc = fabricAllocations[String(item.itemId)]?.length > 0;

                  return (
                    <tr key={item.id} className="border-b border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark">
                      <td className="px-4 py-3">
                        <span className="font-medium">{item.item?.name}</span>
                        <span className="text-xs text-gray-400 mr-2">({item.item?.unit})</span>
                        {isFabric && (
                          <span className="inline-flex mr-2 px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 text-[10px] border border-purple-200">قماش</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-500">{expected.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        {isOpen ? (
                          <input type="number" step="0.01" min="0"
                            value={counted}
                            onChange={(e) => setEdits((prev) => ({ ...prev, [item.itemId]: Number(e.target.value) }))}
                            className="w-24 text-center py-1 px-2 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-gray-800 text-sm focus:ring-1 focus:ring-primary outline-none" />
                        ) : (
                          <span className="font-medium">{counted.toFixed(2)}</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-center font-bold ${
                        variance > 0 ? "text-green-600" : variance < 0 ? "text-red-600" : "text-gray-400"
                      }`}>
                        {variance > 0 ? "+" : ""}{variance.toFixed(2)}
                      </td>
                      {isOpen && (
                        <td className="px-4 py-3 text-center">
                          {needsAlloc && (
                            <button onClick={() => openFabricPicker(item.itemId, variance)}
                              className={`flex items-center gap-1 mx-auto px-3 py-1 rounded-lg text-xs font-medium border ${
                                hasAlloc ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"
                              }`}>
                              <span className="material-icons-round text-[14px]">content_cut</span>
                              {hasAlloc ? "تم التخصيص" : "تخصيص لفات"}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Fabric Roll Picker */}
      {pickerOpen && pickerItemId && count && (
        <FabricRollPickerModal
          isOpen={pickerOpen}
          onClose={() => { setPickerOpen(false); setPickerItemId(null); }}
          itemId={pickerItemId}
          warehouseId={count.warehouseId}
          requestedLength={pickerLength}
          onPick={handlePickerSelect}
        />
      )}
    </div>
  );
};

export default InventoryCountSessionPage;
