import { api } from "./apiClient";

const AUDIT_URL = "/audit";

export const auditService = {
  async getLogs(params = {}) {
    return api.get(AUDIT_URL, { params });
  },

  async getFilters() {
    return api.get(`${AUDIT_URL}/filters`);
  },

  async exportLogs(params = {}) {
    const queryString = new URLSearchParams(
      Object.entries(params).filter(([, value]) => value !== "" && value != null),
    ).toString();
    const token = localStorage.getItem("token");
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL || "/api"}${AUDIT_URL}/export${queryString ? `?${queryString}` : ""}`,
      {
        method: "GET",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    );

    if (!response.ok) {
      let message = "فشل تصدير السجل";
      try {
        const payload = await response.json();
        message = payload.error || message;
      } catch {
        // Ignore JSON parse failures for export errors.
      }
      throw new Error(message);
    }

    return response.blob();
  },
};

export default auditService;
