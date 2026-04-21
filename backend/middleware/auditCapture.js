/**
 * Audit Capture Middleware
 *
 * Intercepts every successful mutating request (POST/PUT/PATCH/DELETE).
 * For UPDATE and DELETE operations, fetches the current DB state BEFORE
 * the write so that old_values and new_values can be stored side-by-side.
 *
 * Entity name is derived from the URL path:
 *   /api/sales            → "sale"
 *   /api/stock-transfers  → "stock_transfer"
 *   /api/auth/login       → "auth"
 */
const { writeAudit } = require("../utils/auditLogger");
const prisma = require("../config/database");

// Map URL path segments → friendly entity names (stored in DB)
const ENTITY_MAP = {
  "sales":              "sale",
  "shifts":             "shift",
  "deposits":           "deposit",
  "withdrawals":        "withdrawal",
  "purchases":          "purchase",
  "purchase-returns":   "purchase_return",
  "stock-transfers":    "stock_transfer",
  "employees":          "employee",
  "supplier-accounts":  "supplier_account",
  "delivery-men":       "delivery_man",
  "delivery-zones":     "delivery_zone",
  "deliverymen":        "delivery_man",
  "deliveryzones":      "delivery_zone",
  "delivery":           "delivery",
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
  "import":             "import",
};

// Map entity name → Prisma model accessor for before-state fetch
const PRISMA_MODEL_MAP = {
  "sale":             "sale",
  "shift":            "shift",
  "deposit":          "deposit",
  "withdrawal":       "withdrawal",
  "purchase":         "purchase",
  "stock_transfer":   "stockTransfer",
  "employee":         "employee",
  "supplier_account": "supplierAccount",
  "delivery_man":     "deliveryMan",
  "delivery_zone":    "deliveryZone",
  "treasury":         "treasury",
  "expense":          "expense",
  "client":           "client",
  "supplier":         "supplier",
  "item":             "item",
  "category":         "category",
  "warehouse":        "warehouse",
  "branch":           "branch",
  "user":             "user",
};

const METHOD_ACTION = {
  POST:   "CREATE",
  PUT:    "UPDATE",
  PATCH:  "UPDATE",
  DELETE: "DELETE",
};

const SUB_ACTION_MAP = {
  "approve":  "APPROVE",
  "start":    "SHIFT_START",
  "end":      "SHIFT_END",
  "pay":      "PAY",
  "settle":   "SETTLE",
  "login":    "LOGIN",
  "logout":   "LOGOUT",
  "return":   "RETURN",
};

const SKIP_PREFIXES = [
  "/api/health",
  "/api/setup-",
  "/api/dangerous-",
  "/api/audit",
  "/api/reports",
  "/api/inventory",
];

function shouldSkip(path) {
  return SKIP_PREFIXES.some((p) => path.startsWith(p));
}

function extractEntity(path) {
  const parts = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  const segment = parts[0];
  if (!segment) return "unknown";
  return ENTITY_MAP[segment] ?? segment.replace(/-/g, "_");
}

function extractAction(method, path) {
  const parts = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  const subAction = parts[2] ?? parts[1];
  if (subAction && SUB_ACTION_MAP[subAction]) {
    return SUB_ACTION_MAP[subAction];
  }
  return METHOD_ACTION[method] ?? method;
}

function extractIdFromPath(path) {
  const parts = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  if (parts[1] && /^\d+$/.test(parts[1])) return parseInt(parts[1]);
  return null;
}

function extractTargetId(path, responseData, requestBody) {
  const parts = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  if (parts[1] && /^\d+$/.test(parts[1])) return parts[1];
  if (responseData && typeof responseData === "object" && responseData.id) return String(responseData.id);
  if (requestBody  && typeof requestBody  === "object" && requestBody.id)  return String(requestBody.id);
  return null;
}

/**
 * Recursively convert Prisma Decimal objects (from decimal.js) to plain JS
 * numbers so JSON.stringify produces a number token, not a quoted string.
 * Other values pass through unchanged.
 */
function serializeForAudit(value) {
  if (value === null || value === undefined) return value;
  // Prisma Decimal instances have a toNumber() method and a non-zero d array.
  if (typeof value === "object" && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  if (Array.isArray(value)) return value.map(serializeForAudit);
  if (typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serializeForAudit(v);
    return out;
  }
  return value;
}

function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    null
  );
}

/**
 * Fetch the current state of a record BEFORE it is mutated.
 * Returns null silently if model is unknown or record doesn't exist.
 */
async function fetchBeforeState(entityName, recordId) {
  if (!recordId) return null;
  const modelName = PRISMA_MODEL_MAP[entityName];
  if (!modelName || !prisma[modelName]) return null;
  try {
    return await prisma[modelName].findUnique({ where: { id: recordId } });
  } catch {
    return null;
  }
}

/**
 * The middleware itself.
 * Registered AFTER body-parser so req.body is populated.
 * req.user is populated by the time res.json fires (inside route handlers).
 */
async function auditCapture(req, res, next) {
  try {
  const method = req.method;

  if (!METHOD_ACTION[method]) return next();
  if (shouldSkip(req.path)) return next();

  const entityName = extractEntity(req.path);
  const action     = extractAction(method, req.path);

  // Fetch before-state for UPDATE / DELETE so we can store old_values
  let beforeState = null;
  if (method === "PUT" || method === "PATCH" || method === "DELETE") {
    const recordId = extractIdFromPath(req.path);
    beforeState = await fetchBeforeState(entityName, recordId);
  }

  const originalJson = res.json.bind(res);

  res.json = function (data) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const targetId = extractTargetId(req.path, data, req.body);
      // For auth/login, req.user is not set — extract from response body
      const userId   = req.user?.id       ?? data?.user?.id       ?? null;
      const branchId = req.user?.branchId ?? data?.user?.branch?.id ?? null;
      const ip       = getIp(req);

      // newValues = request body sent (null for DELETE since record is gone)
      const newValues = (method === "DELETE") ? null : (req.body ?? null);
      // oldValues = DB state before mutation; Decimal fields converted to numbers
      // so stored JSON compares correctly to current values without type coercion.
      const oldValues = beforeState ? serializeForAudit(beforeState) : null;

      writeAudit({
        action,
        targetEntity: entityName,
        targetId,
        userId,
        branchId,
        newValues,
        oldValues,
        ipAddress: ip,
      }).catch((err) => console.error("[AUDIT] Async write error:", err.message));
    }

    return originalJson(data);
  };

  next();
  } catch (err) {
    console.error("[AUDIT] Capture middleware error:", err.message);
    next(); // never block the request
  }
}

module.exports = auditCapture;
module.exports.extractAction = extractAction;
module.exports.serializeForAudit = serializeForAudit;
