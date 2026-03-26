// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('WFLOW — Bill of Materials (BOM)', () => {
  test('WFLOW-008: BOM list page loads', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/bom');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/login/);
    const content = page.locator('text=/تصنيع|BOM|قائمة المواد|وصفة|التصنيع/i').first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });

  test('WFLOW-009: Production history page loads', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/bom/production-history');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/login/);
    const content = page.locator('text=/سجل|تاريخ|إنتاج|production|history/i').first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });
});
