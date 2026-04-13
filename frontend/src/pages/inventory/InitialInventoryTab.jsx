import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Modal from "../../components/ui/Modal";
import { initialInventoryService } from "../../services/initialInventoryService";
import { warehouseService } from "../../services/warehouseService";
import { branchService } from "../../services/branchService";
import AuthService from "../../services/authService";

const InitialInventoryTab = () => {
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
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

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
        if (branchesData.length > 0) {
          setSelectedWarehouseId(branchesData[0].warehouseId);
        }
        if (warehousesData.length > 0) {
          setFormData((prev) => ({
            ...prev,
            warehouseId: warehousesData[0].id,
          }));
        }
      } catch (error) {
        console.error("Failed to load warehouses/branches:", error);
        toast.error("فشل تحميل البيانات");
      }
    };
    init();
  }, []);

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

  const handleOpenModal = () => {
    if (!selectedItem) return;
    setFormData({
      warehouseId: warehouses.length > 0 ? warehouses[0].id : "",
      quantity: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.quantity || Number(formData.quantity) <= 0) {
      toast.error("يرجى إدخال كمية صحيحة");
      return;
    }

    setIsSubmitting(true);
    try {
      await initialInventoryService.add({
        itemId: selectedItem.id,
        warehouseId: parseInt(formData.warehouseId),
        quantity: Number(formData.quantity),
        date: formData.date,
        notes: formData.notes,
      });

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
              onChange={(e) => {
                setSelectedWarehouseId(e.target.value);
                setSelectedItem(null);
                setEntries([]);
              }}
              className="w-full appearance-none bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg px-3 py-2 text-sm pr-8">
              {branches.map((branch) => (
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
            هذا الخيار لتسجيل كميات سابقة لنظام ERP. ستُضاف الكمية للمخزون
            الحالي.
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
              onChange={(e) =>
                setFormData({ ...formData, warehouseId: e.target.value })
              }
              className="w-full bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-text-dark rounded-lg p-2.5"
              required>
              <option value="">اختر المستودع...</option>
              {warehouses.map((w) => (
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
          </div>

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
