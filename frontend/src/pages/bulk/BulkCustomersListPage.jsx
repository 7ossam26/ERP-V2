import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { formatEGP } from "../../utils/bulkMoney";

const emptyForm = {
  companyName: "",
  tradeName: "",
  taxNumber: "",
  primaryContactName: "",
  primaryContactPhone: "",
  primaryContactEmail: "",
  shippingAddress: "",
  creditLimit: "",
  notes: "",
};

export default function BulkCustomersListPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await bulkService.listCustomers({ search });
      setCustomers(data);
    } catch (err) {
      toast.error(err?.data?.error || "تعذر تحميل العملاء");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        creditLimit: form.creditLimit === "" ? null : form.creditLimit,
      };
      const created = await bulkService.createCustomer(payload);
      toast.success("تم إضافة العميل");
      setShowForm(false);
      setForm(emptyForm);
      navigate(`/bulk/customers/${created.id}`);
    } catch (err) {
      toast.error(err?.data?.error || "تعذر الحفظ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      {/* Page header — Creates-style */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-text-light dark:text-text-dark">عملاء الجملة</h1>
        <div className="h-1.5 w-24 bg-primary rounded-full mt-1 opacity-80" />
        <p className="mt-2 text-sm text-text-light/60 dark:text-text-dark/60">الشركات والعقود وأسعار التعاقد</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <input
          type="search"
          className="border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark min-w-[240px] flex-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          placeholder="بحث بالاسم / الهاتف / الرقم الضريبي"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={() => setShowForm((v) => !v)}
          className="bg-primary hover:bg-primary-hover text-white px-4 py-2.5 rounded-xl text-sm transition-colors duration-200"
        >
          {showForm ? "إغلاق" : "+ إضافة عميل"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={onSubmit}
          className="bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-soft dark:shadow-soft-dark p-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3"
        >
          <Field label="اسم الشركة *" value={form.companyName} onChange={onChange("companyName")} required />
          <Field label="الاسم التجاري" value={form.tradeName} onChange={onChange("tradeName")} />
          <Field label="الرقم الضريبي" value={form.taxNumber} onChange={onChange("taxNumber")} />
          <Field
            label="حد الائتمان (فارغ = غير محدود)"
            value={form.creditLimit}
            onChange={onChange("creditLimit")}
            type="number"
            step="0.01"
          />
          <Field label="جهة الاتصال *" value={form.primaryContactName} onChange={onChange("primaryContactName")} required />
          <Field label="الهاتف *" value={form.primaryContactPhone} onChange={onChange("primaryContactPhone")} required />
          <Field label="البريد الإلكتروني" value={form.primaryContactEmail} onChange={onChange("primaryContactEmail")} type="email" />
          <Field label="عنوان الشحن *" value={form.shippingAddress} onChange={onChange("shippingAddress")} required textarea />
          <Field label="ملاحظات" value={form.notes} onChange={onChange("notes")} textarea />
          <div className="md:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(emptyForm); }}
              className="px-4 py-2 rounded-xl border border-border-light dark:border-border-dark text-text-light dark:text-text-dark text-sm hover:bg-accent/30 transition-colors"
            >
              إلغاء
            </button>
            <button
              disabled={submitting}
              type="submit"
              className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-sm disabled:opacity-60 transition-colors duration-200"
            >
              {submitting ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        </form>
      )}

      {!loading && customers.length === 0 && !showForm && (
        <div className="text-center py-16 text-text-light/30 dark:text-text-dark/30">
          <span className="material-symbols-outlined text-6xl block mb-2">business</span>
          <p className="text-sm">لا يوجد عملاء. أضف عميلك الأول.</p>
        </div>
      )}

      {customers.length > 0 && (
        <div className="overflow-x-auto bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-soft dark:shadow-soft-dark">
          <table className="w-full text-sm">
            <thead className="bg-accent/30 dark:bg-primary/10">
              <tr>
                <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">اسم الشركة</th>
                <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">جهة الاتصال</th>
                <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">الهاتف</th>
                <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">رقم ضريبي</th>
                <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">حد الائتمان</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-text-light/60 dark:text-text-dark/60">
                    جارٍ التحميل...
                  </td>
                </tr>
              )}
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-border-light dark:border-border-dark hover:bg-accent/20 dark:hover:bg-primary/10 transition-colors duration-150">
                  <td className="p-3 font-medium text-text-light dark:text-text-dark">{c.companyName}</td>
                  <td className="p-3 text-text-light dark:text-text-dark">{c.primaryContactName}</td>
                  <td className="p-3 ltr-numbers text-text-light/70 dark:text-text-dark/70">{c.primaryContactPhone}</td>
                  <td className="p-3 text-text-light/70 dark:text-text-dark/70">{c.taxNumber || "—"}</td>
                  <td className="p-3 text-text-light/70 dark:text-text-dark/70">
                    {c.creditLimit == null ? "غير محدود" : formatEGP(c.creditLimit)}
                  </td>
                  <td className="p-3">
                    <Link
                      className="text-primary hover:text-primary-hover font-medium text-sm transition-colors"
                      to={`/bulk/customers/${c.id}`}
                    >
                      عرض
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
