import React, { useState, useEffect } from "react";
import KgQuantityInput from "../../components/ui/KgQuantityInput";
import {
  bomService,
  itemService,
  categoryService,
  warehouseService,
  inventoryService,
} from "../../services/domainServices";
import AuthService from "../../services/authService";
import toast from "react-hot-toast";
import { confirmAction } from "../../utils/toastUtils";
import { useNavigate } from "react-router-dom";

// ==========================================
// Execute Production Modal
// ==========================================
const ExecuteProductionModal = ({
  bom,
  allItems,
  warehouses,
  onClose,
  onSuccess,
}) => {
  const [targetQty, setTargetQty] = useState("");
  const [actualQty, setActualQty] = useState("");
  const [sourceWarehouseId, setSourceWarehouseId] = useState("");
  const [destWarehouseId, setDestWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const bomOutputQty = parseFloat(bom.outputQuantity) || 1;
  const hasOutputItem = !!bom.outputItemId;

  // Compute per-material quantities based on targetQty
  const materialRows = bom.items.map((bi) => {
    const multiplier = targetQty ? parseFloat(targetQty) / bomOutputQty : 0;
    const required = parseFloat(bi.quantity) * multiplier;
    // Find stock in selected source warehouse
    const rawItem = allItems.find((i) => String(i.id) === String(bi.itemId));
    let stock = 0;
    if (rawItem?.inventory && sourceWarehouseId) {
      const inv = rawItem.inventory.find(
        (i) => i.warehouseId === parseInt(sourceWarehouseId),
      );
      stock = inv ? Number(inv.quantity) : 0;
    } else if (rawItem?.inventory) {
      stock = rawItem.inventory.reduce((s, i) => s + Number(i.quantity), 0);
    }
    return {
      itemId: bi.itemId,
      itemName: bi.itemName,
      unit: rawItem?.unit || "",
      required: parseFloat(required.toFixed(6)),
      stock,
      insufficient: required > stock && targetQty,
    };
  });

  const wasteQty =
    targetQty && actualQty
      ? Math.max(0, parseFloat(targetQty) - parseFloat(actualQty))
      : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sourceWarehouseId) return toast.error("اختر مستودع الخصم");
    if (!targetQty || parseFloat(targetQty) <= 0)
      return toast.error("أدخل الكمية المستهدفة");
    if (actualQty === "" || parseFloat(actualQty) < 0)
      return toast.error("أدخل الكمية الفعلية");
    if (parseFloat(actualQty) > parseFloat(targetQty))
      return toast.error("الكمية الفعلية لا تتجاوز المستهدفة");
    if (hasOutputItem && !destWarehouseId)
      return toast.error("اختر مستودع الإضافة");
    if (materialRows.some((r) => r.insufficient))
      return toast.error("رصيد غير كافٍ لبعض المواد الخام");
    setLoading(true);
    try {
      await bomService.executeProduction(bom.id, {
        sourceWarehouseId: parseInt(sourceWarehouseId),
        destWarehouseId: destWarehouseId ? parseInt(destWarehouseId) : null,
        targetOutputQty: parseFloat(targetQty),
        actualOutputQty: parseFloat(actualQty),
        notes,
      });
      toast.success("تم تنفيذ أمر الإنتاج بنجاح ✅");
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || "فشل تنفيذ الإنتاج";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="bg-green-100 dark:bg-green-900/30 p-2.5 rounded-xl">
              <span className="material-icons-round text-2xl text-green-600">
                precision_manufacturing
              </span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-light dark:text-text-dark">
                تنفيذ إنتاج
              </h3>
              <p className="text-sm text-gray-500">{bom.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <span className="material-icons-round text-gray-500">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Quantities */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                الكمية المستهدفة
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-background-light dark:bg-background-dark py-2.5 px-4 text-center font-bold focus:ring-2 focus:ring-primary"
                placeholder="0"
                value={targetQty}
                onChange={(e) => {
                  setTargetQty(e.target.value);
                  setActualQty(e.target.value);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                الكمية الفعلية المنتجة
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-background-light dark:bg-background-dark py-2.5 px-4 text-center font-bold focus:ring-2 focus:ring-primary"
                placeholder="0"
                value={actualQty}
                onChange={(e) => setActualQty(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                الهالك (تلقائي)
              </label>
              <div
                className={`rounded-xl border py-2.5 px-4 text-center font-bold ${wasteQty > 0
                    ? "border-red-300 bg-red-50 dark:bg-red-900/20 text-red-600"
                    : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-400"
                  }`}>
                {wasteQty > 0 ? wasteQty.toFixed(3) : "-"}
              </div>
            </div>
          </div>

          {/* Warehouses */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                <span className="material-icons-round text-sm align-middle text-red-500 ml-1">
                  remove_circle
                </span>
                مستودع الخصم (المواد الخام)
              </label>
              <select
                className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-background-light dark:bg-background-dark py-2.5 px-4 focus:ring-2 focus:ring-primary"
                value={sourceWarehouseId}
                onChange={(e) => setSourceWarehouseId(e.target.value)}
                required>
                <option value="">اختر المستودع</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                <span className="material-icons-round text-sm align-middle text-green-500 ml-1">
                  add_circle
                </span>
                مستودع الإضافة (المنتج النهائي)
              </label>
              <select
                className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-background-light dark:bg-background-dark py-2.5 px-4 focus:ring-2 focus:ring-primary"
                value={destWarehouseId}
                onChange={(e) => setDestWarehouseId(e.target.value)}>
                <option value="">اختر المستودع (اختياري)</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              {!hasOutputItem && (
                <p className="text-xs text-gray-400">
                  هذه الوصفة لا تملك منتجاً نهائياً مرتبطاً — الإضافة للمخزون
                  اختيارية.
                </p>
              )}
            </div>
          </div>

          {/* Materials Table */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
              المواد الخام المستهلكة
            </label>
            <div className="rounded-xl border border-gray-200 dark:border-gray-600 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-right py-2 px-3 font-semibold text-gray-500">
                      المادة
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-500">
                      الكمية المطلوبة
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-500">
                      الرصيد المتاح
                    </th>
                    <th className="text-center py-2 px-3 font-semibold text-gray-500">
                      الحالة
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {materialRows.map((row) => (
                    <tr
                      key={row.itemId}
                      className="border-t border-gray-100 dark:border-gray-700">
                      <td className="py-2.5 px-3 font-medium text-text-light dark:text-text-dark">
                        {row.itemName}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-primary">
                        {targetQty ? row.required.toFixed(4) : "-"}{" "}
                        <span className="text-xs text-gray-400">
                          {row.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {row.stock.toFixed(4)}{" "}
                        <span className="text-xs text-gray-400">
                          {row.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {targetQty ? (
                          row.insufficient ? (
                            <span className="text-xs bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                              رصيد غير كافٍ ⚠️
                            </span>
                          ) : (
                            <span className="text-xs bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">
                              متاح ✓
                            </span>
                          )
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
              ملاحظات
            </label>
            <textarea
              className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-background-light dark:bg-background-dark py-2.5 px-4 resize-none focus:ring-2 focus:ring-primary"
              rows={2}
              placeholder="ملاحظات اختيارية..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading || materialRows.some((r) => r.insufficient)}
              className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              <span className="material-icons-round text-lg">
                precision_manufacturing
              </span>
              {loading ? "جاري التنفيذ..." : "تنفيذ الإنتاج"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// BOM Form Component
// ==========================================
const BOMForm = ({ initialData, onClose, onSave, allItems }) => {
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    outputItemId: initialData?.outputItemId || "",
    outputQuantity: initialData?.outputQuantity ?? 1,
    isActive: initialData?.isActive !== false,
    notes: initialData?.notes || "",
    price: initialData?.price || "",
    unit: initialData?.unit || "piece",
    items:
      initialData?.items?.length > 0
        ? initialData.items.map((i) => ({
          itemId: String(i.itemId),
          quantity: String(i.quantity),
          notes: i.notes || "",
        }))
        : [{ itemId: "", quantity: "", notes: "" }],
  });
  const [loading, setLoading] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [linkToItem, setLinkToItem] = useState(!!initialData?.outputItemId);
  const [allCategories, setAllCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState(
    initialData?.categories?.map((c) => c.id) || [],
  );

  useEffect(() => {
    categoryService.getAll().then(setAllCategories).catch(console.error);
  }, []);

  const isEditMode = !!initialData;

  const handleExistingItemSelect = (e) => {
    const itemId = e.target.value;
    const selectedItem = allItems.find((i) => String(i.id) === String(itemId));
    setFormData((prev) => ({
      ...prev,
      outputItemId: itemId,
      // Optional: Auto-fill name/price from item if empty
      name: !prev.name && selectedItem ? selectedItem.name : prev.name,
    }));
  };

  // Calculate estimated cost whenever items change
  useEffect(() => {
    const total = formData.items.reduce((sum, item) => {
      if (!item.itemId || !item.quantity) return sum;
      const rawMaterial = allItems.find(
        (i) => String(i.id) === String(item.itemId),
      );
      // Use costPrice for estimated cost. Fallback to 0 if not set.
      const cost = rawMaterial ? parseFloat(rawMaterial.costPrice || 0) : 0;
      return sum + cost * parseFloat(item.quantity);
    }, 0);
    setEstimatedCost(total);
  }, [formData.items, allItems]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { itemId: "", quantity: "", notes: "" }],
    }));
  };

  const removeItem = (index) => {
    if (formData.items.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Trim input
    const trimmedName = formData.name.trim();

    if (!trimmedName) {
      return toast.error("اسم الوصفة مطلوب");
    }
    // Duplicate check removed

    if (!formData.price || parseFloat(formData.price) <= 0) {
      return toast.error("يجب إدخال سعر البيع (أكبر من صفر)");
    }

    if (!formData.outputQuantity || parseFloat(formData.outputQuantity) <= 0) {
      return toast.error("كمية الإنتاج (Yield) يجب أن تكون أكبر من صفر");
    }

    const validItems = formData.items.filter(
      (i) => i.itemId && parseFloat(i.quantity) > 0,
    );
    if (validItems.length === 0) {
      return toast.error("يجب إضافة مادة خام واحدة على الأقل");
    }

    // Check duplicates
    const itemIds = validItems.map((i) => i.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      return toast.error("لا يمكن تكرار نفس المادة الخام");
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        name: trimmedName,
        items: validItems,
        outputItemId: linkToItem ? formData.outputItemId : null,
        categoryIds: selectedCategoryIds,
      };
      await onSave(payload, true);
    } catch (err) {
      // handled by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
            اسم المنتج (الوصفة)
          </label>
          <div className="relative">
            <input
              className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="مثال: وجبة شاورما"
              type="text"
              required
            />
            <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
              receipt
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
            وحدة القياس
          </label>
          <div className="relative">
            <select
              className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
              name="unit"
              value={formData.unit}
              onChange={handleChange}>
              <option value="piece">قطعة (Piece)</option>
              <option value="kg">كيلوجرام (KG)</option>
            </select>
            <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
              straighten
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
            سعر البيع
          </label>
          <div className="relative">
            <input
              className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-center"
              name="price"
              value={formData.price}
              onChange={handleChange}
              placeholder="0.00"
              type="number"
              step="0.01"
              min="0"
            />
            <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
              attach_money
            </span>
          </div>
        </div>

        {/* Categories */}
        <div className="md:col-span-2 space-y-2">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
            التصنيفات
          </label>
          <div className="flex flex-wrap gap-2 p-3 bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-600 rounded-xl">
            {allCategories.length === 0 && (
              <span className="text-xs text-gray-400">لا توجد تصنيفات</span>
            )}
            {allCategories.map((cat) => (
              <label
                key={cat.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer border transition-all text-sm font-bold ${selectedCategoryIds.includes(cat.id)
                    ? "bg-primary/10 border-primary text-primary dark:text-accent"
                    : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary/40"
                  }`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={selectedCategoryIds.includes(cat.id)}
                  onChange={() => {
                    setSelectedCategoryIds((prev) =>
                      prev.includes(cat.id)
                        ? prev.filter((id) => id !== cat.id)
                        : [...prev, cat.id],
                    );
                  }}
                />
                <span className="material-icons-round text-base">
                  {selectedCategoryIds.includes(cat.id)
                    ? "check_circle"
                    : "radio_button_unchecked"}
                </span>
                {cat.name}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
            كمية الإنتاج (Yield)
          </label>
          <div className="relative">
            <input
              className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 pr-4 pl-12 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow text-center"
              name="outputQuantity"
              value={formData.outputQuantity}
              onChange={handleChange}
              placeholder="1"
              type="number"
              step="0.01"
              min="0.01"
            />
            <span className="material-icons-round absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400">
              output
            </span>
          </div>
        </div>

        <div className="space-y-2 flex items-end">
          <label className="flex items-center gap-3 cursor-pointer p-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors">
            <input
              type="checkbox"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-600 dark:bg-gray-700"
            />
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
              متاح للبيع في نقطة البيع (POS)
            </span>
          </label>
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          ملاحظات
        </label>
        <textarea
          className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-xl py-2.5 px-4 text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow resize-none"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          rows={2}
          placeholder="ملاحظات اختيارية..."
        />
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800">
          <div className="flex justify-between items-center">
            <span className="text-sm font-bold text-blue-800 dark:text-blue-300">
              التكلفة التقديرية:
            </span>
            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {estimatedCost.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center border-t sm:border-t-0 sm:border-r border-blue-200 dark:border-blue-700 pt-2 sm:pt-0 sm:pr-4">
            <span className="text-sm font-bold text-blue-800 dark:text-blue-300">
              أقصى إنتاج متاح:
            </span>
            {(() => {
              const currentUser = AuthService.getCurrentUser();
              const userWarehouseId = currentUser?.branch?.warehouseId;

              const maxProd = formData.items.reduce((min, item) => {
                if (!item.itemId || !item.quantity) return min;
                const raw = allItems.find(
                  (i) => String(i.id) === String(item.itemId),
                );

                let stock = 0;
                if (raw?.inventory) {
                  if (userWarehouseId) {
                    const inv = raw.inventory.find(
                      (i) => i.warehouseId === userWarehouseId,
                    );
                    stock = inv ? Number(inv.quantity) : 0;
                  } else {
                    stock = raw.inventory.reduce(
                      (s, inv) => s + Number(inv.quantity),
                      0,
                    );
                  }
                }

                if (stock === 0) return 0;
                return Math.min(min, stock / item.quantity);
              }, Infinity);
              const val =
                maxProd === Infinity ? 0 : parseFloat(maxProd.toFixed(2));
              return (
                <span
                  className={`text-lg font-bold ${val === 0 ? "text-red-500" : "text-green-600"}`}>
                  {maxProd === Infinity ? "-" : val}
                </span>
              );
            })()}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
            المواد الخام
          </label>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1 text-sm text-primary hover:text-primary-hover font-bold transition-colors">
            <span className="material-icons-round text-lg">add_circle</span>
            إضافة مادة
          </button>
        </div>

        <div className="bg-background-light dark:bg-background-dark border border-gray-200 dark:border-gray-600 rounded-xl p-4 space-y-3 max-h-64 overflow-y-auto">
          {formData.items.map((item, index) => (
            <div
              key={index}
              className="flex items-center gap-3 bg-surface-light dark:bg-surface-dark p-3 rounded-lg border border-gray-100 dark:border-gray-700">
              <div className="flex-1">
                <select
                  className="w-full bg-background-light dark:bg-background-dark border-gray-200 dark:border-gray-600 rounded-lg py-2 px-3 text-sm text-gray-700 dark:text-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent"
                  value={item.itemId}
                  onChange={(e) =>
                    handleItemChange(index, "itemId", e.target.value)
                  }
                  required>
                  <option value="">اختر المادة الخام</option>
                  {allItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.name}
                    </option>
                  ))}
                </select>
                {(() => {
                  const currentUser = AuthService.getCurrentUser();
                  const userWarehouseId = currentUser?.branch?.warehouseId;
                  const selected = allItems.find(
                    (i) => String(i.id) === String(item.itemId),
                  );

                  if (selected) {
                    let stock = 0;
                    if (selected.inventory) {
                      if (userWarehouseId) {
                        const inv = selected.inventory.find(
                          (i) => i.warehouseId === userWarehouseId,
                        );
                        stock = inv ? Number(inv.quantity) : 0;
                      } else {
                        stock = selected.inventory.reduce(
                          (s, inv) => s + Number(inv.quantity),
                          0,
                        );
                      }
                    }

                    return (
                      <div
                        className={`text-xs mt-1 ${stock > 0 ? "text-green-600" : "text-red-500"}`}>
                        الرصيد: {stock}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="w-44">
                <KgQuantityInput
                  value={parseFloat(item.quantity) || 0}
                  onChange={(v) => handleItemChange(index, "quantity", String(v))}
                  unit={allItems.find((i) => String(i.id) === String(item.itemId))?.unit || "piece"}
                  min={0.001}
                />
              </div>
              <button
                type="button"
                onClick={() => removeItem(index)}
                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                disabled={formData.items.length <= 1}>
                <span className="material-icons-round text-lg">delete</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
        <button
          type="button"
          onClick={onClose}
          className="w-full sm:w-auto px-6 py-3 rounded-xl border border-border-light dark:border-border-dark text-text-light dark:text-text-dark font-bold text-sm hover:bg-background-light dark:hover:bg-background-dark transition-all min-h-touch">
          إلغاء
        </button>
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 min-h-touch disabled:opacity-50">
          <span className="material-icons-round text-lg">save</span>
          <span>
            {loading ? "جاري الحفظ..." : initialData ? "حفظ التغييرات" : "حفظ"}
          </span>
        </button>
      </div>
    </form>
  );
};

// ==========================================
// BOM Manager Page
// ==========================================
const BOMManager = () => {
  const [boms, setBoms] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(AuthService.getCurrentUser());
  const [executingBom, setExecutingBom] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);
  const [showForm, setShowForm] = useState(false);
  const [editingBom, setEditingBom] = useState(null);
  const [expandedBom, setExpandedBom] = useState(null);

  const canCreate = AuthService.hasPermission("CREATES_PRODUCTION");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bomsData, warehousesData] = await Promise.all([
        bomService.getAll(),
        warehouseService.getAll(),
      ]);
      setBoms(bomsData);
      setWarehouses(warehousesData);

      // Load items with inventory data; fall back to basic item list if inventory endpoint fails
      try {
        const invData = await inventoryService.getInventory();
        setAllItems(invData);
      } catch {
        const basicItems = await itemService.getAll();
        setAllItems(basicItems);
      }
    } catch (error) {
      toast.error(error.message || "فشل في تحميل البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (data, shouldClose) => {
    try {
      if (editingBom) {
        await bomService.update(editingBom.id, data);
        toast.success("تم تحديث الوصفة بنجاح");
      } else {
        await bomService.create(data);
        toast.success("تم إنشاء الوصفة بنجاح");
      }
      setShowForm(false);
      setEditingBom(null);
      fetchData();
    } catch (error) {
      toast.error(error.message || "فشل في حفظ الوصفة");
      throw error;
    }
  };

  const handleEdit = (bom) => {
    setEditingBom(bom);
    setShowForm(true);
  };

  const handleDelete = async (bom) => {
    confirmAction(`هل أنت متأكد من حذف "${bom.name}"؟`, async () => {
      try {
        await bomService.delete(bom.id);
        toast.success("تم حذف الوصفة");
        fetchData();
      } catch (error) {
        toast.error(error.message || "فشل في حذف الوصفة");
      }
    });
  };

  const toggleExpand = (bomId) => {
    setExpandedBom(expandedBom === bomId ? null : bomId);
  };

  if (showForm) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => {
              setShowForm(false);
              setEditingBom(null);
            }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <span className="material-icons-round text-gray-500">
              arrow_forward
            </span>
          </button>
          <div>
            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">
              {editingBom ? "تعديل الوصفة" : "إنشاء وصفة جديدة"}
            </h2>
            <p className="text-sm text-text-light/60 dark:text-text-dark/60">
              قائمة المواد (BOM)
            </p>
          </div>
        </div>
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark p-6">
          <BOMForm
            initialData={editingBom}
            onClose={() => {
              setShowForm(false);
              setEditingBom(null);
            }}
            onSave={handleSave}
            allItems={allItems}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Execute Production Modal */}
      {executingBom && (
        <ExecuteProductionModal
          bom={executingBom}
          allItems={allItems}
          warehouses={warehouses}
          onClose={() => setExecutingBom(null)}
          onSuccess={fetchData}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 dark:bg-primary/20 p-3 rounded-full">
            <span className="material-icons-round text-3xl text-primary">
              receipt
            </span>
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-text-light dark:text-text-dark">
              وصفات التصنيع
            </h2>
            <p className="text-sm text-text-light/60 dark:text-text-dark/60">
              إدارة قوائم المواد (BOM)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/bom/production-history")}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 font-bold text-sm transition-all min-h-touch">
            <span className="material-icons-round">history</span>
            سجل الإنتاج
          </button>
          {canCreate && (
            <button
              onClick={() => {
                setEditingBom(null);
                setShowForm(true);
              }}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-sm shadow-md hover:shadow-lg transition-all min-h-touch">
              <span className="material-icons-round">add</span>
              إنشاء وصفة جديدة
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : boms.length === 0 ? (
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark p-12 text-center">
          <span className="material-icons-round text-6xl text-gray-300 dark:text-gray-600 mb-4">
            receipt_long
          </span>
          <p className="text-lg text-gray-500 dark:text-gray-400">
            لا توجد وصفات تصنيع مسجلة
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {boms.map((bom) => (
            <div
              key={bom.id}
              className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden transition-all hover:shadow-md">
              {/* BOM Card Header */}
              <div
                className="flex items-center justify-between p-4 sm:p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                onClick={() => toggleExpand(bom.id)}>
                <div className="flex items-center gap-4">
                  <div
                    className={`p-2.5 rounded-xl ${bom.isActive
                        ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-400"
                      }`}>
                    <span className="material-icons-round text-xl">
                      receipt
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-text-light dark:text-text-dark">
                      {bom.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <span className="material-icons-round text-sm">
                          inventory_2
                        </span>
                        المنتج: {bom.outputItemName}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        •
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <span className="material-icons-round text-sm">
                          category
                        </span>
                        {bom.items.length} مادة خام
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        •
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${bom.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
                          }`}>
                        {bom.isActive ? "مفعّل" : "معطّل"}
                      </span>
                    </div>
                    {/* Max Production Display */}
                    <div className="mt-2 flex items-center gap-2">
                      {(() => {
                        // Calculate max possible production
                        const maxProduction = bom.items.reduce(
                          (min, bomItem) => {
                            const rawMaterial = allItems.find(
                              (i) => String(i.id) === String(bomItem.itemId),
                            );
                            // Filter inventory by user branch if available
                            const userWarehouseId =
                              currentUser?.branch?.warehouseId;

                            let totalStock = 0;
                            if (rawMaterial?.inventory) {
                              if (userWarehouseId) {
                                const stock = rawMaterial.inventory.find(
                                  (inv) => inv.warehouseId === userWarehouseId,
                                );
                                totalStock = stock ? Number(stock.quantity) : 0;
                              } else {
                                totalStock = rawMaterial.inventory.reduce(
                                  (sum, inv) => sum + Number(inv.quantity),
                                  0,
                                );
                              }
                            }

                            const possible = totalStock / bomItem.quantity;
                            return Math.min(min, possible);
                          },
                          Infinity,
                        );

                        const isInfinite = maxProduction === Infinity;
                        const possibleCount = isInfinite
                          ? 0
                          : parseFloat(maxProduction.toFixed(2));

                        let colorClass = "text-gray-500";
                        if (!isInfinite) {
                          if (possibleCount === 0)
                            colorClass = "text-red-500 font-bold";
                          else if (possibleCount < 10)
                            colorClass = "text-yellow-600 font-bold";
                          else colorClass = "text-green-600 font-bold";
                        }

                        return (
                          <span
                            className={`text-sm flex items-center gap-1 ${colorClass}`}>
                            <span className="material-icons-round text-sm">
                              construction
                            </span>
                            إمكانية الإنتاج: {isInfinite ? "-" : possibleCount}{" "}
                            وحدة
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canCreate && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExecutingBom(bom);
                        }}
                        title="تنفيذ إنتاج"
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
                        <span className="material-icons-round text-lg">
                          precision_manufacturing
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(bom);
                        }}
                        className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                        <span className="material-icons-round text-lg">
                          edit
                        </span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(bom);
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <span className="material-icons-round text-lg">
                          delete
                        </span>
                      </button>
                    </>
                  )}
                  <span
                    className={`material-icons-round text-gray-400 transform transition-transform ${expandedBom === bom.id ? "rotate-180" : ""
                      }`}>
                    expand_more
                  </span>
                </div>
              </div>

              {/* Expanded Materials List */}
              {expandedBom === bom.id && (
                <div className="border-t border-gray-100 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-800/30">
                  <table className="w-full">
                    <thead>
                      <tr className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="text-right py-2 px-3 font-semibold">
                          #
                        </th>
                        <th className="text-right py-2 px-3 font-semibold">
                          المادة الخام
                        </th>
                        <th className="text-right py-2 px-3 font-semibold">
                          الكمية المطلوبة
                        </th>
                        <th className="text-center py-2 px-3 font-semibold">
                          الرصيد المتاح
                        </th>
                        <th className="text-right py-2 px-3 font-semibold">
                          ملاحظات
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bom.items.map((item, idx) => {
                        const rawMaterial = allItems.find(
                          (i) => String(i.id) === String(item.itemId),
                        );

                        const userWarehouseId =
                          currentUser?.branch?.warehouseId;
                        let totalStock = 0;
                        if (rawMaterial?.inventory) {
                          if (userWarehouseId) {
                            const stock = rawMaterial.inventory.find(
                              (inv) => inv.warehouseId === userWarehouseId,
                            );
                            totalStock = stock ? Number(stock.quantity) : 0;
                          } else {
                            totalStock = rawMaterial.inventory.reduce(
                              (sum, inv) => sum + Number(inv.quantity),
                              0,
                            );
                          }
                        }

                        const maxOutput = parseFloat(
                          (totalStock / item.quantity).toFixed(2),
                        );

                        return (
                          <tr
                            key={item.id}
                            className="border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <td className="py-2.5 px-3 text-sm text-gray-400 font-mono">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3 text-sm font-medium text-text-light dark:text-text-dark">
                              {item.itemName}
                            </td>
                            <td className="py-2.5 px-3 text-sm text-right font-bold text-primary">
                              {item.quantity}
                            </td>
                            <td className="py-2.5 px-3 text-sm text-center">
                              <span
                                className={`font-bold ${totalStock < item.quantity ? "text-red-500" : "text-green-600"}`}>
                                {Number(totalStock).toFixed(2)}
                              </span>
                              <span className="text-xs text-gray-400 block">
                                (يكفي {maxOutput})
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-sm text-gray-500">
                              {item.notes || "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {bom.notes && (
                    <div className="mt-3 flex items-start gap-2 text-sm text-gray-500 bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg">
                      <span className="material-icons-round text-yellow-500 text-sm mt-0.5">
                        info
                      </span>
                      {bom.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BOMManager;
