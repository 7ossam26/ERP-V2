import api from "./apiClient";

const DEPOSITS_URL = "/deposits";

export const depositService = {
    /**
     * Get all deposits
     * @returns {Promise<Array>} Array of deposits
     */
    async getAll() {
        return await api.get(DEPOSITS_URL);
    },

    /**
     * Create a new deposit
     * @param {Object} data - Deposit data
     * @returns {Promise<Object>} Created deposit
     */
    async create(data) {
        return await api.post(DEPOSITS_URL, data);
    },
};
