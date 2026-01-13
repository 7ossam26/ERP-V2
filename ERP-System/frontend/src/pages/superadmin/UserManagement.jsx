import React, { useState, useEffect } from "react";
import SuperadminService from "../../services/superadminService";
import AuthService from "../../services/authService";
import { branchService } from "../../services/domainServices";
import { toast } from "react-hot-toast";

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Deletion State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    password: "",
    roleId: "",
    isActive: true,
    hasSensitiveAccess: false,
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const results = await Promise.allSettled([
        SuperadminService.getUsers(),
        SuperadminService.getRoles(),
        branchService.getAll(),
      ]);

      const [usersResult, rolesResult, branchesResult] = results;

      // Handle Users
      if (usersResult.status === "fulfilled") {
        setUsers(usersResult.value);
      } else {
        console.error("Users load failed:", usersResult.reason);
        toast.error(`Users load failed: ${usersResult.reason.message}`);
      }

      // Handle Roles
      if (rolesResult.status === "fulfilled") {
        setRoles(rolesResult.value);
      } else {
        console.error("Roles load failed:", rolesResult.reason);
        toast.error(`Roles load failed: ${rolesResult.reason.message}`);
      }

      // Handle Branches
      if (branchesResult.status === "fulfilled") {
        const branchesRes = branchesResult.value;
        const rawBranches = Array.isArray(branchesRes)
          ? branchesRes
          : branchesRes?.data || [];
        const sortedBranches = [...rawBranches].sort((a, b) => {
          if (a.isAllBranches) return -1;
          if (b.isAllBranches) return 1;
          return a.name.localeCompare(b.name);
        });
        setBranches(sortedBranches);
      } else {
        console.error("Branches load failed:", branchesResult.reason);
        toast.error(`Branches load failed: ${branchesResult.reason.message}`);
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Update
        await SuperadminService.updateUser(editingUser.id, formData);
        toast.success("User updated successfully");
      } else {
        // Create
        await SuperadminService.createUser(formData);
        toast.success("User created successfully");
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error(error);
      const errorMessage =
        error.response?.data?.error || error.message || "Operation failed";
      toast.error(errorMessage);
    }
  };

  const handleDeleteClick = (user) => {
    const currentUser = AuthService.getCurrentUser();
    // Ensure accurate ID comparison (convert to string if needed or rely on loose equality if types differ)
    if (currentUser && currentUser.id == user.id) {
      toast.error("You cannot delete your own account");
      return;
    }
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      await SuperadminService.deleteUser(userToDelete.id);
      toast.success("User deleted successfully");
      setDeleteModalOpen(false);
      setUserToDelete(null);
      fetchData();
    } catch (error) {
      console.error("Delete operation failed:", error);
      const errorMessage =
        error.response?.data?.error || error.message || "Delete failed";
      toast.error(errorMessage);
      setDeleteModalOpen(false);
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await SuperadminService.toggleUserStatus(id);
      toast.success("User status updated");
      fetchData();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const resetForm = () => {
    setEditingUser(null);
    setFormData({
      name: "",
      username: "",
      password: "",
      roleId: "",
      branchId: "",
      isActive: true,
      hasSensitiveAccess: false,
    });
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      username: user.username,
      password: "", // User can leave empty to keep current
      roleId: user.role.id,
      branchId: user.branchId || "",
      isActive: user.isActive,
      hasSensitiveAccess: user.hasSensitiveAccess || false,
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-gray-100">
            User Management
          </h1>
          <p className="text-slate-500">Manage system users and access</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-lg shadow-red-900/20">
          <span className="material-icons-round">add</span>
          Add New User
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm font-semibold uppercase tracking-wider">
              <th className="p-4">Name</th>
              <th className="p-4">Username</th>
              <th className="p-4">Role</th>
              <th className="p-4">Branch</th>
              <th className="p-4">Status</th>
              <th className="p-4">Sensitive Access</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {users.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <td className="p-4 font-medium text-slate-900 dark:text-slate-100">
                  {user.name}
                </td>
                <td className="p-4 text-slate-600 dark:text-slate-300">
                  {user.username}
                </td>
                <td className="p-4">
                  <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {user.role.name}
                  </span>
                </td>
                <td className="p-4 text-sm text-slate-600 dark:text-slate-300">
                  {user.branch?.name || "-"}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => handleToggleStatus(user.id)}
                    className={`px-2 py-1 rounded-full text-xs font-bold transition-colors ${user.isActive
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 hover:bg-green-200"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200"
                      }`}>
                    {user.isActive ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="p-4">
                  {user.hasSensitiveAccess ? (
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      ✓ Enabled
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      Disabled
                    </span>
                  )}
                </td>
                <td className="p-4 text-right space-x-2">
                  <button
                    onClick={() => openEditModal(user)}
                    className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition">
                    <span className="material-icons-round text-lg">edit</span>
                  </button>
                  <button
                    onClick={() => handleDeleteClick(user)}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                    <span className="material-icons-round text-lg">delete</span>
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && !isLoading && (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingUser ? "Edit User" : "Add New User"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Password{" "}
                  {editingUser && (
                    <span className="text-xs text-slate-400 font-normal">
                      (Leave blank to keep unchanged)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Role
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={formData.roleId}
                  onChange={(e) => {
                    const selectedRoleId = e.target.value;
                    const selectedRole = roles.find(r => r.id == selectedRoleId);
                    // Auto-set hasSensitiveAccess based on role
                    const shouldHaveSensitive = ['Superadmin', 'Admin', 'Manager'].includes(selectedRole?.name);
                    setFormData({
                      ...formData,
                      roleId: selectedRoleId,
                      hasSensitiveAccess: shouldHaveSensitive
                    });
                  }}>
                  <option value="" disabled>
                    Select a role
                  </option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Branch
                </label>
                <select
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  value={formData.branchId}
                  onChange={(e) =>
                    setFormData({ ...formData, branchId: e.target.value })
                  }>
                  <option value="" disabled>
                    Select a branch
                  </option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id} className={branch.isAllBranches ? "font-bold text-primary" : ""}>
                      {branch.isAllBranches ? `★ ${branch.name}` : branch.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.isActive}
                    onChange={(e) =>
                      setFormData({ ...formData, isActive: e.target.checked })
                    }
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Is Active
                  </span>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.hasSensitiveAccess}
                    onChange={(e) =>
                      setFormData({ ...formData, hasSensitiveAccess: e.target.checked })
                    }
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                  <span className="ml-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Sensitive Access
                    <span className="block text-xs text-slate-400">Can edit/delete sensitive data</span>
                  </span>
                </label>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-lg shadow-red-900/20">
                  {editingUser ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && userToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4 text-red-600">
                <span className="material-icons-round text-3xl">warning</span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Confirm Deletion
                </h3>
              </div>

              <p className="text-slate-600 dark:text-slate-300 mb-6">
                Are you sure you want to delete the user{" "}
                <span className="font-semibold text-slate-900 dark:text-white">
                  {userToDelete.name}
                </span>
                ?
                <br />
                <span className="text-sm text-red-500 mt-2 block">
                  This action cannot be undone.
                </span>
              </p>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteModalOpen(false);
                    setUserToDelete(null);
                  }}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-lg shadow-red-900/20">
                  Yes, Delete User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
