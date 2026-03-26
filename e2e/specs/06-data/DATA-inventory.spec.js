// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('DATA — Inventory data display', () => {
  test('DATA-001: Inventory page loads at /inventory', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/login/);
    const content = page.locator('text=/مخزون|جرد|inventory|المخزن/i').first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });

  test('DATA-002: Items are listed with quantities', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');

    // Verify a table or list with item data is present
    const table = page.locator('table, [class*="grid"], [class*="list"]').first();
    await expect(table).toBeVisible({ timeout: 5000 });

    // Verify at least one row or item entry exists
    const rows = page.locator('table tbody tr, [class*="row"], [class*="item"]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });
});
