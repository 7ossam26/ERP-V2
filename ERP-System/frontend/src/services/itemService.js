import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const ITEMS_URL = `${API_BASE_URL}/items`;

// Map backend response to frontend format
const toFrontend = (backendData) => ({
  id: backendData.id,
  name: backendData.name,
  code: backendData.code || backendData.id, // Using ID as code if not present (although model doesn't have code, form expects it visually)
  price: backendData.price,
  unit: backendData.unit,
  // Map array of relation objects to array of IDs for the form state
  suppliers: backendData.suppliers?.map((s) => s.supplier.id) || [],
  categories: backendData.categories?.map((c) => c.category.id) || [],
  createdAt: backendData.createdAt,
  updatedAt: backendData.updatedAt,
});

/**
 * Item API Service
 * Provides CRUD operations for items
 */
export const itemService = {
  /**
   * Get all items
   * @returns {Promise<Array>} Array of items
   */
  async getAll() {
    try {
      const response = await axios.get(ITEMS_URL);
      return response.data.map(toFrontend);
    } catch (error) {
      console.error("Error fetching items:", error);
      throw error;
    }
  },

  /**
   * Get item by ID
   * @param {number} id - Item ID
   * @returns {Promise<Object>} Item object
   */
  async getById(id) {
    try {
      const response = await axios.get(`${ITEMS_URL}/${id}`);
      return toFrontend(response.data);
    } catch (error) {
      console.error(`Error fetching item ${id}:`, error);
      throw error;
    }
  },

  /**
   * Create a new item
   * @param {Object} itemData - Item data
   * @returns {Promise<Object>} Created item
   */
  async create(itemData) {
    try {
      // Backend expects arrays of IDs
      const backendData = {
        name: itemData.name,
        price: itemData.price,
        unit: itemData.unit,
        suppliers: itemData.suppliers,
        categories: itemData.categories,
      };

      const response = await axios.post(ITEMS_URL, backendData);
      return toFrontend(response.data);
    } catch (error) {
      console.error("Error creating item:", error);
      throw error;
    }
  },

  /**
   * Update an existing item
   * @param {number} id - Item ID
   * @param {Object} updates - Updated item data
   * @returns {Promise<Object>} Updated item
   */
  async update(id, updates) {
    try {
      const backendData = {
        name: updates.name,
        price: updates.price,
        unit: updates.unit,
        suppliers: updates.suppliers,
        categories: updates.categories,
      };

      const response = await axios.put(`${ITEMS_URL}/${id}`, backendData);
      return toFrontend(response.data);
    } catch (error) {
      console.error(`Error updating item ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete an item
   * @param {number} id - Item ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    try {
      await axios.delete(`${ITEMS_URL}/${id}`);
      return true;
    } catch (error) {
      console.error(`Error deleting item ${id}:`, error);
      throw error;
    }
  },
};
