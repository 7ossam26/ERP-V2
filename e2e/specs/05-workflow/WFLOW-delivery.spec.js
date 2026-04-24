// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('WFLOW — Delivery management pages', () => {
  test('WFLOW-005: Delivery men page loads with list', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/delivery-men');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/login/);
    const content = page.locator('text=/مندوب|delivery|توصيل|مناديب/i').first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });

  test('WFLOW-006: Delivery zones page loads with zones list', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/delivery-zones');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/login/);
    const content = page.locator('text=/منطقة|zone|مناطق|التوصيل/i').first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });

  test('WFLOW-007: Delivery settlement page loads', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/delivery-settlement');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/login/);
    const content = page.locator('text=/تسوية|settlement|المندوب|حساب/i').first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });
});
