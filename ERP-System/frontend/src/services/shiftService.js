import api from "./apiClient";

const shiftService = {
    start: async (data) => {
        // data: { userId, branchId, startCash }
        const response = await api.post("/shifts/start", data);
        return response;
    },

    end: async (data) => {
        // data: { shiftId, endCash }
        const response = await api.post("/shifts/end", data);
        return response;
    },

    checkActive: async (userId) => {
        try {
            const response = await api.get(`/shifts/active/${userId}`);
            return response;
        } catch (error) {
            if (error.status === 404) {
                return null; // No active shift
            }
            throw error;
        }
    },

    getReport: async (shiftId) => {
        const response = await api.get(`/shifts/${shiftId}/report`);
        return response;
    },
};

export default shiftService;
