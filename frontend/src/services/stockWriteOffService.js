import api from "./apiClient";

export const stockWriteOffService = {
    // Reason codes + their Arabic labels, served from backend/config/writeOffReasons.js
    // so the UI never keeps a second copy that can drift from the DB enum.
    getReasons: async () => {
        return api.get("/stock-writeoffs/reasons");
    },

    // Items available to write off in a warehouse, with on-hand quantity and the
    // cost that would be snapshotted. Includes items hidden from the POS —
    // those (the consumables) are the whole point.
    getAll: async (warehouseId = null) => {
        const params = warehouseId && warehouseId !== "all"
            ? `?warehouseId=${warehouseId}`
            : "";
        return api.get(`/stock-writeoffs${params}`);
    },

    // Write-off history for one item.
    getByItem: async (itemId, warehouseId = null) => {
        const params = warehouseId && warehouseId !== "all"
            ? `?warehouseId=${warehouseId}`
            : "";
        return api.get(`/stock-writeoffs/item/${itemId}${params}`);
    },

    // Totals for a window, grouped by reason.
    getSummary: async ({ startDate, endDate, warehouseId } = {}) => {
        const qs = new URLSearchParams();
        if (startDate) qs.set("startDate", startDate);
        if (endDate) qs.set("endDate", endDate);
        if (warehouseId && warehouseId !== "all") qs.set("warehouseId", warehouseId);
        return api.get(`/stock-writeoffs/summary?${qs.toString()}`);
    },

    // Record an إهلاك: decrements stock and books the cost to COGS.
    add: async (data) => {
        return api.post("/stock-writeoffs", data);
    },

    // Reverse one. NOT a delete: the backend writes a contra row dated today, so
    // the month the original landed in is never rewritten. Admin/Superadmin only.
    reverse: async (id, notes = null) => {
        return api.post(`/stock-writeoffs/${id}/reverse`, { notes });
    },
};
