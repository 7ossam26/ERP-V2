import api from "./apiClient";

const WAREHOUSES_URL = "/warehouses";

export const warehouseService = {
  // Get all warehouses. By default the backend scopes the result to the caller's
  // assigned branch(es). Pass all=true for cross-branch flows (stock transfer,
  // production, admin/settings) that must see every warehouse.
  getAll: async (all = false) => {
    return await api.get(all ? `${WAREHOUSES_URL}?all=true` : WAREHOUSES_URL);
  },

  // Get warehouse by ID
  getById: async (id) => {
    return await api.get(`${WAREHOUSES_URL}/${id}`);
  },

  // Create new warehouse
  create: async (data) => {
    return await api.post(WAREHOUSES_URL, data);
  },

  // Update warehouse
  update: async (id, data) => {
    return await api.put(`${WAREHOUSES_URL}/${id}`, data);
  },

  // Delete warehouse
  delete: async (id) => {
    await api.delete(`${WAREHOUSES_URL}/${id}`);
  },
};
