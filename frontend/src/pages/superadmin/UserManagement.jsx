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
    branchId: "",
    accessibleBranchIds: [],
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
        toast.error(usersResult.reason?.message || "فشل في تحميل قائمة المستخدمين. يرجى المحاولة مرة أخرى.");
      }

      // Handle Roles
      if (rolesResult.status === "fulfilled") {
        setRoles(rolesResult.value);
      } else {
        console.error("Roles load failed:", rolesResult.reason);
        toast.error(rolesResult.reason?.message || "فشل في تحميل قائمة الأدوار. يرجى المحاولة مرة أخرى.");
      }

      // Handle Branches
      if (branchesResult.status === "fulfilled") {
        const branchesRes = branchesResult.value;
        const rawBranches = Array.isArray(branchesRes)
          ? branchesRes
          : branchesRes?.data || [];
        const sortedBranches = [...rawBranches].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        setBranches(sortedBranches);
      } else {
        console.error("Branches load failed:", branchesResult.reason);
        toast.error(branchesResult.reason?.message || "فشل في تحميل قائمة الفروع. يرجى المحاولة مرة أخرى.");
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      toast.error(error.message || "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.");
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
        toast.success("تم تحديث المستخدم بنجاح");
      } else {
        // Create
        await SuperadminService.createUser(formData);
        toast.success("تم إنشاء المستخدم بنجاح");
      }
      setShowModal(false);
      // Check if we updated ourselves
      if (editingUser && editingUser.id === AuthService.getCurrentUser()?.id) {
        await AuthService.refreshProfile();
        window.location.reload(); // Force reload to ensure all components and sidebars update
      }

      resetForm();
      fetchData();
    } catch (error) {
      console.error(error);
      toast.error(error.message || "فشل في حفظ بيانات المستخدم. يرجى التحقق من البيانات والمحاولة مرة أخرى.");
    }
  };

  const handleDeleteClick = (user) => {
    const currentUser = AuthService.getCurrentUser();
    // Ensure accurate ID comparison (convert to string if needed or rely on loose equality if types differ)
    if (currentUser && currentUser.id == user.id) {
      toast.error("لا يمكن حذف حسابك الخاص");
      return;
    }
    setUserToDelete(user);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      await SuperadminService.deleteUser(userToDelete.id);
      toast.success("تم حذف المستخدم بنجاح");
      setDeleteModalOpen(false);
      setUserToDelete(null);
      fetchData();
    } catch (error) {
      console.error("Delete operation failed:", error);
      toast.error(error.message || "فشل في حذف المستخدم. يرجى المحاولة مرة أخرى.");
      setDeleteModalOpen(false);
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await SuperadminService.toggleUserStatus(id);

      // Check if we updated ourselves
      if (id === AuthService.getCurrentUser()?.id) {
        await AuthService.refreshProfile();
      }

      toast.success("تم تحديث حالة المستخدم");
      fetchData();
    } catch (error) {
      toast.error(error.message || "فشل في تحديث الحالة. يرجى المحاولة مرة أخرى.");
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
      accessibleBranchIds: [],
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
      roleId: user.roleId || user.role?.id || "",
      branchId: user.branchId || user.branch?.id || "",
      accessibleBranchIds: user.accessibleBranches
        ? user.accessibleBranches.map((b) => b.id)
        : [],
      isActive: user.isActive,
      hasSensitiveAccess: user.hasSensitiveAccess || false,
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-gray-100 truncate">
            User Management
          </h1>
          <p className="text-slate-500 text-sm hidden sm:block">Manage system users and access</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-lg shadow-red-900/20 shrink-0">
          <span className="material-icons-round">add</span>
          <span className="hidden sm:inline">Add New User</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[640px]">
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
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-md max-h-[92vh] flex flex-col">
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
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
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
                    const selectedRole = roles.find(
                      (r) => r.id == selectedRoleId,
                    );
                    // Auto-set hasSensitiveAccess based on role
                    const shouldHaveSensitive = [
                      "Superadmin",
                      "Admin",
                      "Manager",
                    ].includes(selectedRole?.name);
                    // Only Superadmin has no branch
                    const isSuperadmin = selectedRole?.name === "Superadmin";

                    setFormData({
                      ...formData,
                      roleId: selectedRoleId,
                      hasSensitiveAccess: shouldHaveSensitive,
                      branchId: isSuperadmin ? "" : formData.branchId,
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

              {(() => {
                const selectedRoleName = roles.find(
                  (r) => r.id == formData.roleId,
                )?.name;

                // Superadmin has no branch (truly global)
                const isSuperadmin = selectedRoleName === "Superadmin";

                // Roles that use the multi-branch checkbox UI
                const isMultiBranchRole = [
                  "General Manager",
                  "Area Manager",
                  "Manager",
                ].includes(selectedRoleName);

                if (isSuperadmin) return null;

                // --- Multi-Branch Input (Checkboxes) ---
                if (isMultiBranchRole) {
                  return (
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-700/30">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Assigned Branches
                        <span className="block text-xs text-slate-400 font-normal">
                          Select all branches this user oversees
                        </span>
                      </label>
                      <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                        {branches.map((branch) => {
                          // Check if this branch is either the Primary BranchId OR in the Accessible list
                          const isChecked =
                            formData.branchId == branch.id ||
                            formData.accessibleBranchIds?.includes(
                              parseInt(branch.id),
                            );

                          return (
                            <label
                              key={branch.id}
                              className={`flex items-center space-x-2 cursor-pointer p-2 rounded border transition-colors ${isChecked ? "bg-white dark:bg-slate-600 border-red-200 dark:border-red-900/50" : "border-transparent hover:bg-white dark:hover:bg-slate-600 hover:border-slate-200 dark:hover:border-slate-500"}`}>
                              <input
                                type="checkbox"
                                className="rounded border-slate-300 text-red-600 focus:ring-red-500"
                                checked={isChecked}
                                onChange={(e) => {
                                  const branchId = parseInt(branch.id);
                                  const currentAccessible =
                                    formData.accessibleBranchIds || [];

                                  // Determine new selection state
                                  let newAccessibleIds;

                                  if (e.target.checked) {
                                    // Add to accessible
                                    newAccessibleIds = [
                                      ...new Set([
                                        ...currentAccessible,
                                        branchId,
                                      ]),
                                    ];
                                  } else {
                                    // Remove
                                    newAccessibleIds = currentAccessible.filter(
                                      (id) => id !== branchId,
                                    );
                                  }

                                  // Logic to maintain a valid branchId (Primary)
                                  let newBranchId = formData.branchId;

                                  if (e.target.checked) {
                                    // If no primary branch set, use this one
                                    if (!newBranchId) newBranchId = branchId;
                                  } else {
                                    // If unchecking the primary branch
                                    if (newBranchId == branchId) {
                                      // Pick the first one from the REMAINING list
                                      // Note: newAccessibleIds contains the remaining accessible ones.
                                      // But wait, newAccessibleIds might not contain the *old* primary if it wasn't in accessible list explicitly.
                                      // Let's rely on the set of (newAccessibleIds) as the source of truth for "Selected Branches"
                                      // Actually, simplified: Primary is just the first one of the checked set.
                                      newBranchId =
                                        newAccessibleIds.length > 0
                                          ? newAccessibleIds[0]
                                          : "";
                                    }
                                  }

                                  setFormData({
                                    ...formData,
                                    accessibleBranchIds: newAccessibleIds,
                                    branchId: newBranchId,
                                  });
                                }}
                              />
                              <span
                                className={`text-sm ${isChecked ? "text-slate-900 dark:text-white font-medium" : "text-slate-700 dark:text-slate-300"}`}>
                                {branch.name}
                                {formData.branchId == branch.id && (
                                  <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                    Primary
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-xs text-slate-400 mt-2">
                        * The first selected branch will be automatically set as
                        the primary branch.
                      </p>
                    </div>
                  );
                }

                // --- Single Branch Input (Dropdown) - Default ---
                const isAdminRole = selectedRoleName === "Admin";
                return (
                  <div className="space-y-4">
                    {/* Primary Branch (Home Branch) */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Home Branch{" "}
                        <span className="text-xs text-slate-400 font-normal">
                          {isAdminRole ? "(Optional)" : "(Primary Assignment)"}
                        </span>
                      </label>
                      <select
                        required={!isAdminRole}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-transparent dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        value={formData.branchId}
                        onChange={(e) =>
                          setFormData({ ...formData, branchId: e.target.value })
                        }>
                        <option value="">
                          {isAdminRole ? "No specific branch (global)" : "Select a branch"}
                        </option>
                        {branches.map((branch) => (
                          <option
                            key={branch.id}
                            value={branch.id}
                            className={
                              branch.isAllBranches
                                ? "font-bold text-primary"
                                : ""
                            }>
                            {branch.isAllBranches
                              ? `★ ${branch.name}`
                              : branch.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.isActive}
                  onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                  className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${formData.isActive ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-600"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${formData.isActive ? "left-[22px]" : "left-0.5"}`} />
                </button>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Is Active</span>
              </div>

              <div className="flex items-start gap-3 pt-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.hasSensitiveAccess}
                  onClick={() => setFormData({ ...formData, hasSensitiveAccess: !formData.hasSensitiveAccess })}
                  className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full mt-0.5 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${formData.hasSensitiveAccess ? "bg-purple-600" : "bg-slate-200 dark:bg-slate-600"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${formData.hasSensitiveAccess ? "left-[22px]" : "left-0.5"}`} />
                </button>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Sensitive Access</p>
                  <p className="text-xs text-slate-400">Can edit/delete sensitive data</p>
                </div>
              </div>

              <div className="pt-4 flex flex-row items-center justify-end gap-3">
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
