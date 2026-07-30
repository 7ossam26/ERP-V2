import api from "./apiClient";

const shiftService = {
    start: async (data) => {
        // data: { userId, branchId, startCash }
        const response = await api.post("/shifts/start", data);
        return response;
    },

    end: async (data) => {
        // data: { shiftId, actualCash } - actualCash is blind count
        const response = await api.post("/shifts/end", data);
        return response;
    },

    approve: async (data) => {
        // data: { shiftId, managerUsername, managerPassword }
        const response = await api.post("/shifts/approve", data);
        return response;
    },

    reopen: async ({ shiftId, managerUsername, managerPassword, reason }) => {
        // Sends a PENDING_REVIEW shift back to OPEN *without* approving it, so
        // its cashier can resume selling on the SAME shift. The alternative to
        // approve() — and authorized by the same manager credentials.
        const response = await api.patch(`/shifts/${shiftId}/reopen`, {
            managerUsername,
            managerPassword,
            reason,
        });
        return response;
    },

    checkActive: async (userId) => {
        const response = await api.get(`/shifts/active/${userId}`);
        // Backend now returns null (200 OK) if no shift, or the shift object
        return response;
    },

    getPending: async (branchId) => {
        const response = await api.get(`/shifts/pending/${branchId}`);
        return response;
    },

    getReport: async (shiftId) => {
        const response = await api.get(`/shifts/${shiftId}/report`);
        return response;
    },
};

export default shiftService;
