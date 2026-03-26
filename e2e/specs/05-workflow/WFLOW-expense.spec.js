// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('WFLOW — Expenses and Deposits', () => {
  test('WFLOW-015: Expenses page loads at /expenses', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/login/);
    // Expenses page has title "لوحة المصروفات" and button "إضافة مصروف"
    const title = page.getByText('المصروفات').first();
    const addBtn = page.locator('button').filter({ hasText: /إضافة مصروف/i }).first();
    const hasTitle = await title.isVisible().catch(() => false);
    const hasBtn = await addBtn.isVisible().catch(() => false);

    expect(hasTitle || hasBtn).toBeTruthy();
  });

  test('WFLOW-016: Deposits page loads at /deposits', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/deposits');
    await page.waitForLoadState('networkidle');

    await expect(page).not.toHaveURL(/login/);
    // Deposits page has title "لوحة الإيداعات والمسحوبات" and buttons "إضافة إيداع", "إضافة مسحوب"
    const title = page.getByText('الإيداعات').first();
    const addBtn = page.locator('button').filter({ hasText: /إضافة إيداع/i }).first();
    const hasTitle = await title.isVisible().catch(() => false);
    const hasBtn = await addBtn.isVisible().catch(() => false);

    expect(hasTitle || hasBtn).toBeTruthy();
  });
});
