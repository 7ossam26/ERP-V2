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

  async toggleMaintenanceMode() {
    return await api.post(`${SETTINGS_URL}/maintenance/toggle`);
  },

  async getVersions() {
    return await api.get(`${SETTINGS_URL}/versions`);
  },
};
