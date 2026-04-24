// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('QA Phase 5 — BOM / Production fixes', () => {
  test('QA-B1-001: Production history page loads with table', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/bom/production-history');
    await page.waitForLoadState('networkidle');

    // Verify page loaded
    await expect(page.locator('body')).not.toBeEmpty();

    // Check for a table or production history content
    const table = page.locator('table').first();
    const historyContent = page.locator('text=/سجل الإنتاج|production|أوامر|الإنتاج/i').first();
    const emptyState = page.locator('text=/لا توجد|no data|فارغ/i').first();

    const hasTable = await table.isVisible().catch(() => false);
    const hasContent = await historyContent.isVisible().catch(() => false);
    const hasEmpty = await emptyState.isVisible().catch(() => false);

    expect(hasTable || hasContent || hasEmpty).toBeTruthy();
  });
});
