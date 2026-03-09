import React, { useState, useEffect, useCallback } from "react";
import { api } from "../../services/apiClient";
import toast from "react-hot-toast";

// ─── Constants ───────────────────────────────────────────────────────────────
const ACTIONS = ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "APPROVE", "END", "PAY", "SETTLE"];

const ACTION_STYLES = {
  CREATE:  "bg-green-100 text-green-800",
  UPDATE:  "bg-blue-100 text-blue-800",
  DELETE:  "bg-red-100 text-red-800",
  LOGIN:   "bg-purple-100 text-purple-800",
  LOGOUT:  "bg-gray-100 text-gray-700",
  APPROVE: "bg-teal-100 text-teal-800",
  END:     "bg-orange-100 text-orange-800",
  PAY:     "bg-yellow-100 text-yellow-800",
  SETTLE:  "bg-indigo-100 text-indigo-800",
};

const ENTITY_LABELS = {
  sale: "Sale", shift: "Shift", deposit: "Deposit", withdrawal: "Withdrawal",
  purchase: "Purchase", stock_transfer: "Stock Transfer", employee: "Employee",
  supplier_account: "Supplier Account", delivery_man: "Delivery Man",
  delivery_zone: "Delivery Zone", treasury: "Treasury", expense: "Expense",
  client: "Client", supplier: "Supplier", item: "Item", bom: "BOM",
  auth: "Auth", user: "User", settings: "Settings", superadmin: "Superadmin",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function ActionBadge({ action }) {
  const cls = ACTION_STYLES[action] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>
      {action}
    </span>
  );
}

