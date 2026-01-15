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

    // Manager can only see their assigned branch
    if (role === "manager") {
      const branchId = currentUser.branch?.id || currentUser.branchId;
      if (branchId) {
        return allBranches.filter((branch) => branch.id === branchId);
      }
    }

    // Default: return all branches for other roles (safest fallback, or maybe empty?)
    // If we want to be strict: if role is manager but no branch, return empty?
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

    // Superadmin defaults to "all"
    if (currentUser.role === "Superadmin") {
      return "all";
    }

    // Manager defaults to their assigned branch
    if (currentUser.role === "Manager" && currentUser.branch) {
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
    // Only Superadmin/Admin can see "All Branches"
    return role === "superadmin" || role === "admin";
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
