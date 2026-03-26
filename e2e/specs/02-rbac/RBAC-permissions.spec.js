// RBAC-permissions.spec.js — Role-based access control checks
const { test, expect } = require('@playwright/test');
const { USERS, STORAGE_STATE } = require('../../fixtures/test-data');
const { ApiHelpers } = require('../../fixtures/api-helpers');

test.describe('RBAC — Superadmin access', () => {
  test.use({ storageState: 'e2e/.auth/superadmin.json' });
  test.setTimeout(20000);

  test('RBAC-001: Superadmin can navigate to /superadmin/users', async ({ page }) => {
    await page.goto('/superadmin/users');
    await page.waitForLoadState('networkidle');

    // Should NOT be on /forbidden
    expect(page.url()).not.toContain('/forbidden');

    // Page should contain user-management content (table or heading)
    const content = page.locator('table, h1, h2, [class*="user"]').first();
    await expect(content).toBeVisible({ timeout: 10000 });
  });

  test('RBAC-004: Superadmin can access /settings', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Should NOT be redirected to /forbidden
    expect(page.url()).not.toContain('/forbidden');
  });
});

test.describe('RBAC — Cashier restrictions', () => {
  test.use({ storageState: 'e2e/.auth/cashier.json' });
  test.setTimeout(20000);

  test('RBAC-002: Cashier navigating to /purchases is redirected to /forbidden or /dashboard', async ({ page }) => {
    await page.goto('/purchases');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const url = page.url();
    // Cashier should be redirected away from /purchases
    const isRedirected =
      url.includes('/forbidden') ||
      url.includes('/dashboard') ||
      !url.includes('/purchases');

    expect(isRedirected).toBeTruthy();
  });
});

test.describe('RBAC — Limited user restrictions', () => {
  test.use({ storageState: 'e2e/.auth/limited.json' });
  test.setTimeout(20000);

  test('RBAC-003: Limited user navigating to /superadmin/users is redirected', async ({ page }) => {
    await page.goto('/superadmin/users');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    const url = page.url();
    // Should NOT remain on /superadmin/users
    const isRedirected =
      url.includes('/forbidden') ||
      url.includes('/dashboard') ||
      !url.includes('/superadmin/users');

    expect(isRedirected).toBeTruthy();
  });
});

test.describe('RBAC — API-level authorization', () => {
  test('RBAC-005: API call to /api/superadmin/users without superadmin token returns 403', async () => {
    // Login as cashier to get a non-superadmin token
    const api = new ApiHelpers();
    const loginRes = await api.login(USERS.cashier.username, USERS.cashier.password);

    // Try to access superadmin endpoint with cashier token
    const res = await api.get('/superadmin/users');

    // Should be 403 Forbidden (or 401 Unauthorized)
    expect([401, 403]).toContain(res.status);
  });
});
