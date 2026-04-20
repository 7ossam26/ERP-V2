import api from "./apiClient";

const qs = (params) => {
  const out = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") out.set(k, v);
  });
  const s = out.toString();
  return s ? `?${s}` : "";
};

export const bulkService = {
  // Customers
  listCustomers: (params) => api.get(`/bulk/customers${qs(params)}`),
  getCustomer: (id) => api.get(`/bulk/customers/${id}`),
  createCustomer: (data) => api.post("/bulk/customers", data),
  updateCustomer: (id, data) => api.patch(`/bulk/customers/${id}`, data),
  addContact: (id, data) => api.post(`/bulk/customers/${id}/contacts`, data),
  removeContact: (id, contactId) => api.delete(`/bulk/customers/${id}/contacts/${contactId}`),

  // Contract pricing
  listPrices: (customerId) => api.get(`/bulk/customers/${customerId}/prices`),
  upsertPrices: (customerId, entries) =>
    api.put(`/bulk/customers/${customerId}/prices`, { entries }),
  removePrice: (customerId, priceId) =>
    api.delete(`/bulk/customers/${customerId}/prices/${priceId}`),

  // Orders
  listOrders: (params) => api.get(`/bulk/orders${qs(params)}`),
  getOrder: (id) => api.get(`/bulk/orders/${id}`),
  createOrder: (data) => api.post("/bulk/orders", data),
  confirmOrder: (id, body) => api.post(`/bulk/orders/${id}/confirm`, body || {}),
  cancelOrder: (id, reason) => api.post(`/bulk/orders/${id}/cancel`, { reason }),
};

export default bulkService;
