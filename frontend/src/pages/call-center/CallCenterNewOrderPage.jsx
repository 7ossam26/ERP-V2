import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { callCenterService } from "../../services/callCenterService";
import { deliveryZoneService } from "../../services/deliveryZoneService";
import DiscountPanel, {
  reasonLabel,
  computeDiscountAmount,
} from "../../components/pos/DiscountPanel";

const CallCenterNewOrderPage = () => {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [phone, setPhone] = useState("");
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");

  const [zones, setZones] = useState([]);
  const [zoneId, setZoneId] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [cart, setCart] = useState([]); // [{ itemId, name, price, quantity, stock, unit }]
  const [itemSearch, setItemSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [categoryId, setCategoryId] = useState("all");
  const [discountType, setDiscountType] = useState("PERCENTAGE");
  const [discountInput, setDiscountInput] = useState("");
  const [discountReason, setDiscountReason] = useState("");

  // Load branches once
  useEffect(() => {
    callCenterService.listBranches().then(setBranches).catch((err) => {
      console.error(err);
      toast.error("تعذر تحميل الفروع");
    });
  }, []);

  // Load items + zones when branch changes
  useEffect(() => {
    if (!branchId) {
      setItems([]);
      setZones([]);
      return;
    }
    setLoadingItems(true);
    callCenterService
      .listItems(branchId)
      .then(setItems)
      .catch((err) => {
        console.error(err);
        toast.error("تعذر تحميل الأصناف");
      })
      .finally(() => setLoadingItems(false));

    deliveryZoneService
      .getAll()
      .then((all) => setZones(all.filter((z) => !z.branchId || z.branchId === parseInt(branchId))))
      .catch(console.error);
  }, [branchId]);

  // Phone lookup (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      if (phone.length < 3) {
        setClientResults([]);
        return;
      }
      callCenterService.searchClients({ phone }).then(setClientResults).catch(console.error);
    }, 300);
    return () => clearTimeout(t);
  }, [phone]);

  const categories = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      (it.categories || []).forEach((c) => {
        if (c && !map.has(c.id)) map.set(c.id, c);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return items.filter((i) => {
      if (q && !i.name.toLowerCase().includes(q)) return false;
      if (categoryId !== "all") {
        const catIds = (i.categories || []).map((c) => c.id);
        if (!catIds.includes(parseInt(categoryId))) return false;
      }
      return true;
    });
  }, [items, itemSearch, categoryId]);

  const addToCart = (item) => {
    if (item.stock <= 0) {
      toast.error(`الصنف "${item.name}" غير متوفر بالمخزون`);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        if (existing.quantity + 1 > item.stock) {
          toast.error("الكمية المطلوبة أكبر من المخزون");
          return prev;
        }
        return prev.map((c) =>
          c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        { itemId: item.id, name: item.name, price: item.price, quantity: 1, stock: item.stock, unit: item.unit },
      ];
    });
  };

  const updateQty = (itemId, qty) => {
    const n = Number(qty);
    setCart((prev) =>
      prev
        .map((c) =>
          c.itemId === itemId
            ? { ...c, quantity: Math.max(0, Math.min(n, c.stock)) }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const selectedZone = zones.find((z) => z.id === parseInt(zoneId));
  const deliveryFee = selectedZone ? Number(selectedZone.fee) : 0;
  const discountRaw = Number(discountInput) || 0;
  const discountAmount = computeDiscountAmount(subtotal, discountType, discountInput);
  const total = Math.max(0, subtotal - discountAmount) + deliveryFee;

  const pickClient = (c) => {
    setSelectedClient(c);
    setNewClientName(c.name);
    setDeliveryAddress(c.address || "");
  };

  const clearClient = () => {
    setSelectedClient(null);
    setNewClientName("");
    setDeliveryAddress("");
  };

  const handleSubmit = async () => {
    if (!branchId) return toast.error("اختر الفرع");
    if (cart.length === 0) return toast.error("أضف أصناف إلى السلة");
    if (!phone) return toast.error("أدخل رقم هاتف العميل");
    if (!newClientName) return toast.error("أدخل اسم العميل");
    if (!deliveryAddress) return toast.error("أدخل عنوان التسليم");
    if (!zoneId) return toast.error("اختر منطقة التوصيل");

    setSubmitting(true);
    try {
      // Ensure client exists
      let client = selectedClient;
      if (!client) {
        client = await callCenterService.createClient({
          name: newClientName,
          phoneNumber: phone,
          address: deliveryAddress,
        });
      }

      const payload = {
        branchId: parseInt(branchId),
        clientId: client.id,
        items: cart.map((c) => ({
          itemId: c.itemId,
          quantity: c.quantity,
          unitPrice: c.price,
        })),
        deliveryZoneId: parseInt(zoneId),
        deliveryAddress,
        notes,
      };
      if (discountRaw > 0) {
        if (!discountReason) {
          toast.error("يجب اختيار سبب الخصم");
          setSubmitting(false);
          return;
        }
        payload.discountType = discountType;
        payload.discountValue = discountRaw;
        payload.discountReason = discountReason;
      }
      const result = await callCenterService.createOrder(payload);
      toast.success(`تم إنشاء الطلب ${result.saleNumber}`);

      // Reset form
      setCart([]);
      setPhone("");
      setSelectedClient(null);
      setNewClientName("");
      setNewClientAddress("");
      setDeliveryAddress("");
      setZoneId("");
      setNotes("");
      setDiscountInput("");
      setDiscountType("PERCENTAGE");
      setDiscountReason("");
      // Refresh items to show updated stock
      const fresh = await callCenterService.listItems(branchId);
      setItems(fresh);
    } catch (err) {
      console.error(err);
      if (err?.data?.error === "OUT_OF_STOCK") {
        toast.error(`الصنف رقم ${err.data.itemId} غير متوفر بالمخزون الآن`);
      } else {
        toast.error(err?.data?.error || err?.message || "تعذر إنشاء الطلب");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <h1 className="text-2xl font-bold mb-4">طلب جديد - الكول سنتر</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: branch + client + delivery */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-4 border border-border-light dark:border-border-dark">
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">الفرع</label>
            <select
              className="w-full border rounded-md p-2 bg-white dark:bg-gray-800"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">اختر فرع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">رقم هاتف العميل</label>
            <input
              className="w-full border rounded-md p-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
            />
          </div>

          {clientResults.length > 0 && !selectedClient && (
            <div className="mb-2 border rounded-md max-h-40 overflow-auto">
              {clientResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pickClient(c)}
                  className="w-full text-right p-2 hover:bg-primary/10 text-sm border-b last:border-b-0"
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-gray-500">{c.phoneNumber}</div>
                </button>
              ))}
            </div>
          )}

          {selectedClient && (
            <div className="mb-2 p-2 rounded-md bg-primary/10 flex justify-between items-center">
              <span className="text-sm">{selectedClient.name}</span>
              <button className="text-xs text-red-500" onClick={clearClient}>
                إلغاء
              </button>
            </div>
          )}

          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">اسم العميل</label>
            <input
              className="w-full border rounded-md p-2"
              value={newClientName}
              onChange={(e) => setNewClientName(e.target.value)}
              disabled={!!selectedClient}
            />
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">عنوان التسليم</label>
            <textarea
              className="w-full border rounded-md p-2"
              rows={2}
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
            />
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">منطقة التوصيل</label>
            <select
              className="w-full border rounded-md p-2 bg-white dark:bg-gray-800"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
            >
              <option value="">اختر منطقة</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name} — {Number(z.fee).toFixed(2)}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">ملاحظات</label>
            <textarea
              className="w-full border rounded-md p-2"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        {/* Middle column: items catalog */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-4 border border-border-light dark:border-border-dark">
          <div className="mb-2">
            <input
              className="w-full border rounded-md p-2"
              placeholder="ابحث عن صنف..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
            />
          </div>
          {categories.length > 0 && (
            <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setCategoryId("all")}
                className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border ${
                  categoryId === "all"
                    ? "bg-primary text-white border-primary"
                    : "bg-white dark:bg-gray-800 hover:border-primary"
                }`}
              >
                الكل
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(String(c.id))}
                  className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border ${
                    categoryId === String(c.id)
                      ? "bg-primary text-white border-primary"
                      : "bg-white dark:bg-gray-800 hover:border-primary"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <div className="max-h-[500px] overflow-auto">
            {loadingItems && <div className="p-4 text-center text-gray-500">جارٍ التحميل...</div>}
            {!loadingItems && filteredItems.length === 0 && (
              <div className="p-4 text-center text-gray-500">
                {branchId ? "لا توجد أصناف" : "اختر فرعاً أولاً"}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {filteredItems.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => addToCart(it)}
                  disabled={it.stock <= 0}
                  className={`p-2 rounded-md border text-right ${
                    it.stock <= 0 ? "opacity-50 cursor-not-allowed bg-gray-100" : "hover:border-primary"
                  }`}
                >
                  <div className="font-medium text-sm">{it.name}</div>
                  <div className="text-xs text-gray-500">
                    {Number(it.price).toFixed(2)} ج.م • متوفر: {it.stock}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: cart + totals + submit */}
        <div className="bg-surface-light dark:bg-surface-dark rounded-2xl p-4 border border-border-light dark:border-border-dark">
          <h2 className="font-bold mb-2">السلة</h2>
          {cart.length === 0 ? (
            <div className="text-gray-500 text-sm text-center p-4">السلة فارغة</div>
          ) : (
            <div className="space-y-2 mb-4 max-h-80 overflow-auto">
              {cart.map((c) => (
                <div key={c.itemId} className="flex items-center gap-2 border-b pb-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{c.name}</div>
                    <div className="text-xs text-gray-500">{Number(c.price).toFixed(2)} × {c.quantity}</div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={c.stock}
                    value={c.quantity}
                    onChange={(e) => updateQty(c.itemId, e.target.value)}
                    className="w-16 border rounded p-1 text-center"
                  />
                  <button
                    type="button"
                    className="text-red-500 text-sm"
                    onClick={() => updateQty(c.itemId, 0)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-2 space-y-2 text-sm">
            <DiscountPanel
              subtotal={subtotal}
              discountType={discountType}
              discountValue={discountInput}
              discountReason={discountReason}
              onChange={(next) => {
                setDiscountType(next.discountType);
                setDiscountInput(next.discountValue);
                setDiscountReason(next.discountReason);
              }}
              compact
            />
            <div className="flex justify-between">
              <span>المجموع:</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>
                  الخصم
                  {discountReason ? ` (${reasonLabel(discountReason)})` : ""}:
                </span>
                <span>-{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>رسوم التوصيل:</span>
              <span>{deliveryFee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-base">
              <span>الإجمالي:</span>
              <span>{total.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-4 w-full bg-primary text-white py-2 rounded-md disabled:opacity-50"
          >
            {submitting ? "جارٍ الإرسال..." : "إرسال الطلب إلى الفرع"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallCenterNewOrderPage;
