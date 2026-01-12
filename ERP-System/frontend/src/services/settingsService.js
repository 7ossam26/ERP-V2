import api from "./apiClient";

const SETTINGS_URL = "/settings";

export const settingsService = {
  async getConfigurations() {
    return await api.get(SETTINGS_URL);
  },

  async updateConfigurations(data) {
    return await api.post(SETTINGS_URL, data);
  },

  async toggleMaintenanceMode() {
    return await api.post(`${SETTINGS_URL}/maintenance/toggle`);
  },

  async getVersions() {
    return await api.get(`${SETTINGS_URL}/versions`);
  },
};
