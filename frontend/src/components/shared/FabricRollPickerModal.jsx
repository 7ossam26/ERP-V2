/**
 * FabricRollPickerModal
 *
 * Props:
 *   isOpen        {boolean}
 *   onClose       {() => void}
 *   itemId        {number}
 *   warehouseId   {number}
 *   requestedLength {number}  — total meters required
 *   onPick        {(selection: [{rollId, rollNumber, allocated}]) => void}
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { fabricRollService } from "../../services/fabricRollService";
import toast from "react-hot-toast";

const SORT_OPTIONS = [
  { value: "shortest-first", label: "الأقصر أولاً" },
  { value: "longest-first",  label: "الأطول أولاً" },
  { value: "oldest",         label: "الأقدم أولاً" },
  { value: "newest",         label: "الأحدث أولاً" },
];

const LS_SORT_KEY = "fabricRollPicker_sort";

const FabricRollPickerModal = ({
  isOpen,
  onClose,
  itemId,
  warehouseId,
  requestedLength,
  onPick,
}) => {
  const [rolls, setRolls] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState(
    () => localStorage.getItem(LS_SORT_KEY) || "shortest-first"
  );
  const [barcodeInput, setBarcodeInput] = useState("");
  // allocation: { [rollId]: number }
  const [allocations, setAllocations] = useState({});
  const barcodeRef = useRef(null);

  const fetchRolls = useCallback(async () => {
    if (!itemId || !warehouseId) return;
    setLoading(true);
    try {
      const data = await fabricRollService.getPickable(itemId, warehouseId, sort);
      setRolls(data);
    } catch {
      toast.error("فشل تحميل اللفات المتاحة");
    } finally {
      setLoading(false);
    }
  }, [itemId, warehouseId, sort]);

  useEffect(() => {
    if (isOpen) {
      setAllocations({});
      setBarcodeInput("");
      fetchRolls();
    }
  }, [isOpen, fetchRolls]);

  const handleSortChange = (val) => {
    localStorage.setItem(LS_SORT_KEY, val);
    setSort(val);
  };

  // Barcode-scan: find roll and toggle-select it
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    const found = rolls.find(
      (r) => r.rollNumber === code || r.barcode === code
    );
    if (!found) {
      toast.error(`لا توجد لفة بهذا الرقم: ${code}`);
    } else {
      // Auto-allocate the roll's full remaining or the outstanding needed
      const already = Object.values(allocations).reduce((s, v) => s + v, 0);
      const outstanding = Math.max(0, (requestedLength || 0) - already);
      const suggest = Math.min(found.remainingLength, outstanding || found.remainingLength);
      setAllocations((prev) => ({ ...prev, [found.rollId]: suggest }));
    }
    setBarcodeInput("");
    barcodeRef.current?.focus();
  };

  const setAlloc = (rollId, value) => {
    const num = Math.max(0, Number(value));
    setAllocations((prev) => ({ ...prev, [rollId]: num }));
  };

  const clearAlloc = (rollId) => {
    setAllocations((prev) => {
      const next = { ...prev };
      delete next[rollId];
      return next;
    });
  };

  const totalAllocated = Object.values(allocations).reduce((s, v) => s + v, 0);
  const selectedRolls = rolls.filter((r) => (allocations[r.rollId] || 0) > 0);

  // Validation
  const validationErrors = [];
  for (const roll of selectedRolls) {
    const alloc = allocations[roll.rollId];
    if (alloc > roll.remainingLength) {
      validationErrors.push(
        `اللفة ${roll.rollNumber}: المخصص (${alloc.toFixed(2)}) يتجاوز المتبقي (${roll.remainingLength.toFixed(2)})`
      );
    }
    if (alloc <= 0) {
      validationErrors.push(`اللفة ${roll.rollNumber}: المخصص يجب أن يكون أكبر من صفر`);
    }
  }
  if (requestedLength && Math.abs(totalAllocated - requestedLength) > 0.001) {
    validationErrors.push(
      `إجمالي المخصص (${totalAllocated.toFixed(2)}) لا يساوي المطلوب (${requestedLength.toFixed(2)})`
    );
  }

  const canConfirm = selectedRolls.length > 0 && validationErrors.length === 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    const selection = selectedRolls.map((r) => ({
      rollId: r.rollId,
      rollNumber: r.rollNumber,
      allocated: allocations[r.rollId],
    }));
    onPick(selection);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      dir="rtl"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl border border-border-light dark:border-border-dark shadow-2xl w-full max-w-2xl mx-4 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-light dark:border-border-dark flex-shrink-0">
          <div>
            <h3 className="font-bold text-text-main dark:text-text-dark flex items-center gap-2">
              <span className="material-icons-round text-primary">content_cut</span>
              اختيار لفة
            </h3>
            {requestedLength && (
              <p className="text-xs text-gray-500 mt-0.5">
                المطلوب: <span className="font-bold text-text-main dark:text-text-dark">{requestedLength.toFixed(2)} م</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <span className="material-icons-round text-gray-400">close</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-border-light dark:border-border-dark flex-shrink-0 flex flex-wrap gap-3 items-center">
          {/* Barcode input */}
          <form onSubmit={handleBarcodeSubmit} className="flex gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-gray-400 text-[16px]">qr_code_scanner</span>
              </span>
              <input
                ref={barcodeRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="رقم اللفة أو الباركود..."
                className="w-full pr-9 pl-3 py-1.5 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm text-text-main dark:text-text-dark focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <button type="submit"
              className="px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              بحث
            </button>
          </form>

          {/* Sort */}
          <select
            value={sort}
            onChange={(e) => handleSortChange(e.target.value)}
            className="py-1.5 px-2 rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-sm text-text-main dark:text-text-dark focus:ring-1 focus:ring-primary outline-none">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Roll list */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className="material-icons-round animate-spin text-primary text-3xl">sync</span>
            </div>
          ) : rolls.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <span className="material-icons-round text-3xl mb-2 block">inventory_2</span>
              لا توجد لفات متاحة
            </div>
          ) : (
            <div className="space-y-2">
              {rolls.map((roll) => {
                const alloc = allocations[roll.rollId] || 0;
                const isSelected = alloc > 0;
                return (
                  <div
                    key={roll.rollId}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/5 dark:bg-primary/10"
                        : "border-border-light dark:border-border-dark hover:border-primary/40 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    }`}
                    onClick={() => {
                      if (isSelected) {
                        clearAlloc(roll.rollId);
                      } else {
                        // Suggest: fill the remaining needed
                        const already = Object.values(allocations).reduce((s, v) => s + v, 0);
                        const outstanding = Math.max(0, (requestedLength || 0) - already);
                        const suggest = outstanding > 0
                          ? Math.min(roll.remainingLength, outstanding)
                          : roll.remainingLength;
                        setAlloc(roll.rollId, suggest);
                      }
                    }}>
                    {/* Checkbox indicator */}
                    <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                      isSelected ? "bg-primary border-primary" : "border-gray-300 dark:border-gray-600"
                    }`}>
                      {isSelected && <span className="material-icons-round text-white text-[14px]">check</span>}
                    </div>

                    {/* Roll info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-sm text-text-main dark:text-text-dark">
                          {roll.rollNumber}
                        </span>
                        {roll.barcode && (
                          <span className="text-xs text-gray-400">{roll.barcode}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-500">
                          متبقي: <span className="font-bold text-green-600">{roll.remainingLength.toFixed(2)} م</span>
                        </span>
                        <span className="text-xs text-gray-400">{roll.warehouseName}</span>
                        {roll.lastCutAt && (
                          <span className="text-xs text-gray-400">
                            آخر قطع: {new Date(roll.lastCutAt).toLocaleDateString("ar-EG")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Allocation input */}
                    {isSelected && (
                      <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={roll.remainingLength}
                          value={alloc}
                          onChange={(e) => setAlloc(roll.rollId, e.target.value)}
                          className="w-20 px-2 py-1 text-sm rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark text-text-main dark:text-text-dark focus:ring-1 focus:ring-primary outline-none text-center"
                        />
                        <span className="text-xs text-gray-500">م</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); clearAlloc(roll.rollId); }}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                          <span className="material-icons-round text-[14px]">close</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Summary + Errors */}
        <div className="px-5 py-3 border-t border-border-light dark:border-border-dark flex-shrink-0">
          {/* Allocation summary */}
          <div className="flex items-center justify-between mb-2 text-sm">
            <span className="text-gray-500">
              {selectedRolls.length} لفة مختارة
            </span>
            <span className={`font-bold ${
              requestedLength && Math.abs(totalAllocated - requestedLength) < 0.001
                ? "text-green-600"
                : "text-text-main dark:text-text-dark"
            }`}>
              إجمالي: {totalAllocated.toFixed(2)} م
              {requestedLength && ` / ${requestedLength.toFixed(2)} م`}
            </span>
          </div>

          {validationErrors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-2 mb-3">
              {validationErrors.map((e, i) => (
                <p key={i} className="text-xs text-red-600 dark:text-red-400">{e}</p>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button onClick={onClose}
              className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm transition-colors">
              إلغاء
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="px-5 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40">
              تأكيد الاختيار
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FabricRollPickerModal;
