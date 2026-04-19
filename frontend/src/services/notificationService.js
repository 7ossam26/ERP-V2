import api from "./apiClient";

export const notificationService = {
  list: ({ unreadOnly = false, type, page = 1, limit = 25 } = {}) => {
    const qs = new URLSearchParams({ page, limit });
    if (unreadOnly) qs.set("unreadOnly", "true");
    if (type) qs.set("type", type);
    return api.get(`/notifications?${qs.toString()}`);
  },
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  markReadByOrder: (orderId) =>
    api.patch(`/notifications/read-by-order/${orderId}`),
  markAllRead: () => api.post(`/notifications/read-all`),
};

export default notificationService;
