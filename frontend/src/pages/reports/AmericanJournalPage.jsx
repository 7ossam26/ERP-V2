import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { reportService, branchService } from "../../services/domainServices";
import AuthService from "../../services/authService";
import BranchFilterHelper from "../../utils/BranchFilterHelper";
import { cairoTodayISO } from "../../utils/dateRange";

// اليومية الأمريكية — a double-entry columnar journal synthesised by the server
// from the ERP's documents (backend/lib/journal). Revenue follows التقرير العام
// (by invoice); cash follows the treasury reconciliation rules.

const PAGE_SIZE = 200;

const fmt = (n) =>
  n
    ? Number(n).toLocaleString("ar-EG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";

const firstOfMonthISO = () => `${cairoTodayISO().slice(0, 8)}01`;

// A balance (opening / closing) shows its net on whichever side it sits.
const balanceCells = (t) => {
  const net = t?.net || 0;
  return net >= 0 ? [net, 0] : [0, -net];
};

const AmericanJournalPage = () => {
  const currentUser = AuthService.getCurrentUser();
  const [branches, setBranches] = useState([]);
  const [filters, setFilters] = useState({
    startDate: firstOfMonthISO(),
    endDate: cairoTodayISO(),
    branchId: BranchFilterHelper.getDefaultBranchId(currentUser),
    mode: "detail",
    accounts: [],
  });
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [tieOuts, setTieOuts] = useState(null);
  const [tieLoading, setTieLoading] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [allColumns, setAllColumns] = useState([]);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const list = await branchService.getAll();
        const available = BranchFilterHelper.getAvailableBranches(list, currentUser);
        setBranches((available || []).filter((b) => b.name !== "Main Branch"));
      } catch (err) {
        console.error("Failed to load branches", err);
      }
    };
    loadBranches();
  }, [currentUser?.id]);

  const fetchJournal = async () => {
    try {
      setLoading(true);
      setError(null);
      setTieOuts(null);
      const res = await reportService.getAmericanJournal({ ...filters, offset: 0, limit: PAGE_SIZE });
      setData(res);
      setRows(res.rows || []);
      if (!filters.accounts.length) setAllColumns(res.columns || []);
    } catch (err) {
      console.error("Error loading journal:", err);
      setError(
        err.status === 403
          ? "غير مسموح لك بعرض هذا التقرير."
          : "فشل تحميل اليومية. تأكد من اتصال الخادم.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const loadMore = async () => {
    if (data?.nextOffset == null) return;
    try {
      setLoadingMore(true);
      const res = await reportService.getAmericanJournal({ ...filters, offset: data.nextOffset, limit: PAGE_SIZE });
      setRows((prev) => [...prev, ...(res.rows || [])]);
      setData((prev) => ({ ...prev, nextOffset: res.nextOffset }));
    } catch {
      toast.error("فشل تحميل المزيد");
    } finally {
      setLoadingMore(false);
    }
  };

  const runTieOut = async () => {
    try {
      setTieLoading(true);
      const res = await reportService.getAmericanJournal({ ...filters, tieOut: true, offset: 0, limit: 1 });
      setTieOuts(res.tieOuts);
    } catch {
      toast.error("فشلت المطابقة");
    } finally {
      setTieLoading(false);
    }
  };

  const exportExcel = async () => {
    try {
      setExporting(true);
      await reportService.exportAmericanJournal({ ...filters, tieOut: true });
    } catch (err) {
      toast.error(err.message || "فشل التصدير");
    } finally {
      setExporting(false);
    }
  };

  const toggleAccount = (id) =>
    setFilters((f) => ({
      ...f,
      accounts: f.accounts.includes(id) ? f.accounts.filter((a) => a !== id) : [...f.accounts, id],
    }));

  const columns = data?.columns || [];
  const sumSide = (totals, side) =>
    columns.reduce((s, c) => s + (side === "dr" ? balanceCells(totals?.[c.id])[0] : balanceCells(totals?.[c.id])[1]), 0);

  const integrityOk = data && data.integrity?.unbalancedEntries === 0 && data.integrity?.periodBalanced;

  const inputClass =
    "block w-full rounded-lg border-gray-300 dark:border-border-dark bg-white dark:bg-[#3E332F] py-2.5 px-3 text-sm focus:border-primary focus:ring-primary dark:text-text-dark shadow-sm";
  const th = "px-2 py-2 font-semibold whitespace-nowrap border-b border-l border-border-light dark:border-border-dark";
  const td = "px-2 py-1.5 whitespace-nowrap border-l border-border-light/60 dark:border-border-dark/60";
  const num = `${td} text-left tabular-nums`;

  const summaryRow = (label, cells, totalDr, totalCr, tone) => (
    <tr className={`${tone} font-semibold`}>
      <td className={`${td} sticky right-0 ${tone}`} colSpan={1}>{label}</td>
      <td className={td} colSpan={4}></td>
      <td className={num}>{fmt(totalDr)}</td>
      <td className={num}>{fmt(totalCr)}</td>
      {cells.map((v, i) => (
        <td key={i} className={num}>{fmt(v)}</td>
      ))}
    </tr>
  );

  const openingCells = columns.flatMap((c) => balanceCells(data?.opening?.[c.id]));
  const closingCells = columns.flatMap((c) => balanceCells(data?.closing?.[c.id]));
  const periodCells = columns.flatMap((c) => [data?.period?.[c.id]?.dr || 0, data?.period?.[c.id]?.cr || 0]);

  return (
    <div className="p-4 md:p-6 bg-background-light dark:bg-background-dark min-h-screen" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-text-light dark:text-text-dark">اليومية الأمريكية</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            قيود مزدوجة مستخرجة من مستندات النظام — مدين ودائن لكل حساب
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            المبيعات بالفوترة مثل التقرير العام، والنقدية حسب حركة الخزائن الفعلية.
          </p>
        </div>
        <Link to="/reports" className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors">
          <span className="material-icons-round rtl:rotate-180">arrow_forward</span>
          <span>العودة للتقارير</span>
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-surface-light dark:bg-surface-dark p-4 rounded-2xl shadow-sm border border-border-light dark:border-border-dark mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">من تاريخ</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">الفرع</label>
            <select
              value={filters.branchId}
              onChange={(e) => setFilters({ ...filters, branchId: e.target.value })}
              className={inputClass}>
              <option value="all">كل الفروع (مجمع)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">طريقة العرض</label>
            <select
              value={filters.mode}
              onChange={(e) => setFilters({ ...filters, mode: e.target.value })}
              className={inputClass}>
              <option value="detail">تفصيلي (قيد لكل حركة)</option>
              <option value="daily">مجمع يومي</option>
            </select>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowAccounts((v) => !v)}
              className="px-4 py-2.5 rounded-lg border border-border-light dark:border-border-dark bg-white dark:bg-[#3E332F] text-sm text-text-light dark:text-text-dark flex items-center gap-2">
              <span className="material-icons-round text-lg">view_column</span>
              الحسابات {filters.accounts.length ? `(${filters.accounts.length})` : "(الكل)"}
            </button>
            {showAccounts && (
              <div className="absolute z-30 mt-2 left-0 w-72 max-h-80 overflow-auto bg-white dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl shadow-lg p-3 space-y-1">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  الحسابات غير المختارة تُجمع في عمود "حسابات أخرى" حتى يظل كل قيد متوازنًا.
                </p>
                {allColumns
                  .filter((c) => c.id !== "OTHER")
                  .map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm text-text-light dark:text-text-dark cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.accounts.includes(c.id)}
                        onChange={() => toggleAccount(c.id)}
                        className="rounded text-primary focus:ring-primary"
                      />
                      {c.labelAr}
                    </label>
                  ))}
                {filters.accounts.length > 0 && (
                  <button
                    onClick={() => setFilters({ ...filters, accounts: [] })}
                    className="text-xs text-primary mt-2">
                    إظهار كل الحسابات
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchJournal}
              className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium shadow-md shadow-primary/20 flex items-center gap-2">
              <span className={`material-icons-round text-lg ${loading ? "animate-spin" : ""}`}>refresh</span>
              تحديث
            </button>
            <button
              onClick={runTieOut}
              disabled={tieLoading}
              className="px-4 py-2.5 rounded-lg border border-primary text-primary hover:bg-primary/10 font-medium flex items-center gap-2 disabled:opacity-50">
              <span className={`material-icons-round text-lg ${tieLoading ? "animate-spin" : ""}`}>fact_check</span>
              مطابقة الأرصدة
            </button>
            <button
              onClick={exportExcel}
              disabled={exporting}
              className="px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium flex items-center gap-2 disabled:opacity-50">
              <span className={`material-icons-round text-lg ${exporting ? "animate-spin" : ""}`}>download</span>
              Excel
            </button>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4 border border-red-200">{error}</div>}

      {/* Integrity */}
      {data && (
        <div
          className={`p-3 rounded-xl mb-4 border text-sm flex flex-wrap items-center gap-x-6 gap-y-1 ${
            integrityOk
              ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
              : "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300"
          }`}>
          <span className="font-bold flex items-center gap-1">
            <span className="material-icons-round text-lg">{integrityOk ? "verified" : "error"}</span>
            {integrityOk ? "كل القيود متوازنة (مدين = دائن)" : "توجد قيود غير متوازنة"}
          </span>
          {!integrityOk && <span>عدد القيود غير المتوازنة: {data.integrity.unbalancedEntries}</span>}
          <span>عدد الحركات: {data.totalRows}</span>
        </div>
      )}

      {/* Diagnostics */}
      {data?.diagnostics?.length > 0 && (
        <details className="mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-sm text-amber-900 dark:text-amber-200">
          <summary className="cursor-pointer font-semibold">تنبيهات على البيانات ({data.diagnostics.length})</summary>
          <ul className="mt-2 space-y-1 list-disc pr-5">
            {data.diagnostics.map((d) => (
              <li key={d.code}>
                {d.label} — {d.count} حركة{d.amount ? ` بقيمة ${fmt(d.amount)}` : ""}
                {d.samples?.length ? <span className="text-xs opacity-70"> ({d.samples.join("، ")})</span> : null}
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* Tie-outs */}
      {tieOuts && <TieOutPanel tieOuts={tieOuts} />}

      {/* Journal table */}
      <div className="bg-surface-light dark:bg-surface-dark rounded-2xl shadow-sm border border-border-light dark:border-border-dark overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
          <table className="min-w-full text-xs text-text-light dark:text-text-dark border-collapse">
            <thead className="sticky top-0 z-20 bg-gray-100 dark:bg-[#2F2623]">
              <tr>
                <th rowSpan={2} className={`${th} sticky right-0 z-30 bg-gray-100 dark:bg-[#2F2623]`}>التاريخ</th>
                <th rowSpan={2} className={th}>المرجع</th>
                <th rowSpan={2} className={th}>نوع الحركة</th>
                <th rowSpan={2} className={th}>البيان</th>
                <th rowSpan={2} className={th}>الفرع</th>
                <th rowSpan={2} className={th}>إجمالي مدين</th>
                <th rowSpan={2} className={th}>إجمالي دائن</th>
                {columns.map((c) => (
                  <th key={c.id} colSpan={2} className={`${th} text-center`}>
                    {c.labelAr}
                  </th>
                ))}
              </tr>
              <tr>
                {columns.map((c) => (
                  <React.Fragment key={c.id}>
                    <th className={`${th} text-blue-700 dark:text-blue-300`}>مدين</th>
                    <th className={`${th} text-rose-700 dark:text-rose-300`}>دائن</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {data &&
                summaryRow(
                  "رصيد أول المدة",
                  openingCells,
                  sumSide(data.opening, "dr"),
                  sumSide(data.opening, "cr"),
                  "bg-amber-50 dark:bg-amber-900/20",
                )}
              {rows.map((r) => (
                <tr key={r.key} className="hover:bg-primary/5 even:bg-gray-50/50 dark:even:bg-white/5">
                  <td className={`${td} sticky right-0 bg-surface-light dark:bg-surface-dark`}>{r.day}</td>
                  <td className={td}>{r.ref}</td>
                  <td className={td}>{r.type}</td>
                  <td className={`${td} max-w-[220px] truncate`} title={r.party || ""}>
                    {r.party}
                  </td>
                  <td className={td}>{r.branch}</td>
                  <td className={`${num} font-semibold`}>{fmt(r.totalDr)}</td>
                  <td className={`${num} font-semibold`}>{fmt(r.totalCr)}</td>
                  {columns.map((c) => (
                    <React.Fragment key={c.id}>
                      <td className={num}>{fmt(r.lines[c.id]?.dr)}</td>
                      <td className={num}>{fmt(r.lines[c.id]?.cr)}</td>
                    </React.Fragment>
                  ))}
                </tr>
              ))}
              {!loading && data && rows.length === 0 && (
                <tr>
                  <td colSpan={7 + columns.length * 2} className="text-center py-10 text-gray-500">
                    لا توجد حركات في هذه الفترة
                  </td>
                </tr>
              )}
            </tbody>
            {data && (
              <tfoot className="sticky bottom-0 z-20">
                {summaryRow(
                  "حركة الفترة",
                  periodCells,
                  columns.reduce((s, c) => s + (data.period[c.id]?.dr || 0), 0),
                  columns.reduce((s, c) => s + (data.period[c.id]?.cr || 0), 0),
                  "bg-blue-50 dark:bg-blue-900/30",
                )}
                {summaryRow(
                  "رصيد آخر المدة",
                  closingCells,
                  sumSide(data.closing, "dr"),
                  sumSide(data.closing, "cr"),
                  "bg-amber-100 dark:bg-amber-900/40",
                )}
              </tfoot>
            )}
          </table>
        </div>
        {data?.nextOffset != null && (
          <div className="p-3 text-center border-t border-border-light dark:border-border-dark">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-6 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-medium disabled:opacity-50">
              {loadingMore ? "جاري التحميل..." : `تحميل المزيد (${rows.length} من ${data.totalRows})`}
            </button>
          </div>
        )}
      </div>
      {loading && <div className="text-center text-gray-500 py-6">جاري تحميل اليومية...</div>}
    </div>
  );
};

const TieRow = ({ label, values, residual }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5 border-b border-border-light/60 dark:border-border-dark/60 last:border-0">
    <span className="font-semibold min-w-[180px]">{label}</span>
    {values.map(([k, v]) => (
      <span key={k} className="text-gray-600 dark:text-gray-300">
        {k}: <span className="tabular-nums">{fmt(v) || "0"}</span>
      </span>
    ))}
    {residual !== undefined && (
      <span className={`font-bold ${residual === 0 ? "text-green-600" : "text-red-600"}`}>
        {residual === 0 ? "مطابق ✓" : `فرق: ${fmt(residual)}`}
      </span>
    )}
  </div>
);

const TieOutPanel = ({ tieOuts }) => (
  <div className="mb-4 bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark rounded-xl p-4 text-sm text-text-light dark:text-text-dark">
    <h3 className="font-bold mb-2 flex items-center gap-2">
      <span className="material-icons-round text-primary">fact_check</span>
      مطابقة اليومية مع أرصدة النظام
    </h3>
    {tieOuts.revenue && (
      <TieRow
        label={tieOuts.revenue.label}
        values={[["اليومية", tieOuts.revenue.journal], ["التقرير العام", tieOuts.revenue.general]]}
        residual={tieOuts.revenue.difference}
      />
    )}
    {!tieOuts.treasuries && (
      <p className="text-xs text-gray-500 mt-2">
        مطابقة أرصدة الخزائن والموردين والعملاء والطيارين متاحة فقط لعرض "كل الفروع" لفترة تنتهي اليوم.
      </p>
    )}
    {tieOuts.treasuries && (
      <>
        <h4 className="font-semibold mt-3 mb-1">الخزائن</h4>
        {tieOuts.treasuries.map((t) => (
          <TieRow
            key={t.treasuryId}
            label={t.name}
            values={[["حسب اليومية", t.journal], ["الرصيد المسجل", t.stored]]}
            residual={t.unexplained}
          />
        ))}
        <p className="text-xs text-gray-500 mt-1">
          الفرق هنا رصيد مسجل في الخزينة بلا مستند يثبته (أو مستند لم يصل للرصيد) — موجود قبل اليومية وتكشفه فقط.
        </p>
        <h4 className="font-semibold mt-3 mb-1">الحسابات</h4>
        <TieRow
          label="الموردين"
          values={[["حسب اليومية", tieOuts.suppliers.journal], ["حسابات الموردين", tieOuts.suppliers.stored]]}
          residual={tieOuts.suppliers.difference}
        />
        <TieRow
          label="العملاء (جملة)"
          values={[
            ["حسب اليومية", tieOuts.customers.journal],
            ["الرصيد المفتوح", tieOuts.customers.openBalance],
            ["مرتجع نقدي على فواتير مرتجعة", tieOuts.customers.cashRefundedOnReturns],
          ]}
          residual={tieOuts.customers.residual}
        />
        <TieRow
          label="عهدة الطيارين"
          values={[
            ["حسب اليومية", tieOuts.drivers.journal],
            ["محافظ الطيارين", tieOuts.drivers.wallets],
            ["طلبات لم تخرج بعد", tieOuts.drivers.pendingDispatch],
          ]}
          residual={tieOuts.drivers.residual}
        />
      </>
    )}
  </div>
);

export default AmericanJournalPage;
