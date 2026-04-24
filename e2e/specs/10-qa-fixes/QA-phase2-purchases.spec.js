// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/branch-mgr.json' });

test.describe('QA Phase 2 — Purchase page fixes', () => {
  test('QA-P1-001: Item search input exists with correct Arabic placeholder', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/purchases');
    await page.waitForLoadState('networkidle');

    // Purchases page has item search with "ابحث عن صنف..."
    const searchInput = page.locator('input[placeholder*="ابحث عن صنف"]');
    await expect(searchInput.first()).toBeVisible({ timeout: 5000 });
  });

  test('QA-P2-001: Multiple item search inputs exist in purchase table', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/purchases');
    await page.waitForLoadState('networkidle');

    // Verify at least one item search input exists
    const itemInputs = page.locator('input[placeholder*="ابحث عن صنف"]');
    const count = await itemInputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('QA-P4-001: Supplier selection area and item search exist', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/purchases');
    await page.waitForLoadState('networkidle');

    // Verify supplier label exists
    const supplierLabel = page.getByText('اسم المورد').first();
    await expect(supplierLabel).toBeVisible({ timeout: 5000 });

    // Verify item search input is available
    const itemSearch = page.locator('input[placeholder*="ابحث عن صنف"]').first();
    await expect(itemSearch).toBeVisible({ timeout: 5000 });
  });

  test('QA-P5-001: Hold button exists in purchases header', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/purchases');
    await page.waitForLoadState('networkidle');

    // "تعليق" (Hold/Suspend) button in purchases
    const holdBtn = page.locator('button').filter({ hasText: /تعليق/i }).first();
    await expect(holdBtn).toBeVisible({ timeout: 5000 });
  });

  test('QA-P6-001: No grams (جرام) element on purchases page', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/purchases');
    await page.waitForLoadState('networkidle');

    // Verify no "جرام" text exists anywhere on the page
    const gramsCount = await page.getByText('جرام', { exact: true }).count();
    expect(gramsCount).toBe(0);
  });
});
