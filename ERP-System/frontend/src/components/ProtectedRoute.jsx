import React from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import AuthService from "../services/authService";

const ProtectedRoute = ({ requiredRole, requiredPermission, children }) => {
    const location = useLocation();
    const isAuthenticated = AuthService.isAuthenticated();
    const user = AuthService.getCurrentUser();
    const isSuperadmin = AuthService.isSuperadmin();

    if (!isAuthenticated) {
        // Redirect to login page with the return url
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // Role-based access control
    if (requiredRole === "superadmin" && !isSuperadmin) {
        // User is logged in but trying to access superadmin area without permission
        return <Navigate to="/dashboard" replace />;
    }

    // Permission-based access control
    if (requiredPermission) {
        // Handle array of permissions (OR logic)
        if (Array.isArray(requiredPermission)) {
            const hasAny = AuthService.hasAnyPermission(requiredPermission);
            if (!hasAny) {
                return <Navigate to="/forbidden" replace />;
            }
        }
        // Handle single permission string
        else if (typeof requiredPermission === 'string') {
            if (!AuthService.hasPermission(requiredPermission)) {
                return <Navigate to="/forbidden" replace />;
            }
        }
        // Handle object format { module: "MODULE" } (legacy support if needed)
        else if (requiredPermission.module) {
            if (!AuthService.hasPermission(requiredPermission.module)) {
                return <Navigate to="/forbidden" replace />;
            }
        }
    }

    return children ? children : <Outlet />;
};

export default ProtectedRoute;
