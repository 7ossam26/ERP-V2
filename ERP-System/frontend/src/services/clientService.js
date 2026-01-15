import api from "./apiClient";

const CLIENTS_URL = "/clients";

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
    const data = await api.get(CLIENTS_URL);
    return data.map(toFrontend);
  },

  /**
   * Get client by ID
   * @param {number} id - Client ID
   * @returns {Promise<Object>} Client object
   */
  async getById(id) {
    const data = await api.get(`${CLIENTS_URL}/${id}`);
    return toFrontend(data);
  },

  /**
   * Create a new client
   * @param {Object} clientData - Client data (name, phone)
   * @param {Object} options - Additional options (e.g. checkIfExists)
   * @returns {Promise<Object>} Created client
   */
  async create(clientData, options = {}) {
    // Map frontend field names to backend field names
    const backendData = {
      name: clientData.name,
      phoneNumber: clientData.phone || clientData.phoneNumber,
      checkIfExists: options.checkIfExists,
    };

    const data = await api.post(CLIENTS_URL, backendData);
    return toFrontend(data);
  },

  /**
   * Update an existing client
   * @param {number} id - Client ID
   * @param {Object} updates - Updated client data
   * @returns {Promise<Object>} Updated client
   */
  async update(id, updates) {
    // Map frontend field names to backend field names
    const backendData = {
      name: updates.name,
      phoneNumber: updates.phone || updates.phoneNumber,
    };

    const data = await api.put(`${CLIENTS_URL}/${id}`, backendData);
    return toFrontend(data);
  },

  /**
   * Delete a client
   * @param {number} id - Client ID
   * @returns {Promise<boolean>} Success status
   */
  async delete(id) {
    await api.delete(`${CLIENTS_URL}/${id}`);
    return true;
  },
};
