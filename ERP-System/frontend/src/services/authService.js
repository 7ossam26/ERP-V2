import apiClient from "./apiClient";

const AuthService = {
    // Login with username and password
    login: async (username, password) => {
        try {
            const response = await apiClient.post("/auth/login", {
                username,
                password,
            });

            const { token, user } = response;

            if (token && user) {
                localStorage.setItem("token", token);
                localStorage.setItem("user", JSON.stringify(user));
            }

            return response;
        } catch (error) {
            throw error;
        }
    },

    // Logout current user
    logout: async () => {
        try {
            // Optional: Call server to invalidate token
            // await apiClient.post("/auth/logout");
        } finally {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            window.location.href = "/";
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
    hasPermission: (module, action) => { // action: 'view', 'create', 'edit', 'delete'
        const user = AuthService.getCurrentUser();
        if (!user) return false;

        // Superadmin has all permissions
        if (user.role === "Superadmin") return true;

        // Check permissions object if available
        if (user.permissions && user.permissions[module]) {
            return !!user.permissions[module][action];
        }

        return false;
    },

    // Check if user is superadmin
    isSuperadmin: () => {
        const user = AuthService.getCurrentUser();
        return user && user.role === "Superadmin";
    }
};

export default AuthService;
