// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/cashier.json' });

test.describe('FORM — POS cart and interface elements', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/pos');
    await page.waitForLoadState('networkidle');
  });

  test('FORM-007: POS page loads with product search visible', async ({ page }) => {
    // POS has a product search input with placeholder "بحث عن منتج..."
    const searchInput = page.locator('input[placeholder*="بحث عن منتج"]');
    await expect(searchInput).toBeVisible({ timeout: 10000 });
  });

  test('FORM-008: POS has action buttons', async ({ page }) => {
    // POS has buttons like سجل الفواتير, مرتجع, إنهاء الوردية
    const actionBtn = page.locator('button').filter({ hasText: /سجل الفواتير|مرتجع|إنهاء الوردية/i }).first();
    await expect(actionBtn).toBeVisible({ timeout: 5000 });
  });

  test('FORM-009: Payment buttons exist on POS', async ({ page }) => {
    // POS has payment buttons: نقدي (Cash), InstaPay, توصيل (Delivery)
    const cashBtn = page.locator('button').filter({ hasText: /نقدي/i }).first();
    await expect(cashBtn).toBeVisible({ timeout: 5000 });
  });
});
