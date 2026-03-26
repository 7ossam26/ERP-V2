// Auth setup — creates storageState files for each role
const { test: setup } = require('@playwright/test');
const { USERS, STORAGE_STATE } = require('./fixtures/test-data');

const loginAndSave = (userKey) => {
  setup(`authenticate as ${userKey}`, async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const user = USERS[userKey];

    // Fill login
    await page.fill('input[placeholder="Enter your username"]', user.username);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');

    // Wait for redirect (away from login page)
    await page.waitForURL(url => url.pathname !== '/', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Save auth state
    await page.context().storageState({ path: STORAGE_STATE[userKey] });
  });
};

// Create auth state for each role
loginAndSave('superadmin');
loginAndSave('cashier');
loginAndSave('branchMgr');
loginAndSave('limited');
