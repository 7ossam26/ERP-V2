/**
 * Frontend mirror of the role-name constants in backend/config/roles.js.
 * Keep the two in sync (they are separate packages, so there is no shared
 * import). Role gating here is convenience/UX only — the backend middleware is
 * the real authority.
 *
 * NOTE: Some existing frontend sites use a *different* membership on purpose and
 * are intentionally NOT wired to these constants yet, because changing them
 * would change behavior (pending product sign-off):
 *   - contexts/BranchContext.jsx  → ["Superadmin","Admin","General Manager"] (no "Call Center")
 *   - utils/BranchFilterHelper.js → compares role.toLowerCase() to lowercase
 *     names (works correctly); also references a "area manager" role that isn't
 *     seeded (a harmless dead branch, not a bug).
 */

export const GLOBAL_ROLES = ["Superadmin", "Admin", "General Manager", "Call Center"];

// Roles that see everything in the UI (mirror of backend ADMIN_ROLES).
export const ADMIN_ROLES = ["Superadmin", "Admin"];

export const isGlobalRole = (roleName) => GLOBAL_ROLES.includes(roleName);
export const isAdminRole = (roleName) => ADMIN_ROLES.includes(roleName);
