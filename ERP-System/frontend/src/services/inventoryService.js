import api from "./apiClient";

export const inventoryService = {
  // Get all inventory items with optional filters
  getInventory: async (filters = {}) => {
    const queryParams = new URLSearchParams();
    if (filters.warehouseId)
      queryParams.append("warehouseId", filters.warehouseId);
    if (filters.category) queryParams.append("category", filters.category);

    return api.get(`/inventory?${queryParams.toString()}`);
  },

  // Get dashboard stats
  getStats: async (filters = {}) => {
    const queryParams = new URLSearchParams();
    if (filters.warehouseId)
      queryParams.append("warehouseId", filters.warehouseId);
    if (filters.category) queryParams.append("category", filters.category);

    return api.get(`/inventory/stats?${queryParams.toString()}`);
  },
};
