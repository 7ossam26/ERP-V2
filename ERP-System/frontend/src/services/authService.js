import apiClient from "./apiClient";

const AuthService = {
  // Login with username and password
  login: async (username, password) => {
    try {
      const response = await apiClient.post("/auth/login", {
        username,
        password,
      });

      const { token, refreshToken, user } = response;

      if (token && user) {
        localStorage.setItem("token", token);
        if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
        localStorage.setItem("user", JSON.stringify(user));

        // Start auto-refresh timer
        AuthService.startTokenRefresh();
      }

      return response;
    } catch (error) {
      throw error;
    }
  },

  // Logout current user
  logout: async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      // Call server to invalidate tokens
      await apiClient.post("/auth/logout", { refreshToken });
    } catch (e) {
      // Ignore logout errors
    } finally {
      AuthService.stopTokenRefresh();
      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      window.location.href = "/";
    }
  },

  // Auto-refresh token before expiration
  startTokenRefresh: () => {
    // Clear any existing timer
    if (window.tokenRefreshTimer) {
      clearInterval(window.tokenRefreshTimer);
    }

    // Refresh every 25 minutes (5 min before 30 min expiry)
    window.tokenRefreshTimer = setInterval(async () => {
      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (!refreshToken) return;

        const response = await apiClient.post("/auth/refresh", {
          refreshToken,
        });
        if (response.token) {
          localStorage.setItem("token", response.token);
          window.dispatchEvent(new Event("tokenRefreshed"));
        }
      } catch (error) {
        console.error("Token refresh failed:", error);
        // Don't auto-logout immediately on network error, but maybe warn?
        // For security, if refresh fails definitively (401), apiClient interceptor will handle it
      }
    }, 25 * 60 * 1000); // 25 minutes
  },

  stopTokenRefresh: () => {
    if (window.tokenRefreshTimer) {
      clearInterval(window.tokenRefreshTimer);
      window.tokenRefreshTimer = null;
    }
  },

  // Get current user from local storage
  getCurrentUser: () => {
    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch (e) {
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

    // Superadmin has all permissions
    if (user.role === "Superadmin") return true;

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

          if (!hasPermissionsChanged && !hasRoleChanged && !hasNameChanged) {
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
