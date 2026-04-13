import apiClient from "./apiClient";

export const supplierAccountService = {
    getAll: () => apiClient.get("/supplier-accounts"),
    getById: (supplierId) => apiClient.get(`/supplier-accounts/${supplierId}`),
    getPayments: (supplierId) =>
        apiClient.get(`/supplier-accounts/${supplierId}/payments`),
    makePayment: (supplierId, data) =>
        apiClient.post(`/supplier-accounts/${supplierId}/payments`, data),
    getPurchases: (supplierId) =>
        apiClient.get(`/supplier-accounts/${supplierId}/purchases`),
    addOldDebt: (supplierId, data) =>
        apiClient.post(`/supplier-accounts/${supplierId}/old-debt`, data),
    deleteOldDebt: (supplierId, paymentId) =>
        apiClient.delete(`/supplier-accounts/${supplierId}/old-debt/${paymentId}`),
};
