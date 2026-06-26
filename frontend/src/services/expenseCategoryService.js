import api from "./apiClient";

const BASE_URL = "/expense-categories";

export const expenseCategoryService = {
    // Returns all categories (used by management screen via GenericPageManager)
    async getAll() {
        return await api.get(BASE_URL);
    },

    // Returns only active categories (used by expense form dropdown)
    async getActive() {
        return await api.get(`${BASE_URL}?active=1`);
    },

    async create(data) {
        return await api.post(BASE_URL, data);
    },

    async update(id, data) {
        return await api.put(`${BASE_URL}/${id}`, data);
    },

    async delete(id) {
        await api.delete(`${BASE_URL}/${id}`);
        return true;
    },
};
