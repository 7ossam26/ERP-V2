import apiClient from "./apiClient";
import eventStream from "./eventStreamService.js";
import { emitAuthChanged } from "../utils/authEvents.js";

const AuthService = {
  // Login with username and password
  login: async (username, password) => {
    const response = await apiClient.post("/auth/login", {
      username,
      password,
    });

    const { token, user } = response;

    if (token && user) {
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      emitAuthChanged({ reason: "login" });
    }

    return response;
  },

  // Logout current user
  logout: async () => {
    try {
      // Call server to invalidate tokens
      await apiClient.post("/auth/logout");
    } catch {
      // Ignore logout errors
    } finally {
      eventStream.stop();
      eventStream.clearReplayCursor();
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      emitAuthChanged({ reason: "logout" });
      window.location.href = "/";
    }
  },

  // Get current user from local storage
  getCurrentUser: () => {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem("token");
  },

  // Check if user has specific permission
  hasPermission: (module) => {
    const user = AuthService.getCurrentUser();
    if (!user) return false;

    // Superadmin and Admin have all permissions
    if (user.role === "Superadmin" || user.role === "Admin") return true;

    // Check permissions object if available
    // Backend returns simplified boolean map: { "INVENTORY": true, "Sales": false }
    if (user.permissions) {
      return !!user.permissions[module];
    }

    return false;
  },

  // Check if user has ANY of the provided permissions (OR logic)
  hasAnyPermission: (modules) => {
    return modules.some((module) => AuthService.hasPermission(module));
  },

  // Check if user is superadmin
  isSuperadmin: () => {
    const user = AuthService.getCurrentUser();
    return user && user.role === "Superadmin";
  },

  // Check if user has sensitive access (can edit/delete sensitive data)
  hasSensitiveAccess: () => {
    const user = AuthService.getCurrentUser();
    if (!user) return false;

    // Superadmin always has sensitive access
    if (user.role === "Superadmin") return true;

    // Check hasSensitiveAccess flag
    return !!user.hasSensitiveAccess;
  },

  // Refresh user profile from backend
  refreshProfile: async () => {
    try {
      const response = await apiClient.get("/auth/me");
      const userData = response.data || response;

      if (userData) {
        // Check if critical data has changed
        const currentUser = AuthService.getCurrentUser();
        if (currentUser) {
          const hasPermissionsChanged =
            JSON.stringify(currentUser.permissions || {}) !==
            JSON.stringify(userData.permissions || {});
          // Handle potential differences in role object vs string if applicable, though usually consistent
          const hasRoleChanged = currentUser.role !== userData.role;
          const hasNameChanged = currentUser.name !== userData.name;
          const hasSensitiveAccessChanged =
            currentUser.hasSensitiveAccess !== userData.hasSensitiveAccess;
          const hasBranchesChanged =
            JSON.stringify(currentUser.accessibleBranches || []) !==
            JSON.stringify(userData.accessibleBranches || []);

          if (
            !hasPermissionsChanged &&
            !hasRoleChanged &&
            !hasNameChanged &&
            !hasSensitiveAccessChanged &&
            !hasBranchesChanged
          ) {
            return null; // No significant change, avoid re-render
          }
        }

        // Preserve the token, update the user object
        localStorage.setItem("user", JSON.stringify(userData));
        return userData;
      }
    } catch (error) {
      console.error("Failed to refresh profile:", error);
      return null;
    }
  },
};

export default AuthService;
