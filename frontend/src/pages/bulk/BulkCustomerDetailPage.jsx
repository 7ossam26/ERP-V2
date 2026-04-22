import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { itemService } from "../../services/itemService";
import { formatEGP } from "../../utils/bulkMoney";
import BulkCreditBadge from "../../components/bulk/BulkCreditBadge";
import SummaryCard from "../../components/bulk/SummaryCard";

const TABS = [
  { key: "profile", label: "البيانات" },
  { key: "prices", label: "أسعار العقد" },
  { key: "ar", label: "الحساب" },
];

export default function BulkCustomerDetailPage() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("profile");

  const load = async () => {
    setLoading(true);
    try {
      const data = await bulkService.getCustomer(id);
      setCustomer(data);
    } catch (err) {
      toast.error(err?.data?.error || "تعذر تحميل العميل");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <div className="p-6 text-center text-text-light/60 dark:text-text-dark/60">جارٍ التحميل...</div>;
  if (!customer) return <div className="p-6 text-center text-text-light/60 dark:text-text-dark/60">العميل غير موجود.</div>;

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <Link to="/bulk/customers" className="text-primary hover:text-primary-hover text-sm transition-colors">
            ← الرجوع للقائمة
          </Link>
          <h1 className="text-2xl font-bold text-text-light dark:text-text-dark mt-1">{customer.companyName}</h1>
          <div className="h-1 w-16 bg-primary rounded-full mt-1 opacity-80 mb-1" />
          <div className="text-sm text-text-light/60 dark:text-text-dark/60">
            {customer.tradeName ? `${customer.tradeName} · ` : ""}
            {customer.taxNumber ? `رقم ضريبي ${customer.taxNumber}` : "بدون رقم ضريبي"}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <BulkCreditBadge customer={customer} />
          <Link
            to={`/bulk/pos?customerId=${customer.id}`}
            className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-sm transition-colors duration-200"
          >
            فاتورة جديدة
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-light dark:border-border-dark mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors duration-200 ${
              tab === t.key
                ? "border-primary text-primary dark:text-accent"
                : "border-transparent text-text-light/60 dark:text-text-dark/60 hover:text-text-light dark:hover:text-text-dark"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileTab customer={customer} onSaved={load} />}
      {tab === "prices" && <PricesTab customerId={customer.id} />}
      {tab === "ar" && <ARTab customerId={customer.id} />}
    </div>
  );
}

