import { api } from "./apiClient";

const BASE_URL = "/treasuries";

export const treasuryService = {
  // Get all treasuries
  getAll: () => api.get(BASE_URL),

  // Get treasury by ID
  getById: (id) => api.get(`${BASE_URL}/${id}`),

  // Create new treasury
  create: (data) => api.post(BASE_URL, data),

  // Update treasury
  update: (id, data) => api.put(`${BASE_URL}/${id}`, data),

  // Delete treasury
  delete: (id) => api.delete(`${BASE_URL}/${id}`),

  // Transfer funds
  transfer: (data) => api.post(`${BASE_URL}/transfer`, data),

  // Get all transfers
  getTransfers: () => api.get(`${BASE_URL}/transfers`),

  // Approve transfer
  approveTransfer: (id) => api.post(`${BASE_URL}/transfer/${id}/approve`),

  // Reject transfer
  rejectTransfer: (id) => api.post(`${BASE_URL}/transfer/${id}/reject`),
};