// ─── Details Drawer ───────────────────────────────────────────────────────────
function DetailsDrawer({ log, onClose }) {
  if (!log) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 shadow-2xl h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center gap-2">
            <ActionBadge action={log.action} />
            <span className="font-semibold text-slate-800 dark:text-white capitalize">
              {ENTITY_LABELS[log.targetEntity] ?? log.targetEntity}
              {log.targetId ? ` #${log.targetId}` : ""}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <span className="material-icons-round">close</span>
          </button>
        </div>

        {/* Meta */}
        <div className="px-5 py-4 grid grid-cols-2 gap-3 text-sm border-b border-slate-100 dark:border-slate-700">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">User</div>
            <div className="font-medium text-slate-700 dark:text-slate-200">
              {log.user ? `${log.user.name} (${log.user.username})` : "System"}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Branch</div>
            <div className="font-medium text-slate-700 dark:text-slate-200">
              {log.branch?.name ?? "—"}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Time</div>
            <div className="font-medium text-slate-700 dark:text-slate-200">{formatDate(log.createdAt)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">IP Address</div>
            <div className="font-medium text-slate-700 dark:text-slate-200">{log.ipAddress ?? "—"}</div>
          </div>
        </div>

        {/* Details JSON */}
        <div className="flex-1 px-5 py-4">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-2">Details</div>
          {log.details ? (
            <pre className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-xs text-slate-700 dark:text-slate-300 overflow-auto whitespace-pre-wrap break-all max-h-80">
              {JSON.stringify(log.details, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-slate-400 italic">No details recorded for this action.</p>
          )}
        </div>

        {/* Integrity */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
          <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Record Hash (HMAC-SHA256)</div>
          <code className="text-xs text-slate-500 dark:text-slate-400 break-all">
            {log.rowHash ?? "Not hashed (legacy record)"}
          </code>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const AuditLogs = () => {
  const [logs,       setLogs]       = useState([]);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(false);

  const [selectedLog, setSelectedLog] = useState(null);
  const [integrity,   setIntegrity]   = useState(null);
  const [verifying,   setVerifying]   = useState(false);

  const [filters, setFilters] = useState({
    action: "", entity: "", userId: "", branchId: "", from: "", to: "", search: "",
  });

  const fetchLogs = useCallback(async (currentPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: currentPage, limit: 50 });
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const data = await api.get(`/audit?${params}`);
      setLogs(data.data ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setPage(currentPage);
    } catch (err) {
      toast.error(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  const handleFilterChange = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const handleVerify = async () => {
    setVerifying(true);
    setIntegrity(null);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to)   params.set("to",   filters.to);
      const result = await api.get(`/audit/verify?${params}`);
      setIntegrity(result);
      if (result.integrity === "OK") {
        toast.success(`All ${result.total} records verified — no tampering detected`);
      } else {
        toast.error(`INTEGRITY ISSUE: ${result.tampered.length} tampered record(s) detected`);
      }
    } catch (err) {
      toast.error(err.message || "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Trail</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Immutable, HMAC-protected log of all system mutations. View-only.
          </p>
        </div>
        <button
          onClick={handleVerify}
          disabled={verifying}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <span className="material-icons-round text-base">verified_user</span>
          {verifying ? "Verifying…" : "Verify Integrity"}
        </button>
      </div>

      {/* Integrity Banner */}
      {integrity && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium ${
          integrity.integrity === "OK"
            ? "bg-green-50 border-green-200 text-green-800"
            : "bg-red-50 border-red-200 text-red-800"
        }`}>
          <span className="material-icons-round text-base">
            {integrity.integrity === "OK" ? "check_circle" : "warning"}
          </span>
          {integrity.integrity === "OK"
            ? `${integrity.total} records checked — all HMAC signatures valid. No tampering detected.`
            : `INTEGRITY COMPROMISED — ${integrity.tampered.length} record(s) have invalid hashes: IDs ${integrity.tampered.map((r) => r.id).join(", ")}`
          }
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          <div className="xl:col-span-2">
            <input
              type="text"
              placeholder="Search entity / ID…"
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={filters.action}
            onChange={(e) => handleFilterChange("action", e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Actions</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={filters.entity}
            onChange={(e) => handleFilterChange("entity", e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Entities</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input
            type="datetime-local"
            value={filters.from}
            onChange={(e) => handleFilterChange("from", e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="datetime-local"
            value={filters.to}
            onChange={(e) => handleFilterChange("to", e.target.value)}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={() => setFilters({ action: "", entity: "", userId: "", branchId: "", from: "", to: "", search: "" })}
            className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 px-1">
        <span>{total.toLocaleString()} records</span>
        <span>·</span>
        <span>Page {page} of {totalPages}</span>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <span className="material-icons-round animate-spin mr-2">refresh</span>Loading…
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <span className="material-icons-round text-4xl mb-2">history</span>
            <p className="text-sm">No audit records match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                  {["#", "Action", "Entity", "User", "Branch", "IP", "Time", ""].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{log.id}</td>
                    <td className="px-4 py-3"><ActionBadge action={log.action} /></td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-700 dark:text-slate-200 capitalize">
                        {ENTITY_LABELS[log.targetEntity] ?? log.targetEntity}
                      </span>
                      {log.targetId && (
                        <span className="ml-1.5 text-xs text-slate-400 font-mono">#{log.targetId}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {log.user ? log.user.name : <span className="text-slate-400 italic">System</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">
                      {log.branch?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{log.ipAddress ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap text-xs">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="material-icons-round text-base text-slate-300">chevron_right</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => fetchLogs(page - 1)}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-icons-round text-base align-middle">chevron_left</span>
          </button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
            const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page + i - 3;
            if (p < 1 || p > totalPages) return null;
            return (
              <button
                key={p}
                onClick={() => fetchLogs(p)}
                disabled={loading}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  p === page
                    ? "bg-indigo-600 border-indigo-600 text-white"
                    : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => fetchLogs(page + 1)}
            disabled={page >= totalPages || loading}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-sm disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <span className="material-icons-round text-base align-middle">chevron_right</span>
          </button>
        </div>
      )}

      {/* Details Drawer */}
      <DetailsDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
};

export default AuditLogs;
