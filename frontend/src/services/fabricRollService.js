import api from "./apiClient";

const BASE = "/fabric-rolls";

export const fabricRollService = {
  /** List rolls with filters + pagination */
  getAll: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") q.append(k, v);
    });
    return api.get(`${BASE}?${q.toString()}`);
  },

  /** Single roll detail with cut history */
  getById: (id) => api.get(`${BASE}/${id}`),

  /** Batch create rolls */
  create: (rolls) => api.post(BASE, { rolls }),

  /** Edit notes / barcode */
  update: (id, data) => api.put(`${BASE}/${id}`, data),

  /** Mark a roll as damaged */
  markDamaged: (id, notes) => api.post(`${BASE}/${id}/mark-damaged`, { notes }),

  /** Internal cut — used by POS/adjustments */
  cut: (id, payload) => api.post(`${BASE}/${id}/cut`, payload),

  /** Pickable rolls for a given item+warehouse */
  getPickable: (itemId, warehouseId, sort = "shortest-first") =>
    api.get(
      `${BASE}/pickable?itemId=${itemId}&warehouseId=${warehouseId}&sort=${sort}`
    ),
};
