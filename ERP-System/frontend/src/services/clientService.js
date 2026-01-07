import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const CLIENTS_URL = `${API_BASE_URL}/clients`;

// Map backend response to frontend format
const toFrontend = (backendData) => ({
  id: backendData.id,
  name: backendData.name,
  phone: backendData.phoneNumber,
  createdAt: backendData.createdAt,
  updatedAt: backendData.updatedAt,
});

/**
 * Client API Service
 * Provides CRUD operations for clients
 */
export const clientService = {
  /**
   * Get all clients
   * @returns {Promise<Array>} Array of clients
   */
  async getAll() {
    try {
      const response = await axios.get(CLIENTS_URL);
      return response.data.map(toFrontend);
    } catch (error) {
      console.error("Error fetching clients:", error);
      throw error;
    }
  },

  /**
   * Get client by ID
   * @param {number} id - Client ID
   * @returns {Promise<Object>} Client object
   */
  async getById(id) {
    try {
      const response = await axios.get(`${CLIENTS_URL}/${id}`);
      return toFrontend(response.data);
    } catch (error) {
      console.error(`Error fetching client ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create a new client
   * @param {Object} clientData - Client data (name, phone)
   * @returns {Promise<Object>} Created client
   */
  async create(clientData) {
    try {
      // Map frontend field names to backend field names
      const backendData = {
        name: clientData.name,
        phoneNumber: clientData.phone || clientData.phoneNumber,
      };

      const response = await axios.post(CLIENTS_URL, backendData);
      return toFrontend(response.data);
    } catch (error) {
      console.error("Error creating client:", error);
      throw error;
    }
  },

  /**
   * Update an existing client
   * @param {number} id - Client ID
   * @param {Object} updates - Updated client data
   * @returns {Promise<Object>} Updated client
   */
  async update(id, updates) {
    try {
      // Map frontend field names to backend field names
      const backendData = {
        name: updates.name,
        phoneNumber: updates.phone || updates.phoneNumber,
      };

      const response = await axios.put(`${CLIENTS_URL}/${id}`, backendData);
      return toFrontend(response.data);
    } catch (error) {
      console.error(`Error updating client ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a client
   * @param {number} id - Client ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    try {
      await axios.delete(`${CLIENTS_URL}/${id}`);
      return true;
    } catch (error) {
      console.error(`Error deleting client ${id}:`, error);
      throw error;
    }
  },
};
