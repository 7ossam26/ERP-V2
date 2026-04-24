const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('CRUD — Delivery Zones', () => {
  test('CRUD-DZ-001: Delivery zones page loads', async ({ page }) => {
    await page.goto('/delivery-zones');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table, [class*="grid"], [class*="card"]')).toBeVisible({ timeout: 10000 });
  });

  test('CRUD-DZ-002: Create zone button exists', async ({ page }) => {
    await page.goto('/delivery-zones');
    await page.waitForLoadState('networkidle');
    const addBtn = page.getByRole('button').filter({ hasText: /إضافة|add/i });
    await expect(addBtn.first()).toBeVisible();
  });
});
