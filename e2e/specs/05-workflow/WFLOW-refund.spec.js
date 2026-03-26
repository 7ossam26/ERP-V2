// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/branch-mgr.json' });

test.describe('WFLOW — Refund / Return workflow', () => {
  test('WFLOW-014: Return button exists on purchases page', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/purchases');
    await page.waitForLoadState('networkidle');

    // Find the "مرتجع" (Return) button in purchases header
    const returnBtn = page.locator('button').filter({ hasText: /مرتجع/i }).first();
    await expect(returnBtn).toBeVisible({ timeout: 5000 });
  });
});
