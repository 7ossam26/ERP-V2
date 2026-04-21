import api from "./apiClient";

const SETTINGS_URL = "/settings";

export const settingsService = {
  // Alias for backward compatibility with components using .get()
  async get() {
    return await api.get(SETTINGS_URL);
  },

  async getConfigurations() {
    return await api.get(SETTINGS_URL);
  },

  // Alias for backward compatibility
  async update(data) {
    return await api.put(SETTINGS_URL, data);
  },

  async updateConfigurations(data) {
    return await api.put(SETTINGS_URL, data);
  },

  async getThemes() {
    return await api.get(`${SETTINGS_URL}/themes`);
  },

  async uploadLogo(file) {
    const formData = new FormData();
    formData.append("logo", file);

    const token = localStorage.getItem("token");
    const response = await fetch(
      `${import.meta.env.VITE_API_BASE_URL || "/api"}${SETTINGS_URL}/logo`,
      {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      },
    );

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "فشل رفع الشعار");
    }

    return data;
  },

  async toggleMaintenanceMode() {
    return await api.post(`${SETTINGS_URL}/maintenance/toggle`);
  },

  async getVersions() {
    return await api.get(`${SETTINGS_URL}/versions`);
  },
};
