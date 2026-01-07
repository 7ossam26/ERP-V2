import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const BRANCHES_URL = `${API_URL}/api/branches`;

export const branchService = {
  async getAll() {
    try {
      const response = await axios.get(BRANCHES_URL);
      return response.data;
    } catch (error) {
      console.error("Error fetching branches:", error);
      throw error;
    }
  },

  async getById(id) {
    try {
      const response = await axios.get(`${BRANCHES_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching branch ${id}:`, error);
      throw error;
    }
  },

  async create(branchData) {
    try {
      const response = await axios.post(BRANCHES_URL, branchData);
      return response.data;
    } catch (error) {
      console.error("Error creating branch:", error);
      throw error;
    }
  },

  async update(id, branchData) {
    try {
      const response = await axios.put(`${BRANCHES_URL}/${id}`, branchData);
      return response.data;
    } catch (error) {
      console.error(`Error updating branch ${id}:`, error);
      throw error;
    }
  },

  async delete(id) {
    try {
      await axios.delete(`${BRANCHES_URL}/${id}`);
      return true;
    } catch (error) {
      console.error(`Error deleting branch ${id}:`, error);
      throw error;
    }
  },
};
