import api from "./apiClient";

const BASE = "/inventory-counts";

export const inventoryCountService = {
  getAll: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") q.append(k, v);
    });
    return api.get(`${BASE}?${q.toString()}`);
  },

  getById: (id) => api.get(`${BASE}/${id}`),

  start: (data) => api.post(BASE, data),

  record: (id, items) => api.put(`${BASE}/${id}/record`, { items }),

  finalize: (id, fabricAllocations) =>
    api.post(`${BASE}/${id}/finalize`, { fabricAllocations }),
};
