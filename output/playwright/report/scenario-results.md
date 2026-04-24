# ERP-V2 Scenario Results

Direct URL scenarios in this report were executed with Playwright CLI `goto` so the current authenticated page state was preserved.

## AUTH

----------------------------------------
SCENARIO ID:    AUTH-001
CATEGORY:       Authentication & Session
PRIORITY:       P0-Critical
ROLE UNDER TEST: Superadmin
PRECONDITIONS:  Backend and frontend are running locally. Seeded `superadmin` account exists. Browser session `erp-v2-system` is open on the login page.
----------------------------------------
STEPS:
  1. Navigate to `http://localhost:5173`.
  2. Enter username `superadmin`.
  3. Enter password `246810@Ad`.
  4. Click `Sign in`.
----------------------------------------
EXPECTED RESULT:
  User is authenticated successfully and redirected to the first allowed protected route. No visible errors appear. Session data is stored and the application shell loads.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Redirected to `/superadmin/users`. Evidence: `output/playwright/day1/superadmin-state.json`.
----------------------------------------

----------------------------------------
SCENARIO ID:    AUTH-002
CATEGORY:       Authentication & Session
PRIORITY:       P0-Critical
ROLE UNDER TEST: Anonymous User
PRECONDITIONS:  Backend and frontend are running locally. Browser session `erp-v2-system` is open on the login page.
----------------------------------------
STEPS:
  1. Navigate to `http://localhost:5173`.
  2. Enter username `wrong.user`.
  3. Enter password `wrongpass`.
  4. Click `Sign in`.
----------------------------------------
EXPECTED RESULT:
  Authentication is rejected. The user remains on the login page and receives a clear visible error message indicating invalid credentials.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Retested after the login error-state fix. The page stayed on `/` and rendered a visible inline alert with the invalid-credentials message. Evidence: `output/playwright/day1/auth-invalid-login-visible-error.png`.
----------------------------------------

----------------------------------------
SCENARIO ID:    AUTH-003
CATEGORY:       Authentication & Session
PRIORITY:       P1-High
ROLE UNDER TEST: Cashier
PRECONDITIONS:  Backend and frontend are running locally. Seeded `cashier.gasr` account exists with `mustChangePassword = true`.
----------------------------------------
STEPS:
  1. Navigate to `http://localhost:5173`.
  2. Enter username `cashier.gasr`.
  3. Enter password `Cashier@2026`.
  4. Click `Sign in`.
  5. Confirm the app redirects to `/change-password`.
  6. Enter `Cashier@2026` as current, new, and confirmation password values.
  7. Submit the change-password form.
----------------------------------------
EXPECTED RESULT:
  The user is forced through the password-update gate before normal app access. After submitting a valid password change, `mustChangePassword` is cleared and the user enters the protected application.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Redirected to `/change-password`, accepted the valid submission, and landed on `/dashboard`.
----------------------------------------

----------------------------------------
SCENARIO ID:    AUTH-004
CATEGORY:       Authentication & Session
PRIORITY:       P0-Critical
ROLE UNDER TEST: Superadmin
PRECONDITIONS:  An authenticated `superadmin` session exists.
----------------------------------------
STEPS:
  1. Click `Sign Out` from the superadmin shell.
  2. Attempt direct navigation to `http://localhost:5173/superadmin/users`.
----------------------------------------
EXPECTED RESULT:
  Session is terminated. The user is redirected to the login page and cannot reopen protected content without authenticating again.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Direct navigation after logout returned to `/`.
----------------------------------------

----------------------------------------
SCENARIO ID:    AUTH-005
CATEGORY:       Authentication & Session
PRIORITY:       P1-High
ROLE UNDER TEST: Owner
PRECONDITIONS:  Browser is on the login page. Current owner password had been manually changed to `0000`. Owner account still required password update.
----------------------------------------
STEPS:
  1. Enter username `owner`.
  2. Enter password `0000`.
  3. Click `Sign in`.
  4. Confirm the app redirects to `/change-password`.
  5. Enter current password `0000`.
  6. Set the new password to `Owner@2026` and confirm it.
  7. Submit the change-password form.
