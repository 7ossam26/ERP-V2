const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('CRUD — Treasuries', () => {
  test('CRUD-TR-001: Treasuries page loads', async ({ page }) => {
    await page.goto('/treasuries');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table, [class*="grid"], [class*="card"]')).toBeVisible({ timeout: 10000 });
  });

  test('CRUD-TR-002: Main treasury visible', async ({ page }) => {
    await page.goto('/treasuries');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('الخزنة الرئيسية')).toBeVisible({ timeout: 10000 });
  });

  test('CRUD-TR-003: Create treasury button exists', async ({ page }) => {
    await page.goto('/treasuries');
    await page.waitForLoadState('networkidle');
    const addBtn = page.getByRole('button').filter({ hasText: /إضافة|add/i });
    await expect(addBtn.first()).toBeVisible();
  });
});
