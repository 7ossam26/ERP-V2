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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold">عملاء الجملة</h1>
        <div className="flex gap-2">
          <input
            type="search"
            className="border rounded-md p-2 bg-white dark:bg-gray-800 min-w-[240px]"
            placeholder="بحث بالاسم / الهاتف / الرقم الضريبي"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            {showForm ? "إغلاق" : "إضافة عميل"}
          </button>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={onSubmit}
          className="bg-white dark:bg-gray-800 border rounded-lg p-4 mb-4 grid grid-cols-1 md:grid-cols-2 gap-3"
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
              onClick={() => {
                setShowForm(false);
                setForm(emptyForm);
              }}
              className="px-4 py-2 rounded-md border"
            >
              إلغاء
            </button>
            <button
              disabled={submitting}
              type="submit"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-60"
            >
              {submitting ? "جارٍ الحفظ..." : "حفظ"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto bg-white dark:bg-gray-800 border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="text-right p-3">اسم الشركة</th>
              <th className="text-right p-3">جهة الاتصال</th>
              <th className="text-right p-3">الهاتف</th>
              <th className="text-right p-3">رقم ضريبي</th>
              <th className="text-right p-3">حد الائتمان</th>
              <th className="text-right p-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-4 text-center">
                  جارٍ التحميل...
                </td>
              </tr>
            )}
            {!loading && customers.length === 0 && (
              <tr>
                <td colSpan={6} className="p-4 text-center text-gray-500">
                  لا يوجد عملاء.
                </td>
              </tr>
            )}
            {customers.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3 font-medium">{c.companyName}</td>
                <td className="p-3">{c.primaryContactName}</td>
                <td className="p-3 ltr-numbers">{c.primaryContactPhone}</td>
                <td className="p-3">{c.taxNumber || "—"}</td>
                <td className="p-3">{c.creditLimit == null ? "غير محدود" : formatEGP(c.creditLimit)}</td>
                <td className="p-3">
                  <Link className="text-blue-600 hover:underline" to={`/bulk/customers/${c.id}`}>
                    عرض
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
        <input
          {...rest}
          className="mt-1 w-full border rounded-md p-2 bg-white dark:bg-gray-900"
        />
      )}
    </label>
  );
}
