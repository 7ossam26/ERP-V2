import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { formatEGP } from "../../utils/bulkMoney";
import SummaryCard from "../../components/bulk/SummaryCard";
import StatusChip from "../../components/bulk/StatusChip";

// ─── helpers ─────────────────────────────────────────────────────────────────

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

// ─── shared filter ────────────────────────────────────────────────────────────

const inputCls = "border border-border-light dark:border-border-dark rounded-xl p-2.5 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary";

function DateRangeFilter({ from, to, onFromChange, onToChange }) {
  return (
    <div className="flex flex-wrap gap-2 items-end">
      <div>
        <label className="block text-xs text-text-light/60 dark:text-text-dark/60 mb-1">من</label>
        <input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className="block text-xs text-text-light/60 dark:text-text-dark/60 mb-1">إلى</label>
        <input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className={inputCls} />
      </div>
    </div>
  );
}

// ─── Tab 1: Sales by customer ─────────────────────────────────────────────────

function SalesByCustomerTab() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await bulkService.reportSalesByCustomer({ from, to });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) toast.error(err?.data?.error || "تعذر تحميل التقرير");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(load, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [from, to]);

  return (
    <div className="space-y-6">
      <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryCard label="عدد الطلبات" value={data.summary.orderCount} />
            <SummaryCard label="إجمالي المبيعات" value={formatEGP(data.summary.totalSales)} tone="highlight" />
            <SummaryCard label="المحصّل" value={formatEGP(data.summary.totalPaid)} tone="success" />
            <SummaryCard label="المتبقي" value={formatEGP(data.summary.totalDue)} tone="danger" />
          </div>

          {Object.keys(data.byStatus).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-text-light/80 dark:text-text-dark/80 mb-2">توزيع الطلبات بالحالة</h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.byStatus).map(([status, info]) => (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-accent/30 dark:bg-primary/10 text-text-light dark:text-text-dark ring-1 ring-inset ring-border-light dark:ring-border-dark"
                  >
                    {STATUS_LABELS[status] || status}
                    <span className="font-bold text-primary dark:text-accent">{info.orderCount}</span>
                    <span className="text-text-light/30">|</span>
                    {formatEGP(info.totalSales)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {data.byCustomer.length === 0 ? (
            <p className="text-text-light/40 dark:text-text-dark/40 text-center py-8">لا توجد بيانات في هذه الفترة</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border-light dark:border-border-dark shadow-soft dark:shadow-soft-dark">
              <table className="min-w-full divide-y divide-border-light dark:divide-border-dark text-sm">
                <thead className="bg-accent/30 dark:bg-primary/10">
                  <tr>
                    <th className="px-4 py-3 text-right font-semibold text-text-light/80 dark:text-text-dark/70">العميل</th>
                    <th className="px-4 py-3 text-right font-semibold text-text-light/80 dark:text-text-dark/70">الطلبات</th>
                    <th className="px-4 py-3 text-right font-semibold text-text-light/80 dark:text-text-dark/70">إجمالي المبيعات</th>
                    <th className="px-4 py-3 text-right font-semibold text-text-light/80 dark:text-text-dark/70">المحصّل</th>
                    <th className="px-4 py-3 text-right font-semibold text-text-light/80 dark:text-text-dark/70">المتبقي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark bg-surface-light dark:bg-surface-dark">
                  {data.byCustomer.map((row) => (
                    <tr key={row.customerId} className="hover:bg-accent/20 dark:hover:bg-primary/10 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/bulk/customers/${row.customerId}`} className="text-primary hover:text-primary-hover font-medium transition-colors">
                          {row.companyName}
                        </Link>
                        {row.tradeName && <span className="block text-xs text-text-light/40 dark:text-text-dark/40">{row.tradeName}</span>}
                      </td>
                      <td className="px-4 py-3 text-text-light/80 dark:text-text-dark/80">{row.orderCount}</td>
                      <td className="px-4 py-3 font-medium text-text-light dark:text-text-dark">{formatEGP(row.totalSales)}</td>
                      <td className="px-4 py-3 text-emerald-700 dark:text-emerald-400">{formatEGP(row.totalPaid)}</td>
                      <td className={`px-4 py-3 font-medium ${row.totalDue > 0 ? "text-red-600 dark:text-red-400" : "text-text-light/40 dark:text-text-dark/40"}`}>
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

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await bulkService.reportArAging({ asOf });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) toast.error(err?.data?.error || "تعذر تحميل التقرير");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(load, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [asOf]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="block text-xs text-text-light/60 dark:text-text-dark/60 mb-1">حتى تاريخ</label>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className={inputCls} />
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <SummaryCard label="إجمالي المتأخرات" value={formatEGP(data.summary.totalDue)} tone="highlight" />
            <SummaryCard label="0 – 30 يوم" value={formatEGP(data.summary.b0_30)} />
            <SummaryCard label="31 – 60 يوم" value={formatEGP(data.summary.b31_60)} />
            <SummaryCard label="61 – 90 يوم" value={formatEGP(data.summary.b61_90)} />
            <SummaryCard label="+90 يوم" value={formatEGP(data.summary.b90plus)} tone="danger" />
          </div>

          {data.rows.length === 0 ? (
            <p className="text-text-light/40 dark:text-text-dark/40 text-center py-8">لا توجد مديونيات مفتوحة</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border-light dark:border-border-dark shadow-soft dark:shadow-soft-dark">
              <table className="min-w-full divide-y divide-border-light dark:divide-border-dark text-sm">
                <thead className="bg-accent/30 dark:bg-primary/10">
                  <tr>
                    {["العميل", "حد الائتمان", "0 – 30", "31 – 60", "61 – 90", "+90", "الإجمالي"].map((h) => (
                      <th key={h} className="px-4 py-3 text-right font-semibold text-text-light/80 dark:text-text-dark/70">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark bg-surface-light dark:bg-surface-dark">
                  {data.rows.map((row) => (
                    <tr key={row.customerId} className="hover:bg-accent/20 dark:hover:bg-primary/10 transition-colors">
                      <td className="px-4 py-3">
                        <Link to={`/bulk/customers/${row.customerId}`} className="text-primary hover:text-primary-hover font-medium transition-colors">
                          {row.companyName}
                        </Link>
                        {row.tradeName && <span className="block text-xs text-text-light/40 dark:text-text-dark/40">{row.tradeName}</span>}
                      </td>
                      <td className="px-4 py-3 text-text-light/50 dark:text-text-dark/50 text-xs">
                        {row.creditLimit != null ? formatEGP(row.creditLimit) : "غير محدود"}
                      </td>
                      <td className="px-4 py-3 text-text-light/80 dark:text-text-dark/80">{row.b0_30 > 0 ? formatEGP(row.b0_30) : "—"}</td>
                      <td className="px-4 py-3 text-amber-700 dark:text-amber-400">{row.b31_60 > 0 ? formatEGP(row.b31_60) : "—"}</td>
                      <td className="px-4 py-3 text-orange-700 dark:text-orange-400">{row.b61_90 > 0 ? formatEGP(row.b61_90) : "—"}</td>
                      <td className="px-4 py-3 text-red-700 dark:text-red-400 font-medium">{row.b90plus > 0 ? formatEGP(row.b90plus) : "—"}</td>
                      <td className="px-4 py-3 font-bold text-text-light dark:text-text-dark">{formatEGP(row.total)}</td>
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

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await bulkService.reportStatement({ customerId, from, to });
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) toast.error(err?.data?.error || "تعذر تحميل الكشف");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const t = setTimeout(load, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [customerId, from, to]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-text-light/60 dark:text-text-dark/60 mb-1">العميل</label>
          <div className="relative">
            <input
              type="text"
              placeholder="ابحث باسم الشركة…"
              value={customerSearch}
              onChange={(e) => { setCustomerSearch(e.target.value); searchCustomers(e.target.value); }}
              className={`${inputCls} w-full`}
            />
            {customers.length > 0 && customerSearch && !customerId && (
              <ul className="absolute z-10 w-full bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl mt-1 shadow-soft max-h-48 overflow-y-auto text-sm">
                {customers.map((c) => (
                  <li
                    key={c.id}
                    className="px-3 py-2 cursor-pointer hover:bg-accent/30 dark:hover:bg-primary/10 text-text-light dark:text-text-dark transition-colors"
                    onClick={() => { setCustomerId(c.id); setCustomerSearch(c.companyName); setCustomers([]); }}
                  >
                    {c.companyName}
                    {c.tradeName && <span className="text-text-light/40 text-xs"> — {c.tradeName}</span>}
                  </li>
                ))}
              </ul>
            )}
            {loadingCustomers && (
              <span className="absolute left-2 top-3 text-xs text-text-light/40">جارٍ البحث…</span>
            )}
          </div>
          {customerId && (
            <button
              className="text-xs text-red-500 mt-1 hover:underline"
              onClick={() => { setCustomerId(""); setCustomerSearch(""); setData(null); }}
            >
              مسح الاختيار
            </button>
          )}
        </div>
        <DateRangeFilter from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
      </div>

      {data && (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-bold text-text-light dark:text-text-dark">{data.customer.companyName}</h3>
              {data.customer.tradeName && <p className="text-sm text-text-light/60 dark:text-text-dark/60">{data.customer.tradeName}</p>}
              <p className="text-xs text-text-light/40 dark:text-text-dark/40 mt-1">
                الفترة: {new Date(data.period.from).toLocaleDateString("ar-EG")} — {new Date(data.period.to).toLocaleDateString("ar-EG")}
              </p>
            </div>
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 border border-border-light dark:border-border-dark rounded-xl text-sm text-text-light dark:text-text-dark hover:bg-accent/30 dark:hover:bg-primary/10 transition-colors"
            >
              طباعة
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <SummaryCard label="إجمالي المديونية" value={formatEGP(data.summary.totalDebit)} />
            <SummaryCard label="إجمالي المدفوع" value={formatEGP(data.summary.totalCredit)} tone="success" />
            <SummaryCard label="الرصيد الختامي" value={formatEGP(data.summary.closingBalance)} tone="highlight" />
          </div>

          {data.entries.length === 0 ? (
            <p className="text-text-light/40 dark:text-text-dark/40 text-center py-8">لا توجد حركات في هذه الفترة</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border-light dark:border-border-dark shadow-soft dark:shadow-soft-dark print:border-0">
              <table className="min-w-full divide-y divide-border-light dark:divide-border-dark text-sm">
                <thead className="bg-accent/30 dark:bg-primary/10 print:bg-white">
                  <tr>
                    {["التاريخ", "النوع", "المرجع", "البيان", "مدين", "دائن", "الرصيد"].map((h) => (
                      <th key={h} className="px-4 py-3 text-right font-semibold text-text-light/80 dark:text-text-dark/70">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light dark:divide-border-dark bg-surface-light dark:bg-surface-dark">
                  {data.entries.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-accent/20 dark:hover:bg-primary/10 transition-colors">
                      <td className="px-4 py-2 text-text-light/60 dark:text-text-dark/60 text-xs whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="px-4 py-2">
                        <StatusChip status={entry.type} />
                      </td>
                      <td className="px-4 py-2 text-text-light/70 dark:text-text-dark/70 text-xs font-mono">{entry.ref}</td>
                      <td className="px-4 py-2 text-text-light/70 dark:text-text-dark/70 text-xs">{entry.description}</td>
                      <td className="px-4 py-2 text-text-light dark:text-text-dark font-medium">
                        {entry.debit > 0 ? formatEGP(entry.debit) : "—"}
                      </td>
                      <td className="px-4 py-2 text-emerald-700 dark:text-emerald-400 font-medium">
                        {entry.credit > 0 ? formatEGP(entry.credit) : "—"}
                      </td>
                      <td className={`px-4 py-2 font-bold ${entry.balance > 0 ? "text-red-600 dark:text-red-400" : "text-text-light/50 dark:text-text-dark/50"}`}>
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
    <div className="bg-background-light dark:bg-background-dark min-h-screen p-6 transition-colors duration-300" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">تقارير الجملة</h1>
            <div className="h-1.5 w-28 bg-primary rounded-full mt-1 opacity-80" />
            <p className="text-text-light/60 dark:text-text-dark/60 mt-2 text-sm">
              مبيعات العملاء، تقادم الذمم، وكشف الحساب
            </p>
          </div>
          <Link
            to="/reports/detailed"
            className="flex items-center gap-2 text-primary hover:bg-primary/10 px-4 py-2 rounded-xl transition-colors text-sm"
          >
            <span className="material-symbols-outlined text-lg">arrow_forward</span>
            عودة للسجلات
          </Link>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border-light dark:border-border-dark">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors duration-200 ${
                activeTab === tab.id
                  ? "border-primary text-primary dark:text-accent"
                  : "border-transparent text-text-light/60 dark:text-text-dark/60 hover:text-text-light dark:hover:text-text-dark"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "sales" && <SalesByCustomerTab />}
        {activeTab === "aging" && <ArAgingTab />}
        {activeTab === "statement" && <StatementTab />}
      </div>
    </div>
  );
}
