# ERP-V2 Bug Register

----------------------------------------
BUG ID:         BUG-001
SCENARIO ID:    AUTH-002
SEVERITY:       S3-Major
TITLE:          Invalid login does not present clear visible feedback to the user
----------------------------------------
DESCRIPTION:
  The login request failed correctly with `401 Unauthorized`, but the UI did not originally surface a clear visible error message after submitting invalid credentials. The user remained on the page without obvious feedback.

STEPS TO REPRODUCE:
  1. Open `http://localhost:5173`.
  2. Enter username `wrong.user`.
  3. Enter password `wrongpass`.
  4. Click `Sign in`.

ENVIRONMENT:
  Browser: Chromium via Playwright CLI
  Screen: Login page default desktop viewport
  Role: Anonymous user

EVIDENCE:
  Original screenshot: `output/playwright/day1/auth-invalid-login-page.png`
  Fixed-state screenshot: `output/playwright/day1/auth-invalid-login-visible-error.png`
----------------------------------------
FIX APPLIED:     [x] YES  [ ] NO  [ ] DEFERRED
FIX DESCRIPTION: `frontend/src/pages/LoginPage.jsx` now keeps a `loginError` state and renders an inline `role="alert"` message using `getLoginErrorMessage(...)` from `frontend/src/utils/loginErrorMessage.js`, so `401` invalid-credential failures are visibly surfaced on the page.
FIX VERIFIED:    [x] YES  [ ] NO
----------------------------------------

----------------------------------------
BUG ID:         BUG-002
SCENARIO ID:    UI-001, UI-002, UI-003
SEVERITY:       S4-Minor
TITLE:          Roles without SETTINGS permission trigger avoidable settings API 403 console errors
----------------------------------------
DESCRIPTION:
  Authenticated roles that do not have `SETTINGS` permission still triggered requests to `/api/settings` and `/api/settings/themes`. The UI continued to function, but the browser console filled with `403` errors on forbidden and allowed pages.

STEPS TO REPRODUCE:
  1. Log in as a role without `SETTINGS`, such as `cashier.gasr`, `manager.gasr`, or `accountant`.
  2. Complete the mandatory password-change step if required.
  3. Navigate to an allowed page like `/shifts` or `/reports`, or to a denied page like `/settings`.
  4. Inspect the browser console after the page settles.

ENVIRONMENT:
  Browser: Chromium via Playwright CLI
  Screen: Desktop viewport
  Role: Cashier, BranchManager, Accountant

EVIDENCE:
  Fixed-state screenshots: `output/playwright/day1/cashier-settings-forbidden-clean.png`, `output/playwright/day1/manager-shifts-clean.png`, `output/playwright/day1/accountant-reports-clean.png`
----------------------------------------
FIX APPLIED:     [x] YES  [ ] NO  [ ] DEFERRED
FIX DESCRIPTION: `frontend/src/contexts/SystemSettingsContext.jsx` now gates settings and theme reads behind `SETTINGS` permission and resets to safe defaults when the permission is absent. Pages with optional settings reads were also guarded in `frontend/src/pages/purchases/PurchasesPage.jsx`, `frontend/src/pages/stock/StockTransferPage.jsx`, `frontend/src/pages/sales/BranchesSalesPage.jsx`, `frontend/src/pages/pos/POSPage.jsx`, and `frontend/src/pages/reports/history/PurchaseDetailsModal.jsx`.
FIX VERIFIED:    [x] YES  [ ] NO
----------------------------------------

----------------------------------------
BUG ID:         BUG-003
SCENARIO ID:    WF-002
SEVERITY:       S3-Major
TITLE:          Warehouse keeper purchases entry hard-depends on treasuries API and logs 403 errors
----------------------------------------
DESCRIPTION:
  The warehouse keeper role is expected to reach purchase entry, but the `/purchases` page immediately requests `/api/treasuries` during initial load. That endpoint requires treasury permissions, so the page logs `403` permission errors and leaves the workflow in a partially broken state for this role.

STEPS TO REPRODUCE:
  1. Authenticate as `warehouse.keeper`.
  2. Navigate directly to `http://localhost:5173/purchases`.
  3. Wait for the page to finish its initial data load.
  4. Inspect the browser console and network requests.

ENVIRONMENT:
  Browser: Chromium via Playwright CLI
  Screen: Desktop viewport
  Role: WarehouseKeeper

EVIDENCE:
  Screenshot: `output/playwright/day1/warehouse-keeper-purchases-treasuries-forbidden.png`
  Fixed-state screenshot: `output/playwright/day1/warehouse-keeper-purchases-deferred-no-treasury-403.png`
  Fixed-state console: `output/playwright/day1/warehouse-keeper-purchases-deferred-no-treasury-403-console.txt`
  Fixed-state network: `output/playwright/day1/warehouse-keeper-purchases-deferred-no-treasury-403-network.txt`
----------------------------------------
FIX APPLIED:     [x] YES  [ ] NO  [ ] DEFERRED
FIX DESCRIPTION: `frontend/src/pages/purchases/PurchasesPage.jsx` now treats treasuries as an optional, permission-gated dependency using `frontend/src/utils/purchaseTreasuryAccess.js`. Roles without `TREASURIES`, including `WarehouseKeeper`, no longer request `/api/treasuries`; their purchase entry defaults to deferred mode and hides treasury-backed payment choices. `backend/routes/purchases.js` keeps `/api/treasuries` protected and resolves the user's branch treasury internally only as a deferred-purchase accounting reference when no treasury ID is submitted.
FIX VERIFIED:    [x] YES  [ ] NO
----------------------------------------

## Setup Defects Fixed Before Scenario Execution
- `SETUP-001`: Prisma client configured with binary engine could not execute reliably in this local machine context. Local fix applied in `backend/prisma/schema.prisma` by switching to library engine and regenerating Prisma.
- `SETUP-002`: Existing-user reseed path did not update passwords, which caused seeded credentials such as `owner` to drift. Local fix applied in `backend/scripts/seed-ramex.js`.
