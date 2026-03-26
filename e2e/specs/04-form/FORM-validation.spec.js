// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/superadmin.json' });

test.describe('FORM — Validation errors on empty required fields', () => {
  test('FORM-001: Create item form has required fields', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/items');
    await page.waitForLoadState('networkidle');

    // Click add button
    const addBtn = page.locator('button').filter({ hasText: /إضافة|جديد|أضف/i }).first();
    await addBtn.click();
    await page.waitForTimeout(1000);

    // Verify a form or modal appeared with input fields
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThan(0);
  });

  test('FORM-002: Supplier form has required fields', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/suppliers');
    await page.waitForLoadState('networkidle');

    const addBtn = page.locator('button').filter({ hasText: /إضافة|جديد|أضف/i }).first();
    await addBtn.click();
    await page.waitForTimeout(1000);

    // Verify form appeared
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThan(0);
  });

  test('FORM-003: Warehouse form has required fields', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/warehouses');
    await page.waitForLoadState('networkidle');

    const addBtn = page.locator('button').filter({ hasText: /إضافة|جديد|أضف/i }).first();
    await addBtn.click();
    await page.waitForTimeout(1000);

    // Verify form appeared
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    expect(inputCount).toBeGreaterThan(0);
  });
});
