import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { itemService } from "../../services/itemService";
import { formatEGP } from "../../utils/bulkMoney";

const TABS = [
  { key: "profile", label: "البيانات" },
  { key: "prices", label: "أسعار العقد" },
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

  if (loading) return <div className="p-6 text-center">جارٍ التحميل...</div>;
  if (!customer) return <div className="p-6 text-center">العميل غير موجود.</div>;

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <div className="flex items-center justify-between mb-3">
        <div>
          <Link to="/bulk/customers" className="text-blue-600 hover:underline text-sm">
            ← الرجوع للقائمة
          </Link>
          <h1 className="text-2xl font-bold mt-1">{customer.companyName}</h1>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {customer.tradeName ? `${customer.tradeName} · ` : ""}
            {customer.taxNumber ? `رقم ضريبي ${customer.taxNumber}` : "بدون رقم ضريبي"}
          </div>
        </div>
        <Link
          to={`/bulk/pos?customerId=${customer.id}`}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          فاتورة جديدة
        </Link>
      </div>

      <div className="border-b mb-4 flex gap-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`pb-2 ${
              tab === t.key
                ? "border-b-2 border-blue-600 font-semibold"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "profile" && <ProfileTab customer={customer} onSaved={load} />}
      {tab === "prices" && <PricesTab customerId={customer.id} />}
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
      <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <Info label="اسم الشركة" value={customer.companyName} />
        <Info label="الاسم التجاري" value={customer.tradeName} />
        <Info label="رقم ضريبي" value={customer.taxNumber} />
        <Info
          label="حد الائتمان"
          value={customer.creditLimit == null ? "غير محدود" : formatEGP(customer.creditLimit)}
        />
        <Info label="جهة الاتصال" value={customer.primaryContactName} />
        <Info label="الهاتف" value={customer.primaryContactPhone} />
        <Info label="البريد" value={customer.primaryContactEmail} />
        <Info label="عنوان الشحن" value={customer.shippingAddress} />
        <Info label="ملاحظات" value={customer.notes} />
        <Info label="نشط" value={customer.isActive ? "نعم" : "لا"} />
        <div className="md:col-span-2 flex justify-end">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
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
      className="bg-white dark:bg-gray-800 border rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-3"
    >
      <Field label="اسم الشركة *" value={form.companyName} onChange={onChange("companyName")} required />
      <Field label="الاسم التجاري" value={form.tradeName} onChange={onChange("tradeName")} />
      <Field label="رقم ضريبي" value={form.taxNumber} onChange={onChange("taxNumber")} />
      <Field
        label="حد الائتمان (فارغ = غير محدود)"
        value={form.creditLimit}
        onChange={onChange("creditLimit")}
        type="number"
        step="0.01"
      />
      <Field label="جهة الاتصال *" value={form.primaryContactName} onChange={onChange("primaryContactName")} required />
      <Field label="الهاتف *" value={form.primaryContactPhone} onChange={onChange("primaryContactPhone")} required />
      <Field label="البريد" value={form.primaryContactEmail} onChange={onChange("primaryContactEmail")} type="email" />
      <Field label="عنوان الشحن *" value={form.shippingAddress} onChange={onChange("shippingAddress")} required textarea />
      <Field label="ملاحظات" value={form.notes} onChange={onChange("notes")} textarea />
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.isActive} onChange={onChange("isActive")} />
        نشط
      </label>
      <div className="md:col-span-2 flex justify-end gap-2">
        <button type="button" className="px-4 py-2 rounded-md border" onClick={() => setEdit(false)}>
          إلغاء
        </button>
        <button
          disabled={saving}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-60"
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
    if (entries.length === 0) {
      toast("لا يوجد تغييرات للحفظ");
      return;
    }
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
    <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <input
          type="search"
          placeholder="بحث صنف..."
          className="border rounded-md p-2 bg-white dark:bg-gray-900 min-w-[240px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={saveAll}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
        >
          حفظ التغييرات
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="text-right p-2">الصنف</th>
              <th className="text-right p-2">السعر الأساسي</th>
              <th className="text-right p-2">سعر العقد</th>
              <th className="text-right p-2">جديد</th>
              <th className="text-right p-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="p-4 text-center">جارٍ التحميل...</td>
              </tr>
            )}
            {!loading && filtered.map((it) => {
              const existing = priceByItem.get(it.id);
              return (
                <tr key={it.id} className="border-t">
                  <td className="p-2">{it.name}</td>
                  <td className="p-2">{formatEGP(it.price)}</td>
                  <td className="p-2 font-medium text-blue-700 dark:text-blue-400">
                    {existing ? formatEGP(existing.price) : "—"}
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={existing ? Number(existing.price).toFixed(2) : "—"}
                      className="border rounded-md p-1 w-28 bg-white dark:bg-gray-900"
                      value={draft[it.id] ?? ""}
                      onChange={(e) => setDraftPrice(it.id, e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    {existing && (
                      <button
                        onClick={() => removeOverride(existing.id)}
                        className="text-red-600 hover:underline text-xs"
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

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}

function Field({ label, textarea, ...rest }) {
  return (
    <label className="block">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      {textarea ? (
        <textarea
          {...rest}
          rows={2}
          className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-gray-900"
        />
      ) : (
        <input {...rest} className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-gray-900" />
      )}
    </label>
  );
}
