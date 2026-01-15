import api from "./apiClient";

export const reportService = {
    /**
     * Get general report data (Summary, charts, etc.)
     * @param {Object} filters { startDate, endDate, branchId }
     */
    getGeneralReport: async (filters = {}) => {
        const queryParams = new URLSearchParams();
        if (filters.startDate) queryParams.append("startDate", filters.startDate);
        if (filters.endDate) queryParams.append("endDate", filters.endDate);
        if (filters.branchId) queryParams.append("branchId", filters.branchId);

        return api.get(`/reports/general?${queryParams.toString()}`);
    },
};
