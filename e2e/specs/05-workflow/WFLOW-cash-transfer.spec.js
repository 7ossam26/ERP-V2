// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('WFLOW — Cash transfer workflow', () => {
  test('WFLOW-010: Cash transfer form loads at /cashier-transfer', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/cashier-transfer');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/login/);

    // Verify transfer form elements are present
    const formContent = page.locator('text=/تحويل|transfer|من خزينة|إلى خزينة|المبلغ/i').first();
    await expect(formContent).toBeVisible({ timeout: 5000 });
  });

  test('WFLOW-011: Transfer management page loads at /transfer-management', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/transfer-management');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/login/);

    // Verify management page content
    const content = page.locator('text=/إدارة التحويلات|تحويلات|transfer|management|موافقة|معلق/i').first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });
});
