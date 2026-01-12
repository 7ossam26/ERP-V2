import api from "./apiClient";

const CATEGORIES_URL = "/categories";

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
    return await api.get(CATEGORIES_URL);
  },

  /**
   * Get category by ID
   * @param {number} id - Category ID
   * @returns {Promise<Object>} Category object
   */
  async getById(id) {
    return await api.get(`${CATEGORIES_URL}/${id}`);
  },

  /**
   * Create a new category
   * @param {Object} categoryData - Category data (name)
   * @returns {Promise<Object>} Created category
   */
  async create(categoryData) {
    return await api.post(CATEGORIES_URL, categoryData);
  },

  /**
   * Update an existing category
   * @param {number} id - Category ID
   * @param {Object} updates - Updated category data
   * @returns {Promise<Object>} Updated category
   */
  async update(id, updates) {
    return await api.put(`${CATEGORIES_URL}/${id}`, updates);
  },

  /**
   * Delete a category
   * @param {number} id - Category ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    await api.delete(`${CATEGORIES_URL}/${id}`);
    return true;
  },
};
