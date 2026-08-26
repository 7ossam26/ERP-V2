import api from "./apiClient";

export const reportService = {
    getGeneralReport: async (filters = {}) => {
        const queryParams = new URLSearchParams();
        if (filters.startDate) queryParams.append("startDate", filters.startDate);
        if (filters.endDate) queryParams.append("endDate", filters.endDate);
        if (filters.branchId) queryParams.append("branchId", filters.branchId);
        return api.get(`/reports/general?${queryParams.toString()}`);
    },

    /**
     * Why التقرير العام and مبيعات الفروع differ for the same filter, term by
     * term. Read-only; it changes nothing either page displays.
     *
     * Accepts the same date params as the general report. مبيعات الفروع passes
     * its own from/to through here — the endpoint takes either spelling.
     */
    getSalesBasis: async (filters = {}) => {
        const queryParams = new URLSearchParams();
        if (filters.startDate) queryParams.append("startDate", filters.startDate);
        if (filters.endDate) queryParams.append("endDate", filters.endDate);
        if (filters.branchId) queryParams.append("branchId", filters.branchId);
        return api.get(`/reports/sales-basis?${queryParams.toString()}`);
    },

    getCallCenterReport: async (filters = {}) => {
        const queryParams = new URLSearchParams();
        if (filters.startDate) queryParams.append("startDate", filters.startDate);
        if (filters.endDate) queryParams.append("endDate", filters.endDate);
        if (filters.branchId && filters.branchId !== "all") queryParams.append("branchId", filters.branchId);
        return api.get(`/reports/call-center?${queryParams.toString()}`);
    },
};
