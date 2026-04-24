import React, { useState, useEffect, useCallback } from "react";
import { api } from "../../services/apiClient";
import toast from "react-hot-toast";

// ─── Constants ───────────────────────────────────────────────────────────────
const ACTION_GROUPS = [
  { label: "Data Operations", actions: ["CREATE", "UPDATE", "DELETE"] },
  { label: "Workflow",        actions: ["APPROVE", "RETURN", "PAY", "SETTLE"] },
  { label: "Shifts",          actions: ["SHIFT_START", "SHIFT_END"] },
  { label: "Authentication",  actions: ["LOGIN", "LOGOUT", "LOGIN_FAILED", "ACCOUNT_LOCKED"] },
];

const ACTION_LABELS = {
  CREATE:          "Created",
  UPDATE:          "Updated",
  DELETE:          "Deleted",
  LOGIN:           "System Login",
  LOGOUT:          "System Logout",
  LOGIN_FAILED:    "Login Failed",
  ACCOUNT_LOCKED:  "Account Locked",
  APPROVE:         "Approved",
  SHIFT_START:     "Shift Started",
  SHIFT_END:       "Shift Ended",
  PAY:             "Paid",
  SETTLE:          "Settled",
  RETURN:          "Returned",
};

const ACTION_STYLES = {
  CREATE:          "bg-green-100 text-green-800",
  UPDATE:          "bg-blue-100 text-blue-800",
  DELETE:          "bg-red-100 text-red-800",
  LOGIN:           "bg-purple-100 text-purple-800",
  LOGOUT:          "bg-gray-100 text-gray-700",
  LOGIN_FAILED:    "bg-orange-100 text-orange-800",
  ACCOUNT_LOCKED:  "bg-red-200 text-red-900",
  APPROVE:         "bg-teal-100 text-teal-800",
  SHIFT_START:     "bg-sky-100 text-sky-800",
  SHIFT_END:       "bg-slate-100 text-slate-700",
  PAY:             "bg-yellow-100 text-yellow-800",
  SETTLE:          "bg-indigo-100 text-indigo-800",
  RETURN:          "bg-rose-100 text-rose-800",
};

const ENTITY_LABELS = {
  sale:             "Sale",
  shift:            "Shift",
  deposit:          "Deposit",
  withdrawal:       "Withdrawal",
  purchase:         "Purchase",
  purchase_return:  "Purchase Return",
  stock_transfer:   "Stock Transfer",
  employee:         "Employee",
  supplier_account: "Supplier Account",
  delivery_man:     "Delivery Man",
  delivery_zone:    "Delivery Zone",
  delivery:         "Delivery",
  treasury:         "Treasury",
  expense:          "Expense",
  client:           "Client",
  supplier:         "Supplier",
  item:             "Item",
  category:         "Category",
  warehouse:        "Warehouse",
  branch:           "Branch",
  bom:              "BOM",
  auth:             "Auth",
  user:             "User",
  settings:         "Settings",
  superadmin:       "Superadmin",
  import:           "Data Import",
  role:             "Role",
};

