/**
 * ERP-V2 Desktop — Auth Middleware (Single-User Bypass)
 *
 * All auth checks are bypassed for the desktop single-user application.
 * Every function preserves its original signature and export name
 * so that all 27 route files continue to work without modification.
 *
 * req.user is set to a hardcoded superadmin for all requests.
 */

// Hardcoded superadmin user — injected into every request
const DESKTOP_USER = {
  id: 1,
  username: "superadmin",
  name: "Superadmin",
  role: "Superadmin",
  roleId: 1,
  branchId: null,
  hasSensitiveAccess: true,
};

const authenticateToken = (req, res, next) => {
  req.user = DESKTOP_USER;
  next();
};

const isSuperadmin = (req, res, next) => {
  next();
};

const requirePermission = (module) => {
  return (req, res, next) => {
    next();
  };
};

const requireAnyPermission = (modules) => {
  return (req, res, next) => {
    next();
  };
};

const requireCreatePermission = (createModule) => {
  return (req, res, next) => {
    next();
  };
};

const requireSensitiveAccess = (req, res, next) => {
  next();
};

// Always returns null (no branch filter — full access)
const getUserBranchFilter = async (userId) => {
  return null;
};

module.exports = {
  authenticateToken,
  isSuperadmin,
  requirePermission,
  requireAnyPermission,
  requireCreatePermission,
  requireSensitiveAccess,
  getUserBranchFilter,
};
