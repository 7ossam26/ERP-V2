// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/branch-mgr.json' });

test.describe('FORM — Purchases page form elements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/purchases');
    await page.waitForLoadState('networkidle');
  });

  test('FORM-004: Item search input exists on purchases page', async ({ page }) => {
    test.setTimeout(20000);
    // Purchases has item search with placeholder "ابحث عن صنف..."
    const itemInput = page.locator('input[placeholder*="ابحث عن صنف"]');
    await expect(itemInput.first()).toBeVisible({ timeout: 5000 });
  });

  test('FORM-005: Supplier selection area exists', async ({ page }) => {
    test.setTimeout(20000);
    // Purchases has supplier label "اسم المورد"
    const supplierLabel = page.getByText('اسم المورد').first();
    await expect(supplierLabel).toBeVisible({ timeout: 5000 });
  });

  test('FORM-006: Save purchases button exists', async ({ page }) => {
    test.setTimeout(20000);
    // Purchases has "حفظ المشتريات" or similar save button
    const saveBtn = page.locator('button').filter({ hasText: /حفظ/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
  });
});
