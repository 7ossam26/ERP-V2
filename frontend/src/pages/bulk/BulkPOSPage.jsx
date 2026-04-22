import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { itemService } from "../../services/itemService";
import { warehouseService } from "../../services/warehouseService";
import { settingsService } from "../../services/settingsService";
import { formatEGP, splitInclusive } from "../../utils/bulkMoney";
import BulkPaymentModal from "../../components/bulk/BulkPaymentModal";
import BulkCreditBadge from "../../components/bulk/BulkCreditBadge";
import BulkSectionTabs from "../../components/bulk/BulkSectionTabs";

const ERROR_LABELS = {
  INSUFFICIENT_STOCK: "الكمية غير متاحة في المخزون",
  CREDIT_LIMIT_EXCEEDED: "تم تجاوز حد الائتمان",
  TAX_INVOICE_NOT_AVAILABLE_IN_PHASE_1: "الفوترة الضريبية غير متاحة حاليًا",
};

function formatConfirmError(err) {
  const code = err?.data?.error;
  if (code === "INSUFFICIENT_STOCK" && Array.isArray(err?.data?.details)) {
    const lines = err.data.details
      .map((d) => `• ${d.itemName}: مطلوب ${d.requested}، متاح ${d.available}`)
      .join("\n");
    return `الكمية غير متاحة في المخزون:\n${lines}`;
  }
  if (code === "CREDIT_LIMIT_EXCEEDED") {
    return `تم تجاوز حد الائتمان (مفتوح: ${formatEGP(err.data?.open)}، الحد: ${formatEGP(err.data?.limit)})`;
  }
  return ERROR_LABELS[code] || code || "تعذر التأكيد";
}

export default function BulkPOSPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCustomerId = searchParams.get("customerId");

  const [customers, setCustomers] = useState([]);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [contractPrices, setContractPrices] = useState(new Map());

  const [customerId, setCustomerId] = useState(initialCustomerId ? Number(initialCustomerId) : null);
  const [warehouseId, setWarehouseId] = useState(null);
  const [cart, setCart] = useState([]);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [taxRate, setTaxRate] = useState(0.14);

  useEffect(() => {
    (async () => {
      try {
        const [cs, its, whs, cfg] = await Promise.all([
          bulkService.listCustomers({ active: true }),
          itemService.getAll(),
          warehouseService.getAll(),
          settingsService.get(),
        ]);
        setCustomers(cs);
        setItems(its);
        setWarehouses(whs);
        if (cfg?.taxRate != null) setTaxRate(Number(cfg.taxRate) / 100);
      } catch (err) {
        toast.error(err?.data?.error || "تعذر تحميل البيانات");
      }
    })();
  }, []);

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

  const addToCart = (item) => {
    const overridePrice = contractPrices.get(item.id);
    const unitPrice = overridePrice != null ? overridePrice : Number(item.price);
    setCart((c) => {
      const existing = c.find((l) => l.itemId === item.id);
      if (existing) {
        return c.map((l) =>
          l.itemId === item.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...c,
        {
          itemId: item.id,
          name: item.name,
          unit: item.unit,
          quantity: 1,
          unitPrice,
          source: overridePrice != null ? "CONTRACT" : "BASE",
        },
      ];
    });
  };

  const updateLine = (itemId, patch) =>
    setCart((c) => c.map((l) => (l.itemId === itemId ? { ...l, ...patch } : l)));

  const removeLine = (itemId) => setCart((c) => c.filter((l) => l.itemId !== itemId));

  const subtotalInclusive = cart.reduce(
    (acc, l) => acc + Number(l.quantity) * Number(l.unitPrice),
    0,
  );
  const totals = splitInclusive(subtotalInclusive, taxRate);

  const canSubmit = customerId && warehouseId && cart.length > 0 && !submitting;

  const buildOrderPayload = (status = "DRAFT") => ({
    customerId,
    warehouseId,
    status,
    items: cart.map((l) => ({
      itemId: l.itemId,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
    })),
  });

  const saveDraft = async () => {
    if (!canSubmit) return;
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
    if (!canSubmit) return;
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

  const openConfirmModal = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const created = await bulkService.createOrder(buildOrderPayload("DRAFT"));
      const confirmed = await bulkService.confirmOrder(created.id, { paidAmount: 0 });
      setPendingOrder(confirmed);
    } catch (err) {
      toast.error(formatConfirmError(err), { duration: 6000, style: { whiteSpace: "pre-line", textAlign: "right", maxWidth: "420px" } });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3 sm:p-4" dir="rtl">
      {pendingOrder && (
        <BulkPaymentModal
          order={pendingOrder}
          onSuccess={() => {
            toast.success(`تم تأكيد الطلب ${pendingOrder.orderNumber}`);
            navigate(`/bulk/orders/${pendingOrder.id}`);
          }}
          onClose={() => {
            navigate(`/bulk/orders/${pendingOrder.id}`);
          }}
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
            <select
              className="border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
              value={warehouseId || ""}
              onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">اختر المخزن...</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
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

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[70vh] overflow-y-auto">
            {filteredItems.map((it) => {
              const overridden = contractPrices.has(it.id);
              const price = overridden ? contractPrices.get(it.id) : Number(it.price);
              return (
                <button
                  key={it.id}
                  disabled={!customerId}
                  onClick={() => addToCart(it)}
                  className="text-right border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                >
                  <div className="font-medium text-sm line-clamp-2 text-text-light dark:text-text-dark">{it.name}</div>
                  <div className="text-xs text-text-light/50 dark:text-text-dark/50">{it.unit}</div>
                  <div className="mt-1 font-bold text-text-light dark:text-text-dark">{formatEGP(price)}</div>
                  {overridden && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 mt-0.5">
                      سعر عقد
                    </span>
                  )}
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
            {cart.map((l) => (
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
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0.0001"
                    className="border border-border-light dark:border-border-dark rounded-lg p-1 w-20 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
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
                    {formatEGP(Number(l.quantity) * Number(l.unitPrice))}
                  </span>
                </div>
              </div>
            ))}
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
