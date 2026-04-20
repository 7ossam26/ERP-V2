import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { itemService } from "../../services/itemService";
import { warehouseService } from "../../services/warehouseService";
import { formatEGP, splitInclusive } from "../../utils/bulkMoney";

const TAX_RATE = 0.14;

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

  useEffect(() => {
    (async () => {
      try {
        const [cs, its, whs] = await Promise.all([
          bulkService.listCustomers({ active: true }),
          itemService.getAll(),
          warehouseService.getAll(),
        ]);
        setCustomers(cs);
        setItems(its);
        setWarehouses(whs);
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
  const totals = splitInclusive(subtotalInclusive, TAX_RATE);

  const canConfirm = customerId && warehouseId && cart.length > 0 && !submitting;

  const confirmCash = async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      const created = await bulkService.createOrder({
        customerId,
        warehouseId,
        items: cart.map((l) => ({
          itemId: l.itemId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
        })),
      });
      const confirmed = await bulkService.confirmOrder(created.id, {
        paidAmount: totals.total,
      });
      toast.success(`تم تأكيد الطلب ${confirmed.orderNumber}`);
      navigate(`/bulk/orders/${confirmed.id}`);
    } catch (err) {
      const detail = err?.data?.details
        ? err.data.details.map((d) => `${d.itemName} (طلب ${d.requested}, متاح ${d.available})`).join(", ")
        : "";
      toast.error(`${err?.data?.error || "تعذر تأكيد الطلب"}${detail ? `: ${detail}` : ""}`);
    } finally {
      setSubmitting(false);
    }
  };

  const saveDraft = async () => {
    if (!customerId || !warehouseId || cart.length === 0) return;
    setSubmitting(true);
    try {
      const created = await bulkService.createOrder({
        customerId,
        warehouseId,
        items: cart.map((l) => ({
          itemId: l.itemId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
        })),
      });
      toast.success("تم حفظ الطلب كمسودة");
      navigate(`/bulk/orders/${created.id}`);
    } catch (err) {
      toast.error(err?.data?.error || "تعذر الحفظ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-3 gap-3" dir="rtl">
      {/* Catalog (left, takes 2/3 on desktop) */}
      <div className="lg:col-span-2 bg-white dark:bg-gray-800 border rounded-lg p-3">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select
            className="border rounded-md p-2 bg-white dark:bg-gray-900 min-w-[220px]"
            value={customerId || ""}
            onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">اختر العميل...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>{c.companyName}</option>
            ))}
          </select>
          <select
            className="border rounded-md p-2 bg-white dark:bg-gray-900"
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
            className="border rounded-md p-2 bg-white dark:bg-gray-900 flex-1 min-w-[200px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {customer && customer.creditLimit != null && (
          <div className="mb-2 text-xs text-amber-700 dark:text-amber-300">
            حد الائتمان للعميل: {formatEGP(customer.creditLimit)}
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
                className="text-right border rounded-md p-2 bg-gray-50 dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="font-medium text-sm line-clamp-2">{it.name}</div>
                <div className="text-xs text-gray-500">{it.unit}</div>
                <div className="mt-1 font-bold">{formatEGP(price)}</div>
                {overridden && (
                  <div className="text-[10px] text-blue-600 dark:text-blue-400">سعر عقد</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cart (right) */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg p-3 flex flex-col">
        <h2 className="font-bold mb-2">السلة</h2>
        <div className="flex-1 overflow-y-auto max-h-[55vh]">
          {cart.length === 0 && (
            <div className="text-center text-gray-500 text-sm p-6">السلة فارغة</div>
          )}
          {cart.map((l) => (
            <div key={l.itemId} className="border-b py-2">
              <div className="flex justify-between items-start">
                <div className="text-sm font-medium">{l.name}</div>
                <button
                  className="text-red-600 text-xs"
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
                  className="border rounded-md p-1 w-20 bg-white dark:bg-gray-900"
                  value={l.quantity}
                  onChange={(e) => updateLine(l.itemId, { quantity: e.target.value })}
                />
                <span className="text-xs">×</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="border rounded-md p-1 w-24 bg-white dark:bg-gray-900"
                  value={l.unitPrice}
                  onChange={(e) => updateLine(l.itemId, { unitPrice: e.target.value })}
                />
                <span className="ms-auto font-semibold">
                  {formatEGP(Number(l.quantity) * Number(l.unitPrice))}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 border-t pt-2 text-sm space-y-1">
          <Row label="الصافي" value={formatEGP(totals.net)} />
          <Row label={`الضريبة (${(TAX_RATE * 100).toFixed(0)}%)`} value={formatEGP(totals.tax)} />
          <Row label="الإجمالي شامل الضريبة" value={formatEGP(totals.total)} bold />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            disabled={!customerId || !warehouseId || cart.length === 0 || submitting}
            onClick={saveDraft}
            className="border rounded-md p-2 disabled:opacity-50"
          >
            حفظ كمسودة
          </button>
          <button
            disabled={!canConfirm}
            onClick={confirmCash}
            className="bg-green-600 hover:bg-green-700 text-white rounded-md p-2 disabled:opacity-50"
          >
            {submitting ? "..." : "تأكيد نقدي"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between ${bold ? "font-bold text-base" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
