import { api } from "./apiClient";

const BASE_URL = "/treasuries";

export const treasuryService = {
  // Get all treasuries
  getAll: () => api.get(BASE_URL),

  // Get every treasury system-wide (no branch filter) — used by cash transfer destination dropdown
  getAllUnfiltered: () => api.get(`${BASE_URL}?all=true`),

  // Get treasury by ID
  getById: (id) => api.get(`${BASE_URL}/${id}`),

  // Get global balances (Main, Visa, Instapay)
  getGlobalBalances: () => api.get(`${BASE_URL}/global-balances`),

  // Create new treasury
  create: (data) => api.post(BASE_URL, data),

  // Update treasury
  update: (id, data) => api.put(`${BASE_URL}/${id}`, data),

  // Delete treasury
  delete: (id) => api.delete(`${BASE_URL}/${id}`),

  // Drawer / branch-safe split of one treasury:
  // { balance, drawerCash, safeCash, pendingVariance, shift: {id,status,userId,userName} | null }
  // drawerCash/safeCash are null when the branch has no live shift.
  getCashSplit: (id) => api.get(`${BASE_URL}/${id}/cash-split`),

  // Transfer funds. { fromTreasuryId, toTreasuryId, amount, notes, fromDrawer, force }
  // A 409 with data.code === "CONTAINER_LIMIT" is a warning; resend with force.
  transfer: (data) => api.post(`${BASE_URL}/transfer`, data),

  // Get all transfers
  getTransfers: () => api.get(`${BASE_URL}/transfers`),

  // Approve transfer. { toDrawer } when the receiver puts the cash in the register.
  approveTransfer: (id, data = {}) =>
    api.post(`${BASE_URL}/transfer/${id}/approve`, data),

  // Reject transfer
  rejectTransfer: (id) => api.post(`${BASE_URL}/transfer/${id}/reject`),
};