----------------------------------------
EXPECTED RESULT:
  Owner login succeeds with the current password, the mandatory change-password gate appears, and a valid replacement password is accepted so the owner can enter the application.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Redirected to `/change-password`, then to `/dashboard`. Evidence: `output/playwright/day1/owner-state.json`.
----------------------------------------

----------------------------------------
SCENARIO ID:    AUTH-006
CATEGORY:       Authentication & Session
PRIORITY:       P1-High
ROLE UNDER TEST: BranchManager
PRECONDITIONS:  Browser is on the login page. Seeded `manager.gasr` account exists with `mustChangePassword = true`.
----------------------------------------
STEPS:
  1. Enter username `manager.gasr`.
  2. Enter password `Manager@2026`.
  3. Click `Sign in`.
  4. Confirm the app redirects to `/change-password`.
  5. Enter `Manager@2026` as current, new, and confirmation password values.
  6. Submit the change-password form.
----------------------------------------
EXPECTED RESULT:
  Branch manager clears the mandatory password-update gate and lands in the protected application.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Redirected to `/dashboard`. Evidence: `output/playwright/day1/manager-gasr-state.json`.
----------------------------------------

----------------------------------------
SCENARIO ID:    AUTH-007
CATEGORY:       Authentication & Session
PRIORITY:       P1-High
ROLE UNDER TEST: Accountant
PRECONDITIONS:  Browser is on the login page. Seeded `accountant` account exists with `mustChangePassword = true`.
----------------------------------------
STEPS:
  1. Enter username `accountant`.
  2. Enter password `Accountant@2026`.
  3. Click `Sign in`.
  4. Confirm the app redirects to `/change-password`.
  5. Enter `Accountant@2026` as current, new, and confirmation password values.
  6. Submit the change-password form.
----------------------------------------
EXPECTED RESULT:
  Accountant clears the mandatory password-update gate and lands in the protected application.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Redirected to `/dashboard`. Evidence: `output/playwright/day1/accountant-state.json`.
----------------------------------------

----------------------------------------
SCENARIO ID:    AUTH-008
CATEGORY:       Authentication & Session
PRIORITY:       P1-High
ROLE UNDER TEST: WarehouseKeeper
PRECONDITIONS:  Browser is on the login page. Seeded `warehouse.keeper` account exists and had not completed the first-login password gate in this environment.
----------------------------------------
STEPS:
  1. Enter username `warehouse.keeper`.
  2. Enter password `Warehouse@2026`.
  3. Click `Sign in`.
  4. Confirm the app redirects to `/change-password`.
  5. Enter `Warehouse@2026` as current, new, and confirmation password values.
  6. Submit the change-password form.
----------------------------------------
EXPECTED RESULT:
  Warehouse keeper clears the mandatory password-update gate and lands in the protected application with a reusable authenticated session.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Redirected to `/change-password`, then `/dashboard`. Saved auth state: `output/playwright/day1/warehouse-keeper-state.json`. Evidence: `output/playwright/day1/warehouse-keeper-dashboard.png`.
----------------------------------------

## RBAC

----------------------------------------
SCENARIO ID:    RBAC-001
CATEGORY:       Role-Based Access Control
PRIORITY:       P0-Critical
ROLE UNDER TEST: Superadmin
PRECONDITIONS:  Authenticated `superadmin` session.
----------------------------------------
STEPS:
  1. Navigate to `/superadmin/users`.
  2. Open `/superadmin/roles`.
  3. Open `/superadmin/roles/11/permissions`.
  4. Open `/superadmin/audit-logs`.
  5. Open `/superadmin/reset-database` without triggering any destructive button.
----------------------------------------
EXPECTED RESULT:
  All superadmin-only routes load successfully, render their expected controls, and remain accessible to the superadmin user.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Evidence saved as `output/playwright/day1/superadmin-users.png`, `output/playwright/day1/superadmin-roles.png`, `output/playwright/day1/superadmin-role-permissions-branchmanager.png`, `output/playwright/day1/superadmin-audit-logs.png`, and `output/playwright/day1/superadmin-reset-database.png`.
