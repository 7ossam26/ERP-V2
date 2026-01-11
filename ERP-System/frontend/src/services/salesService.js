import axios from "axios";

const API_BASE_URL = "/api";
const SALES_URL = `${API_BASE_URL}/sales`;

/**
 * Sales API Service
 * Provides CRUD operations for POS sales
 */
export const salesService = {
  /**
   * Get all sales
   * @returns {Promise<Array>} Array of sales
   */
  async getAll() {
    try {
      const response = await axios.get(SALES_URL);
      return response.data;
    } catch (error) {
      console.error("Error fetching sales:", error);
      throw error;
    }
  },

  /**
   * Get sale by ID
   * @param {number} id - Sale ID
   * @returns {Promise<Object>} Sale object
   */
  async getById(id) {
    try {
      const response = await axios.get(`${SALES_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching sale ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create a new sale
   * @param {Object} saleData - Sale data
   * @returns {Promise<Object>} Created sale
   */
  async create(saleData) {
    try {
      const response = await axios.post(SALES_URL, saleData);
      return response.data;
    } catch (error) {
      console.error("Error creating sale:", error);
      throw error;
    }
  },

  /**
   * Update an existing sale
   * @param {number} id - Sale ID
   * @param {Object} updates - Updated sale data
   * @returns {Promise<Object>} Updated sale
   */
  async update(id, updates) {
    try {
      const response = await axios.put(`${SALES_URL}/${id}`, updates);
      return response.data;
    } catch (error) {
      console.error(`Error updating sale ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a sale
   * @param {number} id - Sale ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    try {
      await axios.delete(`${SALES_URL}/${id}`);
      return true;
    } catch (error) {
      console.error(`Error deleting sale ${id}:`, error);
      throw error;
    }
  },
};
