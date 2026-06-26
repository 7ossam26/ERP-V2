import api from "./apiClient";

const EXPENSES_URL = "/expenses";

export const expenseService = {
    /**
     * Get treasuries available for expense creation (scoped to user's branch)
     * @returns {Promise<Array>} Array of treasuries
     */
    async getTreasuries() {
        return await api.get(`${EXPENSES_URL}/treasuries`);
    },

    /**
     * Get all expenses
     * @returns {Promise<Array>} Array of expenses
     */
    async getAll() {
        return await api.get(EXPENSES_URL);
    },

    /**
     * Get expense by ID
     * @param {number} id
     * @returns {Promise<Object>} Expense object
     */
    async getById(id) {
        return await api.get(`${EXPENSES_URL}/${id}`);
    },

    /**
     * Create a new expense
     * @param {Object} data - Expense data
     * @returns {Promise<Object>} Created expense
     */
    async create(data) {
        return await api.post(EXPENSES_URL, data);
    },

    /**
     * Update an existing expense
     * @param {number} id
     * @param {Object} data
     * @returns {Promise<Object>} Updated expense
     */
    async update(id, data) {
        return await api.put(`${EXPENSES_URL}/${id}`, data);
    },

    /**
     * Delete an expense
     * @param {number} id
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        await api.delete(`${EXPENSES_URL}/${id}`);
        return true;
    },

    /**
     * Get expense analysis report with aggregations by category and branch
     * @param {Object} filters - startDate, endDate, branchId, categoryId, paymentMethod
     */
    async getReport(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") params.append(k, v);
        });
        const qs = params.toString();
        return await api.get(`${EXPENSES_URL}/report${qs ? `?${qs}` : ""}`);
    },
};
