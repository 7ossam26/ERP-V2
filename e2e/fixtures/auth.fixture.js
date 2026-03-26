// Auth fixture — login helpers per role with storageState caching
const { test: base, expect } = require('@playwright/test');
const { USERS, STORAGE_STATE } = require('./test-data');
const fs = require('fs');
const path = require('path');

/**
 * Login as a specific user and save storageState
 */
async function loginAs(page, userKey) {
  const user = USERS[userKey];
  if (!user) throw new Error(`Unknown user key: ${userKey}`);

  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.fill('input[placeholder="Enter your username"]', user.username);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');

  // Wait for navigation away from login
  await page.waitForURL((url) => url.pathname !== '/', { timeout: 10000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Ensure storageState file exists for a role by logging in if needed
 */
async function ensureAuth(page, userKey) {
  const stateFile = path.resolve(process.cwd(), STORAGE_STATE[userKey]);
  if (fs.existsSync(stateFile)) {
    return; // Already authenticated
  }
  await loginAs(page, userKey);
  await page.context().storageState({ path: stateFile });
}

/**
 * Create a test fixture that's already logged in as the given role
 */
function createAuthTest(userKey) {
  return base.extend({
    storageState: STORAGE_STATE[userKey],
  });
}

// Pre-built fixtures for common roles
const superadminTest = createAuthTest('superadmin');
const adminTest = createAuthTest('admin');
const cashierTest = createAuthTest('cashier');
const branchMgrTest = createAuthTest('branchMgr');
const gmTest = createAuthTest('gm');
const limitedTest = createAuthTest('limited');

module.exports = {
  loginAs,
  ensureAuth,
  createAuthTest,
  superadminTest,
  adminTest,
  cashierTest,
  branchMgrTest,
  gmTest,
  limitedTest,
};
