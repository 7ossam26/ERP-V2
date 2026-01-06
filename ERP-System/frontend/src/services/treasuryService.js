import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const BASE_URL = `${API_URL}/api/treasuries`;

export const treasuryService = {
  // Get all treasuries
  getAll: async () => {
    const response = await axios.get(BASE_URL);
    return response.data;
  },

  // Get treasury by ID
  getById: async (id) => {
    const response = await axios.get(`${BASE_URL}/${id}`);
    return response.data;
  },

  // Create new treasury
  create: async (data) => {
    const response = await axios.post(BASE_URL, data);
    return response.data;
  },

  // Update treasury
  update: async (id, data) => {
    const response = await axios.put(`${BASE_URL}/${id}`, data);
    return response.data;
  },

  // Delete treasury
  delete: async (id) => {
    await axios.delete(`${BASE_URL}/${id}`);
  },
};
