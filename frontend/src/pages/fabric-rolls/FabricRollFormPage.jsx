import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fabricRollService } from "../../services/fabricRollService";
import { warehouseService } from "../../services/warehouseService";
import { itemService } from "../../services/itemService";
import toast from "react-hot-toast";
import Icon from "../../components/ui/Icon";

// ─── Blank row template ───
const blankRow = () => ({
  itemId: "",
  warehouseId: "",
  originalLength: "",
  unitCost: "",
  widthCm: "",
  colorCode: "",
  barcode: "",
  notes: "",
  _error: "",
});

// ─── Parse a quick-entry line: "itemId|length|unitCost|notes" ───
const parseQuickLine = (line, warehouses, items, fallbackWarehouseId) => {
  const parts = line.split("|").map((p) => p.trim());
  const row = blankRow();
  const errors = [];

  const rawItemId = parts[0];
  const rawLen = parts[1];
  const rawCost = parts[2];
  const rawNotes = parts[3];

  // itemId lookup (by id or name prefix)
  const item = items.find(
    (i) =>
      String(i.id) === rawItemId ||
      i.name.toLowerCase().startsWith(rawItemId.toLowerCase())
  );
  if (!item) errors.push(`صنف غير موجود: "${rawItemId}"`);
  else row.itemId = String(item.id);

  const len = parseFloat(rawLen);
  if (isNaN(len) || len <= 0) errors.push("الطول غير صالح");
  else row.originalLength = String(len);

  if (rawCost) {
    const cost = parseFloat(rawCost);
    if (!isNaN(cost)) row.unitCost = String(cost);
  }
  if (rawNotes) row.notes = rawNotes;

  row.warehouseId = String(fallbackWarehouseId || "");
  row._error = errors.join(" — ");
  return row;
};

const FabricRollFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams(); // present for edit mode
  const isEdit = Boolean(id);

  const [warehouses, setWarehouses] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Batch-create state
  const [rows, setRows] = useState([blankRow()]);
  const [quickText, setQuickText] = useState("");
  const [showQuick, setShowQuick] = useState(false);

  // Edit state
  const [editRoll, setEditRoll] = useState(null);
  const [editNotes, setEditNotes] = useState("");
  const [editBarcode, setEditBarcode] = useState("");

  useEffect(() => {
    const loadMeta = async () => {
      const [wh, it] = await Promise.all([
        warehouseService.getAll().catch(() => []),
        itemService.getAll
          ? itemService.getAll({ itemType: "FABRIC" }).catch(() => [])
          : Promise.resolve([]),
      ]);
      setWarehouses(Array.isArray(wh) ? wh : []);
      setItems(Array.isArray(it) ? it : []);
    };
    loadMeta();
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    fabricRollService
      .getById(id)
      .then((r) => {
        setEditRoll(r);
        setEditNotes(r.notes || "");
        setEditBarcode(r.barcode || "");
      })
      .catch(() => toast.error("فشل تحميل اللفة"))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  // ── Row manipulation ──
  const updateRow = (idx, field, value) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));

  const addRow = () => setRows((prev) => [...prev, blankRow()]);

  const removeRow = (idx) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

  const duplicateRow = (idx) =>
    setRows((prev) => {
      const copy = [...prev];
      copy.splice(idx + 1, 0, { ...prev[idx], barcode: "", _error: "" });
      return copy;
    });

  // ── Quick-entry parse ──
  const applyQuickText = () => {
    const lines = quickText.split("\n").filter((l) => l.trim());
    if (!lines.length) return;
    const fallbackWh = warehouses[0]?.id || "";
    const parsed = lines.map((l) => parseQuickLine(l, warehouses, items, fallbackWh));
    setRows(parsed);
    setShowQuick(false);
    setQuickText("");
  };

  // ── Submit batch create ──
  const handleCreate = async (e) => {
    e.preventDefault();
    const invalid = rows.some((r) => !r.itemId || !r.warehouseId || !r.originalLength);
    if (invalid) {
      toast.error("يرجى تعبئة جميع الحقول الإلزامية (الصنف، المخزن، الطول)");
      return;
    }
    setSubmitting(true);
    try {
      const payload = rows.map((r) => ({
        itemId: parseInt(r.itemId),
        warehouseId: parseInt(r.warehouseId),
        originalLength: parseFloat(r.originalLength),
        unitCost: r.unitCost ? parseFloat(r.unitCost) : 0,
        widthCm: r.widthCm ? parseFloat(r.widthCm) : undefined,
        colorCode: r.colorCode || undefined,
        barcode: r.barcode || undefined,
        notes: r.notes || undefined,
      }));
      await fabricRollService.create(payload);
      toast.success(`تم إنشاء ${payload.length} لفة بنجاح`);
      navigate("/fabric-rolls");
    } catch (err) {
      toast.error(err.message || "فشل إنشاء اللفات");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Submit edit ──
  const handleEdit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fabricRollService.update(id, {
        notes: editNotes || undefined,
        barcode: editBarcode || undefined,
      });
      toast.success("تم حفظ التغييرات");
      navigate(`/fabric-rolls/${id}`);
    } catch (err) {
      toast.error(err.message || "فشل حفظ التغييرات");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Icon name="sync" className="animate-spin text-primary text-4xl" />
      </div>
    );
  }

  return (
    <div className="bg-background-light dark:bg-background-dark min-h-screen p-4 sm:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <Icon name="arrow_forward" className="text-gray-500" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-text-main dark:text-text-dark">
              {isEdit ? `تعديل اللفة ${editRoll?.rollNumber}` : "إضافة لفات جديدة"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {isEdit ? "يمكنك تعديل الملاحظات والباركود فقط" : "يمكنك إضافة أكثر من لفة دفعة واحدة"}
            </p>
          </div>
        </div>

        {/* ── Edit Form ── */}
        {isEdit && editRoll && (
          <form onSubmit={handleEdit}>
            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-6 shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">رقم اللفة</label>
                  <input value={editRoll.rollNumber} readOnly
                    className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-gray-50 dark:bg-gray-800 text-gray-500 text-sm font-mono cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">الباركود</label>
                  <input
                    value={editBarcode}
                    onChange={(e) => setEditBarcode(e.target.value)}
                    disabled={!!editRoll.barcode}
                    placeholder="اختياري"
                    className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm text-text-main dark:text-text-dark focus:ring-1 focus:ring-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {editRoll.barcode && (
                    <p className="text-xs text-gray-400 mt-1">لا يمكن تغيير الباركود بعد تعيينه</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">ملاحظات</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm text-text-main dark:text-text-dark focus:ring-1 focus:ring-primary outline-none resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => navigate(-1)}
                  className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm">
                  إلغاء
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {submitting ? "جارٍ الحفظ..." : "حفظ التغييرات"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ── Batch Create Form ── */}
        {!isEdit && (
          <form onSubmit={handleCreate}>
            {/* Quick-entry toggle */}
            <div className="flex justify-end mb-3">
              <button type="button" onClick={() => setShowQuick((v) => !v)}
                className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium">
                <Icon name="edit_note" className="text-[16px]" />
                {showQuick ? "إخفاء الإدخال السريع" : "إدخال سريع (نص)"}
              </button>
            </div>

            {/* Quick-entry textarea */}
            {showQuick && (
              <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark p-4 mb-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-2">
                  كل سطر: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">itemId|الطول|التكلفة|ملاحظات</code>
                </p>
                <textarea
                  value={quickText}
                  onChange={(e) => setQuickText(e.target.value)}
                  rows={6}
                  placeholder={"1|50|120|لفة حمراء\n2|80\n3|30|200"}
                  className="w-full px-3 py-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm font-mono text-text-main dark:text-text-dark focus:ring-1 focus:ring-primary outline-none resize-none"
                />
                <div className="flex justify-end mt-2">
                  <button type="button" onClick={applyQuickText}
                    className="px-4 py-1.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors">
                    تحليل النص
                  </button>
                </div>
              </div>
            )}

            {/* Rows table */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-sm overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-background-light dark:bg-background-dark border-b border-border-light dark:border-border-dark">
                      <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 font-medium w-8">#</th>
                      <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 font-medium">الصنف *</th>
                      <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 font-medium">المخزن *</th>
                      <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 font-medium">الطول (م) *</th>
                      <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 font-medium">التكلفة</th>
                      <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 font-medium">الباركود</th>
                      <th className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 font-medium">ملاحظات</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx} className={`border-b border-border-light dark:border-border-dark ${row._error ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                        <td className="px-3 py-2 text-gray-400 text-center">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <select
                            value={row.itemId}
                            onChange={(e) => updateRow(idx, "itemId", e.target.value)}
                            required
                            className="w-full py-1.5 px-2 rounded border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-main dark:text-text-dark text-xs focus:ring-1 focus:ring-primary outline-none">
                            <option value="">-- اختر --</option>
                            {items.map((i) => (
                              <option key={i.id} value={i.id}>{i.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={row.warehouseId}
                            onChange={(e) => updateRow(idx, "warehouseId", e.target.value)}
                            required
                            className="w-full py-1.5 px-2 rounded border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-main dark:text-text-dark text-xs focus:ring-1 focus:ring-primary outline-none">
                            <option value="">-- اختر --</option>
                            {warehouses.map((w) => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" step="0.01" min="0.01"
                            value={row.originalLength}
                            onChange={(e) => updateRow(idx, "originalLength", e.target.value)}
                            required
                            placeholder="50"
                            className="w-24 py-1.5 px-2 rounded border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-main dark:text-text-dark text-xs focus:ring-1 focus:ring-primary outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" step="0.01" min="0"
                            value={row.unitCost}
                            onChange={(e) => updateRow(idx, "unitCost", e.target.value)}
                            placeholder="0"
                            className="w-20 py-1.5 px-2 rounded border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-main dark:text-text-dark text-xs focus:ring-1 focus:ring-primary outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.barcode}
                            onChange={(e) => updateRow(idx, "barcode", e.target.value)}
                            placeholder="اختياري"
                            className="w-28 py-1.5 px-2 rounded border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-main dark:text-text-dark text-xs focus:ring-1 focus:ring-primary outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={row.notes}
                            onChange={(e) => updateRow(idx, "notes", e.target.value)}
                            placeholder="اختياري"
                            className="w-32 py-1.5 px-2 rounded border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-main dark:text-text-dark text-xs focus:ring-1 focus:ring-primary outline-none"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => duplicateRow(idx)} title="تكرار"
                              className="p-1 text-gray-400 hover:text-primary transition-colors">
                              <Icon name="content_copy" className="text-[16px]" />
                            </button>
                            <button type="button" onClick={() => removeRow(idx)} title="حذف"
                              className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                              <Icon name="delete_outline" className="text-[16px]" />
                            </button>
                          </div>
                          {row._error && (
                            <p className="text-xs text-red-500 mt-0.5">{row._error}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add row */}
              <div className="p-3 border-t border-border-light dark:border-border-dark">
                <button type="button" onClick={addRow}
                  className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium">
                  <Icon name="add" className="text-[16px]" />
                  إضافة صف
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">{rows.length} لفة للإضافة</span>
              <div className="flex gap-3">
                <button type="button" onClick={() => navigate(-1)}
                  className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm">
                  إلغاء
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2">
                  {submitting && <Icon name="sync" className="animate-spin text-[16px]" />}
                  {submitting ? "جارٍ الحفظ..." : `إضافة ${rows.length} لفة`}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default FabricRollFormPage;
