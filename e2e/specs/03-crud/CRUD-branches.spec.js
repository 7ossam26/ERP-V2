const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('CRUD — Branches', () => {
  test('CRUD-BR-001: Branches page loads', async ({ page }) => {
    await page.goto('/branches');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('table, [class*="grid"], [class*="card"]')).toBeVisible({ timeout: 10000 });
  });

  test('CRUD-BR-002: Main branch visible', async ({ page }) => {
    await page.goto('/branches');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('table').getByText('الفرع الرئيسي')).toBeVisible({ timeout: 10000 });
  });

  test('CRUD-BR-003: Create branch button exists', async ({ page }) => {
    await page.goto('/branches');
    await page.waitForLoadState('networkidle');
    const addBtn = page.getByRole('button').filter({ hasText: /إضافة|add/i });
    await expect(addBtn.first()).toBeVisible();
  });
});
