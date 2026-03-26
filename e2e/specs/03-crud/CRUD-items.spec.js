const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('CRUD — Items', () => {
  test('CRUD-ITEM-001: Items page loads', async ({ page }) => {
    await page.goto('/items');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table, [class*="grid"], [class*="card"]')).toBeVisible({ timeout: 10000 });
  });

  test('CRUD-ITEM-002: Create item button exists', async ({ page }) => {
    await page.goto('/items');
    await page.waitForLoadState('networkidle');
    const addBtn = page.getByRole('button').filter({ hasText: /إضافة|add/i });
    await expect(addBtn.first()).toBeVisible();
  });

  test('CRUD-ITEM-003: Items table has data rows', async ({ page }) => {
    await page.goto('/items');
    await page.waitForLoadState('networkidle');
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
  });
});
