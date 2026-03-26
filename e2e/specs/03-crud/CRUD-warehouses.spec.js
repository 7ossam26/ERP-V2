const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('CRUD — Warehouses', () => {
  test('CRUD-WH-001: Warehouses page loads', async ({ page }) => {
    await page.goto('/warehouses');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table, [class*="grid"], [class*="card"]')).toBeVisible({ timeout: 10000 });
  });

  test('CRUD-WH-002: Create warehouse button exists', async ({ page }) => {
    await page.goto('/warehouses');
    await page.waitForLoadState('networkidle');
    const addBtn = page.getByRole('button').filter({ hasText: /إضافة|add/i });
    await expect(addBtn.first()).toBeVisible();
  });

  test('CRUD-WH-003: Warehouse list shows data', async ({ page }) => {
    await page.goto('/warehouses');
    await page.waitForLoadState('networkidle');
    // Should show at least the main warehouse
    await expect(page.getByText('المخزن الرئيسي')).toBeVisible({ timeout: 10000 });
  });
});
