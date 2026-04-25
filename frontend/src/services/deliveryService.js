import api from "./apiClient";

export const deliveryService = {
  getAll: (params) => api.get("/delivery-men", { params }),
  create: (data) => api.post("/delivery-men", data),
  update: (id, data) => api.put(`/delivery-men/${id}`, data),
  delete: (id) => api.delete(`/delivery-men/${id}`),
  getStats: (params) => api.get("/delivery-men/stats", { params }),
  getWithDebt: (params) => api.get("/delivery-men/with-debt", { params }),
  settle: (data) => api.post("/delivery-men/settle", data),
  settleDeliveryMan: (data) => api.post("/delivery-men/settle", data),
  settleBulk: (data) => api.post("/delivery-men/settle", data), // Uses same endpoint, backend detects bulk
  getHistory: (id, params) => api.get(`/delivery-men/${id}/history`, { params }),
  getDailyReport: (params) => api.get("/delivery-men/daily-report", { params }),
};
