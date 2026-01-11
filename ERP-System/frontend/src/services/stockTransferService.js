import api from "./apiClient";

export const stockTransferService = {
  // Get all stock transfers
  getAll: async () => {
    return api.get("/stock-transfers");
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
};
