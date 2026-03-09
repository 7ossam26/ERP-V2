/**
 * Audit Capture Middleware
 *
 * Wraps res.json() on mutating requests (POST/PUT/PATCH/DELETE) so that
 * every successful API response automatically writes an audit record.
 * Routes do NOT need to be modified — this middleware does it for them.
 *
 * Entity name is derived from the URL path:
 *   /api/sales        → "sale"
 *   /api/stock-transfers → "stock_transfer"
 *   /api/auth/login   → "auth"
 *
 * Target ID is extracted from:
 *   1. URL path param  (/api/sales/42 → "42")
 *   2. Response body   ({ id: 42 })
 *   3. Request body    ({ id: 42 })
 */
const { writeAudit } = require("../utils/auditLogger");

// Map URL path segments to friendly entity names
const ENTITY_MAP = {
  "sales":              "sale",
  "shifts":             "shift",
  "deposits":           "deposit",
  "withdrawals":        "withdrawal",
  "purchases":          "purchase",
  "stock-transfers":    "stock_transfer",
  "employees":          "employee",
  "supplier-accounts":  "supplier_account",
  "delivery-men":       "delivery_man",
  "delivery-zones":     "delivery_zone",
  "treasuries":         "treasury",
  "expenses":           "expense",
  "clients":            "client",
  "suppliers":          "supplier",
  "items":              "item",
  "categories":         "category",
  "warehouses":         "warehouse",
  "branches":           "branch",
  "users":              "user",
  "bom":                "bom",
  "auth":               "auth",
  "superadmin":         "superadmin",
  "settings":           "settings",
};

const METHOD_ACTION = {
  POST:   "CREATE",
  PUT:    "UPDATE",
  PATCH:  "UPDATE",
  DELETE: "DELETE",
};

// Sub-paths that map to specific actions (e.g. /shifts/42/approve → APPROVE)
const SUB_ACTION_MAP = {
  "approve":  "APPROVE",
  "end":      "END",
  "pay":      "PAY",
  "settle":   "SETTLE",
  "login":    "LOGIN",
  "logout":   "LOGOUT",
};

// Paths to skip auditing entirely (read-only or noisy setup routes)
const SKIP_PREFIXES = [
  "/api/health",
  "/api/setup-",
  "/api/dangerous-",
  "/api/audit",       // don't audit the audit reader itself
  "/api/reports",
  "/api/inventory",
];

function shouldSkip(path) {
  return SKIP_PREFIXES.some((p) => path.startsWith(p));
}

/**
 * Extract entity name from URL path.
 * /api/stock-transfers/5  →  "stock_transfer"
 */
function extractEntity(path) {
  // Strip /api/ prefix
  const parts = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  const segment = parts[0] ?? "unknown";
  return ENTITY_MAP[segment] ?? segment.replace(/-/g, "_");
}

/**
 * Extract action — check for sub-paths like /end, /approve, /pay first.
 */
function extractAction(method, path) {
  const parts = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  // parts: [entity, id?, sub-action?]
  const subAction = parts[2] ?? parts[1];
  if (subAction && SUB_ACTION_MAP[subAction]) {
    return SUB_ACTION_MAP[subAction];
  }
  return METHOD_ACTION[method] ?? method;
}

/**
 * Extract target ID from URL, then response, then request body.
 */
function extractTargetId(path, responseData, requestBody) {
  const parts = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  // parts[1] is the ID if it's a number
  if (parts[1] && /^\d+$/.test(parts[1])) return parts[1];
  if (responseData && typeof responseData === "object" && responseData.id) return String(responseData.id);
  if (requestBody  && typeof requestBody  === "object" && requestBody.id)  return String(requestBody.id);
  return null;
}

/**
 * Build a compact details object — only the request body, stripped of noise.
 */
function buildDetails(method, requestBody, responseData) {
  if (method === "DELETE") return null;  // nothing meaningful to log
  if (!requestBody || typeof requestBody !== "object") return null;

  // Include only the body — response data is usually the full record which is too large
  return requestBody;
}

/**
 * Get the real client IP, respecting X-Forwarded-For.
 */
function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

/**
 * The middleware itself.
 * Must be registered AFTER authenticateToken so req.user is populated.
 */
function auditCapture(req, res, next) {
  const method = req.method;

  // Only intercept mutating methods
  if (!METHOD_ACTION[method]) return next();
  if (shouldSkip(req.path)) return next();

  const originalJson = res.json.bind(res);

  res.json = function (data) {
    // Only write audit on successful responses (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const entity   = extractEntity(req.path);
      const action   = extractAction(method, req.path);
      const targetId = extractTargetId(req.path, data, req.body);
      const details  = buildDetails(method, req.body, data);
      const userId   = req.user?.id   ?? null;
      const branchId = req.user?.branchId ?? null;
      const ip       = getIp(req);

      // Fire-and-forget — never block the response
      writeAudit({ action, targetEntity: entity, targetId, userId, branchId, details, ipAddress: ip })
        .catch((err) => console.error("[AUDIT] Async write error:", err.message));
    }

    return originalJson(data);
  };

  next();
}

module.exports = auditCapture;
