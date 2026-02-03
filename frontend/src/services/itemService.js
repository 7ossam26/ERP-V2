import api from "./apiClient";

const ITEMS_URL = "/items";

// Map backend response to frontend format
const toFrontend = (backendData) => ({
  id: backendData.id,
  name: backendData.name,
  code: backendData.code || backendData.id,
  price: backendData.price,
  unit: backendData.unit,
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
    const data = await api.get(ITEMS_URL);
    return data.map(toFrontend);
  },

  /**
   * Get item by ID
   * @param {number} id - Item ID
   * @returns {Promise<Object>} Item object
   */
  async getById(id) {
    const data = await api.get(`${ITEMS_URL}/${id}`);
    return toFrontend(data);
  },

  /**
   * Create a new item
   * @param {Object} itemData - Item data
   * @returns {Promise<Object>} Created item
   */
  async create(itemData) {
    const backendData = {
      name: itemData.name,
      price: Number(itemData.price) || 0,
      unit: itemData.unit || "piece",
      reorderPoint: Number(itemData.reorderPoint) || 10,
      // Deduplicate and ensure numbers for suppliers
      suppliers: itemData.suppliers
        ? [...new Set(itemData.suppliers.map((id) => parseInt(id)))].filter((id) => !isNaN(id))
        : [],
      categories: itemData.categories,
    };
    const data = await api.post(ITEMS_URL, backendData);
    return toFrontend(data);
  },

  /**
   * Update an existing item
   * @param {number} id - Item ID
   * @param {Object} updates - Updated item data
   * @returns {Promise<Object>} Updated item
   */
  async update(id, updates) {
    const backendData = {
      name: updates.name,
      price: updates.price,
      unit: updates.unit,
      suppliers: updates.suppliers,
      categories: updates.categories,
    };
    const data = await api.put(`${ITEMS_URL}/${id}`, backendData);
    return toFrontend(data);
  },

  /**
   * Delete an item
   * @param {number} id - Item ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    await api.delete(`${ITEMS_URL}/${id}`);
    return true;
  },
};
