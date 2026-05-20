import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { CheckCircle2, MapPin, Phone, Search, Sparkles, UserRound, X } from "lucide-react";
import { callCenterService } from "../../services/callCenterService";
import { deliveryZoneService } from "../../services/deliveryZoneService";
import { computeDiscountAmount } from "../../components/pos/DiscountPanel";
import OrderCommandBar from "./components/OrderCommandBar";
import Step from "./components/Step";
import BranchChips from "./components/BranchChips";
import CartDrawer from "./components/CartDrawer";
import ItemsGrid from "./components/ItemsGrid";
import ZoneChips from "./components/ZoneChips";
import WeightPickerModal from "./components/WeightPickerModal";
import {
  createClientSelectionState,
  isCustomerInformationComplete,
} from "./callCenterCustomerSelection";

// ─── main component ───────────────────────────────────────────────────────────

const CallCenterNewOrderPage = () => {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  const [phone, setPhone] = useState("");
  const [clientResults, setClientResults] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [newClientName, setNewClientName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const [zones, setZones] = useState([]);
  const [zoneId, setZoneId] = useState("");
  const [notes, setNotes] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);

  const [cart, setCart] = useState([]);
  const [lastAddedId, setLastAddedId] = useState(null);
  const [itemSearch, setItemSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [submitting, setSubmitting] = useState(false);
  const [discountType, setDiscountType] = useState("PERCENTAGE");
  const [discountInput, setDiscountInput] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [weightPickerItem, setWeightPickerItem] = useState(null);

  const searchRef = useRef(null);
  const phoneRef = useRef(null);
  const nameRef = useRef(null);
  const zoneSectionRef = useRef(null);
  const addressRef = useRef(null);
  const branchSectionRef = useRef(null);
  const customerSectionRef = useRef(null);

  // Load branches on mount; focus phone (customer is step 1)
  useEffect(() => {
    callCenterService.listBranches().then(setBranches).catch(() => toast.error("تعذر تحميل الفروع"));
    setTimeout(() => phoneRef.current?.focus(), 100);
  }, []);

  // Load items + zones when branch changes (delivery zones filter by branch)
  useEffect(() => {
    if (!branchId) { setItems([]); setZones([]); return; }
    setLoadingItems(true);
    callCenterService
      .listItems(branchId)
      .then(setItems)
      .catch(() => toast.error("تعذر تحميل الأصناف"))
      .finally(() => setLoadingItems(false));

    deliveryZoneService
      .getAll()
      .then((all) => setZones(all.filter((z) => !z.branchId || z.branchId === parseInt(branchId))))
      .catch(console.error);
  }, [branchId]);

  // Phone lookup (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      if (selectedClient) {
        setClientResults([]);
        return;
      }
      if (phone.length < 3) { setClientResults([]); return; }
      callCenterService.searchClients({ phone }).then(setClientResults).catch(console.error);
    }, 300);
    return () => clearTimeout(t);
  }, [phone, selectedClient]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      const inInput = ["INPUT", "TEXTAREA", "SELECT"].includes(tag);

      if (e.key === "/" && !inInput) {
        e.preventDefault();
        if (readyForPos) searchRef.current?.focus();
        else focusCustomerInformation();
      }
      if (e.key === "Escape") {
        if (document.activeElement === searchRef.current) setItemSearch("");
        setClientResults([]);
      }
      if (e.key === "?" && !inInput) setShowShortcuts(true);
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault();
        if (!submitBlocker) handleSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const categories = useMemo(() => {
    const map = new Map();
    items.forEach((it) => (it.categories || []).forEach((c) => { if (c && !map.has(c.id)) map.set(c.id, c); }));
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [items]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    items.forEach((it) => (it.categories || []).forEach((c) => { if (c) counts[c.id] = (counts[c.id] || 0) + 1; }));
    return counts;
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

  const customerInformationComplete = useMemo(
    () =>
      isCustomerInformationComplete({
        phone,
        name: newClientName,
        zoneId,
        deliveryAddress,
      }),
    [phone, newClientName, zoneId, deliveryAddress]
  );

  const posGateReason = useMemo(() => {
    if (!String(phone).trim()) return "أدخل رقم هاتف العميل";
    if (!String(newClientName).trim()) return "أدخل اسم العميل";
    if (!String(deliveryAddress).trim()) return "أدخل عنوان التسليم";
    if (!branchId) return "اختر الفرع";
    if (!zoneId) return "اختر منطقة التوصيل";
    return null;
  }, [branchId, phone, newClientName, zoneId, deliveryAddress]);

  const readyForPos = !posGateReason && customerInformationComplete;

  const focusCustomerInformation = () => {
    // Flow: Customer step (phone → name → address) → Branch → Zone
    if (!String(phone).trim() || !String(newClientName).trim() || !String(deliveryAddress).trim()) {
      customerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => {
        if (!String(phone).trim()) phoneRef.current?.focus();
        else if (!String(newClientName).trim()) nameRef.current?.focus();
        else addressRef.current?.focus();
      }, 120);
      return;
    }

    if (!branchId) {
      branchSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (!zoneId) {
      zoneSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  useEffect(() => {
    if (!readyForPos) return;
    setTimeout(() => searchRef.current?.focus(), 120);
  }, [readyForPos]);

  const addToCart = (item) => {
    if (!readyForPos) {
      toast.error(posGateReason || "أكمل بيانات العميل أولاً");
      focusCustomerInformation();
      return;
    }
    if (item.stock <= 0) { toast.error(`الصنف "${item.name}" غير متوفر بالمخزون`); return; }
    if (item.unit === "kg") {
      setWeightPickerItem(item);
      return;
    }
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (existing) {
        if (existing.quantity + 1 > item.stock) { toast.error("الكمية المطلوبة أكبر من المخزون"); return prev; }
        return prev.map((c) => c.itemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { itemId: item.id, name: item.name, price: item.price, quantity: 1, stock: item.stock, unit: item.unit }];
    });
    setLastAddedId(item.id);
    setTimeout(() => setLastAddedId(null), 300);
  };

  const confirmWeight = (qty) => {
    const item = weightPickerItem;
    if (!item) return;
    const n = Math.max(0, Math.min(Number(qty) || 0, item.stock));
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id);
      if (n <= 0) {
        return prev.filter((c) => c.itemId !== item.id);
      }
      if (existing) {
        return prev.map((c) => c.itemId === item.id ? { ...c, quantity: n } : c);
      }
      return [...prev, { itemId: item.id, name: item.name, price: item.price, quantity: n, stock: item.stock, unit: item.unit }];
    });
    setLastAddedId(item.id);
    setTimeout(() => setLastAddedId(null), 300);
    setWeightPickerItem(null);
  };

  const updateQty = (itemId, qty) => {
    const n = Number(qty);
    setCart((prev) =>
      prev.map((c) => c.itemId === itemId ? { ...c, quantity: Math.max(0, Math.min(n, c.stock)) } : c)
          .filter((c) => c.quantity > 0)
    );
  };

  const openWeightPickerFor = (itemId) => {
    const cartLine = cart.find((c) => c.itemId === itemId);
    const item = items.find((it) => it.id === itemId);
    if (!item) return;
    setWeightPickerItem({ ...item, _currentQty: cartLine?.quantity || 0 });
  };

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const selectedZone = zones.find((z) => z.id === parseInt(zoneId));
  const deliveryFee = selectedZone ? Number(selectedZone.fee) : 0;
  const discountAmount = computeDiscountAmount(subtotal, discountType, discountInput);
  const total = Math.max(0, subtotal - discountAmount) + deliveryFee;

  const selectedBranch = branches.find((b) => String(b.id) === String(branchId)) || null;

  const submitBlocker = useMemo(() => {
    if (posGateReason) return posGateReason;
    if (cart.length === 0) return "أضف صنفاً إلى السلة";
    if (Number(discountInput) > 0 && !discountReason) return "اختر سبب الخصم";
    return null;
  }, [posGateReason, cart, discountInput, discountReason]);

  const pickClient = (client) => {
    const next = createClientSelectionState(client, phone);
    setPhone(next.phone);
    setSelectedClient(next.selectedClient);
    setNewClientName(next.newClientName);
    setDeliveryAddress(next.deliveryAddress);
    setClientResults(next.clientResults);
  };

  const clearClient = () => {
    setSelectedClient(null);
    setNewClientName("");
    setDeliveryAddress("");
    setClientResults([]);
    phoneRef.current?.focus();
  };

  const startNewClient = () => {
    setSelectedClient(null);
    setClientResults([]);
    setNewClientName("");
    setDeliveryAddress("");
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let client = selectedClient;
      if (!client) {
        client = await callCenterService.createClient({ name: newClientName, phoneNumber: phone, address: deliveryAddress });
      }
      const payload = {
        branchId: parseInt(branchId),
        clientId: client.id,
        items: cart.map((c) => ({ itemId: c.itemId, quantity: c.quantity, unitPrice: c.price })),
        deliveryZoneId: parseInt(zoneId),
        deliveryAddress,
        notes,
      };
      const discountRaw = Number(discountInput) || 0;
      if (discountRaw > 0) {
        payload.discountType = discountType;
        payload.discountValue = discountRaw;
        payload.discountReason = discountReason;
      }
      const result = await callCenterService.createOrder(payload);
      toast.success(`تم إنشاء الطلب ${result.saleNumber}`);
      setCart([]); setPhone(""); setSelectedClient(null); setNewClientName(""); setDeliveryAddress("");
      setZoneId(""); setNotes(""); setNotesOpen(false); setDiscountInput(""); setDiscountType("PERCENTAGE"); setDiscountReason("");
      const fresh = await callCenterService.listItems(branchId);
      setItems(fresh);
    } catch (err) {
      console.error(err);
      if (err?.data?.error === "OUT_OF_STOCK") toast.error(`الصنف رقم ${err.data.itemId} غير متوفر بالمخزون الآن`);
      else toast.error(err?.data?.error || err?.message || "تعذر إنشاء الطلب");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background-light dark:bg-background-dark">
      {/* Sticky command bar */}
      <OrderCommandBar
        branch={selectedBranch}
        customer={selectedClient ? { name: selectedClient.name, totalOrders: selectedClient.totalOrders } : (newClientName ? { name: newClientName } : null)}
        itemCount={cart.length}
        total={total}
        onJumpToBranch={() => branchSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        onJumpToCustomer={() => customerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        onJumpToCart={() => readyForPos ? searchRef.current?.focus() : focusCustomerInformation()}
        onShowShortcuts={() => setShowShortcuts(true)}
      />

      {/* Page title */}
      <div className="mx-auto max-w-[1680px] px-4 sm:px-6 pt-5 pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/70">
              Call Center
            </p>
            <h1 className="text-2xl font-extrabold text-text-light dark:text-text-dark">
              طلب جديد — الكول سنتر
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-3 py-1.5 text-text-light/70 dark:text-text-dark/70">
              الفرع: <b className="text-text-light dark:text-text-dark">{selectedBranch?.name || "—"}</b>
            </span>
            <span className="rounded-lg border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark px-3 py-1.5 text-text-light/70 dark:text-text-dark/70">
              العميل: <b className="text-text-light dark:text-text-dark">{selectedClient?.name || newClientName || "—"}</b>
            </span>
            <span className="rounded-lg border border-primary/20 bg-primary/10 px-3 py-1.5 font-bold tabular-nums text-primary">
              {total.toFixed(2)} ج.م
            </span>
          </div>
        </div>
      </div>

      {/* Body: 4/5/3 three-column receipt-rail layout */}
      <div className="mx-auto grid max-w-[1680px] grid-cols-1 gap-5 px-4 sm:px-6 pb-8 lg:grid-cols-12 items-start">

        {/* ── Column A: Form (4/12) ── */}
        <div className="lg:col-span-4 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-5 shadow-soft">
          {/* Step 1 — Customer */}
          <div ref={customerSectionRef}>
            <Step number={1} label="العميل" complete={!!(phone && newClientName)} active={!phone || !newClientName}>
              {/* Phone */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-text-light/60 dark:text-text-dark/60 mb-1.5">رقم الهاتف</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary/60" />
                  <input
                    ref={phoneRef}
                    className="h-14 w-full rounded-lg border border-border-light bg-white px-4 pl-11 text-lg font-bold tabular-nums tracking-wide text-text-light placeholder:text-text-light/25 transition-shadow focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary dark:border-border-dark dark:bg-gray-800 dark:text-text-dark"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); if (selectedClient) clearClient(); }}
                    placeholder="01XXXXXXXXX"
                    dir="ltr"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    name="customer-phone"
                    id="customer-phone"
                    aria-autocomplete="list"
                    aria-expanded={clientResults.length > 0 && !selectedClient}
                    aria-controls="customer-phone-results"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && clientResults.length > 0) pickClient(clientResults[0]);
                      if (e.key === "Enter" && clientResults.length === 0) nameRef.current?.focus();
                    }}
                  />
                </div>
              </div>

              {/* New-customer notice — number not registered */}
              {!selectedClient && phone.trim().length >= 3 && clientResults.length === 0 && (
                <div className="mb-3 flex items-start gap-2.5 rounded-lg border-2 border-amber-400/60 bg-amber-50 px-3 py-2.5 shadow-sm dark:border-amber-500/50 dark:bg-amber-900/20">
                  <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-amber-400/30 text-amber-700 dark:bg-amber-500/30 dark:text-amber-300">
                    <Sparkles size={13} strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0 text-xs leading-snug">
                    <p className="font-extrabold text-amber-700 dark:text-amber-300">
                      رقم غير مسجل — عميل جديد
                    </p>
                    <p className="mt-0.5 font-medium text-text-light/70 dark:text-text-dark/70">
                      سيتم تسجيل هذا العميل تلقائياً في قاعدة البيانات عند إرسال الطلب
                    </p>
                  </div>
                </div>
              )}

              {/* Live results dropdown */}
              {clientResults.length > 0 && !selectedClient && (
                <ul
                  id="customer-phone-results"
                  role="listbox"
                  aria-label="نتائج البحث عن العملاء"
                  className="mb-3 max-h-72 overflow-y-auto rounded-lg border border-border-light bg-white shadow-soft animate-slide-down divide-y divide-border-light dark:divide-border-dark dark:border-border-dark dark:bg-gray-800"
                >
                  {clientResults.map((c) => (
                    <li key={c.id} role="option">
                      <button
                        type="button"
                        onClick={() => pickClient(c)}
                        className="group w-full px-3.5 py-3 text-right transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm font-bold text-text-light dark:text-text-dark">
                              <UserRound size={14} className="text-primary/70" />
                              <span className="truncate">{c.name}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-text-light/50 dark:text-text-dark/50" dir="rtl">
                              <span dir="ltr">{c.phoneNumber}</span>
                              {c.lastOrderDate && <span>آخر طلب: {new Date(c.lastOrderDate).toLocaleDateString("ar-EG")}</span>}
                            </div>
                          </div>
                          <span className="rounded-full bg-accent/40 px-2 py-1 text-[11px] font-bold text-text-light/60 dark:bg-accent-dark/40 dark:text-text-dark/60">
                            {c.totalOrders || 0} طلب
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                  <li role="option">
                    <button
                      type="button"
                      onClick={startNewClient}
                      className="flex w-full items-center gap-2 px-3.5 py-3 text-right text-sm font-bold text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      + عميل جديد بهذا الرقم
                    </button>
                  </li>
                </ul>
              )}

              {/* Selected customer chip */}
              {selectedClient && (
                <div className="mb-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-stock-ok" />
                        <span className="truncate text-sm font-bold text-text-light dark:text-text-dark">{selectedClient.name}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs tabular-nums text-text-light/55 dark:text-text-dark/55">
                        <span dir="ltr">{phone}</span>
                        {selectedClient.totalOrders ? <span>{selectedClient.totalOrders} طلبات</span> : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={clearClient}
                      aria-label="إلغاء اختيار العميل"
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-text-light/45 transition-colors hover:bg-stock-out/10 hover:text-stock-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stock-out dark:text-text-dark/45"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              )}

              {/* Name field */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-text-light/60 dark:text-text-dark/60 mb-1.5">اسم العميل</label>
                <input
                  ref={nameRef}
                  className="w-full border border-border-light dark:border-border-dark rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-text-light dark:text-text-dark placeholder:text-text-light/30 focus:outline-none focus:ring-2 focus:ring-primary disabled:bg-accent/20 disabled:cursor-not-allowed transition-shadow"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  disabled={!!selectedClient}
                  placeholder="اسم العميل"
                />
              </div>

              {/* Address */}
              <div className="mb-3">
                <label className="mb-1.5 block text-xs font-medium text-text-light/60 dark:text-text-dark/60">عنوان التسليم</label>
                <div className="relative">
                  <MapPin size={18} className="absolute left-3 top-3.5 text-primary/60" />
                  <textarea
                    ref={addressRef}
                    className="min-h-[88px] w-full resize-none rounded-lg border border-border-light bg-white px-3 py-3 pl-10 text-sm font-semibold text-text-light placeholder:text-text-light/30 transition-shadow focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-border-dark dark:bg-gray-800 dark:text-text-dark"
                    rows={3}
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="العنوان بالتفصيل"
                  />
                </div>
              </div>

              {/* Notes (collapsed) */}
              {!notesOpen ? (
                <button type="button" onClick={() => setNotesOpen(true)} className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
                  + أضف ملاحظة
                </button>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-text-light/60 dark:text-text-dark/60 mb-1.5">ملاحظات</label>
                  <textarea
                    className="w-full border border-border-light dark:border-border-dark rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-primary transition-shadow resize-none"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
            </Step>
          </div>

          {/* Step 2 — Branch */}
          <div ref={branchSectionRef}>
            <Step number={2} label="الفرع" complete={!!branchId} active={!!(phone && newClientName) && !branchId}>
              <BranchChips branches={branches} selectedId={branchId} onChange={setBranchId} />
            </Step>
          </div>

          {/* Step 3 — Delivery zone */}
          <Step number={3} label="التوصيل" complete={!!zoneId} active={!!(phone && newClientName && branchId) && !zoneId}>
            <div ref={zoneSectionRef}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="block text-sm font-extrabold text-primary">منطقة التوصيل *</label>
                {selectedZone && (
                  <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold tabular-nums text-primary">
                    {deliveryFee.toFixed(0)} ج.م
                  </span>
                )}
              </div>
              <ZoneChips zones={zones} selectedId={zoneId} onChange={setZoneId} branchId={branchId} />
            </div>
          </Step>
        </div>

        {/* ── Column B: Items catalog (5/12) ── */}
        <div className="lg:col-span-5 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/70">POS</p>
              <h2 className="text-lg font-extrabold text-text-light dark:text-text-dark">الأصناف والسلة</h2>
            </div>
            <span className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              readyForPos
                ? "bg-stock-ok/10 text-stock-ok"
                : "bg-stock-low/10 text-stock-low"
            }`}>
              {readyForPos ? "جاهز" : "بانتظار بيانات العميل"}
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-light/40 dark:text-text-dark/40" />
            <input
              ref={searchRef}
              className="w-full border border-border-light dark:border-border-dark rounded-lg pr-9 pl-3 py-2.5 text-sm bg-white dark:bg-gray-800 text-text-light dark:text-text-dark placeholder:text-text-light/30 focus:outline-none focus:ring-2 focus:ring-primary transition-shadow"
              placeholder={readyForPos ? "ابحث عن صنف... (اضغط / للتركيز)" : posGateReason || "أكمل بيانات العميل أولاً"}
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              disabled={!readyForPos}
            />
          </div>

          {/* Category tabs */}
          {readyForPos && categories.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
              <button
                type="button"
                onClick={() => setCategoryId("all")}
                className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                  ${categoryId === "all" ? "bg-primary text-white border-primary" : "bg-white dark:bg-surface-dark border-border-light dark:border-border-dark text-text-light dark:text-text-dark hover:border-primary/50"}`}
              >
                الكل <span className="opacity-60 mr-1">{items.length}</span>
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(String(c.id))}
                  className={`flex-shrink-0 px-3 py-1 rounded-lg text-xs font-medium border transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
                    ${categoryId === String(c.id) ? "bg-primary text-white border-primary" : "bg-white dark:bg-surface-dark border-border-light dark:border-border-dark text-text-light dark:text-text-dark hover:border-primary/50"}`}
                >
                  {c.name} <span className="opacity-60 mr-1">{categoryCounts[c.id] || 0}</span>
                </button>
              ))}
            </div>
          )}

          {/* Items grid — roving tabindex keyboard nav handled inside ItemsGrid */}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
            <ItemsGrid
              items={filteredItems}
              cart={cart}
              loading={loadingItems}
              branchId={branchId}
              readyForPos={readyForPos}
              lockedReason={posGateReason}
              onAdd={addToCart}
            />
          </div>
        </div>

        {/* ── Column C: Cart receipt rail (3/12) ── */}
        <div className="lg:col-span-3">
          <CartDrawer
            cart={cart}
            onUpdateQty={updateQty}
            onEditKg={openWeightPickerFor}
            subtotal={subtotal}
            deliveryFee={deliveryFee}
            discountType={discountType}
            discountInput={discountInput}
            discountReason={discountReason}
            discountAmount={discountAmount}
            total={total}
            onDiscountChange={(next) => {
              setDiscountType(next.discountType);
              setDiscountInput(next.discountValue);
              setDiscountReason(next.discountReason);
            }}
            onSubmit={handleSubmit}
            submitting={submitting}
            submitBlocker={submitBlocker}
            lastAddedId={lastAddedId}
          />
        </div>
      </div>

      {/* Weight picker modal — kg items */}
      {weightPickerItem && (
        <WeightPickerModal
          item={weightPickerItem}
          currentQty={weightPickerItem._currentQty || cart.find((c) => c.itemId === weightPickerItem.id)?.quantity || 0}
          onConfirm={confirmWeight}
          onClose={() => setWeightPickerItem(null)}
        />
      )}

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-soft p-6 w-80 max-w-full"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <h2 className="text-base font-bold text-text-light dark:text-text-dark mb-4">اختصارات لوحة المفاتيح</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border-light dark:divide-border-dark">
                {[
                  ["/", "تركيز حقل البحث"],
                  ["Esc", "مسح البحث / إغلاق القائمة"],
                  ["Enter (في حقل الهاتف)", "اختيار أول عميل"],
                  ["Ctrl+Enter", "إرسال الطلب"],
                  ["?", "عرض هذه النافذة"],
                ].map(([key, desc]) => (
                  <tr key={key}>
                    <td className="py-2 pl-4">
                      <kbd className="px-2 py-0.5 rounded bg-accent/60 dark:bg-accent-dark/60 text-xs font-mono text-text-light dark:text-text-dark">{key}</kbd>
                    </td>
                    <td className="py-2 text-text-light/70 dark:text-text-dark/70">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              onClick={() => setShowShortcuts(false)}
              className="mt-4 w-full py-2 rounded-lg border border-border-light dark:border-border-dark text-sm text-text-light/60 dark:text-text-dark/60 hover:bg-accent/20 transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallCenterNewOrderPage;
