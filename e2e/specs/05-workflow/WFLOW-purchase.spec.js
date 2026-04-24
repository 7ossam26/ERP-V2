// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/branch-mgr.json' });

test.describe('WFLOW — Purchase workflow', () => {
  test('WFLOW-003: Purchases page has supplier selection and item search', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/purchases');
    await page.waitForLoadState('networkidle');

    // Verify supplier area exists (label "اسم المورد")
    const supplierLabel = page.getByText('اسم المورد').first();
    await expect(supplierLabel).toBeVisible({ timeout: 5000 });

    // Verify item search input exists
    const itemSearch = page.locator('input[placeholder*="ابحث عن صنف"]').first();
    await expect(itemSearch).toBeVisible({ timeout: 5000 });
  });

  test('WFLOW-004: Purchase history button is accessible', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/purchases');
    await page.waitForLoadState('networkidle');

    // Look for "سجل المشتريات" (Purchase History) button
    const historyBtn = page.locator('button').filter({ hasText: /سجل المشتريات|سجل/i }).first();
    await expect(historyBtn).toBeVisible({ timeout: 5000 });
  });
});
