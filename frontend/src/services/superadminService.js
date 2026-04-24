import { api } from "./apiClient";

const SuperadminService = {
    // === User Management ===
    getUsers: () => api.get("/superadmin/users"),
    createUser: (data) => api.post("/superadmin/users", data),
    updateUser: (id, data) => api.put(`/superadmin/users/${id}`, data),
    deleteUser: (id) => api.delete(`/superadmin/users/${id}`),
    toggleUserStatus: (id) => api.patch(`/superadmin/users/${id}/toggle-status`),
    resetPassword: (id, newPassword) => api.post(`/superadmin/users/${id}/reset-password`, { newPassword }),

    // === Role Management ===
    getRoles: () => api.get("/superadmin/roles"),
    createRole: (data) => api.post("/superadmin/roles", data),
    deleteRole: (id) => api.delete(`/superadmin/roles/${id}`),
    getRole: (id) => api.get(`/superadmin/roles/${id}`),

    // === Permission Management ===
    getPermissions: (roleId) => api.get(`/superadmin/roles/${roleId}/permissions`),
    updatePermissions: (roleId, permissions) => api.put(`/superadmin/roles/${roleId}/permissions`, { permissions }),

    // === Database Reset ===
    resetCategory: (category, credentials) =>
        api.post(`/superadmin/reset/${category}`, credentials),

    // === Audit Logs ===
    // Params: { page, limit, type, userId }
    getAuditLogs: (params) => {
        const query = new URLSearchParams(params).toString();
        return api.get(`/superadmin/audit-logs?${query}`);
    }
};

export default SuperadminService;
