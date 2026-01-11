import axios from "axios";

const API_BASE_URL = "/api";
const CATEGORIES_URL = `${API_BASE_URL}/categories`;

/**
 * Category API Service
 * Provides CRUD operations for categories
 */
export const categoryService = {
  /**
   * Get all categories
   * @returns {Promise<Array>} Array of categories
   */
  async getAll() {
    try {
      const response = await axios.get(CATEGORIES_URL);
      return response.data;
    } catch (error) {
      console.error("Error fetching categories:", error);
      throw error;
    }
  },

  /**
   * Get category by ID
   * @param {number} id - Category ID
   * @returns {Promise<Object>} Category object
   */
  async getById(id) {
    try {
      const response = await axios.get(`${CATEGORIES_URL}/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching category ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create a new category
   * @param {Object} categoryData - Category data (name)
   * @returns {Promise<Object>} Created category
   */
  async create(categoryData) {
    try {
      const response = await axios.post(CATEGORIES_URL, categoryData);
      return response.data;
    } catch (error) {
      console.error("Error creating category:", error);
      throw error;
    }
  },

  /**
   * Update an existing category
   * @param {number} id - Category ID
   * @param {Object} updates - Updated category data
   * @returns {Promise<Object>} Updated category
   */
  async update(id, updates) {
    try {
      const response = await axios.put(`${CATEGORIES_URL}/${id}`, updates);
      return response.data;
    } catch (error) {
      console.error(`Error updating category ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a category
   * @param {number} id - Category ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    try {
      await axios.delete(`${CATEGORIES_URL}/${id}`);
      return true;
    } catch (error) {
      console.error(`Error deleting category ${id}:`, error);
      throw error;
    }
  },
};
