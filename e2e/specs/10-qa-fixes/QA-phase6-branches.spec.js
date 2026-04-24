// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('QA Phase 6 — Branch-related fixes', () => {
  test('QA-BR1-001: Branch balances page shows heading', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/branches/balances');
    await page.waitForLoadState('networkidle');

    // Verify the page has the Arabic heading "أرصدة الفروع"
    const heading = page.locator('text=أرصدة الفروع');
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test('QA-BR1-002: Branch sales page loads with branch cards', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/branches-sales');
    await page.waitForLoadState('networkidle');

    // Verify page loaded with content
    await expect(page.locator('body')).not.toBeEmpty();

    // Look for branch-related cards or content
    const cards = page.locator('[class*="card"], [class*="grid"] > div').first();
    const branchContent = page.locator('text=/فرع|branch|مبيعات/i').first();
    const hasCards = await cards.isVisible().catch(() => false);
    const hasContent = await branchContent.isVisible().catch(() => false);

    expect(hasCards || hasContent).toBeTruthy();
  });
});
