// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('QA Phase 7 — General UI fixes (superadmin)', () => {
  test.use({ storageState: 'e2e/.auth/superadmin.json' });

  test('QA-G1-001: Items table header has sticky positioning', async ({ page }) => {
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

  test('QA-SA1-001: Superadmin user management page loads', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/superadmin/users');
    await page.waitForLoadState('networkidle');

    const table = page.locator('table').first();
    const addBtn = page.locator('button').filter({ hasText: /إضافة|add/i }).first();
    const hasTable = await table.isVisible().catch(() => false);
    const hasBtn = await addBtn.isVisible().catch(() => false);

    expect(hasTable || hasBtn).toBeTruthy();
  });
});

test.describe('QA Phase 7 — Purchases UI (branchMgr)', () => {
  test.use({ storageState: 'e2e/.auth/branch-mgr.json' });

  test('QA-G2-001: Purchases page has price inputs for items', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/purchases');
    await page.waitForLoadState('networkidle');

    // Purchases page has price inputs with placeholder "0.00"
    const priceInput = page.locator('input[placeholder="0.00"]').first();
    await expect(priceInput).toBeVisible({ timeout: 5000 });
  });
});