function ProfileTab({ customer, onSaved }) {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    companyName: customer.companyName,
    tradeName: customer.tradeName || "",
    taxNumber: customer.taxNumber || "",
    primaryContactName: customer.primaryContactName,
    primaryContactPhone: customer.primaryContactPhone,
    primaryContactEmail: customer.primaryContactEmail || "",
    shippingAddress: customer.shippingAddress,
    creditLimit: customer.creditLimit ?? "",
    notes: customer.notes || "",
    isActive: customer.isActive,
  });
  const [saving, setSaving] = useState(false);
  const onChange = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await bulkService.updateCustomer(customer.id, {
        ...form,
        creditLimit: form.creditLimit === "" ? null : form.creditLimit,
      });
      toast.success("تم الحفظ");
      setEdit(false);
      onSaved && onSaved();
    } catch (err) {
      toast.error(err?.data?.error || "تعذر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (!edit) {
    return (
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-soft dark:shadow-soft-dark p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Info label="اسم الشركة" value={customer.companyName} />
        <Info label="الاسم التجاري" value={customer.tradeName} />
        <Info label="رقم ضريبي" value={customer.taxNumber} />
        <Info label="حد الائتمان" value={customer.creditLimit == null ? "غير محدود" : formatEGP(customer.creditLimit)} />
        <Info label="جهة الاتصال" value={customer.primaryContactName} />
        <Info label="الهاتف" value={customer.primaryContactPhone} />
        <Info label="البريد" value={customer.primaryContactEmail} />
        <Info label="عنوان الشحن" value={customer.shippingAddress} />
        <Info label="ملاحظات" value={customer.notes} />
        <Info label="نشط" value={customer.isActive ? "نعم" : "لا"} />
        <div className="md:col-span-2 flex justify-end">
          <button
            className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-sm transition-colors duration-200"
            onClick={() => setEdit(true)}
          >
            تعديل
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-soft dark:shadow-soft-dark p-4 grid grid-cols-1 md:grid-cols-2 gap-3"
    >
      <Field label="اسم الشركة *" value={form.companyName} onChange={onChange("companyName")} required />
      <Field label="الاسم التجاري" value={form.tradeName} onChange={onChange("tradeName")} />
      <Field label="رقم ضريبي" value={form.taxNumber} onChange={onChange("taxNumber")} />
      <Field label="حد الائتمان (فارغ = غير محدود)" value={form.creditLimit} onChange={onChange("creditLimit")} type="number" step="0.01" />
      <Field label="جهة الاتصال *" value={form.primaryContactName} onChange={onChange("primaryContactName")} required />
      <Field label="الهاتف *" value={form.primaryContactPhone} onChange={onChange("primaryContactPhone")} required />
      <Field label="البريد" value={form.primaryContactEmail} onChange={onChange("primaryContactEmail")} type="email" />
      <Field label="عنوان الشحن *" value={form.shippingAddress} onChange={onChange("shippingAddress")} required textarea />
      <Field label="ملاحظات" value={form.notes} onChange={onChange("notes")} textarea />
      <label className="flex items-center gap-2 text-sm text-text-light dark:text-text-dark">
        <input type="checkbox" checked={form.isActive} onChange={onChange("isActive")} className="accent-primary" />
        نشط
      </label>
      <div className="md:col-span-2 flex justify-end gap-2">
        <button
          type="button"
          className="px-4 py-2 rounded-xl border border-border-light dark:border-border-dark text-sm text-text-light dark:text-text-dark hover:bg-accent/30 transition-colors"
          onClick={() => setEdit(false)}
        >
          إلغاء
        </button>
        <button
          disabled={saving}
          className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-sm disabled:opacity-60 transition-colors duration-200"
        >
          {saving ? "جارٍ الحفظ..." : "حفظ"}
        </button>
      </div>
    </form>
  );
}

function PricesTab({ customerId }) {
  const [prices, setPrices] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const [p, allItems] = await Promise.all([
        bulkService.listPrices(customerId),
        itemService.getAll(),
      ]);
      setPrices(p);
      setItems(allItems);
    } catch (err) {
      toast.error(err?.data?.error || "تعذر تحميل أسعار العقد");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const priceByItem = new Map(prices.map((p) => [p.itemId, p]));
  const filtered = items.filter((i) =>
    !search.trim() ? true : (i.name || "").toLowerCase().includes(search.trim().toLowerCase()),
  );

  const setDraftPrice = (itemId, value) => setDraft((d) => ({ ...d, [itemId]: value }));

  const saveAll = async () => {
    const entries = Object.entries(draft)
      .filter(([, v]) => v !== "" && v != null)
      .map(([itemId, price]) => ({ itemId: Number(itemId), price: Number(price) }));
    if (entries.length === 0) { toast("لا يوجد تغييرات للحفظ"); return; }
    try {
      await bulkService.upsertPrices(customerId, entries);
      toast.success(`تم حفظ ${entries.length} سعر`);
      setDraft({});
      load();
    } catch (err) {
      toast.error(err?.data?.error || "تعذر الحفظ");
    }
  };

  const removeOverride = async (priceId) => {
    if (!window.confirm("حذف سعر العقد لهذا الصنف؟")) return;
    try {
      await bulkService.removePrice(customerId, priceId);
      toast.success("تم الحذف");
      load();
    } catch (err) {
      toast.error(err?.data?.error || "تعذر الحذف");
    }
  };

  return (
    <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-soft dark:shadow-soft-dark p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <input
          type="search"
          placeholder="بحث صنف..."
          className="border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark text-sm min-w-[240px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={saveAll}
          className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-sm transition-colors duration-200"
        >
          حفظ التغييرات
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-accent/30 dark:bg-primary/10">
            <tr>
              <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">الصنف</th>
              <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">السعر الأساسي</th>
              <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">سعر العقد</th>
              <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">جديد</th>
              <th className="text-right p-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-text-light/60 dark:text-text-dark/60">
                  جارٍ التحميل...
                </td>
              </tr>
            )}
            {!loading && filtered.map((it) => {
              const existing = priceByItem.get(it.id);
              return (
                <tr key={it.id} className="border-t border-border-light dark:border-border-dark hover:bg-accent/20 dark:hover:bg-primary/10">
                  <td className="p-2 text-text-light dark:text-text-dark">{it.name}</td>
                  <td className="p-2 text-text-light/70 dark:text-text-dark/70">{formatEGP(it.price)}</td>
                  <td className="p-2 font-medium text-primary dark:text-accent">
                    {existing ? formatEGP(existing.price) : "—"}
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={existing ? Number(existing.price).toFixed(2) : "—"}
                      className="border border-border-light dark:border-border-dark rounded-lg p-1 w-28 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={draft[it.id] ?? ""}
                      onChange={(e) => setDraftPrice(it.id, e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    {existing && (
                      <button
                        onClick={() => removeOverride(existing.id)}
                        className="text-red-600 hover:text-red-700 text-xs transition-colors"
                      >
                        حذف
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ARTab({ customerId }) {
  const [payments, setPayments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const METHOD_LABELS = {
    CASH: "نقدي",
    BANK_TRANSFER: "تحويل بنكي",
    CHEQUE: "شيك",
    CREDIT: "آجل",
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [p, o] = await Promise.all([
          bulkService.listCustomerPayments(customerId),
          bulkService.listOrders({ customerId }),
        ]);
        setPayments(p);
        setOrders(o);
      } catch (err) {
        toast.error(err?.data?.error || "تعذر تحميل الحساب");
      } finally {
        setLoading(false);
      }
    })();
  }, [customerId]);

  const totalOrders = orders
    .filter((o) => !["CANCELLED", "RETURNED"].includes(o.status))
    .reduce((s, o) => s + Number(o.total), 0);
  const totalPaid = payments
    .filter((p) => !p.voidedAt)
    .reduce((s, p) => s + Number(p.amount), 0);
  const openBalance = Math.max(0, totalOrders - totalPaid);

  if (loading) return <div className="p-6 text-center text-text-light/60 dark:text-text-dark/60">جارٍ التحميل...</div>;

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="إجمالي الطلبات" value={formatEGP(totalOrders)} />
        <SummaryCard label="إجمالي المدفوع" value={formatEGP(totalPaid)} tone="success" />
        <SummaryCard label="الرصيد المفتوح" value={formatEGP(openBalance)} tone={openBalance > 0 ? "danger" : "default"} />
      </div>

      {/* Payments log */}
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-soft dark:shadow-soft-dark p-4">
        <h3 className="font-bold mb-3 text-sm text-text-light dark:text-text-dark">سجل الدفعات</h3>
        {payments.length === 0 ? (
          <div className="text-sm text-text-light/40 dark:text-text-dark/40">لا يوجد دفعات مسجلة.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-accent/30 dark:bg-primary/10">
              <tr>
                <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">التاريخ</th>
                <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">الطلب</th>
                <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">الطريقة</th>
                <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">المبلغ</th>
                <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className={`border-t border-border-light dark:border-border-dark hover:bg-accent/20 dark:hover:bg-primary/10 ${p.voidedAt ? "opacity-50" : ""}`}>
                  <td className="p-2 ltr-numbers text-text-light/70 dark:text-text-dark/70">
                    {new Date(p.receivedAt).toLocaleDateString("ar-EG")}
                  </td>
                  <td className="p-2">
                    <Link to={`/bulk/orders/${p.order?.id}`} className="text-primary hover:text-primary-hover transition-colors">
                      {p.order?.orderNumber || `#${p.order?.id}`}
                    </Link>
                  </td>
                  <td className="p-2 text-text-light dark:text-text-dark">{METHOD_LABELS[p.method] || p.method}</td>
                  <td className="p-2 font-medium text-text-light dark:text-text-dark">{formatEGP(p.amount)}</td>
                  <td className="p-2">
                    {p.voidedAt
                      ? <span className="text-red-600 text-xs">ملغاة</span>
                      : <span className="text-emerald-700 text-xs">مسجلة</span>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pending orders */}
      <div className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-soft dark:shadow-soft-dark p-4">
        <h3 className="font-bold mb-3 text-sm text-text-light dark:text-text-dark">الطلبات المعلقة</h3>
        {orders.filter((o) => ["CONFIRMED", "PARTIALLY_PAID"].includes(o.status)).length === 0 ? (
          <div className="text-sm text-text-light/40 dark:text-text-dark/40">لا يوجد طلبات معلقة.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-accent/30 dark:bg-primary/10">
              <tr>
                <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">رقم الطلب</th>
                <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">التاريخ</th>
                <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">الإجمالي</th>
                <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">المتبقي</th>
              </tr>
            </thead>
            <tbody>
              {orders
                .filter((o) => ["CONFIRMED", "PARTIALLY_PAID"].includes(o.status))
                .map((o) => (
                  <tr key={o.id} className="border-t border-border-light dark:border-border-dark hover:bg-accent/20 dark:hover:bg-primary/10">
                    <td className="p-2">
                      <Link to={`/bulk/orders/${o.id}`} className="text-primary hover:text-primary-hover transition-colors">
                        {o.orderNumber || `#${o.id}`}
                      </Link>
                    </td>
                    <td className="p-2 ltr-numbers text-text-light/70 dark:text-text-dark/70">
                      {new Date(o.createdAt).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="p-2 text-text-light dark:text-text-dark">{formatEGP(o.total)}</td>
                    <td className="p-2 font-bold text-red-700 dark:text-red-400">{formatEGP(o.balanceDue)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs text-text-light/50 dark:text-text-dark/50">{label}</div>
      <div className="font-medium text-text-light dark:text-text-dark">{value || "—"}</div>
    </div>
  );
}

function Field({ label, textarea, ...rest }) {
  const inputCls = "mt-1 w-full border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";
  return (
    <label className="block">
      <span className="text-sm text-text-light/70 dark:text-text-dark/70">{label}</span>
      {textarea
        ? <textarea {...rest} rows={2} className={inputCls} />
        : <input {...rest} className={inputCls} />
      }
    </label>
  );
}
