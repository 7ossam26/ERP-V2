import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { formatEGP } from "../../utils/bulkMoney";
import BulkSectionTabs from "../../components/bulk/BulkSectionTabs";
import BulkPaymentModal from "../../components/bulk/BulkPaymentModal";
import StatusChip from "../../components/bulk/StatusChip";
import SummaryCard from "../../components/bulk/SummaryCard";

const TYPE_BADGE = {
  ORDER: { label: "مبيعات", cls: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
  PAYMENT: { label: "دفعة", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" },
  REFUND: { label: "مرتجع", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
};

export default function BulkCollectionsPage() {
  const [agingRows, setAgingRows] = useState([]);
  const [agingLoading, setAgingLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statement, setStatement] = useState(null);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("orders");
  const [payOrder, setPayOrder] = useState(null);

  const loadAging = () => {
    setAgingLoading(true);
    bulkService
      .reportArAging()
      .then((r) => setAgingRows(r.rows || []))
      .catch(() => toast.error("تعذر تحميل بيانات التحصيل"))
      .finally(() => setAgingLoading(false));
  };

  useEffect(() => { loadAging(); }, []);

  const loadDetail = (customerId) => {
    if (!customerId) { setStatement(null); setPendingOrders([]); return; }
    setDetailLoading(true);
    Promise.all([
      bulkService.reportStatement({ customerId }),
      bulkService.listOrders({ customerId, status: "CONFIRMED" }),
      bulkService.listOrders({ customerId, status: "PARTIALLY_PAID" }),
    ])
      .then(([stmt, confirmed, partial]) => {
        setStatement(stmt);
        const combined = [...confirmed, ...partial];
        combined.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        setPendingOrders(combined);
      })
      .catch(() => toast.error("تعذر تحميل تفاصيل العميل"))
      .finally(() => setDetailLoading(false));
  };

  const selectCustomer = (id) => {
    setSelectedId(id);
    setActiveTab("orders");
    loadDetail(id);
  };

  const afterPayment = () => {
    setPayOrder(null);
    loadAging();
    loadDetail(selectedId);
  };

  const filteredRows = agingRows.filter((r) =>
    !search.trim() ||
    (r.companyName || "").toLowerCase().includes(search.trim().toLowerCase())
  );

  const selectedRow = agingRows.find((r) => r.customerId === selectedId);

  return (
    <div className="p-3 sm:p-4" dir="rtl">
      {/* Page header */}
      <div className="mb-3">
        <h1 className="text-2xl font-bold text-text-light dark:text-text-dark">الجملة</h1>
        <div className="h-1 w-16 bg-primary rounded-full mt-1 mb-3 opacity-80" />
        <BulkSectionTabs />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left panel — customer list */}
        <div className="lg:col-span-1 bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-soft dark:shadow-soft-dark overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border-light dark:border-border-dark bg-accent/5 dark:bg-primary/5">
            <div className="text-sm font-bold text-text-light dark:text-text-dark mb-2">
              العملاء المديونون ({filteredRows.length})
            </div>
            <input
              type="search"
              placeholder="بحث بالاسم..."
              className="w-full border border-border-light dark:border-border-dark rounded-xl p-2 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="overflow-y-auto flex-1 max-h-[65vh]">
            {agingLoading ? (
              <div className="p-8 text-center text-text-light/40 dark:text-text-dark/40 text-sm">جارٍ التحميل...</div>
            ) : filteredRows.length === 0 ? (
              <div className="p-8 text-center text-text-light/40 dark:text-text-dark/40 text-sm">
                {search ? "لا توجد نتائج" : "لا يوجد عملاء مديونون"}
              </div>
            ) : (
              filteredRows.map((row) => (
                <button
                  key={row.customerId}
                  onClick={() => selectCustomer(row.customerId)}
                  className={`w-full text-right p-3 border-b border-border-light dark:border-border-dark transition-colors duration-150 ${
                    selectedId === row.customerId
                      ? "bg-primary/10 dark:bg-primary/20"
                      : "hover:bg-accent/20 dark:hover:bg-primary/10"
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-text-light dark:text-text-dark truncate">
                        {row.companyName}
                      </div>
                      {row.tradeName && (
                        <div className="text-xs text-text-light/50 dark:text-text-dark/50 truncate">{row.tradeName}</div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-red-600 dark:text-red-400">{formatEGP(row.total)}</div>
                      <div className="text-[10px] text-text-light/40 dark:text-text-dark/40">مستحق</div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel — customer detail */}
        <div className="lg:col-span-2 space-y-3">
          {!selectedId ? (
            <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-16 text-center">
              <span className="material-icons-round text-5xl text-text-light/20 dark:text-text-dark/20 mb-3 block">touch_app</span>
              <p className="text-sm text-text-light/40 dark:text-text-dark/40">اختر عميلًا من القائمة لعرض تفاصيل حسابه</p>
            </div>
          ) : (
            <>
              {/* Customer header card */}
              <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-soft dark:shadow-soft-dark p-4">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-text-light dark:text-text-dark">
                      {selectedRow?.companyName}
                    </h2>
                    {selectedRow?.tradeName && (
                      <div className="text-sm text-text-light/50 dark:text-text-dark/50">{selectedRow.tradeName}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400">{formatEGP(selectedRow?.total)}</div>
                    <div className="text-xs text-text-light/50 dark:text-text-dark/50">إجمالي المستحق</div>
                  </div>
                </div>

                {/* Aging buckets */}
                {selectedRow && (
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { label: "0-30 يوم", val: selectedRow.b0_30 },
                      { label: "31-60 يوم", val: selectedRow.b31_60 },
                      { label: "61-90 يوم", val: selectedRow.b61_90 },
                      { label: "+90 يوم", val: selectedRow.b90plus },
                    ].map(({ label, val }) => (
                      <div key={label} className="bg-accent/10 dark:bg-primary/10 rounded-xl p-2 text-center">
                        <div className="text-xs text-text-light/50 dark:text-text-dark/50">{label}</div>
                        <div className={`text-sm font-bold mt-0.5 ${val > 0 ? "text-red-600 dark:text-red-400" : "text-text-light/40 dark:text-text-dark/40"}`}>
                          {val > 0 ? formatEGP(val) : "—"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Link
                    to={`/bulk/customers/${selectedId}`}
                    className="border border-primary/30 text-primary hover:bg-primary/5 px-3 py-2 rounded-xl text-sm transition-colors"
                  >
                    ملف العميل
                  </Link>
                  <Link
                    to={`/bulk/pos?customerId=${selectedId}`}
                    className="border border-primary/30 text-primary hover:bg-primary/5 px-3 py-2 rounded-xl text-sm transition-colors"
                  >
                    فاتورة جديدة
                  </Link>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-border-light dark:border-border-dark">
                {[
                  { key: "orders", label: `الطلبات المعلقة (${pendingOrders.length})` },
                  { key: "statement", label: "كشف الحساب" },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors duration-200 ${
                      activeTab === t.key
                        ? "border-primary text-primary dark:text-accent"
                        : "border-transparent text-text-light/60 dark:text-text-dark/60 hover:text-text-light dark:hover:text-text-dark"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {detailLoading ? (
                <div className="p-8 text-center text-text-light/40 dark:text-text-dark/40 text-sm">جارٍ التحميل...</div>
              ) : (
                <>
                  {activeTab === "orders" && (
                    <PendingOrdersTab orders={pendingOrders} onPay={setPayOrder} />
                  )}
                  {activeTab === "statement" && statement && (
                    <StatementTab statement={statement} />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {payOrder && (
        <BulkPaymentModal
          order={payOrder}
          onSuccess={afterPayment}
          onClose={() => setPayOrder(null)}
        />
      )}
    </div>
  );
}

function PendingOrdersTab({ orders, onPay }) {
  if (orders.length === 0) {
    return (
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-8 text-center text-sm text-text-light/40 dark:text-text-dark/40">
        لا يوجد طلبات معلقة التحصيل.
      </div>
    );
  }

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-soft dark:shadow-soft-dark overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-accent/30 dark:bg-primary/10">
          <tr>
            <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">الطلب</th>
            <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">التاريخ</th>
            <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">الإجمالي</th>
            <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">المتبقي</th>
            <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">الحالة</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-border-light dark:border-border-dark hover:bg-accent/20 dark:hover:bg-primary/10 transition-colors">
              <td className="p-3">
                <Link to={`/bulk/orders/${o.id}`} className="text-primary hover:text-primary-hover font-semibold transition-colors">
                  {o.orderNumber || `#${o.id}`}
                </Link>
              </td>
              <td className="p-3 ltr-numbers text-text-light/70 dark:text-text-dark/70">
                {new Date(o.createdAt).toLocaleDateString("ar-EG")}
              </td>
              <td className="p-3 text-text-light dark:text-text-dark">{formatEGP(o.total)}</td>
              <td className="p-3 font-bold text-red-600 dark:text-red-400">{formatEGP(o.balanceDue)}</td>
              <td className="p-3"><StatusChip status={o.status} /></td>
              <td className="p-3">
                <button
                  onClick={() => onPay(o)}
                  className="bg-primary hover:bg-primary-hover text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
                >
                  تحصيل
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatementTab({ statement }) {
  const { summary, entries } = statement;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="إجمالي المبيعات" value={formatEGP(summary.totalDebit)} />
        <SummaryCard label="إجمالي المدفوع" value={formatEGP(summary.totalCredit)} tone="success" />
        <SummaryCard
          label="الرصيد المفتوح"
          value={formatEGP(summary.closingBalance)}
          tone={summary.closingBalance > 0 ? "danger" : "default"}
        />
      </div>

      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-soft dark:shadow-soft-dark overflow-hidden">
        {entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-text-light/40 dark:text-text-dark/40">لا يوجد حركات.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-accent/30 dark:bg-primary/10">
                <tr>
                  <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">التاريخ</th>
                  <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">النوع</th>
                  <th className="text-right p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">المرجع</th>
                  <th className="text-left p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">مدين</th>
                  <th className="text-left p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">دائن</th>
                  <th className="text-left p-2 text-text-light/80 dark:text-text-dark/70 font-semibold">الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const badge = TYPE_BADGE[e.type] || TYPE_BADGE.PAYMENT;
                  return (
                    <tr key={i} className="border-t border-border-light dark:border-border-dark hover:bg-accent/20 dark:hover:bg-primary/10">
                      <td className="p-2 ltr-numbers text-text-light/70 dark:text-text-dark/70 whitespace-nowrap">
                        {new Date(e.date).toLocaleDateString("ar-EG")}
                      </td>
                      <td className="p-2">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-2">
                        {e.type === "ORDER" ? (
                          <Link to={`/bulk/orders/${e.orderId}`} className="text-primary hover:text-primary-hover transition-colors font-medium">
                            {e.ref}
                          </Link>
                        ) : (
                          <span className="text-text-light/60 dark:text-text-dark/60 text-xs">{e.ref}</span>
                        )}
                      </td>
                      <td className="p-2 text-left ltr-numbers font-medium text-red-600 dark:text-red-400">
                        {e.debit > 0 ? formatEGP(e.debit) : "—"}
                      </td>
                      <td className="p-2 text-left ltr-numbers font-medium text-emerald-600 dark:text-emerald-400">
                        {e.credit > 0 ? formatEGP(e.credit) : "—"}
                      </td>
                      <td className={`p-2 text-left ltr-numbers font-bold ${e.balance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                        {formatEGP(e.balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-border-light dark:border-border-dark bg-accent/20 dark:bg-primary/10">
                <tr>
                  <td colSpan={3} className="p-2 font-bold text-text-light dark:text-text-dark text-sm">الإجمالي</td>
                  <td className="p-2 text-left ltr-numbers font-bold text-red-600 dark:text-red-400">{formatEGP(summary.totalDebit)}</td>
                  <td className="p-2 text-left ltr-numbers font-bold text-emerald-600 dark:text-emerald-400">{formatEGP(summary.totalCredit)}</td>
                  <td className={`p-2 text-left ltr-numbers font-bold ${summary.closingBalance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                    {formatEGP(summary.closingBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
