import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const SUPPLIERS_URL = `${API_BASE_URL}/suppliers`;

// Map backend response to frontend format
const toFrontend = (backendData) => ({
  id: backendData.id,
  name: backendData.name,
  phone: backendData.phoneNumber,
  createdAt: backendData.createdAt,
  updatedAt: backendData.updatedAt,
});

/**
 * Supplier API Service
 * Provides CRUD operations for suppliers
 */
export const supplierService = {
  /**
   * Get all suppliers
   * @returns {Promise<Array>} Array of suppliers
   */
  async getAll() {
    try {
      const response = await axios.get(SUPPLIERS_URL);
      return response.data.map(toFrontend);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      throw error;
    }
  },

  /**
   * Get supplier by ID
   * @param {number} id - Supplier ID
   * @returns {Promise<Object>} Supplier object
   */
  async getById(id) {
    try {
      const response = await axios.get(`${SUPPLIERS_URL}/${id}`);
      return toFrontend(response.data);
    } catch (error) {
      console.error(`Error fetching supplier ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create a new supplier
   * @param {Object} supplierData - Supplier data (name, phone, code)
   * @returns {Promise<Object>} Created supplier
   */
  async create(supplierData) {
    try {
      // Map frontend field names to backend field names
      const backendData = {
        name: supplierData.name,
        phoneNumber: supplierData.phone || supplierData.phoneNumber,
      };

      const response = await axios.post(SUPPLIERS_URL, backendData);
      return toFrontend(response.data);
    } catch (error) {
      console.error("Error creating supplier:", error);
      throw error;
    }
  },

  /**
   * Update an existing supplier
   * @param {number} id - Supplier ID
   * @param {Object} updates - Updated supplier data
   * @returns {Promise<Object>} Updated supplier
   */
  async update(id, updates) {
    try {
      // Map frontend field names to backend field names
      const backendData = {
        name: updates.name,
        phoneNumber: updates.phone || updates.phoneNumber,
      };

      const response = await axios.put(`${SUPPLIERS_URL}/${id}`, backendData);
      return toFrontend(response.data);
    } catch (error) {
      console.error(`Error updating supplier ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a supplier
   * @param {number} id - Supplier ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    try {
      await axios.delete(`${SUPPLIERS_URL}/${id}`);
      return true;
    } catch (error) {
      console.error(`Error deleting supplier ${id}:`, error);
      throw error;
    }
  },
};
