import React, { useState, useEffect, useMemo } from "react";
import toast from "react-hot-toast";
import Modal from "../../components/ui/Modal";
import { initialInventoryService } from "../../services/initialInventoryService";
import { warehouseService } from "../../services/warehouseService";
import { branchService } from "../../services/branchService";
import AuthService from "../../services/authService";
import { useBranch } from "../../contexts/BranchContext";

const InitialInventoryTab = () => {
  const { activeBranch, isGlobalRole } = useBranch();
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [entries, setEntries] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const [formData, setFormData] = useState({
    warehouseId: "",
    quantity: "",
    unitCost: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // BOM (manufactured) opening-production state
  const [bomRecipe, setBomRecipe] = useState(null); // { outputQuantity, components[] }
  const [componentCosts, setComponentCosts] = useState({}); // itemId -> cost string
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false);

  const isBomItem = !!selectedItem?.isBom;

  const currentUser = AuthService.getCurrentUser();
  const canDelete =
    currentUser?.role === "Superadmin" || currentUser?.role === "Admin";

  // Load warehouses and branches once on mount
  useEffect(() => {
    const init = async () => {
      try {
        const [warehousesData, branchesData] = await Promise.all([
          warehouseService.getAll(),
          branchService.getAll(),
        ]);
        setWarehouses(warehousesData);
        setBranches(branchesData);
      } catch (error) {
        console.error("Failed to load warehouses/branches:", error);
        toast.error("فشل تحميل البيانات");
      }
    };
    init();
  }, []);

  // Non-global users are pinned to their active branch's warehouse — they
  // should never be able to filter or post opening balances to another branch.
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

  // Default the filter to the active branch's warehouse (non-global) or the
  // first available branch (global). Re-runs when branches load or the
  // active branch changes (e.g. user switches branch from the top-bar picker).
  useEffect(() => {
    if (branches.length === 0) return;
    if (!isGlobalRole && activeBranch?.warehouseId) {
      setSelectedWarehouseId(activeBranch.warehouseId);
    } else if (isGlobalRole && !selectedWarehouseId) {
      setSelectedWarehouseId(branches[0].warehouseId);
    }
  }, [branches, isGlobalRole, activeBranch?.warehouseId]);

  // Fetch items whenever the warehouse filter changes (skips initial null state)
  useEffect(() => {
    if (selectedWarehouseId === "") return;
    const fetchItems = async () => {
      try {
        setIsLoading(true);
        const itemsData =
          await initialInventoryService.getAll(selectedWarehouseId);
        setItems(itemsData);
        if (selectedItem) {
          const updated = itemsData.find((i) => i.id === selectedItem.id);
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

  const handleItemClick = async (item) => {
    setSelectedItem(item);
    setIsLoadingEntries(true);
    try {
      const data = await initialInventoryService.getByItem(item.id);
      setEntries(data.entries);
    } catch (error) {
      console.error("Failed to load item entries:", error);
      toast.error("فشل تحميل سجل الكميات");
    } finally {
      setIsLoadingEntries(false);
    }
  };

  const handleOpenModal = async () => {
    if (!selectedItem) return;
    setFormData({
      warehouseId: selectedWarehouseId || (warehouses[0]?.id ?? ""),
      quantity: "",
      unitCost: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setBomRecipe(null);
    setComponentCosts({});
    setIsModalOpen(true);

    // For manufactured (BOM) items, load the recipe so the user can enter a
    // purchase cost per raw material (prefilled with each component's cost).
    if (selectedItem.isBom) {
      setIsLoadingRecipe(true);
      try {
        const recipe = await initialInventoryService.getBomExplosion(
          selectedItem.id,
        );
        setBomRecipe(recipe);
        const prefilled = {};
        recipe.components.forEach((c) => {
          prefilled[c.itemId] = c.costPrice ? String(c.costPrice) : "";
        });
        setComponentCosts(prefilled);
      } catch (error) {
        console.error("Failed to load BOM recipe:", error);
        toast.error("فشل تحميل مكونات الصنف المصنّع");
      } finally {
        setIsLoadingRecipe(false);
      }
    }
  };

  // Raw-material quantity needed for the entered finished quantity.
  const componentNeedQty = (component) => {
    const qty = Number(formData.quantity) || 0;
    const outputQty = Number(bomRecipe?.outputQuantity) || 1;
    return (Number(component.quantityPerBatch) * qty) / outputQty;
  };

  // Derived finished unit cost = Σ(component cost × needQty) / finished qty.
  const bomFinishedUnitCost = useMemo(() => {
    if (!bomRecipe) return 0;
    const qty = Number(formData.quantity) || 0;
    if (qty <= 0) return 0;
    const total = bomRecipe.components.reduce((sum, c) => {
      const cost = Number(componentCosts[c.itemId]) || 0;
      return sum + cost * componentNeedQty(c);
    }, 0);
    return total / qty;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bomRecipe, componentCosts, formData.quantity]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.quantity || Number(formData.quantity) <= 0) {
      toast.error("يرجى إدخال كمية صحيحة");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isBomItem) {
        // Opening production: seed raw materials at cost, then produce the good.
        await initialInventoryService.addBom({
          outputItemId: selectedItem.id,
          warehouseId: parseInt(formData.warehouseId),
          quantity: Number(formData.quantity),
          date: formData.date,
          notes: formData.notes,
          components: (bomRecipe?.components || []).map((c) => ({
            itemId: c.itemId,
            unitCost:
              componentCosts[c.itemId] === "" ||
              componentCosts[c.itemId] === undefined
                ? null
                : Number(componentCosts[c.itemId]),
          })),
        });
      } else {
        await initialInventoryService.add({
          itemId: selectedItem.id,
          warehouseId: parseInt(formData.warehouseId),
          quantity: Number(formData.quantity),
          unitCost:
            formData.unitCost === "" ? null : Number(formData.unitCost),
          date: formData.date,
          notes: formData.notes,
        });
      }

      toast.success("تم إضافة الكمية الافتتاحية بنجاح");
      setIsModalOpen(false);

      // Refresh both lists
      const [itemsData, entriesData] = await Promise.all([
        initialInventoryService.getAll(selectedWarehouseId),
        initialInventoryService.getByItem(selectedItem.id),
      ]);
      setItems(itemsData);
      setEntries(entriesData.entries);

      // Update selected item total
      const updated = itemsData.find((i) => i.id === selectedItem.id);
      if (updated) setSelectedItem(updated);
    } catch (error) {
      console.error("Failed to add initial inventory:", error);
      toast.error(error.message || "فشل إضافة الكمية");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (entryId) => {
    if (
      !window.confirm(
        "هل أنت متأكد من حذف هذا القيد؟ سيتم عكس الكمية من المخزون.",
      )
    ) {
      return;
    }

    try {
      await initialInventoryService.delete(entryId);
      toast.success("تم حذف القيد وعكس الكمية");

      const [itemsData, entriesData] = await Promise.all([
        initialInventoryService.getAll(selectedWarehouseId),
        initialInventoryService.getByItem(selectedItem.id),
      ]);
      setItems(itemsData);
      setEntries(entriesData.entries);

      const updated = itemsData.find((i) => i.id === selectedItem.id);
      if (updated) setSelectedItem(updated);
    } catch (error) {
      console.error("Failed to delete entry:", error);
      toast.error(error.message || "فشل حذف القيد");
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── Left panel: product list ── */}
      <div className="lg:col-span-1 bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
        <div className="p-4 bg-background-light dark:bg-background-dark/50 border-b border-border-light dark:border-border-dark">
          <h3 className="font-bold text-text-light dark:text-text-dark flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-primary">
              inventory_2
            </span>
            الأصناف ({filteredItems.length})
          </h3>

          {/* Branch filter */}
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
                    ? "bg-primary/10 dark:bg-primary/20"
                    : "hover:bg-background-light dark:hover:bg-background-dark/50"
                }`}>
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-text-light dark:text-text-dark text-sm">
                      {item.name}
                    </h4>
                    {item.entriesCount > 0 && (
                      <span className="text-xs text-primary mt-0.5 inline-block">
                        {item.entriesCount} قيد افتتاحي
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-bold text-text-light dark:text-text-dark">
                    {Number(item.totalQuantity).toFixed(2)}
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
              اختر صنفًا لعرض التفاصيل
            </p>
          </div>
        ) : (
          <>
            {/* Item info + action */}
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
                      {Number(selectedItem.totalQuantity).toFixed(2)}{" "}
                      {selectedItem.unit}
                    </span>
                  </p>
                </div>
              </div>

              <button
                onClick={handleOpenModal}
                className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm">
                <span className="material-symbols-outlined">add_circle</span>
                إضافة كمية افتتاحية
              </button>
            </div>

            {/* History table */}
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
              <div className="p-4 bg-background-light dark:bg-background-dark/50 border-b border-border-light dark:border-border-dark">
                <h3 className="font-bold text-text-light dark:text-text-dark flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    history
                  </span>
                  سجل الكميات الافتتاحية ({entries.length})
                </h3>
              </div>

              {isLoadingEntries ? (
                <div className="p-8 text-center text-text-muted">
                  <span className="material-symbols-outlined animate-spin text-3xl">
                    progress_activity
                  </span>
                </div>
              ) : entries.length === 0 ? (
                <div className="p-8 text-center text-text-muted">
                  لا يوجد قيود افتتاحية لهذا الصنف
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm whitespace-nowrap" dir="rtl">
                    <thead className="text-xs uppercase bg-accent/20 dark:bg-surface-dark/80">
                      <tr>
                        <th className="px-4 py-3 text-right">التاريخ</th>
                        <th className="px-4 py-3 text-right">المستودع</th>
                        <th className="px-4 py-3 text-right">الكمية</th>
                        <th className="px-4 py-3 text-right">التكلفة</th>
                        <th className="px-4 py-3 text-right">بواسطة</th>
                        <th className="px-4 py-3 text-right">ملاحظات</th>
                        {canDelete && <th className="px-4 py-3"></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-b border-border-light dark:border-border-dark hover:bg-background-light dark:hover:bg-background-dark/50">
                          <td className="px-4 py-3 text-text-muted">
                            {formatDate(entry.date)}
                          </td>
                          <td className="px-4 py-3 font-medium">
                            {entry.warehouse.name}
                          </td>
                          <td className="px-4 py-3 font-bold text-amber-600 dark:text-amber-400">
                            +{Number(entry.quantity).toFixed(2)}{" "}
                            {selectedItem.unit}
                          </td>
                          <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                            {entry.unitCost != null
                              ? Number(entry.unitCost).toFixed(2)
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-text-muted text-xs">
                            {entry.user.name}
                          </td>
                          <td className="px-4 py-3 text-text-muted text-xs max-w-xs truncate">
                            {entry.notes || "—"}
                          </td>
                          {canDelete && (
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleDelete(entry.id)}
                                className="text-red-500 hover:text-red-700 transition-colors"
                                title="حذف القيد">
                                <span className="material-symbols-outlined text-xl">
                                  delete
                                </span>
                              </button>
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

      {/* ── Add Initial Quantity Modal ── */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="إضافة كمية افتتاحية">
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 flex items-start gap-2">
          <span className="material-symbols-outlined text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0">
            info
          </span>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {isBomItem
              ? "هذا صنف مصنّع (BOM). سيتم إضافة المواد الخام بالتكلفة ثم إنتاج الكمية النهائية تلقائياً، بحيث يُقيَّم الرصيد بتكلفة المكونات."
              : "هذا الخيار لتسجيل كميات سابقة لنظام ERP. ستُضاف الكمية للمخزون الحالي."}
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
            <label className="block text-sm font-medium mb-1">الكمية *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={formData.quantity}
              onChange={(e) =>
                setFormData({ ...formData, quantity: e.target.value })
              }
              className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg p-2.5"
              placeholder="0.00"
              required
              autoFocus
            />
            {isBomItem && (
              <p className="text-xs text-text-muted mt-1">
                الكمية المصنّعة النهائية — سيتم حساب المواد الخام تلقائياً من
                مكونات الصنف.
              </p>
            )}
          </div>

          {/* Plain item: single purchase cost */}
          {!isBomItem && (
            <div>
              <label className="block text-sm font-medium mb-1">
                سعر الشراء (تكلفة الوحدة)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.unitCost}
                onChange={(e) =>
                  setFormData({ ...formData, unitCost: e.target.value })
                }
                className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg p-2.5"
                placeholder="0.00"
              />
              <p className="text-xs text-text-muted mt-1">
                تُستخدم لتقييم المخزون وحساب الأرباح. ستحل محل تكلفة الصنف
                الحالية.
              </p>
            </div>
          )}

          {/* BOM item: raw materials with a purchase cost each */}
          {isBomItem && (
            <div className="rounded-lg border border-border-light dark:border-border-dark overflow-hidden">
              <div className="px-3 py-2 bg-background-light dark:bg-background-dark/50 text-sm font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-base">
                  category
                </span>
                المواد الخام المطلوبة وتكلفتها
              </div>
              {isLoadingRecipe ? (
                <div className="p-6 text-center text-text-muted">
                  <span className="material-symbols-outlined animate-spin text-2xl">
                    progress_activity
                  </span>
                </div>
              ) : !bomRecipe || bomRecipe.components.length === 0 ? (
                <div className="p-4 text-center text-text-muted text-sm">
                  لا توجد مكونات لهذا الصنف
                </div>
              ) : (
                <>
                  <table className="w-full text-sm" dir="rtl">
                    <thead className="text-xs bg-accent/20 dark:bg-surface-dark/80">
                      <tr>
                        <th className="px-3 py-2 text-right">المادة</th>
                        <th className="px-3 py-2 text-right">الكمية</th>
                        <th className="px-3 py-2 text-right">تكلفة الوحدة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bomRecipe.components.map((c) => (
                        <tr
                          key={c.itemId}
                          className="border-t border-border-light dark:border-border-dark">
                          <td className="px-3 py-2 font-medium">{c.name}</td>
                          <td className="px-3 py-2 text-text-muted whitespace-nowrap">
                            {componentNeedQty(c).toFixed(3)} {c.unit}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={componentCosts[c.itemId] ?? ""}
                              onChange={(e) =>
                                setComponentCosts((prev) => ({
                                  ...prev,
                                  [c.itemId]: e.target.value,
                                }))
                              }
                              className="w-28 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-lg p-1.5 text-sm"
                              placeholder="0.00"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 bg-background-light dark:bg-background-dark/50 text-sm flex justify-between border-t border-border-light dark:border-border-dark">
                    <span className="text-text-muted">
                      تكلفة الوحدة المصنّعة (محسوبة)
                    </span>
                    <span className="font-bold text-primary">
                      {bomFinishedUnitCost.toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">التاريخ *</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg p-2.5"
              required
            />
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
              placeholder="مثال: كميات متراكمة قبل بدء استخدام النظام..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2">
              {isSubmitting ? (
                <span className="material-symbols-outlined animate-spin text-base">
                  progress_activity
                </span>
              ) : (
                <span className="material-symbols-outlined text-base">
                  add_circle
                </span>
              )}
              {isSubmitting ? "جاري الحفظ..." : "تأكيد وإضافة الكمية"}
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

export default InitialInventoryTab;