----------------------------------------

----------------------------------------
SCENARIO ID:    RBAC-002
CATEGORY:       Role-Based Access Control
PRIORITY:       P0-Critical
ROLE UNDER TEST: Cashier
PRECONDITIONS:  Authenticated `cashier.gasr` session after completing the mandatory password-change flow.
----------------------------------------
STEPS:
  1. Authenticate as `cashier.gasr`.
  2. Navigate directly to `http://localhost:5173/superadmin/users` using current-page navigation.
----------------------------------------
EXPECTED RESULT:
  The cashier remains authenticated and is redirected away from the superadmin-only route without gaining access.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Redirected to `/dashboard`. Evidence: `output/playwright/day1/cashier-superadmin-redirect-dashboard.png`.
----------------------------------------

----------------------------------------
SCENARIO ID:    RBAC-003
CATEGORY:       Role-Based Access Control
PRIORITY:       P0-Critical
ROLE UNDER TEST: Cashier
PRECONDITIONS:  Authenticated `cashier.gasr` session after completing the mandatory password-change flow.
----------------------------------------
STEPS:
  1. Authenticate as `cashier.gasr`.
  2. Navigate directly to `http://localhost:5173/settings` using current-page navigation.
----------------------------------------
EXPECTED RESULT:
  The cashier remains authenticated and is redirected to `/forbidden` because the role lacks `SETTINGS` permission.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Redirected to `/forbidden`. Evidence: `output/playwright/day1/cashier-settings-forbidden.png`.
----------------------------------------

----------------------------------------
SCENARIO ID:    RBAC-004
CATEGORY:       Role-Based Access Control
PRIORITY:       P0-Critical
ROLE UNDER TEST: Owner
PRECONDITIONS:  Authenticated `owner` session after completing the mandatory password-change flow.
----------------------------------------
STEPS:
  1. Navigate to `http://localhost:5173/settings`.
  2. Navigate to `http://localhost:5173/dashboard/owner`.
  3. Navigate to `http://localhost:5173/audit`.
----------------------------------------
EXPECTED RESULT:
  Owner-only and owner-allowed routes load successfully for the owner role.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: `/settings`, `/dashboard/owner`, and `/audit` all loaded. Evidence: `output/playwright/day1/owner-settings.png`, `output/playwright/day1/owner-dashboard.png`, and `output/playwright/day1/owner-state.json`.
----------------------------------------

----------------------------------------
SCENARIO ID:    RBAC-005
CATEGORY:       Role-Based Access Control
PRIORITY:       P0-Critical
ROLE UNDER TEST: Owner
PRECONDITIONS:  Authenticated `owner` session.
----------------------------------------
STEPS:
  1. Navigate directly to `http://localhost:5173/superadmin/users`.
----------------------------------------
EXPECTED RESULT:
  Owner does not gain superadmin access and is redirected away from the route.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Redirected to `/dashboard`.
----------------------------------------

----------------------------------------
SCENARIO ID:    RBAC-006
CATEGORY:       Role-Based Access Control
PRIORITY:       P0-Critical
ROLE UNDER TEST: BranchManager
PRECONDITIONS:  Authenticated `manager.gasr` session after completing the mandatory password-change flow.
----------------------------------------
STEPS:
  1. Navigate directly to `http://localhost:5173/shifts`.
----------------------------------------
EXPECTED RESULT:
  Branch manager can access the operational shifts route.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: `/shifts` loaded successfully.
----------------------------------------

----------------------------------------
SCENARIO ID:    RBAC-007
CATEGORY:       Role-Based Access Control
PRIORITY:       P0-Critical
ROLE UNDER TEST: BranchManager
PRECONDITIONS:  Authenticated `manager.gasr` session.
----------------------------------------
STEPS:
  1. Navigate directly to `http://localhost:5173/settings`.
----------------------------------------
EXPECTED RESULT:
  Branch manager remains authenticated and is redirected to `/forbidden` because the role lacks `SETTINGS`.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Redirected to `/forbidden`.
----------------------------------------

