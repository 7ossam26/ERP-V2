import api from "./apiClient"; // Assuming api is the default export from api.js or similar

export const deliveryService = {
  getAll: (params) =>
    api.get("/delivery-men", { params }).then((res) => res.data),
  create: (data) => api.post("/delivery-men", data).then((res) => res.data),
  update: (id, data) =>
    api.put(`/delivery-men/${id}`, data).then((res) => res.data),
  delete: (id) => api.delete(`/delivery-men/${id}`).then((res) => res.data),
};
