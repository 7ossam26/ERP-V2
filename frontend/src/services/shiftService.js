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
        const response = await api.get(`/shifts/active/${userId}`);
        // Backend now returns null (200 OK) if no shift, or the shift object
        return response;
    },

    getReport: async (shiftId) => {
        const response = await api.get(`/shifts/${shiftId}/report`);
        return response;
    },
};

export default shiftService;
