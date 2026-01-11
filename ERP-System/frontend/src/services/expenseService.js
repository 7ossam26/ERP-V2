import axios from "axios";

const API_BASE_URL =
    import.meta.env.VITE_API_URL || "http://localhost:3001/api";
const EXPENSES_URL = `${API_BASE_URL}/expenses`;

export const expenseService = {
    /**
     * Get all expenses
     * @returns {Promise<Array>} Array of expenses
     */
    async getAll() {
        try {
            const response = await axios.get(EXPENSES_URL);
            return response.data;
        } catch (error) {
            console.error("Error fetching expenses:", error);
            throw error;
        }
    },

    /**
     * Get expense by ID
     * @param {number} id
     * @returns {Promise<Object>} Expense object
     */
    async getById(id) {
        try {
            const response = await axios.get(`${EXPENSES_URL}/${id}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching expense ${id}:`, error);
            throw error;
        }
    },

    /**
     * Create a new expense
     * @param {Object} data - Expense data
     * @returns {Promise<Object>} Created expense
     */
    async create(data) {
        try {
            const response = await axios.post(EXPENSES_URL, data);
            return response.data;
        } catch (error) {
            console.error("Error creating expense:", error);
            throw error;
        }
    },

    /**
     * Update an existing expense
     * @param {number} id
     * @param {Object} data
     * @returns {Promise<Object>} Updated expense
     */
    async update(id, data) {
        try {
            const response = await axios.put(`${EXPENSES_URL}/${id}`, data);
            return response.data;
        } catch (error) {
            console.error(`Error updating expense ${id}:`, error);
            throw error;
        }
    },

    /**
     * Delete an expense
     * @param {number} id
     * @returns {Promise<boolean>} Success status
     */
    async delete(id) {
        try {
            await axios.delete(`${EXPENSES_URL}/${id}`);
            return true;
        } catch (error) {
            console.error(`Error deleting expense ${id}:`, error);
            throw error;
        }
    },
};
