import React, { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { formatEGP } from "../../utils/bulkMoney";

// ─── helpers ────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

const STATUS_LABELS = {
  DRAFT: "مسودة",
  QUOTED: "عرض سعر",
  CONFIRMED: "مؤكد",
  PARTIALLY_PAID: "مدفوع جزئيًا",
  PAID: "مدفوع",
  CANCELLED: "ملغي",
  RETURNED: "مرتجع",
};

const METHOD_LABELS = {
  CASH: "نقدي",
  BANK_TRANSFER: "تحويل بنكي",
  CHEQUE: "شيك",
  CREDIT: "آجل",
  CASH_REFUND: "استرداد نقدي",
  CREDIT_NOTE: "إشعار دائن",
};

const ENTRY_TYPE_LABELS = {
  ORDER: "طلب",
  PAYMENT: "دفعة",
  REFUND: "مرتجع",
};

// ─── sub-components ──────────────────────────────────────────────────────────

function SummaryCard({ label, value, highlight }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20"
          : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
      }`}
    >
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function DateRangeFilter({ from, to, onFromChange, onToChange, onSearch, loading }) {
  return (
    <div className="flex flex-wrap gap-2 items-end">
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">من</label>
        <input
          type="date"
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
          className="border rounded-md p-2 bg-white dark:bg-gray-800 dark:border-gray-600 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">إلى</label>
        <input
          type="date"
          value={to}
          onChange={(e) => onToChange(e.target.value)}
          className="border rounded-md p-2 bg-white dark:bg-gray-800 dark:border-gray-600 text-sm"
        />
      </div>
      <button
        onClick={onSearch}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "جارٍ التحميل…" : "عرض"}
      </button>
    </div>
  );
}

// ─── Tab 1: Sales by customer ─────────────────────────────────────────────────

function SalesByCustomerTab() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await bulkService.reportSalesByCustomer({ from, to });
      setData(result);
    } catch (err) {
      toast.error(err?.data?.error || "تعذر تحميل التقرير");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  return (
    <div className="space-y-6">
      <DateRangeFilter
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onSearch={load}
        loading={loading}
      />

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="عدد الطلبات" value={data.summary.orderCount} />
            <SummaryCard label="إجمالي المبيعات" value={formatEGP(data.summary.totalSales)} highlight />
            <SummaryCard label="المحصّل" value={formatEGP(data.summary.totalPaid)} />
            <SummaryCard label="المتبقي" value={formatEGP(data.summary.totalDue)} />
          </div>

          {/* Status breakdown */}
          {Object.keys(data.byStatus).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                توزيع الطلبات بالحالة
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.byStatus).map(([status, info]) => (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  >
                    {STATUS_LABELS[status] || status}
                    <span className="font-bold">{info.orderCount}</span>
                    <span className="text-gray-400">|</span>
                    {formatEGP(info.totalSales)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Per-customer table */}
          {data.byCustomer.length === 0 ? (
            <p className="text-gray-500 text-center py-8">لا توجد بيانات في هذه الفترة</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      العميل
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      الطلبات
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      إجمالي المبيعات
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      المحصّل
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      المتبقي
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {data.byCustomer.map((row) => (
                    <tr key={row.customerId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3">
                        <Link
                          to={`/bulk/customers/${row.customerId}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {row.companyName}
                        </Link>
                        {row.tradeName && (
                          <span className="block text-xs text-gray-400">{row.tradeName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.orderCount}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        {formatEGP(row.totalSales)}
                      </td>
                      <td className="px-4 py-3 text-green-700 dark:text-green-400">
                        {formatEGP(row.totalPaid)}
                      </td>
                      <td
                        className={`px-4 py-3 font-medium ${
                          row.totalDue > 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {formatEGP(row.totalDue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab 2: AR aging ──────────────────────────────────────────────────────────

function ArAgingTab() {
  const [asOf, setAsOf] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await bulkService.reportArAging({ asOf });
      setData(result);
    } catch (err) {
      toast.error(err?.data?.error || "تعذر تحميل التقرير");
    } finally {
      setLoading(false);
    }
  }, [asOf]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">حتى تاريخ</label>
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="border rounded-md p-2 bg-white dark:bg-gray-800 dark:border-gray-600 text-sm"
          />
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "جارٍ التحميل…" : "عرض"}
        </button>
      </div>

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <SummaryCard label="إجمالي المتأخرات" value={formatEGP(data.summary.totalDue)} highlight />
            <SummaryCard label="0 – 30 يوم" value={formatEGP(data.summary.b0_30)} />
            <SummaryCard label="31 – 60 يوم" value={formatEGP(data.summary.b31_60)} />
            <SummaryCard label="61 – 90 يوم" value={formatEGP(data.summary.b61_90)} />
            <SummaryCard label="+90 يوم" value={formatEGP(data.summary.b90plus)} />
          </div>

          {data.rows.length === 0 ? (
            <p className="text-gray-500 text-center py-8">لا توجد مديونيات مفتوحة</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      العميل
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      حد الائتمان
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      0 – 30
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      31 – 60
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      61 – 90
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      +90
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      الإجمالي
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {data.rows.map((row) => (
                    <tr key={row.customerId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3">
                        <Link
                          to={`/bulk/customers/${row.customerId}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {row.companyName}
                        </Link>
                        {row.tradeName && (
                          <span className="block text-xs text-gray-400">{row.tradeName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {row.creditLimit != null ? formatEGP(row.creditLimit) : "غير محدود"}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {row.b0_30 > 0 ? formatEGP(row.b0_30) : "—"}
                      </td>
                      <td className="px-4 py-3 text-yellow-700 dark:text-yellow-400">
                        {row.b31_60 > 0 ? formatEGP(row.b31_60) : "—"}
                      </td>
                      <td className="px-4 py-3 text-orange-700 dark:text-orange-400">
                        {row.b61_90 > 0 ? formatEGP(row.b61_90) : "—"}
                      </td>
                      <td className="px-4 py-3 text-red-700 dark:text-red-400 font-medium">
                        {row.b90plus > 0 ? formatEGP(row.b90plus) : "—"}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">
                        {formatEGP(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tab 3: Statement of account ─────────────────────────────────────────────

function StatementTab() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const searchCustomers = useCallback(async (q) => {
    if (!q || q.length < 2) return;
    setLoadingCustomers(true);
    try {
      const result = await bulkService.listCustomers({ search: q, limit: 20 });
      setCustomers(Array.isArray(result) ? result : result.data || []);
    } catch {
      // silent
    } finally {
      setLoadingCustomers(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (!customerId) {
      toast.error("اختر عميلاً أولاً");
      return;
    }
    setLoading(true);
    try {
      const result = await bulkService.reportStatement({ customerId, from, to });
      setData(result);
    } catch (err) {
      toast.error(err?.data?.error || "تعذر تحميل الكشف");
    } finally {
      setLoading(false);
    }
  }, [customerId, from, to]);

  const printStatement = () => window.print();

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Customer search */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">العميل</label>
          <div className="relative">
            <input
              type="text"
              placeholder="ابحث باسم الشركة…"
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                searchCustomers(e.target.value);
              }}
              className="border rounded-md p-2 bg-white dark:bg-gray-800 dark:border-gray-600 text-sm w-full"
            />
            {customers.length > 0 && customerSearch && !customerId && (
              <ul className="absolute z-10 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto text-sm">
                {customers.map((c) => (
                  <li
                    key={c.id}
                    className="px-3 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => {
                      setCustomerId(c.id);
                      setCustomerSearch(c.companyName);
                      setCustomers([]);
                    }}
                  >
                    {c.companyName}
                    {c.tradeName && (
                      <span className="text-gray-400 text-xs"> — {c.tradeName}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {loadingCustomers && (
              <span className="absolute left-2 top-2 text-xs text-gray-400">جارٍ البحث…</span>
            )}
          </div>
          {customerId && (
            <button
              className="text-xs text-red-500 mt-1 hover:underline"
              onClick={() => {
                setCustomerId("");
                setCustomerSearch("");
                setData(null);
              }}
            >
              مسح الاختيار
            </button>
          )}
        </div>

        <DateRangeFilter
          from={from}
          to={to}
          onFromChange={setFrom}
          onToChange={setTo}
          onSearch={load}
          loading={loading}
        />
      </div>

      {data && (
        <div className="space-y-4">
          {/* Customer header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {data.customer.companyName}
              </h3>
              {data.customer.tradeName && (
                <p className="text-sm text-gray-500">{data.customer.tradeName}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">
                الفترة: {new Date(data.period.from).toLocaleDateString("ar-EG")} —{" "}
                {new Date(data.period.to).toLocaleDateString("ar-EG")}
              </p>
            </div>
            <button
              onClick={printStatement}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              طباعة
            </button>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard label="إجمالي المديونية" value={formatEGP(data.summary.totalDebit)} />
            <SummaryCard label="إجمالي المدفوع" value={formatEGP(data.summary.totalCredit)} />
            <SummaryCard
              label="الرصيد الختامي"
              value={formatEGP(data.summary.closingBalance)}
              highlight
            />
          </div>

          {/* Ledger table */}
          {data.entries.length === 0 ? (
            <p className="text-gray-500 text-center py-8">لا توجد حركات في هذه الفترة</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 print:border-0">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 print:bg-white">
                  <tr>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      التاريخ
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      النوع
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      المرجع
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      البيان
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      مدين
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      دائن
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300">
                      الرصيد
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                  {data.entries.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            entry.type === "ORDER"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                              : entry.type === "PAYMENT"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                          }`}
                        >
                          {ENTRY_TYPE_LABELS[entry.type] || entry.type}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300 text-xs font-mono">
                        {entry.ref}
                      </td>
                      <td className="px-4 py-2 text-gray-700 dark:text-gray-300 text-xs">
                        {entry.description}
                      </td>
                      <td className="px-4 py-2 text-gray-900 dark:text-white font-medium">
                        {entry.debit > 0 ? formatEGP(entry.debit) : "—"}
                      </td>
                      <td className="px-4 py-2 text-green-700 dark:text-green-400 font-medium">
                        {entry.credit > 0 ? formatEGP(entry.credit) : "—"}
                      </td>
                      <td
                        className={`px-4 py-2 font-bold ${
                          entry.balance > 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-500 dark:text-gray-400"
                        }`}
                      >
                        {formatEGP(entry.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "sales", label: "المبيعات بالعميل" },
  { id: "aging", label: "تقادم الذمم" },
  { id: "statement", label: "كشف حساب" },
];

export default function BulkReportsPage() {
  const [activeTab, setActiveTab] = useState("sales");

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">تقارير الجملة</h1>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "sales" && <SalesByCustomerTab />}
      {activeTab === "aging" && <ArAgingTab />}
      {activeTab === "statement" && <StatementTab />}
    </div>
  );
}