----------------------------------------
SCENARIO ID:    RBAC-008
CATEGORY:       Role-Based Access Control
PRIORITY:       P0-Critical
ROLE UNDER TEST: BranchManager
PRECONDITIONS:  Authenticated `manager.gasr` session.
----------------------------------------
STEPS:
  1. Navigate directly to `http://localhost:5173/dashboard/owner`.
----------------------------------------
EXPECTED RESULT:
  Branch manager remains authenticated and is redirected to `/forbidden` because the role lacks owner-dashboard permission.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Redirected to `/forbidden`.
----------------------------------------

----------------------------------------
SCENARIO ID:    RBAC-009
CATEGORY:       Role-Based Access Control
PRIORITY:       P0-Critical
ROLE UNDER TEST: BranchManager
PRECONDITIONS:  Authenticated `manager.gasr` session.
----------------------------------------
STEPS:
  1. Navigate directly to `http://localhost:5173/superadmin/users`.
----------------------------------------
EXPECTED RESULT:
  Branch manager does not gain superadmin access and is redirected away from the route.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Redirected to `/dashboard`.
----------------------------------------

----------------------------------------
SCENARIO ID:    RBAC-010
CATEGORY:       Role-Based Access Control
PRIORITY:       P0-Critical
ROLE UNDER TEST: Accountant
PRECONDITIONS:  Authenticated `accountant` session after completing the mandatory password-change flow.
----------------------------------------
STEPS:
  1. Navigate directly to `http://localhost:5173/reports`.
  2. Navigate directly to `http://localhost:5173/audit`.
----------------------------------------
EXPECTED RESULT:
  Accountant can access reporting and audit routes assigned to the role.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: `/reports` and `/audit` both loaded successfully.
----------------------------------------

----------------------------------------
SCENARIO ID:    RBAC-011
CATEGORY:       Role-Based Access Control
PRIORITY:       P0-Critical
ROLE UNDER TEST: Accountant
PRECONDITIONS:  Authenticated `accountant` session.
----------------------------------------
STEPS:
  1. Navigate directly to `http://localhost:5173/pos`.
----------------------------------------
EXPECTED RESULT:
  Accountant remains authenticated and is redirected to `/forbidden` because the role lacks POS permission.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Redirected to `/forbidden`.
----------------------------------------

----------------------------------------
SCENARIO ID:    RBAC-012
CATEGORY:       Role-Based Access Control
PRIORITY:       P0-Critical
ROLE UNDER TEST: WarehouseKeeper
PRECONDITIONS:  Authenticated `warehouse.keeper` session after completing the mandatory password-change flow.
----------------------------------------
STEPS:
  1. Navigate directly to `http://localhost:5173/inventory-counts`.
  2. Navigate directly to `http://localhost:5173/inventory-adjustments`.
  3. Navigate directly to `http://localhost:5173/fabric-rolls`.
----------------------------------------
EXPECTED RESULT:
  Warehouse keeper can access the expected inventory-control routes assigned to the role.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: All three routes loaded successfully. Evidence: `output/playwright/day1/warehouse-keeper-inventory-counts.png`, `output/playwright/day1/warehouse-keeper-inventory-adjustments.png`, and `output/playwright/day1/warehouse-keeper-fabric-rolls.png`.
----------------------------------------

----------------------------------------
SCENARIO ID:    RBAC-013
CATEGORY:       Role-Based Access Control
PRIORITY:       P0-Critical
ROLE UNDER TEST: WarehouseKeeper
PRECONDITIONS:  Authenticated `warehouse.keeper` session.
----------------------------------------
STEPS:
  1. Navigate directly to `http://localhost:5173/pos`.
  2. Navigate directly to `http://localhost:5173/settings`.
----------------------------------------
EXPECTED RESULT:
  Warehouse keeper remains authenticated and is redirected to `/forbidden` for routes outside the role's permission set.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Both denied routes redirected to `/forbidden`. Evidence: `output/playwright/day1/warehouse-keeper-pos-forbidden.png` and `output/playwright/day1/warehouse-keeper-settings-forbidden.png`.
----------------------------------------

## UI

