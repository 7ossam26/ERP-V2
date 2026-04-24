# Manager Multi-Branch Management

## Summary
Enable the Manager role to manage multiple branches, with a branch switcher in the navbar so any multi-branch user can switch their active branch context during a session.

## Changes

### 1. UserManagement UI — Manager gets multi-branch checkboxes
- Add "Manager" to the list of roles that show multi-branch selection checkboxes (alongside General Manager, Area Manager)
- No backend changes needed — `accessibleBranchIds` handling already exists

### 2. BranchContext (React Context)
- New context: `BranchContext` in `frontend/src/contexts/BranchContext.jsx`
- State: `activeBranchId`, `activeBranch`, `userBranches`, `setActiveBranch()`
- Defaults to user's primary `branchId` on first login
- Persisted in localStorage keyed by userId
- `userBranches` = union of `[user.branch, ...user.accessibleBranches]`

### 3. BranchSwitcher Component
- New component in `frontend/src/components/BranchSwitcher.jsx`
- Replaces static branch display in MainLayout navbar
- Dropdown listing all accessible branches
- Only shows as dropdown when user has 2+ branches; otherwise static display
- Global roles (Superadmin, Admin) see all branches + "All Branches" default option

### 4. Backend — Active Branch Header
- Frontend sends `X-Active-Branch-Id` header on every API request
- `getUserBranchFilter()` in `backend/middleware/auth.js` checks this header
- If header present and branch is in user's allowed list, filter by that single branch
- If header absent, current behavior preserved (filter by all accessible branches)
- Global roles can use the header to filter to a specific branch (null = all)

### 5. Frontend API Service
- Axios interceptor reads `activeBranchId` from localStorage and attaches `X-Active-Branch-Id` header
- All API calls automatically include the active branch context

### 6. Login Flow
- Backend login endpoint includes `accessibleBranches` in the user response
- Frontend authService stores accessible branches in user state

## Approach
Frontend-only active branch state (Approach A). No DB migration. localStorage persistence. Backend validates header against user's allowed branches.
