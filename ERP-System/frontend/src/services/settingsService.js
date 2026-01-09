import api from "./apiClient";

export const settingsService = {
  get: async () => {
    const response = await api.get("/settings");
    return response;
  },

  update: async (data) => {
    const response = await api.put("/settings", data);
    return response;
  },
};
