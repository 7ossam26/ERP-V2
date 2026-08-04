import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { bulkService } from "../../services/bulkService";
import { treasuryService } from "../../services/treasuryService";
import { formatEGP } from "../../utils/bulkMoney";
import { scopeTreasuriesToBranches } from "../../utils/treasuryScope";
import BulkSectionTabs from "../../components/bulk/BulkSectionTabs";
import StatusChip from "../../components/bulk/StatusChip";
import { useBranch } from "../../contexts/BranchContext";

const TYPE_BADGE = {
  ORDER:   { label: "مبيعات",  cls: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
  PAYMENT: { label: "دفعة",    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" },
  REFUND:  { label: "مرتجع",   cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
  OLD_DEBT:{ label: "رصيد أولي", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400" },
};

const METHOD_BADGE = {
  CASH:          { label: "نقدي",        cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" },
  BANK_TRANSFER: { label: "تحويل بنكي",  cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
  CHEQUE:        { label: "شيك",         cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-400" },
  CREDIT:        { label: "دين",         cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400" },
};

// ─── modals ──────────────────────────────────────────────────────────────────

function PayDebtModal({ customer, openBalance, onSuccess, onClose }) {
  const { userBranches } = useBranch();
  const [amount, setAmount]         = useState(openBalance > 0 ? String(openBalance.toFixed(2)) : "");
  const [treasuryId, setTreasuryId] = useState("");
  const [notes, setNotes]           = useState("");
  const [treasuries, setTreasuries] = useState([]);
  const [loading, setLoading]       = useState(false);

  useEffect(() => {
    treasuryService.getAll().then((list) => {
      const filtered = scopeTreasuriesToBranches(list, userBranches);
      setTreasuries(filtered);
      if (filtered.length > 0) setTreasuryId(String(filtered[0].id));
    }).catch(() => {});
  }, [userBranches]);

  const submit = async (e) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("أدخل مبلغ صحيح");
    if (!treasuryId) return toast.error("اختر خزينة");
    setLoading(true);
    try {
      await bulkService.createCustomerPayment(customer.id, { amount: amt, treasuryId: Number(treasuryId), notes });
      toast.success("تم تسجيل الدفعة");
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.error || "تعذر تسجيل الدفعة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b border-border-light dark:border-border-dark">
          <h3 className="font-bold text-text-light dark:text-text-dark">سداد دفعة</h3>
          <button onClick={onClose} className="text-text-light/50 hover:text-text-light dark:text-text-dark/50 dark:hover:text-text-dark">
            <span className="material-icons-round text-xl">close</span>
          </button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-4">
          <p className="text-sm text-text-light/70 dark:text-text-dark/70">
            العميل: <strong className="text-text-light dark:text-text-dark">{customer.companyName}</strong>
            {openBalance > 0 && (
              <> · الرصيد المستحق: <strong className="text-red-600">{formatEGP(openBalance)}</strong></>
            )}
          </p>

          <div>
            <label className="block text-sm font-medium text-text-light/70 dark:text-text-dark/70 mb-1">المبلغ</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-border-light dark:border-border-dark rounded-xl p-2 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-light/70 dark:text-text-dark/70 mb-1">الخزينة</label>
            <select
              value={treasuryId}
              onChange={(e) => setTreasuryId(e.target.value)}
              className="w-full border border-border-light dark:border-border-dark rounded-xl p-2 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {treasuries.map((t) => (
                <option key={t.id} value={String(t.id)}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-light/70 dark:text-text-dark/70 mb-1">ملاحظات (اختياري)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-border-light dark:border-border-dark rounded-xl p-2 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border-light dark:border-border-dark rounded-xl hover:bg-accent/20 dark:hover:bg-primary/10 transition-colors">
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm bg-primary hover:bg-primary-hover text-white rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? "جارٍ التسجيل..." : "تسجيل الدفعة"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function OldDebtModal({ customer, onSuccess, onClose }) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes]   = useState("");
  const [date, setDate]     = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) return toast.error("أدخل مبلغ صحيح");
    setLoading(true);
    try {
      await bulkService.addCustomerOldDebt(customer.id, { amount: amt, notes, date });
      toast.success("تم إضافة الدين القديم");
      onSuccess();
    } catch (err) {
      toast.error(err?.response?.data?.error || "تعذر إضافة الدين القديم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center p-4 border-b border-border-light dark:border-border-dark">
          <h3 className="font-bold text-text-light dark:text-text-dark">إضافة دين قديم</h3>
          <button onClick={onClose} className="text-text-light/50 hover:text-text-light dark:text-text-dark/50 dark:hover:text-text-dark">
            <span className="material-icons-round text-xl">close</span>
          </button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-4">
          <p className="text-sm text-text-light/70 dark:text-text-dark/70">
            العميل: <strong className="text-text-light dark:text-text-dark">{customer.companyName}</strong>
          </p>

          <div>
            <label className="block text-sm font-medium text-text-light/70 dark:text-text-dark/70 mb-1">المبلغ</label>
            <input
              type="number" step="0.01" min="0.01" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-border-light dark:border-border-dark rounded-xl p-2 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-light/70 dark:text-text-dark/70 mb-1">التاريخ</label>
            <input
              type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full border border-border-light dark:border-border-dark rounded-xl p-2 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-light/70 dark:text-text-dark/70 mb-1">ملاحظات (اختياري)</label>
            <input
              type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-border-light dark:border-border-dark rounded-xl p-2 bg-surface-light dark:bg-surface-dark text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-border-light dark:border-border-dark rounded-xl hover:bg-accent/20 dark:hover:bg-primary/10 transition-colors">
              إلغاء
            </button>
            <button
              type="submit" disabled={loading}
              className="px-5 py-2 text-sm bg-amber-600 hover:bg-amber-700 text-white rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? "جارٍ الحفظ..." : "إضافة الدين"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function BulkCollectionsPage() {
  const [customers, setCustomers]       = useState([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [search, setSearch]             = useState("");

  const [selectedId, setSelectedId]     = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [orders, setOrders]             = useState([]);
  const [payments, setPayments]         = useState([]);
  const [activeTab, setActiveTab]       = useState("orders");

  const [payModal, setPayModal]         = useState(null);   // customer obj
  const [debtModal, setDebtModal]       = useState(null);   // customer obj

  const loadCustomers = useCallback(() => {
    setCustomersLoading(true);
    bulkService
      .listCustomers({ includeBalance: "true" })
      .then((res) => setCustomers(Array.isArray(res) ? res : (res.data || [])))
      .catch(() => toast.error("تعذر تحميل العملاء"))
      .finally(() => setCustomersLoading(false));
  }, []);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const loadDetail = useCallback((customerId) => {
    if (!customerId) { setOrders([]); setPayments([]); return; }
    setDetailLoading(true);
    Promise.all([
      bulkService.listOrders({ customerId, status: "CONFIRMED" }),
      bulkService.listOrders({ customerId, status: "PARTIALLY_PAID" }),
      // The full statement, not just payments: a collector needs to see what the
      // customer was charged next to what they paid, in one column of dates.
      // includeInactive brings cancelled orders and voided payments back as
      // zero-value rows, so "where did that payment go?" has an answer on screen.
      bulkService.reportStatement({ customerId, includeInactive: 1 }),
    ])
      .then(([confirmed, partial, statement]) => {
        const combined = [...confirmed, ...partial];
        combined.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        setOrders(combined);
        setPayments(Array.isArray(statement?.entries) ? statement.entries : []);
      })
      .catch(() => toast.error("تعذر تحميل تفاصيل العميل"))
      .finally(() => setDetailLoading(false));
  }, []);

  const selectCustomer = (id) => {
    setSelectedId(id);
    setActiveTab("orders");
    loadDetail(id);
  };

  const afterAction = () => {
    setPayModal(null);
    setDebtModal(null);
    loadCustomers();
    if (selectedId) loadDetail(selectedId);
  };

const selectedCustomer = customers.find((c) => c.id === selectedId);
  const openBalance = Number(selectedCustomer?.openBalance ?? 0);

  const filteredCustomers = customers.filter((c) =>
    !search.trim() ||
    (c.companyName || "").toLowerCase().includes(search.trim().toLowerCase()) ||
    (c.tradeName || "").toLowerCase().includes(search.trim().toLowerCase())
  );

  // Sort: customers with balance first, then alphabetical
  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    const balA = Number(a.openBalance ?? a.creditExposure ?? 0);
    const balB = Number(b.openBalance ?? b.creditExposure ?? 0);
    if (balB !== balA) return balB - balA;
    return (a.companyName || "").localeCompare(b.companyName || "", "ar");
  });

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
              العملاء ({sortedCustomers.length})
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
            {customersLoading ? (
              <div className="p-8 text-center text-text-light/40 dark:text-text-dark/40 text-sm">جارٍ التحميل...</div>
            ) : sortedCustomers.length === 0 ? (
              <div className="p-8 text-center text-text-light/40 dark:text-text-dark/40 text-sm">لا يوجد عملاء</div>
            ) : (
              sortedCustomers.map((customer) => {
                const bal = Number(customer.openBalance ?? customer.creditExposure ?? 0);
                return (
                  <button
                    key={customer.id}
                    onClick={() => selectCustomer(customer.id)}
                    className={`w-full text-right p-3 border-b border-border-light dark:border-border-dark transition-colors duration-150 ${
                      selectedId === customer.id
                        ? "bg-primary/10 dark:bg-primary/20"
                        : "hover:bg-accent/20 dark:hover:bg-primary/10"
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-text-light dark:text-text-dark truncate">
                          {customer.companyName}
                        </div>
                        {customer.tradeName && (
                          <div className="text-xs text-text-light/50 dark:text-text-dark/50 truncate">{customer.tradeName}</div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {bal > 0 ? (
                          <>
                            <div className="text-sm font-bold text-red-600 dark:text-red-400">{formatEGP(bal)}</div>
                            <div className="text-[10px] text-text-light/40 dark:text-text-dark/40">مستحق</div>
                          </>
                        ) : (
                          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">مسدد</div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
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
                      {selectedCustomer?.companyName}
                    </h2>
                    {selectedCustomer?.tradeName && (
                      <div className="text-sm text-text-light/50 dark:text-text-dark/50">{selectedCustomer.tradeName}</div>
                    )}
                  </div>
                  {openBalance > 0 && (
                    <div className="text-right">
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">{formatEGP(openBalance)}</div>
                      <div className="text-xs text-text-light/50 dark:text-text-dark/50">إجمالي المستحق</div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {openBalance > 0 && (
                    <button
                      onClick={() => setPayModal(selectedCustomer)}
                      className="bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-icons-round text-[16px]">payments</span>
                      سداد دفعة
                    </button>
                  )}
                  <button
                    onClick={() => setDebtModal(selectedCustomer)}
                    className="border border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-icons-round text-[16px]">add_circle_outline</span>
                    إضافة دين قديم
                  </button>
                  <Link
                    to={`/bulk/customers/${selectedId}`}
                    className="border border-border-light dark:border-border-dark text-text-light/70 dark:text-text-dark/70 hover:bg-accent/20 dark:hover:bg-primary/10 px-4 py-2 rounded-xl text-sm transition-colors"
                  >
                    ملف العميل
                  </Link>
                  <Link
                    to={`/bulk/pos?customerId=${selectedId}`}
                    className="border border-border-light dark:border-border-dark text-text-light/70 dark:text-text-dark/70 hover:bg-accent/20 dark:hover:bg-primary/10 px-4 py-2 rounded-xl text-sm transition-colors"
                  >
                    فاتورة جديدة
                  </Link>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 border-b border-border-light dark:border-border-dark">
                {[
                  { key: "orders",   label: `الطلبات المعلقة (${orders.length})` },
                  { key: "payments", label: "سجل الدفعات" },
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
                  {activeTab === "orders" && <PendingOrdersTab orders={orders} />}
                  {activeTab === "payments" && (
                    <PaymentsTab payments={payments} />
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {payModal && (
        <PayDebtModal
          customer={payModal}
          openBalance={openBalance}
          onSuccess={afterAction}
          onClose={() => setPayModal(null)}
        />
      )}
      {debtModal && (
        <OldDebtModal
          customer={debtModal}
          onSuccess={afterAction}
          onClose={() => setDebtModal(null)}
        />
      )}
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────────

function PendingOrdersTab({ orders }) {
  if (orders.length === 0) {
    return (
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-8 text-center text-sm text-text-light/40 dark:text-text-dark/40">
        لا يوجد طلبات معلقة.
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
            <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">المخزن</th>
            <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">الإجمالي</th>
            <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">المتبقي</th>
            <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">الحالة</th>
            <th className="p-3 w-10"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-t border-border-light dark:border-border-dark hover:bg-accent/20 dark:hover:bg-primary/10 transition-colors">
              <td className="p-3">
                <span className="font-semibold text-text-light dark:text-text-dark">{o.orderNumber || `#${o.id}`}</span>
              </td>
              <td className="p-3 ltr-numbers text-text-light/70 dark:text-text-dark/70">
                {new Date(o.createdAt).toLocaleDateString("ar-EG")}
              </td>
              {/* The stock left this warehouse. It is fixed at confirm time from
                  the operator's branch, so it says where the goods physically
                  went out from — not where the customer is. */}
              <td className="p-3">
                {o.warehouse?.name ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/25 dark:text-indigo-300 whitespace-nowrap">
                    <span className="material-icons-round text-[13px]">warehouse</span>
                    {o.warehouse.name}
                  </span>
                ) : (
                  <span className="text-text-light/30 dark:text-text-dark/30 text-xs">—</span>
                )}
              </td>
              <td className="p-3 text-text-light dark:text-text-dark">{formatEGP(o.total)}</td>
              <td className="p-3 font-bold text-red-600 dark:text-red-400">{formatEGP(o.balanceDue)}</td>
              <td className="p-3"><StatusChip status={o.status} /></td>
              <td className="p-3">
                <Link
                  to={`/bulk/orders/${o.id}`}
                  className="text-primary hover:text-primary-hover transition-colors"
                  title="عرض الطلب"
                >
                  <span className="material-icons-round text-[20px]">visibility</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The customer's whole account, not just the money they handed over: invoices
 * and the opening balance in مدين, payments and refunds in دائن, with the
 * running balance beside them. Cancelled orders and voided payments are listed
 * at zero and struck through — a collector on the phone has to be able to answer
 * "what happened to that payment?" without leaving the screen.
 *
 * Rows come straight from GET /bulk/reports/statement?includeInactive=1, which
 * is also what the credit badge and the limit check read. One arithmetic, so
 * this table cannot disagree with the figure at the top of the page.
 */
function PaymentsTab({ payments: entries }) {
  if (entries.length === 0) {
    return (
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark p-8 text-center text-sm text-text-light/40 dark:text-text-dark/40">
        لا يوجد حركات مالية.
      </div>
    );
  }

  const totalDebit  = entries.reduce((s, e) => s + Number(e.debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.credit || 0), 0);
  const closing = entries.length ? Number(entries[entries.length - 1].balance || 0) : 0;

  const ENTRY_BADGE = {
    ORDER:   TYPE_BADGE.ORDER,
    PAYMENT: TYPE_BADGE.PAYMENT,
    REFUND:  TYPE_BADGE.REFUND,
    OPENING: TYPE_BADGE.OLD_DEBT,
  };

  return (
    <div className="bg-surface-light dark:bg-surface-dark rounded-xl border border-border-light dark:border-border-dark shadow-soft dark:shadow-soft-dark overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-accent/30 dark:bg-primary/10">
            <tr>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold whitespace-nowrap">التاريخ</th>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">النوع</th>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">طريقة الدفع</th>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">المرجع</th>
              <th className="text-left p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">عليه (دين)</th>
              <th className="text-left p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">له (مدفوع)</th>
              <th className="text-left p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">الرصيد</th>
              <th className="text-right p-3 text-text-light/80 dark:text-text-dark/70 font-semibold">ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const badge    = ENTRY_BADGE[e.type] || TYPE_BADGE.PAYMENT;
              const inactive = e.status === "VOIDED" || e.status === "CANCELLED";
              const method   = e.method ? METHOD_BADGE[e.method] : null;
              return (
                <tr
                  key={`${e.type}-${e.ref}-${i}`}
                  className={`border-t border-border-light dark:border-border-dark transition-colors ${
                    inactive
                      ? "opacity-45"
                      : e.type === "OPENING"
                      ? "bg-red-50/60 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20"
                      : "hover:bg-accent/20 dark:hover:bg-primary/10"
                  }`}
                >
                  <td className="p-3 ltr-numbers text-text-light/70 dark:text-text-dark/70 whitespace-nowrap">
                    {new Date(e.date).toLocaleDateString("ar-EG")}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                    {inactive && (
                      <span className="mr-1 inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                        {e.status === "VOIDED" ? "ملغاة" : "ملغي"}
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    {method ? (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${method.cls}`}>
                        {method.label}
                      </span>
                    ) : (
                      <span className="text-text-light/30 dark:text-text-dark/30 text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {e.orderId ? (
                      <Link to={`/bulk/orders/${e.orderId}`} className="text-primary hover:text-primary-hover transition-colors font-medium text-xs">
                        {e.orderNumber || e.ref}
                      </Link>
                    ) : (
                      <span className="text-text-light/50 dark:text-text-dark/50 text-xs">{e.ref}</span>
                    )}
                  </td>
                  {/* A cancelled or voided row carries its original amount struck
                      through: the history stays readable while the arithmetic
                      correctly ignores it. */}
                  <td className="p-3 text-left ltr-numbers font-bold text-red-600 dark:text-red-400">
                    {e.debit > 0 ? formatEGP(e.debit)
                      : inactive && e.type !== "PAYMENT" && e.amount > 0
                      ? <span className="line-through opacity-60">{formatEGP(e.amount)}</span>
                      : "—"}
                  </td>
                  <td className="p-3 text-left ltr-numbers font-bold text-emerald-600 dark:text-emerald-400">
                    {e.credit > 0 ? formatEGP(e.credit)
                      : inactive && e.type === "PAYMENT" && e.amount > 0
                      ? <span className="line-through opacity-60">{formatEGP(e.amount)}</span>
                      : "—"}
                  </td>
                  <td className={`p-3 text-left ltr-numbers font-bold ${Number(e.balance) > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                    {formatEGP(e.balance)}
                  </td>
                  {/* Which safe took the cash comes first — it is the question
                      asked of this column, and it is per-payment: two payments
                      from one customer can land in different treasuries. The
                      free-text note follows it. */}
                  <td className="p-3 text-xs max-w-[200px]">
                    {e.treasuryName && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900/25 dark:text-teal-300 font-medium whitespace-nowrap">
                        <span className="material-icons-round text-[13px]">savings</span>
                        {e.treasuryName}
                      </span>
                    )}
                    {e.notes && (
                      <span
                        className={`block text-text-light/50 dark:text-text-dark/50 truncate ${e.treasuryName ? "mt-1" : ""}`}
                        title={e.notes}
                      >
                        {e.notes}
                      </span>
                    )}
                    {!e.treasuryName && !e.notes && (
                      <span className="text-text-light/30 dark:text-text-dark/30">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t-2 border-border-light dark:border-border-dark bg-accent/20 dark:bg-primary/10">
            <tr>
              <td colSpan={4} className="p-3 font-bold text-text-light dark:text-text-dark">الإجمالي</td>
              <td className="p-3 text-left ltr-numbers font-bold text-red-600 dark:text-red-400">{formatEGP(totalDebit)}</td>
              <td className="p-3 text-left ltr-numbers font-bold text-emerald-600 dark:text-emerald-400">{formatEGP(totalCredit)}</td>
              <td className={`p-3 text-left ltr-numbers font-bold ${closing > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                {formatEGP(closing)}
              </td>
              <td className="p-3" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

