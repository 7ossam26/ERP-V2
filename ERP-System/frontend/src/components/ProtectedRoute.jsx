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
        // Handle both string "MODULE" and object { module: "MODULE" } formats
        const moduleName = typeof requiredPermission === 'string'
            ? requiredPermission
            : requiredPermission.module;

        if (moduleName) {
            const hasPerm = AuthService.hasPermission(moduleName);
            if (!hasPerm) {
                // User doesn't have permission for this module
                return <Navigate to="/forbidden" replace />;
            }
        }
    }

    return children ? children : <Outlet />;
};

export default ProtectedRoute;
