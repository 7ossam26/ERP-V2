// @ts-check
const { test, expect } = require('@playwright/test');
const { ApiHelpers } = require('../../fixtures/api-helpers');
const { USERS } = require('../../fixtures/test-data');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('DATA — Treasury and branch balances', () => {
  test('DATA-003: API GET /api/treasuries returns list with balances', async () => {
    test.setTimeout(20000);
    const api = new ApiHelpers();
    await api.login(USERS.superadmin.username, USERS.superadmin.password);

    const res = await api.get('/treasuries');
    expect(res.ok).toBeTruthy();
    expect(Array.isArray(res.data)).toBeTruthy();
    expect(res.data.length).toBeGreaterThan(0);

    // Each treasury should have an id and balance field
    const first = res.data[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('balance');
  });

  test('DATA-004: Branch balance cards load at /branches-sales', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/branches-sales');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/login/);
    const content = page.locator('text=/فروع|فرع|branch|مبيعات/i').first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });
});
