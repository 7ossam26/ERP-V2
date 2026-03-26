// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('WFLOW — Stock transfer workflow', () => {
  test('WFLOW-012: Stock transfer page loads with warehouse selects', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/stock-transfer');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/login/);

    // Verify warehouse selection elements exist (from/to)
    const warehouseSelects = page.locator('text=/مخزن|مستودع|warehouse|من|إلى/i');
    await expect(warehouseSelects.first()).toBeVisible({ timeout: 5000 });

    // Verify at least a form or transfer UI is present
    const transferUI = page.locator('text=/تحويل|نقل|transfer|stock/i').first();
    await expect(transferUI).toBeVisible({ timeout: 3000 });
  });

  test('WFLOW-013: Transfer history is accessible', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/stock-transfer');
    await page.waitForLoadState('networkidle');

    // Look for a history or previous transfers section/button
    const historyBtn = page.locator('button, a, [role="tab"]').filter({ hasText: /سجل|تاريخ|history|سابقة|عرض/i }).first();
    await expect(historyBtn).toBeVisible({ timeout: 5000 });
    await historyBtn.click();
    await page.waitForLoadState('networkidle');

    // Verify list or table appears
    const list = page.locator('table, [class*="list"], [class*="history"], [class*="grid"]').first();
    await expect(list).toBeVisible({ timeout: 5000 });
  });
});
