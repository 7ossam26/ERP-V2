import api from "./apiClient";

const BRANCHES_URL = "/branches";

export const branchService = {
  async getAll() {
    return await api.get(BRANCHES_URL);
  },

  async getSummary() {
    try {
      const data = await api.get(`${BRANCHES_URL}/summary`);
      return data;
    } catch (error) {
      console.error("Error fetching branch summary:", error);
      return { totalBalance: 0, percentageChange: 0, netChange: 0 };
    }
  },

  async getById(id) {
    return await api.get(`${BRANCHES_URL}/${id}`);
  },

  async create(branchData) {
    return await api.post(BRANCHES_URL, branchData);
  },

  async update(id, branchData) {
    return await api.put(`${BRANCHES_URL}/${id}`, branchData);
  },

  async delete(id) {
    await api.delete(`${BRANCHES_URL}/${id}`);
    return true;
  },
};
