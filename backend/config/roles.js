/**
 * Single source of truth for role-NAME based access decisions.
 *
 * Before this file, these lists were copy-pasted (with subtle differences) into
 * middleware/auth.js and routes/superadmin.js. Centralizing them removes that
 * drift. Membership here is an EXACT copy of what those call sites used, so this
 * change is behavior-preserving.
 *
 * ⚠️ Known inconsistencies preserved on purpose (pending a product decision — do
 *    NOT "fix" without sign-off, as it would change who can do what):
 *    - GLOBAL_ROLES includes "Call Center" but SENSITIVE_ACCESS_DEFAULT_ROLES
 *      does not.
 *    - SENSITIVE_ACCESS_DEFAULT_ROLES includes "Manager" (department manager),
 *      which is NOT a global role.
 *
 * Role logic still reads the role NAME from the JWT (req.user.role), which is
 * stale until the user re-logs in. Moving to DB-driven role flags is a separate,
 * larger change tracked in the plan.
 */

// Roles that are NOT tied to a single branch (see all branches / no branch
// required). Used by getUserBranchFilter and user create/update validation.
const GLOBAL_ROLES = ["Superadmin", "Admin", "General Manager", "Call Center"];

// Roles that bypass module permission checks entirely and always have sensitive
// access. Used by the requirePermission* middleware and verifyManager.
const ADMIN_ROLES = ["Superadmin", "Admin"];

// Roles that DEFAULT to hasSensitiveAccess=true at user-creation time when the
// caller doesn't specify the flag explicitly. (Distinct list — see warning above.)
const SENSITIVE_ACCESS_DEFAULT_ROLES = [
  "Superadmin",
  "Admin",
  "Manager",
  "General Manager",
];

// Roles allowed to act as the manager approver on a manager-gated action (e.g.
// executing a sales/purchase return). A hard allowlist by design: even if a
// role is granted SALES_RETURNS/PURCHASE_RETURNS via the Superadmin permission
// UI, it can only approve if its NAME is also here. Deliberately a separate
// list from SENSITIVE_ACCESS_DEFAULT_ROLES above — that one is a *default* at
// user-creation time and the file header warns it's pending a product decision;
// this one is a hard approval gate and must not drift if that one changes.
const RETURN_APPROVAL_ROLES = ["Superadmin", "Admin", "General Manager", "Manager"];

const isGlobalRole = (roleName) => GLOBAL_ROLES.includes(roleName);
const isAdminRole = (roleName) => ADMIN_ROLES.includes(roleName);
const defaultsToSensitiveAccess = (roleName) =>
  SENSITIVE_ACCESS_DEFAULT_ROLES.includes(roleName);
const isReturnApprovalRole = (roleName) => RETURN_APPROVAL_ROLES.includes(roleName);

module.exports = {
  GLOBAL_ROLES,
  ADMIN_ROLES,
  SENSITIVE_ACCESS_DEFAULT_ROLES,
  RETURN_APPROVAL_ROLES,
  isGlobalRole,
  isAdminRole,
  defaultsToSensitiveAccess,
  isReturnApprovalRole,
};
