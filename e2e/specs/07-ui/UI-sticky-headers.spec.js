// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('UI — Sticky table headers (GenericDataTable)', () => {
  test('UI-001: Items table has sticky thead', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/items');
    await page.waitForLoadState('networkidle');

    const thead = page.locator('thead').first();
    await expect(thead).toBeVisible({ timeout: 5000 });

    const position = await thead.evaluate(
      (el) => getComputedStyle(el).position
    );
    expect(position).toBe('sticky');
  });

  test('UI-002: Suppliers table has sticky thead', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/suppliers');
    await page.waitForLoadState('networkidle');

    const thead = page.locator('thead').first();
    await expect(thead).toBeVisible({ timeout: 5000 });

    const position = await thead.evaluate(
      (el) => getComputedStyle(el).position
    );
    expect(position).toBe('sticky');
  });
});
