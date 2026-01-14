import apiClient from "./apiClient";

export const supplierAccountService = {
    getAll: () => apiClient.get("/api/supplier-accounts"),
    getById: (supplierId) => apiClient.get(`/api/supplier-accounts/${supplierId}`),
    getPayments: (supplierId) =>
        apiClient.get(`/api/supplier-accounts/${supplierId}/payments`),
    makePayment: (supplierId, data) =>
        apiClient.post(`/api/supplier-accounts/${supplierId}/payments`, data),
    getPurchases: (supplierId) =>
        apiClient.get(`/api/supplier-accounts/${supplierId}/purchases`),
};
