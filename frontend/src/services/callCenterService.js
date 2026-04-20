import api from "./apiClient";

export const callCenterService = {
  listBranches: () => api.get("/call-center/branches"),
  listItems: (branchId) => api.get(`/call-center/items?branchId=${branchId}`),
  searchClients: ({ phone, name } = {}) => {
    const qs = new URLSearchParams();
    if (phone) qs.set("phone", phone);
    if (name) qs.set("name", name);
    return api.get(`/call-center/clients?${qs.toString()}`);
  },
  createClient: (data) => api.post("/call-center/clients", data),
  createOrder: (data) => api.post("/call-center/orders", data),
  listOrders: ({ status, branchId, page = 1, limit = 25 } = {}) => {
    const qs = new URLSearchParams({ page, limit });
    if (status) qs.set("status", status);
    if (branchId) qs.set("branchId", branchId);
    return api.get(`/call-center/orders?${qs.toString()}`);
  },
  cancelOrder: (id, reason, note) =>
    api.post(`/call-center/orders/${id}/cancel`, { reason, note }),
};

export default callCenterService;