----------------------------------------
SCENARIO ID:    UI-001
CATEGORY:       UI/UX & Responsiveness
PRIORITY:       P1-High
ROLE UNDER TEST: Cashier
PRECONDITIONS:  Authenticated `cashier.gasr` session.
----------------------------------------
STEPS:
  1. Log in as `cashier.gasr`.
  2. Navigate directly to `http://localhost:5173/settings`.
  3. Inspect browser console errors after the redirect settles on `/forbidden`.
----------------------------------------
EXPECTED RESULT:
  The forbidden page loads without frontend console errors caused by avoidable background requests.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Retested after the `SETTINGS` fetch gating fix. The route redirected to `/forbidden` with no console errors and no `/api/settings` requests. Evidence: `output/playwright/day1/cashier-settings-forbidden-clean.png`.
----------------------------------------

----------------------------------------
SCENARIO ID:    UI-002
CATEGORY:       UI/UX & Responsiveness
PRIORITY:       P1-High
ROLE UNDER TEST: BranchManager
PRECONDITIONS:  Authenticated `manager.gasr` session.
----------------------------------------
STEPS:
  1. Log in as `manager.gasr`.
  2. Navigate to an allowed route such as `http://localhost:5173/shifts`.
  3. Inspect browser console errors after the page settles.
----------------------------------------
EXPECTED RESULT:
  Allowed pages load without frontend console errors caused by avoidable background requests.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Retested after the `SETTINGS` fetch gating fix. `/shifts` loaded with zero console errors and no `/api/settings` requests. Evidence: `output/playwright/day1/manager-shifts-clean.png`.
----------------------------------------

----------------------------------------
SCENARIO ID:    UI-003
CATEGORY:       UI/UX & Responsiveness
PRIORITY:       P1-High
ROLE UNDER TEST: Accountant
PRECONDITIONS:  Authenticated `accountant` session.
----------------------------------------
STEPS:
  1. Log in as `accountant`.
  2. Navigate to an allowed route such as `http://localhost:5173/reports` or `http://localhost:5173/audit`.
  3. Inspect browser console errors after the page settles.
----------------------------------------
EXPECTED RESULT:
  Allowed pages load without frontend console errors caused by avoidable background requests.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Retested after the `SETTINGS` fetch gating fix. `/reports` loaded with zero console errors and no `/api/settings` requests. Evidence: `output/playwright/day1/accountant-reports-clean.png`.
----------------------------------------

## WORKFLOWS

----------------------------------------
SCENARIO ID:    WF-001
CATEGORY:       Workflow Smoke
PRIORITY:       P0-Critical
ROLE UNDER TEST: BranchManager
PRECONDITIONS:  Authenticated `manager.gasr` session.
----------------------------------------
STEPS:
  1. Navigate directly to `http://localhost:5173/shifts`.
  2. Let the page finish loading its data and controls.
  3. Inspect the browser console for runtime errors.
----------------------------------------
EXPECTED RESULT:
  Shift management loads for the branch manager with its primary controls visible and without frontend runtime errors.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: The shifts page rendered its filters and empty-state table with no console errors. Evidence: `output/playwright/day1/shifts-management-page.png`.
----------------------------------------

----------------------------------------
SCENARIO ID:    WF-002
CATEGORY:       Workflow Smoke
PRIORITY:       P0-Critical
ROLE UNDER TEST: WarehouseKeeper
PRECONDITIONS:  Authenticated `warehouse.keeper` session.
----------------------------------------
STEPS:
  1. Navigate directly to `http://localhost:5173/purchases`.
  2. Let the page finish its initial data loading.
  3. Inspect network and browser console output.
----------------------------------------
EXPECTED RESULT:
  Purchase entry loads for the warehouse keeper without permission-related frontend errors on required page dependencies.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: Retested after the purchase treasury-access fix. `/purchases` loaded for `warehouse.keeper` in deferred-only mode, console output had zero errors/warnings, and network output showed no `/api/treasuries` request or `403`. Evidence: `output/playwright/day1/warehouse-keeper-purchases-deferred-no-treasury-403.png`, `output/playwright/day1/warehouse-keeper-purchases-deferred-no-treasury-403-console.txt`, and `output/playwright/day1/warehouse-keeper-purchases-deferred-no-treasury-403-network.txt`.
