import api from "./apiClient";

export const reportService = {
    getGeneralReport: async (filters = {}) => {
        const queryParams = new URLSearchParams();
        if (filters.startDate) queryParams.append("startDate", filters.startDate);
        if (filters.endDate) queryParams.append("endDate", filters.endDate);
        if (filters.branchId) queryParams.append("branchId", filters.branchId);
        return api.get(`/reports/general?${queryParams.toString()}`);
    },

    getCallCenterReport: async (filters = {}) => {
        const queryParams = new URLSearchParams();
        if (filters.startDate) queryParams.append("startDate", filters.startDate);
        if (filters.endDate) queryParams.append("endDate", filters.endDate);
        if (filters.branchId && filters.branchId !== "all") queryParams.append("branchId", filters.branchId);
        return api.get(`/reports/call-center?${queryParams.toString()}`);
    },
};
