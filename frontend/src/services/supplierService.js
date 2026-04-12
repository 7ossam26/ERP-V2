import api from "./apiClient";

const SUPPLIERS_URL = "/suppliers";

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
    const data = await api.get(SUPPLIERS_URL);
    return data.map(toFrontend);
  },

  /**
   * Get supplier by ID
   * @param {number} id - Supplier ID
   * @returns {Promise<Object>} Supplier object
   */
  async getById(id) {
    const data = await api.get(`${SUPPLIERS_URL}/${id}`);
    return toFrontend(data);
  },

  /**
   * Create a new supplier
   * @param {Object} supplierData - Supplier data (name, phone)
   * @returns {Promise<Object>} Created supplier
   */
  async create(supplierData) {
    const backendData = {
      name: supplierData.name,
      phoneNumber: supplierData.phone ?? supplierData.phoneNumber ?? "",
    };
    const data = await api.post(SUPPLIERS_URL, backendData);
    return toFrontend(data);
  },

  /**
   * Update an existing supplier
   * @param {number} id - Supplier ID
   * @param {Object} updates - Updated supplier data
   * @returns {Promise<Object>} Updated supplier
   */
  async update(id, updates) {
    const backendData = {
      name: updates.name,
      phoneNumber: updates.phone ?? updates.phoneNumber ?? "",
    };
    const data = await api.put(`${SUPPLIERS_URL}/${id}`, backendData);
    return toFrontend(data);
  },

  /**
   * Delete a supplier
   * @param {number} id - Supplier ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    await api.delete(`${SUPPLIERS_URL}/${id}`);
    return true;
  },
};
