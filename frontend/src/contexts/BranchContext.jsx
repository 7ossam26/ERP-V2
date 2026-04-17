import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AuthService from "../services/authService";
import { branchService } from "../services/domainServices";

const BranchContext = createContext(null);

export const useBranch = () => {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used within BranchProvider");
  return ctx;
};

const STORAGE_KEY_PREFIX = "activeBranch_";

const getStorageKey = (userId) => `${STORAGE_KEY_PREFIX}${userId}`;

export const BranchProvider = ({ children }) => {
  const [user, setUser] = useState(() => AuthService.getCurrentUser());
  const userId = user?.id;
  const isGlobalRole = user && ["Superadmin", "Admin", "General Manager"].includes(user.role);

  // For global roles, fetch all branches from API
  // For non-global roles (Manager), refresh profile to get latest branch assignments
  const [allBranches, setAllBranches] = useState([]);

  useEffect(() => {
    if (!userId) return;
    if (isGlobalRole) {
      branchService.getAll().then((res) => {
        const branches = Array.isArray(res) ? res : res?.data || [];
        setAllBranches(branches);
      }).catch(() => {});
    } else {
      // Refresh user profile to get latest branch assignments from server
      AuthService.refreshProfile().then((updatedUser) => {
        if (updatedUser) setUser(updatedUser);
      }).catch(() => {});
    }
  }, [isGlobalRole, userId]);

  // Build list of branches user can access
  const buildUserBranches = useCallback(() => {
    if (!user) return [];

    // Global roles see all branches
    if (isGlobalRole) return allBranches;

    const map = new Map();
    if (user.branch) {
      map.set(user.branch.id, user.branch);
    }
    if (user.accessibleBranches && Array.isArray(user.accessibleBranches)) {
      user.accessibleBranches.forEach((b) => map.set(b.id, b));
    }
    return Array.from(map.values());
  }, [user?.id, user?.branch?.id, user?.accessibleBranches?.length, isGlobalRole, allBranches]);

  const userBranches = buildUserBranches();
  const hasMultipleBranches = userBranches.length > 1 || isGlobalRole;

  // Initialize active branch from localStorage or default to primary
  const [activeBranchId, setActiveBranchIdState] = useState(() => {
    if (!userId) return null;
    const stored = localStorage.getItem(getStorageKey(userId));
    if (stored) {
      const parsed = parseInt(stored, 10);
      // For global roles, "0" means "all branches"
      if (parsed === 0 && isGlobalRole) return 0;
      // For global roles, trust the stored value (branches load async)
      if (isGlobalRole && parsed > 0) return parsed;
      // Validate stored branch is still accessible (non-global)
      if (userBranches.some((b) => b.id === parsed)) return parsed;
    }
    // Global roles default to "all branches"
    if (isGlobalRole) return 0;
    return user?.branch?.id || null;
  });

  const activeBranch =
    activeBranchId === 0
      ? null // "All branches" for global roles
      : userBranches.find((b) => b.id === activeBranchId) || user?.branch || null;

  const setActiveBranch = useCallback(
    (branchId) => {
      const id = branchId === 0 ? 0 : parseInt(branchId, 10);
      setActiveBranchIdState(id);
      if (userId) {
        localStorage.setItem(getStorageKey(userId), String(id));
      }
    },
    [userId]
  );

  // Sync if user changes (e.g. profile refresh)
  useEffect(() => {
    if (!userId) return;
    const stored = localStorage.getItem(getStorageKey(userId));
    if (!stored) {
      // No stored preference — default
      if (isGlobalRole) {
        setActiveBranchIdState(0);
      } else {
        setActiveBranchIdState(user?.branch?.id || null);
      }
    }
  }, [userId]);

  return (
    <BranchContext.Provider
      value={{
        activeBranchId,
        activeBranch,
        userBranches,
        hasMultipleBranches,
        isGlobalRole,
        setActiveBranch,
      }}
    >
      {children}
    </BranchContext.Provider>
  );
};

export default BranchContext;
