// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('WFLOW — Shift management (cashier)', () => {
  test.use({ storageState: 'e2e/.auth/cashier.json' });

  test('WFLOW-001: POS shows shift-related UI (start shift or status)', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/pos');
    await page.waitForLoadState('networkidle');

    // POS page should load — has product search, shift buttons, or payment buttons
    const searchInput = page.locator('input[placeholder*="بحث عن منتج"]');
    const endShiftBtn = page.locator('button').filter({ hasText: /إنهاء الوردية/i }).first();
    const cashBtn = page.locator('button').filter({ hasText: /نقدي/i }).first();

    const hasSearch = await searchInput.isVisible().catch(() => false);
    const hasShiftBtn = await endShiftBtn.isVisible().catch(() => false);
    const hasCash = await cashBtn.isVisible().catch(() => false);

    expect(hasSearch || hasShiftBtn || hasCash).toBeTruthy();
  });
});

test.describe('WFLOW — Shift management (superadmin)', () => {
  test.use({ storageState: 'e2e/.auth/superadmin.json' });

  test('WFLOW-002: Shifts management page loads', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/shifts');
    await page.waitForLoadState('networkidle');

    // Verify the page loaded — "إدارة الورديات" or table or filter controls
    const heading = page.getByText('إدارة الورديات').first();
    const table = page.locator('table').first();
    const filterBtn = page.locator('button').filter({ hasText: /بحث|تصفية/i }).first();

    const hasHeading = await heading.isVisible().catch(() => false);
    const hasTable = await table.isVisible().catch(() => false);
    const hasFilter = await filterBtn.isVisible().catch(() => false);

    expect(hasHeading || hasTable || hasFilter).toBeTruthy();
  });
});