// Maps a field key (lowercase) → which ref bucket holds its name.
// Covers all FK variants found in the schema (prefixed, suffixed, aliased).
const ID_TO_REF = {
  // Supplier
  supplierid:           "supplier",
  // Treasury — all variants
  treasuryid:           "treasury",
  fromtreasuryid:       "treasury",
  totreasuryid:         "treasury",
  banktreasuryid:       "treasury",
  maintreasuryid:       "treasury",
  // Warehouse — all variants
  warehouseid:          "warehouse",
  towarehouseid:        "warehouse",
  fromwarehouseid:      "warehouse",
  sourcewarehouseid:    "warehouse",
  destwarehouseid:      "warehouse",
  mainwarehouseid:      "warehouse",
  // Client
  clientid:             "client",
  // Item — all variants
  itemid:               "item",
  outputitemid:         "item",
  // Branch
  branchid:             "branch",
  // User — all user-like FK fields
  userid:               "user",
  createdbyid:          "user",
  acceptedbyid:         "user",
  reviewedbyid:         "user",
  // Employee
  employeeid:           "employee",
  // Category
  categoryid:           "category",
  // Delivery man
  deliverymanid:        "deliveryMan",
  // Sale / Purchase (for cross-references)
  saleid:               "sale",
  purchaseid:           "purchase",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function entityLabel(entity) {
  return ENTITY_LABELS[entity] ?? entity?.replace(/_/g, " ") ?? "Unknown";
}

function buildDescription(log) {
  const obj = entityLabel(log.targetEntity);
  const id  = log.targetId ? ` #${log.targetId}` : "";
  const user = log.user?.name ?? "User";
  switch (log.action) {
    case "CREATE":         return `New ${obj} created${id}`;
    case "UPDATE":         return `${obj}${id} updated`;
    case "DELETE":         return `${obj}${id} deleted`;
    case "SHIFT_START":    return `${user} clocked in — Shift${id} started`;
    case "SHIFT_END":      return `${user} clocked out — Shift${id} ended`;
    case "END":            return `${obj}${id} ended`; // legacy records
    case "LOGIN":          return `${user} logged in to system`;
    case "LOGOUT":         return `${user} logged out`;
    case "LOGIN_FAILED":   return log.details?.username
      ? `Failed login attempt for "${log.details.username}"`
      : "Failed login attempt";
    case "ACCOUNT_LOCKED": return log.details?.username
      ? `Account locked: "${log.details.username}"`
      : "Account locked — too many failed attempts";
    case "APPROVE":        return `${obj}${id} approved`;
    case "PAY":            return `${obj}${id} paid`;
    case "SETTLE":         return `${obj}${id} settled`;
    case "RETURN":         return `${obj}${id} returned`;
    default:               return `${log.action} on ${obj}${id}`;
  }
}

function formatDate(dt) {
  if (!dt) return "—";
  const d = new Date(dt);
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  return (
    `${pad(d.getDate())} ${d.toLocaleString("en-GB", { month: "short" })} ${d.getFullYear()} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`
  );
}

function ActionBadge({ action }) {
  const cls = ACTION_STYLES[action] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${cls}`}>
      {ACTION_LABELS[action] ?? action}
    </span>
  );
}

// ─── Human-readable value helpers ─────────────────────────────────────────────
const SENSITIVE_KEY = (k) => {
  const l = k.toLowerCase();
  return l.includes("password") || l.includes("token") || l.includes("secret") || l === "pin";
};

// SKIP_FIELDS: internal DB fields not useful to display
const SKIP_FIELDS = new Set(["rowHash", "row_hash", "createdAt", "updatedAt", "created_at", "updated_at"]);

function humanize(key) {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function resolveRef(k, val, refs) {
  const refKey = ID_TO_REF[k.toLowerCase()];
  if (!refKey || !refs?.[refKey] || val == null) return null;
  const name = refs[refKey][val] ?? refs[refKey][String(val)];
  return name ?? null;
}

function CellValue({ val, k, refs }) {
  if (SENSITIVE_KEY(k))
    return <span className="text-xs text-slate-400 italic">[Redacted]</span>;
  if (val === null || val === undefined)
    return <span className="text-slate-400">—</span>;
  if (typeof val === "boolean")
    return <span>{val ? "Yes" : "No"}</span>;

  // Resolve FK IDs to names
  const resolved = resolveRef(k, val, refs);
  if (resolved)
    return <span className="font-medium">{resolved} <span className="text-slate-400 text-xs font-normal">({val})</span></span>;

  if (Array.isArray(val)) {
    if (!val.length) return <span className="text-slate-400 italic">Empty</span>;
    return (
      <ul className="list-disc pl-4 space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
        {val.map((item, i) => (
          <li key={i}>
            {typeof item === "object" && item !== null
              ? Object.entries(item)
                  .filter(([k2]) => !SENSITIVE_KEY(k2) && !SKIP_FIELDS.has(k2))
                  .map(([k2, v2]) => {
                    const r = resolveRef(k2, v2, refs);
                    return `${humanize(k2)}: ${r ?? v2 ?? "—"}`;
                  })
                  .join("  ·  ")
              : String(item)}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof val === "object") {
    return (
      <ul className="space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
        {Object.entries(val)
          .filter(([k2]) => !SENSITIVE_KEY(k2) && !SKIP_FIELDS.has(k2))
          .map(([k2, v2]) => {
            const r = resolveRef(k2, v2, refs);
            return (
              <li key={k2}>
                <span className="text-slate-400">{humanize(k2)}:</span> {r ? `${r} (${v2})` : String(v2 ?? "—")}
              </li>
            );
          })}
      </ul>
    );
  }
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
    try { return <span>{new Date(val).toLocaleString("en-GB")}</span>; } catch {}
  }
  return <span className="break-all">{String(val)}</span>;
}

function ValuesTable({ data, refs, bgClass = "", labelClass = "", valueClass = "" }) {
  const entries = Object.entries(data).filter(([k]) => !SKIP_FIELDS.has(k));
  if (!entries.length) return <p className="text-sm text-slate-400 italic">No fields recorded.</p>;
  return (
    <div className={`rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm ${bgClass}`}>
      {entries.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[180px_1fr] border-t border-slate-100 dark:border-slate-700 first:border-0">
          <div className={`px-3 py-2 font-medium border-r border-slate-100 dark:border-slate-700 text-xs ${labelClass || "text-slate-500 dark:text-slate-400"}`}>
            {humanize(k)}
          </div>
          <div className={`px-3 py-2 ${valueClass || "text-slate-700 dark:text-slate-200"}`}>
            <CellValue val={v} k={k} refs={refs} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Before / After comparison ────────────────────────────────────────────────
function DiffView({ oldValues, newValues, action, refs }) {
  if (!oldValues && !newValues) {
    return <p className="text-sm text-slate-400 italic">No values recorded.</p>;
  }

  // CREATE — show what was submitted
  if (!oldValues && newValues) {
    return (
      <div>
        <div className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide mb-2">What was submitted</div>
        <ValuesTable data={newValues} refs={refs} />
      </div>
    );
  }

  // DELETE — show what was removed
  if (oldValues && !newValues) {
    return (
      <div>
        <div className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide mb-2">Deleted record</div>
        <ValuesTable data={oldValues} refs={refs} />
      </div>
    );
  }

  // UPDATE — side-by-side diff of changed fields only
  const allKeys = Array.from(new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})])).filter((k) => !SKIP_FIELDS.has(k));
  const changedKeys   = allKeys.filter((k) => JSON.stringify(oldValues?.[k]) !== JSON.stringify(newValues?.[k]));
  const unchangedKeys = allKeys.filter((k) => !changedKeys.includes(k));

  return (
    <div className="space-y-3">
      {changedKeys.length > 0 ? (
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Changed Fields ({changedKeys.length})
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
            <div className="grid grid-cols-[160px_1fr_1fr] bg-slate-100 dark:bg-slate-700 font-semibold text-xs text-slate-600 dark:text-slate-300">
              <div className="px-3 py-2 border-r border-slate-200 dark:border-slate-600">Field</div>
              <div className="px-3 py-2 border-r border-slate-200 dark:border-slate-600 text-red-600 dark:text-red-400">Before</div>
              <div className="px-3 py-2 text-green-600 dark:text-green-400">After</div>
            </div>
            {changedKeys.map((k) => (
              <div key={k} className="grid grid-cols-[160px_1fr_1fr] border-t border-slate-100 dark:border-slate-700">
                <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 border-r border-slate-100 dark:border-slate-700">
                  {humanize(k)}
                </div>
                <div className="px-3 py-2 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-300 border-r border-slate-100 dark:border-slate-700">
                  <CellValue val={oldValues?.[k] ?? null} k={k} refs={refs} />
                </div>
                <div className="px-3 py-2 bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-300">
                  <CellValue val={newValues?.[k] ?? null} k={k} refs={refs} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-400 italic">No field-level changes detected.</p>
      )}
      {unchangedKeys.length > 0 && changedKeys.length > 0 && (
        <details className="text-xs text-slate-400">
          <summary className="cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 select-none">
            {unchangedKeys.length} unchanged fields
          </summary>
          <div className="mt-2 rounded-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
            {unchangedKeys.map((k) => (
              <div key={k} className="grid grid-cols-[160px_1fr] border-t border-slate-100 dark:border-slate-700 first:border-0">
                <div className="px-3 py-1.5 text-slate-400 border-r border-slate-100 dark:border-slate-700">{humanize(k)}</div>
                <div className="px-3 py-1.5 text-slate-500 dark:text-slate-400">
                  <CellValue val={oldValues?.[k] ?? null} k={k} refs={refs} />
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Details Drawer ───────────────────────────────────────────────────────────
function DetailsDrawer({ log, onClose, refs }) {
  if (!log) return null;

  const hasOld = log.oldValues && Object.keys(log.oldValues).length > 0;
  const hasNew = log.details   && Object.keys(log.details).length   > 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 shadow-2xl h-full overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ActionBadge action={log.action} />
            <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
              {buildDescription(log)}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 ml-3 shrink-0">
            <span className="material-icons-round">close</span>
          </button>
        </div>

        {/* Meta grid */}
        <div className="px-5 py-4 grid grid-cols-2 gap-y-4 gap-x-6 text-sm border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Transaction ID</div>
            <div className="font-mono font-semibold text-slate-700 dark:text-slate-200">
              TXN-{String(log.id).padStart(8, "0")}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Timestamp</div>
            <div className="font-mono text-slate-700 dark:text-slate-200 text-xs">{formatDate(log.createdAt)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">User Identity</div>
            <div className="font-medium text-slate-700 dark:text-slate-200">
              {log.user
                ? `${log.user.name} (${log.user.username})`
                : <span className="italic text-slate-400">System</span>}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">IP Address</div>
            <div className="font-mono text-slate-700 dark:text-slate-200">{log.ipAddress ?? "—"}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Action Type</div>
            <ActionBadge action={log.action} />
          </div>
          <div>
            <div className="text-xs text-slate-400 uppercase tracking-wide mb-1">Object Affected</div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200 capitalize">
              {entityLabel(log.targetEntity)}{log.targetId ? <span className="text-slate-400 font-mono"> #{log.targetId}</span> : null}
            </div>
          </div>
        </div>

        {/* Before / After values */}
        <div className="flex-1 px-5 py-4 space-y-3 overflow-y-auto">
          <div className="text-xs text-slate-400 uppercase tracking-wide">
            {log.action === "UPDATE" ? "Before / After Values" : "Values"}
          </div>
          <DiffView
            oldValues={hasOld ? log.oldValues : null}
            newValues={hasNew ? log.details   : null}
            action={log.action}
            refs={refs}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const AuditLogs = () => {
  const [logs,        setLogs]        = useState([]);
  const [total,       setTotal]       = useState(0);
  const [totalPages,  setTotalPages]  = useState(1);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [refs,        setRefs]        = useState({});

  const [filters, setFilters] = useState({
    action: "", entity: "", from: "", to: "", search: "",
  });

  // Load reference data once to resolve IDs → names in audit value display
  useEffect(() => {
    const REF_ENDPOINTS = [
      { key: "supplier",    url: "/suppliers" },
      { key: "treasury",    url: "/treasuries" },
      { key: "warehouse",   url: "/warehouses" },
      { key: "client",      url: "/clients" },
      { key: "item",        url: "/items" },
      { key: "branch",      url: "/branches" },
      { key: "employee",    url: "/employees" },
      { key: "category",    url: "/categories" },
      { key: "user",        url: "/superadmin/users" },
      { key: "deliveryMan", url: "/delivery-men" },
    ];

    async function loadRefs() {
      const result = {};
      await Promise.allSettled(
        REF_ENDPOINTS.map(async ({ key, url }) => {
          try {
            const data = await api.get(url);
            const list = Array.isArray(data) ? data : (data.data ?? []);
            result[key] = Object.fromEntries(
              list.map((item) => [item.id, item.name ?? item.fullName ?? item.username ?? `#${item.id}`])
            );
          } catch { /* silent — names just won't resolve */ }
        })
      );
      setRefs(result);
    }
    loadRefs();
  }, []);

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

  const handleFilterChange = (key, value) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Audit Trail</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Immutable, HMAC-protected log of all system mutations. View-only.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
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
            {ACTION_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.actions.map((a) => (
                  <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>
                ))}
              </optgroup>
            ))}
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
            onClick={() => setFilters({ action: "", entity: "", from: "", to: "", search: "" })}
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
                  {["Timestamp", "User", "Event", "Action", "TXN ID"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide whitespace-nowrap">
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
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono text-xs whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-slate-700 dark:text-slate-200 font-medium">
                        {log.user ? log.user.name : <span className="text-slate-400 italic text-sm">System</span>}
                      </div>
                      {log.user?.username && (
                        <div className="text-xs text-slate-400">{log.user.username}</div>
                      )}
                      {log.ipAddress && (
                        <div className="text-xs text-slate-300 dark:text-slate-600 font-mono">{log.ipAddress}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">
                      {buildDescription(log)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs whitespace-nowrap">
                      TXN-{String(log.id).padStart(8, "0")}
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
      <DetailsDrawer log={selectedLog} onClose={() => setSelectedLog(null)} refs={refs} />
    </div>
  );
};

export default AuditLogs;
