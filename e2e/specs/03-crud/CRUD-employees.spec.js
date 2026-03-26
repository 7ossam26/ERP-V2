const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('CRUD — Employees', () => {
  test('CRUD-EMP-001: Employees page loads', async ({ page }) => {
    await page.goto('/employees');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table, [class*="grid"], [class*="card"]')).toBeVisible({ timeout: 10000 });
  });

  test('CRUD-EMP-002: Create employee button exists', async ({ page }) => {
    await page.goto('/employees');
    await page.waitForLoadState('networkidle');
    const addBtn = page.getByRole('button').filter({ hasText: /إضافة|add/i });
    await expect(addBtn.first()).toBeVisible();
  });
});
