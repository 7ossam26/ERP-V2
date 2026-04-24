import api from "./apiClient";

const WITHDRAWALS_URL = "/withdrawals";

export const withdrawalService = {
    /**
     * Get all withdrawals
     * @returns {Promise<Array>} Array of withdrawals
     */
    async getAll() {
        return await api.get(WITHDRAWALS_URL);
    },

    /**
     * Create a new withdrawal
     * @param {Object} data - Withdrawal data
     * @returns {Promise<Object>} Created withdrawal
     */
    async create(data) {
        return await api.post(WITHDRAWALS_URL, data);
    },
};
