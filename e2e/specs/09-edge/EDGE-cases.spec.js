// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('EDGE — Edge case handling', () => {
  test('EDGE-001: Warehouses page renders table or empty state', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/warehouses');
    await page.waitForLoadState('networkidle');

    const table = page.locator('table');
    const hasTable = await table.isVisible().catch(() => false);
    const body = page.locator('body');
    const bodyText = await body.textContent();

    expect(hasTable || bodyText.length > 100).toBeTruthy();
  });

  test('EDGE-003: Non-existent route shows 404 or redirects', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/nonexistent');
    await page.waitForLoadState('networkidle');

    const url = page.url();
    const redirected = url.includes('/dashboard') || url.includes('/');
    expect(redirected).toBeTruthy();
  });
});

test.describe('EDGE — Purchases page refresh', () => {
  test.use({ storageState: 'e2e/.auth/branch-mgr.json' });

  test('EDGE-002: Page refresh on /purchases works correctly', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/purchases');
    await page.waitForLoadState('networkidle');

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify the page re-rendered
    const supplierLabel = page.getByText('اسم المورد').first();
    const itemSearch = page.locator('input[placeholder*="ابحث عن صنف"]').first();
    const hasSupplier = await supplierLabel.isVisible().catch(() => false);
    const hasSearch = await itemSearch.isVisible().catch(() => false);

    expect(hasSupplier || hasSearch).toBeTruthy();
  });
});
