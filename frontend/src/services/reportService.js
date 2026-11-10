import api from "./apiClient";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

// Shared by the journal page and its Excel export so both always ask the
// server for the same journal.
const journalQuery = (filters = {}) => {
    const queryParams = new URLSearchParams();
    if (filters.startDate) queryParams.append("startDate", filters.startDate);
    if (filters.endDate) queryParams.append("endDate", filters.endDate);
    if (filters.branchId) queryParams.append("branchId", filters.branchId);
    if (filters.mode) queryParams.append("mode", filters.mode);
    if (filters.accounts?.length) queryParams.append("accounts", filters.accounts.join(","));
    if (filters.tieOut) queryParams.append("tieOut", "1");
    if (filters.offset) queryParams.append("offset", String(filters.offset));
    if (filters.limit) queryParams.append("limit", String(filters.limit));
    return queryParams.toString();
};

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

    /** اليومية الأمريكية — one page of rows plus opening/period/closing totals. */
    getAmericanJournal: async (filters = {}) => {
        return api.get(`/reports/american-journal?${journalQuery(filters)}`);
    },

    /**
     * Download the journal as .xlsx. apiClient reads non-JSON bodies as text,
     * so the binary download goes through fetch directly (same as
     * importService.exportData).
     */
    exportAmericanJournal: async (filters = {}) => {
        // The export is always the whole window, never one page of it.
        const whole = { ...filters, offset: undefined, limit: undefined };
        const res = await fetch(`${API_BASE}/reports/american-journal/export?${journalQuery(whole)}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "فشل تصدير اليومية");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `اليومية_الأمريكية_${filters.startDate || ""}_${filters.endDate || ""}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    },
};
