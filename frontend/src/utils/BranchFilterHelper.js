import AuthService from "../services/authService";

/**
 * Branch Filter Helper - Centralized logic for role-based branch filtering
 */
const BranchFilterHelper = {
  /**
   * Get available branches based on user role
   * @param {Array} allBranches - All branches from the system
   * @param {Object} user - Current user object (optional, will fetch if not provided)
   * @returns {Array} Filtered branches based on user role
   */
  getAvailableBranches: (allBranches, user = null) => {
    if (!allBranches || allBranches.length === 0) return [];

    const currentUser = user || AuthService.getCurrentUser();
    if (!currentUser) return [];

    const role = currentUser.role?.toLowerCase();

    // Superadmin can see all branches
    if (role === "superadmin" || role === "admin") {
      return allBranches;
    }

    // Manager / Area Manager — see primary branch + accessible branches
    if (role === "manager" || role === "area manager") {
      const allowedIds = new Set();
      if (currentUser.branch?.id) allowedIds.add(currentUser.branch.id);
      if (currentUser.branchId) allowedIds.add(currentUser.branchId);
      if (currentUser.accessibleBranches && Array.isArray(currentUser.accessibleBranches)) {
        currentUser.accessibleBranches.forEach((b) => allowedIds.add(b.id));
      }
      if (allowedIds.size > 0) {
        return allBranches.filter((branch) => allowedIds.has(branch.id));
      }
    }

    // General Manager can see all branches
    if (role === "general manager") {
      return allBranches;
    }

    // Default: return all branches
    return allBranches;
  },

  /**
   * Get default branch ID for filter initialization
   * @param {Object} user - Current user object (optional, will fetch if not provided)
   * @returns {string|number} Default branchId ("all" for Superadmin, specific ID for Manager)
   */
  getDefaultBranchId: (user = null) => {
    const currentUser = user || AuthService.getCurrentUser();
    if (!currentUser) return "all";

    const role = currentUser.role?.toLowerCase();

    // Global roles default to "all"
    if (role === "superadmin" || role === "admin" || role === "general manager") {
      return "all";
    }

    // Manager defaults to their primary branch
    if (currentUser.branch) {
      return currentUser.branch.id;
    }

    // Default to "all" for other roles
    return "all";
  },

  /**
   * Check if user can see "All Branches" option
   * @param {Object} user - Current user object (optional, will fetch if not provided)
   * @returns {boolean} True if user can see "All Branches" option
   */
  canSeeAllBranches: (user = null) => {
    const currentUser = user || AuthService.getCurrentUser();
    if (!currentUser) return false;

    const role = currentUser.role?.toLowerCase();
    // Superadmin/Admin/General Manager can see "All Branches"
    return role === "superadmin" || role === "admin" || role === "general manager";
  },

  /**
   * Get user's assigned branch
   * @param {Object} user - Current user object (optional, will fetch if not provided)
   * @returns {Object|null} User's branch object or null
   */
  getUserBranch: (user = null) => {
    const currentUser = user || AuthService.getCurrentUser();
    return currentUser?.branch || null;
  },
};

export default BranchFilterHelper;
