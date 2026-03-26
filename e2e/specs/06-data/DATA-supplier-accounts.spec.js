// @ts-check
const { test, expect } = require('@playwright/test');
const { ApiHelpers } = require('../../fixtures/api-helpers');
const { USERS } = require('../../fixtures/test-data');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('DATA — Supplier accounts', () => {
  test('DATA-005: Supplier accounts page loads at /supplier-accounts', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/supplier-accounts');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/login/);
    const content = page.locator('text=/حسابات الموردين|مورد|supplier|حساب/i').first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });

  test('DATA-006: API GET /api/supplier-accounts returns data', async () => {
    test.setTimeout(20000);
    const api = new ApiHelpers();
    await api.login(USERS.superadmin.username, USERS.superadmin.password);

    const res = await api.get('/supplier-accounts');
    expect(res.ok).toBeTruthy();
    expect(res.data).toBeDefined();

    // Response should be an array or object with data
    if (Array.isArray(res.data)) {
      expect(res.data.length).toBeGreaterThanOrEqual(0);
    } else {
      expect(typeof res.data).toBe('object');
    }
  });
});
