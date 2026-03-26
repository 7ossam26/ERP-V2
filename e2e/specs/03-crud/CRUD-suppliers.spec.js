const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('CRUD — Suppliers', () => {
  test('CRUD-SUPP-001: Suppliers page loads', async ({ page }) => {
    await page.goto('/suppliers');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table, [class*="grid"], [class*="card"]')).toBeVisible({ timeout: 10000 });
  });

  test('CRUD-SUPP-002: Create supplier button exists', async ({ page }) => {
    await page.goto('/suppliers');
    await page.waitForLoadState('networkidle');
    const addBtn = page.getByRole('button').filter({ hasText: /إضافة|add/i });
    await expect(addBtn.first()).toBeVisible();
  });

  test('CRUD-SUPP-003: Default supplier visible', async ({ page }) => {
    await page.goto('/suppliers');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('مورد عام')).toBeVisible({ timeout: 10000 });
  });
});
