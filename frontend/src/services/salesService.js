import api from "./apiClient";

const SALES_URL = "/sales";

// Map backend payment method to frontend format
const mapPaymentMethod = (backendMethod) => {
  const mapping = {
    CASH: "cash",
    CREDIT: "credit",
    MIXED: "mixed",
  };
  return mapping[backendMethod] || "cash";
};

// Map frontend payment method to backend format
const mapPaymentMethodToBackend = (frontendMethod) => {
  const mapping = {
    cash: "CASH",
    credit: "CREDIT",
    mixed: "MIXED",
  };
  return mapping[frontendMethod] || "CASH";
};

export const salesService = {
  async getAll() {
    const data = await api.get(SALES_URL);
    return data;
  },

  async getById(id) {
    return await api.get(`${SALES_URL}/${id}`);
  },

  async getBySaleNumber(saleNumber) {
    return await api.get(`${SALES_URL}/number/${saleNumber}`);
  },

  async create(saleData) {
    return await api.post(SALES_URL, saleData);
  },

  async update(id, updates) {
    return await api.put(`${SALES_URL}/${id}`, updates);
  },

  async delete(id) {
    await api.delete(`${SALES_URL}/${id}`);
    return true;
  },

  async refund(refundData) {
    return await api.post(`${SALES_URL}/refund`, refundData);
  },

  async markDelivered(saleId) {
    return await api.patch(`${SALES_URL}/${saleId}/mark-delivered`);
  },
};
