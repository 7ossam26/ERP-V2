import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import AuthService from "../services/authService";
import { branchService } from "../services/domainServices";
import { AUTH_CHANGED_EVENT } from "../utils/authEvents";

const BranchContext = createContext(null);

export const useBranch = () => {
  const ctx = useContext(BranchContext);
  if (!ctx) throw new Error("useBranch must be used within BranchProvider");
  return ctx;
};

const STORAGE_KEY_PREFIX = "activeBranch_";

const getStorageKey = (userId) => `${STORAGE_KEY_PREFIX}${userId}`;

// Which branch should be active for this user, given what they picked last time.
// Shared by the mount-time initializer and the user-changed path below so the two
// can't drift. `userBranches` is only consulted for non-global roles, whose
// branches come off the user object itself and are available synchronously.
const resolveActiveBranchId = (user, isGlobalRole, userBranches) => {
  if (!user?.id) return null;

  const stored = localStorage.getItem(getStorageKey(user.id));
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
};

export const BranchProvider = ({ children }) => {
  const [user, setUser] = useState(() => AuthService.getCurrentUser());
  const userId = user?.id;
  const isGlobalRole = user && ["Superadmin", "Admin", "General Manager"].includes(user.role);

  // Login and logout are client-side transitions, so this provider mounts once —
  // on the login screen, where there is no user yet — and the initializer above
  // captures null. Without re-reading here the provider stays pinned to that null
  // for the whole session: activeBranch never resolves, warehouseId stays null,
  // and pages that gate on it (Bulk POS, Inventory, Stock Transfer) look broken
  // until the user hits refresh, which is the only thing that remounts us.
  useEffect(() => {
    const syncUser = (e) => {
      // `storage` fires for every key in the tab that didn't write it
      if (e?.type === "storage" && e.key && e.key !== "user") return;
      setUser(AuthService.getCurrentUser());
    };
    window.addEventListener(AUTH_CHANGED_EVENT, syncUser);
    window.addEventListener("storage", syncUser); // login/logout in another tab
    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

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

  // Memoized: consumers use `userBranches` as an effect dependency, and an
  // array rebuilt on every provider render would re-run their fetches and reset
  // their selections each time this provider re-renders.
  const userBranches = useMemo(() => buildUserBranches(), [buildUserBranches]);
  const hasMultipleBranches = userBranches.length > 1 || isGlobalRole;

  // Initialize active branch from localStorage or default to primary
  const [activeBranchId, setActiveBranchIdState] = useState(() =>
    resolveActiveBranchId(user, isGlobalRole, userBranches),
  );

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

  // Drop a stored branch that no longer exists (e.g. it was deleted server-side).
  // The stored id is trusted on init because branches load async, and the backend
  // lets global roles filter to any id — so a stale id silently filters every
  // query down to nothing instead of failing loudly.
  useEffect(() => {
    if (!userId || activeBranchId === null || activeBranchId === 0) return;
    if (!userBranches.length) return; // not loaded yet
    if (userBranches.some((b) => b.id === activeBranchId)) return;
    setActiveBranch(isGlobalRole ? 0 : user?.branch?.id || userBranches[0].id);
  }, [userId, activeBranchId, userBranches.length, isGlobalRole]);

  // Re-resolve when the signed-in user changes (login, logout, profile refresh).
  // The initializer above only runs on mount, which for a fresh login is the login
  // screen with no user — this is where the real value gets set.
  //
  // Adjusted during render rather than in an effect, so consumers never observe a
  // frame where the user is known but the branch is still null: an effect would
  // let them fire one unscoped fetch before the branch landed. Keyed on userId
  // alone, so a branch the user picked by hand is never clobbered on re-render.
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [resolvedForUserId, setResolvedForUserId] = useState(userId);
  if (resolvedForUserId !== userId) {
    setResolvedForUserId(userId);
    setActiveBranchIdState(resolveActiveBranchId(user, isGlobalRole, userBranches));
  }

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
