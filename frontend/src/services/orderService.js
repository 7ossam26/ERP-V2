import api from "./apiClient";

export const orderService = {
  getQueue: (branchId) =>
    api.get(`/orders/queue?branchId=${encodeURIComponent(branchId)}`),
  get: (id) => api.get(`/orders/${id}`),
  setStatus: (id, { status, deliveryManId, reason } = {}) =>
    api.patch(`/orders/${id}/status`, { status, deliveryManId, reason }),
};

export default orderService;
