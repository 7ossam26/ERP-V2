import api from "./apiClient";

const BASE = "/inventory-adjustments";

export const inventoryAdjustmentService = {
  getAll: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") q.append(k, v);
    });
    return api.get(`${BASE}?${q.toString()}`);
  },

  getById: (id) => api.get(`${BASE}/${id}`),

  create: (data) => api.post(BASE, data),
};
