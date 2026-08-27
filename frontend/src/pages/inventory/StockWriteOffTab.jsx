import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import Modal from "../../components/ui/Modal";
import { stockWriteOffService } from "../../services/stockWriteOffService";
import { warehouseService } from "../../services/warehouseService";
import { branchService } from "../../services/branchService";
import AuthService from "../../services/authService";
import { useBranch } from "../../contexts/BranchContext";

/**
 * إهلاك — stock consumed internally, damaged, expired, or lost to a count
 * variance.
 *
 * Styled ROSE rather than the opening tab's amber on purpose: an إهلاك removes
 * stock and reduces reported profit, and must never be mistaken at a glance for
 * an opening balance, which adds stock.
 */
const StockWriteOffTab = () => {
  const { activeBranch, isGlobalRole } = useBranch();
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [entries, setEntries] = useState([]);
  const [reasons, setReasons] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    warehouseId: "",
    quantity: "",
    unitCost: "",
    reason: "INTERNAL_USE",
    date: today,
    notes: "",
  });

  const currentUser = AuthService.getCurrentUser();
  // Reversing unwinds recognised COGS, so it is held to the same manager-level
  // bar the backend enforces.
  const canReverse =
    currentUser?.role === "Superadmin" || currentUser?.role === "Admin";

  const reasonLabel = (code) =>
    reasons.find((r) => r.code === code)?.label || code;

  useEffect(() => {
    const init = async () => {
      try {
        const [warehousesData, branchesData, reasonsData] = await Promise.all([
          warehouseService.getAll(),
          branchService.getAll(),
          stockWriteOffService.getReasons(),
        ]);
        setWarehouses(warehousesData);
        setBranches(branchesData);
        setReasons(reasonsData.reasons || []);
      } catch (error) {
        console.error("Failed to load write-off reference data:", error);
        toast.error("فشل تحميل البيانات");
      }
    };
    init();
  }, []);

  // Non-global users are pinned to their active branch's warehouse — they must
  // never be able to write off stock belonging to another branch.
  const visibleBranches = useMemo(() => {
    if (isGlobalRole) return branches;
    if (!activeBranch?.warehouseId) return [];
    return branches.filter((b) => b.warehouseId === activeBranch.warehouseId);
  }, [isGlobalRole, activeBranch, branches]);

  const visibleWarehouses = useMemo(() => {
    if (isGlobalRole) return warehouses;
    if (!activeBranch?.warehouseId) return [];
    return warehouses.filter((w) => w.id === activeBranch.warehouseId);
  }, [isGlobalRole, activeBranch, warehouses]);

  useEffect(() => {
    if (branches.length === 0) return;
    if (!isGlobalRole && activeBranch?.warehouseId) {
      setSelectedWarehouseId(activeBranch.warehouseId);
    } else if (isGlobalRole && !selectedWarehouseId) {
      setSelectedWarehouseId(branches[0].warehouseId);
    }
  }, [branches, isGlobalRole, activeBranch?.warehouseId]);

  useEffect(() => {
    if (selectedWarehouseId === "") return;
    const fetchItems = async () => {
      try {
        setIsLoading(true);
        const data = await stockWriteOffService.getAll(selectedWarehouseId);
        setItems(data.items || []);
        if (selectedItem) {
          const updated = (data.items || []).find((i) => i.id === selectedItem.id);
          if (updated) setSelectedItem(updated);
        }
      } catch (error) {
        console.error("Failed to fetch items:", error);
        toast.error("فشل تحميل الأصناف");
      } finally {
        setIsLoading(false);
      }
    };
    fetchItems();
  }, [selectedWarehouseId]);

  const loadEntries = async (itemId) => {
    setIsLoadingEntries(true);
    try {
      const data = await stockWriteOffService.getByItem(itemId, selectedWarehouseId);
      setEntries(data.entries || []);
    } catch (error) {
      console.error("Failed to load write-off history:", error);
      toast.error("فشل تحميل سجل الإهلاك");
    } finally {
      setIsLoadingEntries(false);
    }
  };

  const handleItemClick = async (item) => {
    setSelectedItem(item);
    await loadEntries(item.id);
  };

  const refreshItems = async () => {
    const data = await stockWriteOffService.getAll(selectedWarehouseId);
    setItems(data.items || []);
    const updated = (data.items || []).find((i) => i.id === selectedItem?.id);
    if (updated) setSelectedItem(updated);
  };

  const handleOpenModal = () => {
    if (!selectedItem) return;
    setFormData({
      warehouseId: selectedWarehouseId || (warehouses[0]?.id ?? ""),
      quantity: "",
      // Prefilled from the item's own cost. Editable, because damaged stock may
      // have been bought at a different price — but never written back to the
      // item, so editing it here changes this one write-off and nothing else.
      unitCost: selectedItem.costPrice > 0 ? String(selectedItem.costPrice) : "",
      reason: "INTERNAL_USE",
      date: today,
      notes: "",
    });
    setIsModalOpen(true);
  };

  const available = Number(selectedItem?.totalQuantity || 0);
  const enteredQty = Number(formData.quantity || 0);
  const enteredCost = Number(formData.unitCost || 0);
  const cogsImpact = enteredQty > 0 && enteredCost > 0 ? enteredQty * enteredCost : 0;

  const exceedsStock = enteredQty > available;
  const missingCost = !(enteredCost > 0);
  const canSubmit =
    enteredQty > 0 && !exceedsStock && !missingCost && !!formData.warehouseId;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await stockWriteOffService.add({
        itemId: selectedItem.id,
        warehouseId: parseInt(formData.warehouseId, 10),
        quantity: enteredQty,
        unitCost: enteredCost,
        reason: formData.reason,
        date: formData.date,
        notes: formData.notes || null,
      });
      toast.success("تم تسجيل الإهلاك بنجاح");
      setIsModalOpen(false);
      await Promise.all([refreshItems(), loadEntries(selectedItem.id)]);
    } catch (error) {
      console.error("Failed to record write-off:", error);
      toast.error(error?.message || "فشل تسجيل الإهلاك");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReverse = async (entry) => {
    const label = `${parseFloat(Number(entry.quantity).toFixed(4))} ${selectedItem.unit}`;
    if (
      !window.confirm(
        `عكس قيد الإهلاك (${label})؟\n\nسيتم إرجاع الكمية للمخزون وتسجيل قيد عكسي بتاريخ اليوم. لن يتم تعديل الشهر الأصلي.`,
      )
    ) {
      return;
    }
    try {
      await stockWriteOffService.reverse(entry.id);
      toast.success("تم عكس قيد الإهلاك");
      await Promise.all([refreshItems(), loadEntries(selectedItem.id)]);
    } catch (error) {
      console.error("Failed to reverse write-off:", error);
      toast.error(error?.message || "فشل عكس القيد");
    }
  };

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase()),
  );

  const totalWrittenOff = entries.reduce((s, e) => s + e.totalCost, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── Left panel: product list ── */}
      <div className="lg:col-span-1 bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
        <div className="p-4 bg-background-light dark:bg-background-dark/50 border-b border-border-light dark:border-border-dark">
          <h3 className="font-bold text-text-light dark:text-text-dark flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-rose-500">
              inventory_2
            </span>
            الأصناف ({filteredItems.length})
          </h3>

          <div className="relative mb-3">
            <select
              value={selectedWarehouseId}
              disabled={!isGlobalRole && visibleBranches.length <= 1}
              onChange={(e) => {
                setSelectedWarehouseId(e.target.value);
                setSelectedItem(null);
                setEntries([]);
              }}
              className="w-full appearance-none bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg px-3 py-2 text-sm pr-8 disabled:opacity-70 disabled:cursor-not-allowed">
              {visibleBranches.map((branch) => (
                <option key={branch.id} value={branch.warehouseId}>
                  {branch.name}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none text-base">
              store
            </span>
          </div>

          <input
            type="text"
            placeholder="بحث بالاسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="overflow-y-auto max-h-[40vh] lg:max-h-[580px]">
          {isLoading ? (
            <div className="p-8 text-center text-text-muted">
              <span className="material-symbols-outlined animate-spin text-4xl">
                progress_activity
              </span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center text-text-muted">لا يوجد أصناف</div>
          ) : (
            filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`p-4 border-b border-border-light dark:border-border-dark cursor-pointer transition-colors ${
                  selectedItem?.id === item.id
                    ? "bg-rose-500/10 dark:bg-rose-500/20"
                    : "hover:bg-background-light dark:hover:bg-background-dark/50"
                }`}>
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-text-light dark:text-text-dark text-sm">
                      {item.name}
                    </h4>
                    {/* The consumables this feature exists for are exactly the
                        items hidden from the POS, so mark them. */}
                    {!item.showInPos && (
                      <span className="text-xs text-text-muted mt-0.5 inline-block">
                        مخفي من الكاشير
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-text-light dark:text-text-dark">
                    {parseFloat(Number(item.totalQuantity).toFixed(4))}
                    <span className="text-xs text-text-muted mr-1">
                      {item.unit}
                    </span>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right panel: details + history ── */}
      <div className="lg:col-span-2 space-y-6">
        {!selectedItem ? (
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-text-muted/30 dark:text-accent/30 mb-4 block">
              touch_app
            </span>
            <p className="text-text-muted dark:text-accent">
              اختر صنفًا لتسجيل الإهلاك
            </p>
          </div>
        ) : (
          <>
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark p-6">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h3 className="text-xl font-bold text-text-light dark:text-text-dark">
                    {selectedItem.name}
                  </h3>
                  <p className="text-sm text-text-muted dark:text-accent mt-1">
                    {`مخزون ${branches.find((b) => String(b.warehouseId) === String(selectedWarehouseId))?.name || "الفرع"}`}
                    :{" "}
                    <span className="font-bold text-text-light dark:text-text-dark">
                      {parseFloat(Number(selectedItem.totalQuantity).toFixed(4))}{" "}
                      {selectedItem.unit}
                    </span>
                    {selectedItem.costPrice > 0 && (
                      <>
                        {" · "}
                        تكلفة الوحدة:{" "}
                        <span className="font-bold text-text-light dark:text-text-dark">
                          {Number(selectedItem.costPrice).toFixed(2)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <button
                onClick={handleOpenModal}
                disabled={available <= 0}
                className="w-full sm:w-auto bg-rose-500 hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
                <span className="material-symbols-outlined">delete_sweep</span>
                تسجيل إهلاك
              </button>
              {available <= 0 && (
                <p className="text-xs text-text-muted mt-2">
                  لا توجد كمية متاحة في هذا المخزن.
                </p>
              )}
            </div>

            {/* History table */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
              <div className="p-4 bg-background-light dark:bg-background-dark/50 border-b border-border-light dark:border-border-dark flex justify-between items-center">
                <h3 className="font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                  <span className="material-symbols-outlined text-rose-500">
                    history
                  </span>
                  سجل الإهلاك ({entries.length})
                </h3>
                {entries.length > 0 && (
                  <span className="text-sm text-text-muted">
                    الإجمالي:{" "}
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      {totalWrittenOff.toLocaleString()} ج.م
                    </span>
                  </span>
                )}
              </div>

              {isLoadingEntries ? (
                <div className="p-8 text-center text-text-muted">
                  <span className="material-symbols-outlined animate-spin text-3xl">
                    progress_activity
                  </span>
                </div>
              ) : entries.length === 0 ? (
                <div className="p-8 text-center text-text-muted">
                  لا يوجد إهلاك مسجل لهذا الصنف
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm whitespace-nowrap" dir="rtl">
                    <thead className="text-xs uppercase bg-accent/20 dark:bg-surface-dark/80">
                      <tr>
                        <th className="px-4 py-3 text-right">التاريخ</th>
                        <th className="px-4 py-3 text-right">المستودع</th>
                        <th className="px-4 py-3 text-right">الكمية</th>
                        <th className="px-4 py-3 text-right">السبب</th>
                        <th className="px-4 py-3 text-right">تكلفة الوحدة</th>
                        <th className="px-4 py-3 text-right">إجمالي التكلفة</th>
                        <th className="px-4 py-3 text-right">بواسطة</th>
                        <th className="px-4 py-3 text-right">ملاحظات</th>
                        {canReverse && <th className="px-4 py-3"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className={`border-b border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark/50 ${
                            entry.isReversal ? "opacity-70" : ""
                          }`}>
                          <td className="px-4 py-3 text-text-muted">
                            {formatDate(entry.date)}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {entry.warehouse.name}
                          </td>
                          <td
                            className={`px-4 py-3 font-bold ${
                              entry.isReversal
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-rose-600 dark:text-rose-400"
                            }`}>
                            {parseFloat(Number(entry.quantity).toFixed(4))}{" "}
                            {selectedItem.unit}
                          </td>
                          <td className="px-4 py-3 text-text-muted text-xs">
                            {reasonLabel(entry.reason)}
                            {entry.isReversal && (
                              <span className="mr-1 px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
                                قيد عكسي
                              </span>
                            )}
                            {entry.isReversed && (
                              <span className="mr-1 px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-text-muted">
                                معكوس
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-text-muted">
                            {Number(entry.unitCost).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {entry.totalCost.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-text-muted text-xs">
                            {entry.user.name}
                          </td>
                          <td className="px-4 py-3 text-text-muted text-xs max-w-xs truncate">
                            {entry.notes || "—"}
                          </td>
                          {canReverse && (
                            <td className="px-4 py-3">
                              {!entry.isReversal && !entry.isReversed && (
                                <button
                                  onClick={() => handleReverse(entry)}
                                  className="text-rose-500 hover:text-rose-700 transition-colors"
                                  title="عكس القيد">
                                  <span className="material-symbols-outlined text-xl">
                                    undo
                                  </span>
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Record write-off modal ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="تسجيل إهلاك">
        <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700 flex items-start gap-2">
          <span className="material-symbols-outlined text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0">
            warning
          </span>
          <p className="text-sm text-rose-800 dark:text-rose-300">
            سيتم خصم الكمية من مخزون الفرع وتحميل تكلفتها على تكلفة البضاعة
            المباعة في التقرير العام. لن يتم إنشاء أي مصروف ولن تتأثر الخزنة.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
          <div>
            <label className="block text-sm font-medium mb-1">الصنف</label>
            <div className="w-full bg-background-light/60 dark:bg-background-dark/60 border border-border-light dark:border-border-dark text-text-muted dark:text-text-dark rounded-lg p-2.5 font-semibold">
              {selectedItem?.name}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">المستودع *</label>
            <select
              value={formData.warehouseId}
              disabled={!isGlobalRole && visibleWarehouses.length <= 1}
              onChange={(e) =>
                setFormData({ ...formData, warehouseId: e.target.value })
              }
              className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg p-2.5 disabled:opacity-70 disabled:cursor-not-allowed"
              required>
              <option value="">اختر المستودع...</option>
              {visibleWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              الكمية * <span className="text-text-muted font-normal">
                (المتاح: {parseFloat(available.toFixed(4))} {selectedItem?.unit})
              </span>
            </label>
            <input
              type="number"
              step="0.0001"
              min="0.0001"
              value={formData.quantity}
              onChange={(e) =>
                setFormData({ ...formData, quantity: e.target.value })
              }
              className={`w-full bg-background-light dark:bg-background-dark border text-text-light dark:text-text-dark rounded-lg p-2.5 ${
                exceedsStock
                  ? "border-rose-500"
                  : "border-border-light dark:border-border-dark"
              }`}
              placeholder="0.0000"
              required
              autoFocus
            />
            {exceedsStock && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                الكمية أكبر من الرصيد المتاح في هذا المخزن.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">سبب الإهلاك *</label>
            <select
              value={formData.reason}
              onChange={(e) =>
                setFormData({ ...formData, reason: e.target.value })
              }
              className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg p-2.5"
              required>
              {reasons.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              تكلفة الوحدة *
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.unitCost}
              onChange={(e) =>
                setFormData({ ...formData, unitCost: e.target.value })
              }
              className={`w-full bg-background-light dark:bg-background-dark border text-text-light dark:text-text-dark rounded-lg p-2.5 ${
                missingCost
                  ? "border-rose-500"
                  : "border-border-light dark:border-border-dark"
              }`}
              placeholder="0.00"
              required
            />
            <p className="text-xs text-text-muted mt-1">
              مأخوذة من تكلفة الصنف الحالية. يمكن تعديلها لهذا القيد فقط —{" "}
              <strong>لن تُغيّر تكلفة الصنف</strong>.
            </p>
            {missingCost && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                لا توجد تكلفة مسجلة لهذا الصنف — أدخل تكلفة الوحدة يدويًا، وإلا
                لن تُحتسب أي تكلفة على الأرباح.
              </p>
            )}
          </div>

          {/* The P&L hit, shown before confirming. */}
          <div className="p-3 rounded-lg bg-background-light dark:bg-background-dark/50 border border-border-light dark:border-border-dark flex justify-between items-center">
            <span className="text-sm text-text-muted">
              الأثر على تكلفة البضاعة المباعة
            </span>
            <span className="font-bold text-rose-600 dark:text-rose-400">
              {cogsImpact.toLocaleString()} ج.م
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">التاريخ *</label>
            <input
              type="date"
              value={formData.date}
              max={today}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg p-2.5"
              required
            />
            {formData.date !== today && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                تاريخ سابق — سيتم تعديل أرباح تلك الفترة في التقرير العام.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">ملاحظات</label>
            <textarea
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
              className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg p-2.5"
              rows="3"
              placeholder="مثال: استهلاك مناديل خلال الشهر..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !canSubmit}
              className="flex-1 bg-rose-500 hover:bg-rose-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
              {isSubmitting ? (
                <span className="material-symbols-outlined animate-spin text-base">
                  progress_activity
                </span>
              ) : (
                <span className="material-symbols-outlined text-base">
                  delete_sweep
                </span>
              )}
              {isSubmitting ? "جاري الحفظ..." : "تأكيد الإهلاك"}
            </button>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-text-light dark:text-text-dark font-bold py-2.5 px-4 rounded-lg transition-colors">
              إلغاء
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default StockWriteOffTab;
