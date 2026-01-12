import api from "./apiClient";

const WAREHOUSES_URL = "/warehouses";

export const warehouseService = {
  // Get all warehouses
  getAll: async () => {
    return await api.get(WAREHOUSES_URL);
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
