import api from "./apiClient";

export const initialInventoryService = {
    // Get all items with initial inventory summary
    // Optional: warehouseId to get warehouse-specific quantities
    getAll: async (warehouseId = null) => {
        const params = warehouseId && warehouseId !== "all"
            ? `?warehouseId=${warehouseId}`
            : "";
        return api.get(`/initial-inventory${params}`);
    },

    // Get initial inventory history for a specific item
    getByItem: async (itemId) => {
        return api.get(`/initial-inventory/${itemId}`);
    },

    // Add initial quantity entry
    add: async (data) => {
        return api.post("/initial-inventory", data);
    },

    // Delete an entry (admin/superadmin only)
    delete: async (id) => {
        return api.delete(`/initial-inventory/${id}`);
    },
};
