import api from "./apiClient";

export const stockTransferService = {
  // Get all stock transfers
  getAll: async (filters = {}) => {
    const query = new URLSearchParams(filters).toString();
    return api.get(`/stock-transfers?${query}`);
  },

  // Get stock transfer by ID
  getById: async (id) => {
    return api.get(`/stock-transfers/${id}`);
  },

  // Create new stock transfer
  create: async (data) => {
    return api.post("/stock-transfers", data);
  },

  // Delete stock transfer
  delete: async (id) => {
    return api.delete(`/stock-transfers/${id}`);
  },

  // Approve a pending stock transfer (credits destination inventory)
  approve: async (id) => {
    return api.post(`/stock-transfers/${id}/approve`);
  },

  // Reject a pending stock transfer (refunds source inventory)
  reject: async (id) => {
    return api.post(`/stock-transfers/${id}/reject`);
  },
};
