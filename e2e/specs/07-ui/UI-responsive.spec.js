// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('UI — Responsive viewport rendering', () => {
  test('UI-005: Dashboard renders at 1920x1080 (desktop)', async ({ browser }) => {
    test.setTimeout(20000);
    const context = await browser.newContext({
      storageState: 'e2e/.auth/superadmin.json',
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Verify no crash — page has content
    await expect(page.locator('body')).not.toBeEmpty();

    // No uncaught JS errors
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);

    await context.close();
  });

  test('UI-006: Dashboard renders at 768x1024 (tablet)', async ({ browser }) => {
    test.setTimeout(20000);
    const context = await browser.newContext({
      storageState: 'e2e/.auth/superadmin.json',
      viewport: { width: 768, height: 1024 },
    });
    const page = await context.newPage();

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).not.toBeEmpty();

    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);

    await context.close();
  });
});
