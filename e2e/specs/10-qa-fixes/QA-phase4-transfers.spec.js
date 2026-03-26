// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('QA Phase 4 — Stock transfer fixes', () => {
  test('QA-T1-001: Stock transfer page has history button/link', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/stock-transfer');
    await page.waitForLoadState('networkidle');

    // Look for "سجل التحويلات" (Transfer History) button
    const historyBtn = page.locator('button, a').filter({ hasText: /سجل التحويلات|سجل|history/i }).first();
    await expect(historyBtn).toBeVisible({ timeout: 5000 });
  });

  test('QA-T2-001: Stock transfer page has confirm button', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/stock-transfer');
    await page.waitForLoadState('networkidle');

    // Stock transfer has "تأكيد التحويل" (Confirm Transfer) button
    const confirmBtn = page.locator('button').filter({ hasText: /تأكيد التحويل|تأكيد/i }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
  });

  test('QA-T3-001: No grams (جرام) text on stock transfer page', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/stock-transfer');
    await page.waitForLoadState('networkidle');

    const gramsCount = await page.getByText('جرام', { exact: true }).count();
    expect(gramsCount).toBe(0);
  });
});
