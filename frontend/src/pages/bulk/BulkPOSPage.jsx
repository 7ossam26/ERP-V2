import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { itemService } from "../../services/itemService";
import { settingsService } from "../../services/settingsService";
import { inventoryService } from "../../services/inventoryService";
import { formatEGP, splitInclusive } from "../../utils/bulkMoney";
import BulkConfirmOrderModal from "../../components/bulk/BulkConfirmOrderModal";
import BulkCreditBadge from "../../components/bulk/BulkCreditBadge";
import BulkSectionTabs from "../../components/bulk/BulkSectionTabs";
import { useBranch } from "../../contexts/BranchContext";


const PIECE_UNITS = new Set(["piece", "قطعة", "pcs", "unit", "وحدة", "علبة", "box", "carton"]);
const isPiece = (unit) => PIECE_UNITS.has((unit || "").toLowerCase());

export default function BulkPOSPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCustomerId = searchParams.get("customerId");

  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [contractPrices, setContractPrices] = useState(new Map());
  // null until the inventory response lands. An empty Map here would be
  // indistinguishable from "everything is at zero", which paints the whole
  // catalog as نفد and disabled on the first paint after a branch resolves.
  const [stock, setStock] = useState(null); // itemId → onHand qty
  const [stockLoading, setStockLoading] = useState(false);

  const [customerId, setCustomerId] = useState(initialCustomerId ? Number(initialCustomerId) : null);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [taxRate, setTaxRate] = useState(0.14);

  // The warehouse always follows the active branch — it is never chosen by hand.
  // Employees are assigned to a single branch, so BranchContext resolves it for
  // them automatically and there is nothing to pick. The backend derives the
  // warehouse the same way and ignores any client-sent warehouseId, so this is
  // display/stock-lookup only, not a trust boundary.
  const { activeBranch } = useBranch();
  const warehouseId = activeBranch?.warehouseId ?? null;

  // Initial load: customers, base items, settings
  useEffect(() => {
    (async () => {
      // allSettled, not all: a failing settings call used to blank the customer
      // and item lists too, leaving a page with nothing to click and no clue why.
      const [cs, its, cfg] = await Promise.allSettled([
        bulkService.listCustomers({ active: true }),
        itemService.getAll(),
        settingsService.get(),
      ]);
      if (cs.status === "fulfilled") setCustomers(cs.value || []);
      if (its.status === "fulfilled") setItems(its.value || []);
      if (cfg.status === "fulfilled" && cfg.value?.taxRate != null) {
        setTaxRate(Number(cfg.value.taxRate) / 100);
      }
      setCatalogLoading(false);

      const failed = [
        cs.status === "rejected" && "العملاء",
        its.status === "rejected" && "الأصناف",
        cfg.status === "rejected" && "الإعدادات",
      ].filter(Boolean);
      if (failed.length) toast.error(`تعذر تحميل: ${failed.join("، ")}`);
    })();
  }, []);

  // Fetch warehouse stock when warehouse changes
  useEffect(() => {
    if (!warehouseId) {
      setStock(null);
      return;
    }
    let cancelled = false;
    setStockLoading(true);
    inventoryService.getInventory({ warehouseId }).then((data) => {
      if (cancelled) return;
      const map = new Map(data.map((it) => [it.id, Number(it.quantity ?? 0)]));
      setStock(map);
    }).catch(() => {
      if (!cancelled) toast.error("تعذر تحميل أرصدة المخزون");
    }).finally(() => {
      if (!cancelled) setStockLoading(false);
    });
    return () => { cancelled = true; };
  }, [warehouseId]);

  // Fetch contract prices when customer changes
  useEffect(() => {
    if (!customerId) {
      setContractPrices(new Map());
      return;
    }
    (async () => {
      try {
        const prices = await bulkService.listPrices(customerId);
        setContractPrices(new Map(prices.map((p) => [p.itemId, Number(p.price)])));
      } catch (err) {
        toast.error("تعذر تحميل أسعار العقد");
      }
    })();
  }, [customerId]);

  const customer = customers.find((c) => c.id === customerId) || null;

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const s = search.trim().toLowerCase();
    return items.filter((i) => (i.name || "").toLowerCase().includes(s));
  }, [items, search]);

  // Infinity means "no known constraint": either no warehouse is in play, or the
  // balances haven't arrived yet. Nothing can be spent against an unknown balance
  // because every action is gated on stockReady below.
  const stockReady = stock !== null;
  const getOnHand = (itemId) => (warehouseId && stock ? (stock.get(itemId) ?? 0) : Infinity);

  const addToCart = (item) => {
    const overridePrice = contractPrices.get(item.id);
    const unitPrice = overridePrice != null ? overridePrice : Number(item.price);
    const onHand = getOnHand(item.id);
    const step = isPiece(item.unit) ? 1 : 0.01;

    setCart((c) => {
      const existing = c.find((l) => l.itemId === item.id);
      const newQty = existing ? existing.quantity + step : step;
      if (newQty > onHand) {
        toast.error(`${item.name}: الكمية المتاحة ${onHand} ${item.unit || ""}`);
        return c;
      }
      if (existing) {
        return c.map((l) => l.itemId === item.id ? { ...l, quantity: newQty } : l);
      }
      return [
        ...c,
        { itemId: item.id, name: item.name, unit: item.unit, quantity: step, unitPrice, source: overridePrice != null ? "CONTRACT" : "BASE" },
      ];
    });
  };

  const updateLine = (itemId, patch) => {
    if ("quantity" in patch) {
      const qty = Number(patch.quantity);
      const onHand = getOnHand(itemId);
      if (qty > onHand) {
        toast.error(`الكمية المتاحة في المخزون ${onHand}`);
      }
    }
    setCart((c) => c.map((l) => (l.itemId === itemId ? { ...l, ...patch } : l)));
  };

  const removeLine = (itemId) => setCart((c) => c.filter((l) => l.itemId !== itemId));

  // Validate all cart lines before submitting
  const validateCart = () => {
    for (const l of cart) {
      const qty = Number(l.quantity);
      const price = Number(l.unitPrice);
      if (!Number.isFinite(qty) || qty <= 0) {
        toast.error(`${l.name}: أدخل كمية صحيحة`);
        return false;
      }
      if (!Number.isFinite(price) || price < 0) {
        toast.error(`${l.name}: أدخل سعرًا صحيحًا`);
        return false;
      }
      const onHand = getOnHand(l.itemId);
      if (qty > onHand) {
        toast.error(`${l.name}: الكمية المطلوبة ${qty} تتجاوز المتاح ${onHand}`);
        return false;
      }
    }
    return true;
  };

  const subtotalInclusive = cart.reduce(
    (acc, l) => acc + Number(l.quantity) * Number(l.unitPrice),
    0,
  );
  const totals = splitInclusive(subtotalInclusive, taxRate);

  const canSubmit = customerId && warehouseId && stockReady && cart.length > 0 && !submitting;

  // No warehouseId: the backend derives it from the operator's branch and
  // ignores anything the client sends.
  const buildOrderPayload = (status = "DRAFT") => ({
    customerId,
    status,
    taxRate, // send the settings-derived tax rate so backend stores it correctly
    items: cart.map((l) => ({
      itemId: l.itemId,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
    })),
  });

  const saveDraft = async () => {
    if (!canSubmit || !validateCart()) return;
    setSubmitting(true);
    try {
      const created = await bulkService.createOrder(buildOrderPayload("DRAFT"));
      toast.success("تم حفظ الطلب كمسودة");
      navigate(`/bulk/orders/${created.id}`);
    } catch (err) {
      toast.error(err?.data?.error || "تعذر الحفظ");
    } finally {
      setSubmitting(false);
    }
  };

  const saveQuote = async () => {
    if (!canSubmit || !validateCart()) return;
    setSubmitting(true);
    try {
      const created = await bulkService.createOrder(buildOrderPayload("QUOTED"));
      toast.success("تم الحفظ كعرض سعر");
      navigate(`/bulk/orders/${created.id}`);
    } catch (err) {
      toast.error(err?.data?.error || "تعذر الحفظ");
    } finally {
      setSubmitting(false);
    }
  };

  const openConfirmModal = () => {
    if (!canSubmit || !validateCart()) return;
    setShowConfirmModal(true);
  };

  const handleConfirm = async (confirmBody) => {
    setSubmitting(true);
    try {
      const created = await bulkService.createOrder(buildOrderPayload("DRAFT"));
      await bulkService.confirmOrder(created.id, confirmBody);
      toast.success("تم تأكيد الطلب");
      navigate(`/bulk/orders/${created.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3 sm:p-4" dir="rtl">
      {showConfirmModal && (
        <BulkConfirmOrderModal
          totalAmount={totals.total}
          customerName={customer?.companyName || ""}
          onConfirm={handleConfirm}
          onClose={() => setShowConfirmModal(false)}
        />
      )}

      {/* Page header */}
      <div className="mb-3">
        <h1 className="text-2xl font-bold text-text-light dark:text-text-dark">الجملة</h1>
        <div className="h-1 w-16 bg-primary rounded-full mt-1 mb-3 opacity-80" />
        <BulkSectionTabs />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Catalog */}
        <div className="lg:col-span-2 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-soft dark:shadow-soft-dark p-3">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <select
              className="border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark min-w-[220px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
              value={customerId || ""}
              onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">اختر العميل...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.companyName}</option>
              ))}
            </select>
            <input
              type="search"
              placeholder="بحث صنف..."
              className="border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark flex-1 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {customer && (
            <div className="mb-2">
              <BulkCreditBadge customer={customer} />
            </div>
          )}

          {/* A global role sitting on "كل الفروع" has no single warehouse, so every
              card below is disabled. Say so instead of leaving a dead grid. */}
          {!warehouseId && (
            <div className="mb-2 rounded-lg border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              اختر فرعًا محددًا من أعلى الصفحة لبدء البيع — لا يمكن تحديد المخزن في وضع "كل الفروع".
            </div>
          )}

          {stockLoading && (
            <div className="text-xs text-text-light/40 dark:text-text-dark/40 mb-2">جارٍ تحميل الأرصدة...</div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[70vh] overflow-y-auto">
            {catalogLoading && (
              <div className="col-span-full text-center text-sm text-text-light/40 dark:text-text-dark/40 p-6">
                جارٍ تحميل الأصناف...
              </div>
            )}
            {!catalogLoading && filteredItems.length === 0 && (
              <div className="col-span-full text-center text-sm text-text-light/40 dark:text-text-dark/40 p-6">
                لا توجد أصناف
              </div>
            )}
            {filteredItems.map((it) => {
              const overridden = contractPrices.has(it.id);
              const price = overridden ? contractPrices.get(it.id) : Number(it.price);
              // null while balances are unknown — never render that as zero/نفد
              const onHand = warehouseId && stock ? (stock.get(it.id) ?? 0) : null;
              const outOfStock = onHand !== null && onHand <= 0;
              return (
                <button
                  key={it.id}
                  disabled={!customerId || !warehouseId || !stockReady || outOfStock}
                  onClick={() => addToCart(it)}
                  className={`text-right border rounded-xl p-2.5 transition-colors duration-200 ${
                    outOfStock
                      ? "border-border-light dark:border-border-dark bg-surface-light/50 dark:bg-surface-dark/50 opacity-50 cursor-not-allowed"
                      : "border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
                >
                  <div className="font-medium text-sm line-clamp-2 text-text-light dark:text-text-dark">{it.name}</div>
                  <div className="text-xs text-text-light/50 dark:text-text-dark/50">{it.unit}</div>
                  <div className="mt-1 font-bold text-text-light dark:text-text-dark">{formatEGP(price)}</div>
                  <div className="flex flex-wrap items-center gap-1 mt-0.5">
                    {overridden && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                        سعر عقد
                      </span>
                    )}
                    {onHand !== null && (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                        outOfStock
                          ? "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                          : onHand <= 10
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                      }`}>
                        {outOfStock ? "نفد" : `${onHand}`}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cart */}
        <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-soft dark:shadow-soft-dark p-3 flex flex-col">
          <h2 className="font-bold mb-2 text-text-light dark:text-text-dark">السلة</h2>
          <div className="flex-1 overflow-y-auto max-h-[55vh]">
            {cart.length === 0 && (
              <div className="text-center text-text-light/40 dark:text-text-dark/40 text-sm p-6">السلة فارغة</div>
            )}
            {cart.map((l) => {
              const onHand = getOnHand(l.itemId);
              const qty = Number(l.quantity);
              const overStock = qty > onHand;
              const step = isPiece(l.unit) ? 1 : 0.01;
              const minQty = isPiece(l.unit) ? 1 : 0.01;
              return (
                <div key={l.itemId} className="border-b border-border-light dark:border-border-dark py-2">
                  <div className="flex justify-between items-start">
                    <div className="text-sm font-medium text-text-light dark:text-text-dark">{l.name}</div>
                    <button
                      className="text-red-600 text-xs hover:text-red-700 transition-colors"
                      onClick={() => removeLine(l.itemId)}
                    >
                      حذف
                    </button>
                  </div>
                  {overStock && (
                    <div className="text-[11px] text-red-500 mb-1">⚠ المتاح {onHand} {l.unit}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step={step}
                      min={minQty}
                      max={onHand === Infinity ? undefined : onHand}
                      className={`border rounded-lg p-1 w-20 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                        overStock ? "border-red-400" : "border-border-light dark:border-border-dark"
                      }`}
                      value={l.quantity}
                      onChange={(e) => updateLine(l.itemId, { quantity: e.target.value })}
                    />
                    <span className="text-xs text-text-light/50">×</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="border border-border-light dark:border-border-dark rounded-lg p-1 w-24 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={l.unitPrice}
                      onChange={(e) => updateLine(l.itemId, { unitPrice: e.target.value })}
                    />
                    <span className="ms-auto font-semibold text-sm text-text-light dark:text-text-dark">
                      {formatEGP(qty * Number(l.unitPrice))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="mt-3 bg-accent/20 dark:bg-primary/10 rounded-xl p-3 space-y-1 text-sm">
            <Row label="الصافي" value={formatEGP(totals.net)} />
            <Row label={`الضريبة (${(taxRate * 100).toFixed(0)}%)`} value={formatEGP(totals.tax)} />
            <Row label="الإجمالي شامل الضريبة" value={formatEGP(totals.total)} bold />
          </div>

          {/* Actions */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              disabled={!canSubmit}
              onClick={saveDraft}
              className="border border-primary/30 text-primary hover:bg-primary/5 rounded-xl p-2 disabled:opacity-50 text-sm transition-colors duration-200"
            >
              مسودة
            </button>
            <button
              disabled={!canSubmit}
              onClick={saveQuote}
              className="border border-amber-400/60 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl p-2 disabled:opacity-50 text-sm transition-colors duration-200"
            >
              عرض سعر
            </button>
            <button
              disabled={!canSubmit}
              onClick={openConfirmModal}
              className="bg-primary hover:bg-primary-hover text-white rounded-xl p-2 disabled:opacity-50 text-sm transition-colors duration-200"
            >
              {submitting ? "..." : "تأكيد"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-base text-primary dark:text-accent" : "text-text-light/70 dark:text-text-dark/70"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
