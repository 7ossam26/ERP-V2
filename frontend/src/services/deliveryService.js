import api from "./apiClient";

export const deliveryService = {
  getAll: (params) => api.get("/delivery-men", { params }),
  create: (data) => api.post("/delivery-men", data),
  update: (id, data) => api.put(`/delivery-men/${id}`, data),
  delete: (id) => api.delete(`/delivery-men/${id}`),
  getStats: (params) => api.get("/delivery-men/stats", { params }),
};
