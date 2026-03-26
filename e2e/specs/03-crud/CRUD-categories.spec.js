const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('CRUD — Categories', () => {
  test('CRUD-CAT-001: Categories page loads', async ({ page }) => {
    await page.goto('/categories');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table, [class*="grid"], [class*="card"]')).toBeVisible({ timeout: 10000 });
  });

  test('CRUD-CAT-002: Create category button exists', async ({ page }) => {
    await page.goto('/categories');
    await page.waitForLoadState('networkidle');
    const addBtn = page.getByRole('button').filter({ hasText: /إضافة|add/i });
    await expect(addBtn.first()).toBeVisible();
  });
});
