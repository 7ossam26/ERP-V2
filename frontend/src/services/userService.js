import api from "./apiClient";

const userService = {
    getBranchManagers: async (branchId) => {
        const response = await api.get(`/users/branch-managers/${branchId}`);
        return response;
    },
    getAllManagers: async () => {
        const response = await api.get(`/users/all-managers`);
        return response;
    },
};

export default userService;
