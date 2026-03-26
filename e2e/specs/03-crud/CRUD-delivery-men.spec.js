const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('CRUD — Delivery Men', () => {
  test('CRUD-DM-001: Delivery men page loads', async ({ page }) => {
    await page.goto('/delivery-men');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table, [class*="grid"], [class*="card"]')).toBeVisible({ timeout: 10000 });
  });

  test('CRUD-DM-002: Create delivery man button exists', async ({ page }) => {
    await page.goto('/delivery-men');
    await page.waitForLoadState('networkidle');
    const addBtn = page.getByRole('button').filter({ hasText: /إضافة|add/i });
    await expect(addBtn.first()).toBeVisible();
  });
});
