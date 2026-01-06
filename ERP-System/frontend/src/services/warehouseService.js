import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const BASE_URL = `${API_URL}/api/warehouses`;

export const warehouseService = {
  // Get all warehouses
  getAll: async () => {
    const response = await axios.get(BASE_URL);
    return response.data;
  },

  // Get warehouse by ID
  getById: async (id) => {
    const response = await axios.get(`${BASE_URL}/${id}`);
    return response.data;
  },

  // Create new warehouse
  create: async (data) => {
    const response = await axios.post(BASE_URL, data);
    return response.data;
  },

  // Update warehouse
  update: async (id, data) => {
    const response = await axios.put(`${BASE_URL}/${id}`, data);
    return response.data;
  },

  // Delete warehouse
  delete: async (id) => {
    await axios.delete(`${BASE_URL}/${id}`);
  },
};
