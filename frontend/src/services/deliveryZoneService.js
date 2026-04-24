import api from "./apiClient";

export const deliveryZoneService = {
    getAll: (params) => api.get("/delivery-zones", { params }),
    getById: (id) => api.get(`/delivery-zones/${id}`),
    create: (data) => api.post("/delivery-zones", data),
    update: (id, data) => api.put(`/delivery-zones/${id}`, data),
    delete: (id) => api.delete(`/delivery-zones/${id}`),
};
