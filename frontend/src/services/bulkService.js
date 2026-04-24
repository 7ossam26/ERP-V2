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
  returnOrder: (id, data) => api.post(`/bulk/orders/${id}/return`, data),

  // Payments
  listOrderPayments: (orderId) => api.get(`/bulk/orders/${orderId}/payments`),
  createPayment: (orderId, data) => api.post(`/bulk/orders/${orderId}/payments`, data),
  voidPayment: (paymentId, reason) => api.post(`/bulk/payments/${paymentId}/void`, { reason }),
  listCustomerPayments: (customerId) => api.get(`/bulk/customers/${customerId}/payments`),

  // Customer-level payments and old-debt management
  createCustomerPayment: (customerId, data) => api.post(`/bulk/customers/${customerId}/payments`, data),
  addCustomerOldDebt: (customerId, data) => api.post(`/bulk/customers/${customerId}/old-debt`, data),
// Reports
  reportSalesByCustomer: (params) => api.get(`/bulk/reports/sales-by-customer${qs(params)}`),
  reportArAging: (params) => api.get(`/bulk/reports/ar-aging${qs(params)}`),
  reportStatement: (params) => api.get(`/bulk/reports/statement${qs(params)}`),
};

export default bulkService;