----------------------------------------

----------------------------------------
SCENARIO ID:    WF-003
CATEGORY:       Workflow Smoke
PRIORITY:       P0-Critical
ROLE UNDER TEST: Accountant
PRECONDITIONS:  Authenticated `accountant` session.
----------------------------------------
STEPS:
  1. Navigate directly to `http://localhost:5173/purchases`.
  2. Open the purchase return entry flow from the page controls.
  3. Confirm the return modal renders.
----------------------------------------
EXPECTED RESULT:
  Accountant can reach the purchase-return entry flow and the return modal opens without runtime errors.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: The return modal opened successfully and no console errors were observed. Evidence: `output/playwright/day1/purchase-return-modal.png`.
----------------------------------------

----------------------------------------
SCENARIO ID:    WF-004
CATEGORY:       Workflow Smoke
PRIORITY:       P0-Critical
ROLE UNDER TEST: Accountant
PRECONDITIONS:  Authenticated `accountant` session.
----------------------------------------
STEPS:
  1. Navigate directly to `http://localhost:5173/transfer-management`.
  2. Let the page finish its initial data loading.
----------------------------------------
EXPECTED RESULT:
  Treasury transfer management loads for the accountant with primary controls visible and without frontend runtime errors.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: The page loaded with status tabs and empty-state content and produced no console errors. Evidence: `output/playwright/day1/treasury-transfer-management.png`.
----------------------------------------

----------------------------------------
SCENARIO ID:    WF-005
CATEGORY:       Workflow Smoke
PRIORITY:       P0-Critical
ROLE UNDER TEST: WarehouseKeeper
PRECONDITIONS:  Authenticated `warehouse.keeper` session.
----------------------------------------
STEPS:
  1. Navigate directly to `http://localhost:5173/inventory-counts/new`.
  2. Let the page render the start form.
----------------------------------------
EXPECTED RESULT:
  Inventory count creation opens for the warehouse keeper and renders its form without runtime errors.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: The count start form rendered cleanly with no console errors. Evidence: `output/playwright/day1/inventory-count-start-form.png`.
----------------------------------------

----------------------------------------
SCENARIO ID:    WF-006
CATEGORY:       Workflow Smoke
PRIORITY:       P0-Critical
ROLE UNDER TEST: WarehouseKeeper
PRECONDITIONS:  Authenticated `warehouse.keeper` session.
----------------------------------------
STEPS:
  1. Navigate directly to `http://localhost:5173/inventory-adjustments/new`.
  2. Let the page render the adjustment form.
----------------------------------------
EXPECTED RESULT:
  Inventory adjustment creation opens for the warehouse keeper and renders its form without runtime errors.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: The adjustment form rendered cleanly with no console errors. Evidence: `output/playwright/day1/inventory-adjustment-form.png`.
----------------------------------------

----------------------------------------
SCENARIO ID:    WF-007
CATEGORY:       Workflow Smoke
PRIORITY:       P0-Critical
ROLE UNDER TEST: WarehouseKeeper
PRECONDITIONS:  Authenticated `warehouse.keeper` session.
----------------------------------------
STEPS:
  1. Navigate directly to `http://localhost:5173/fabric-rolls/new`.
  2. Let the page render the creation form.
----------------------------------------
EXPECTED RESULT:
  Fabric roll creation opens for the warehouse keeper and renders its form without runtime errors.
----------------------------------------
ACTUAL RESULT:   [x] PASS  [ ] FAIL  [ ] BLOCKED
BUG ID (if fail): ___________
NOTES: The creation form rendered cleanly with no console errors. Evidence: `output/playwright/day1/fabric-roll-form.png`.
----------------------------------------

## EXECUTION STATUS
- Executed so far: `31`
- Passed: `31`
- Failed: `0`
- Blocked: `0`
- In progress: deeper CRUD and submit-path coverage for shifts, purchases and returns, treasury transfer approval flows, inventory count finalization, inventory adjustments, and fabric-roll operations.
