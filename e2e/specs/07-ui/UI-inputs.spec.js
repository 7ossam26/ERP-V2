// @ts-check
const { test, expect } = require('@playwright/test');

test.use({ storageState: 'e2e/.auth/branch-mgr.json' });

test.describe('UI — Quantity inputs (KgQuantityInput)', () => {
  test('UI-003: Purchases page has number inputs for item prices', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/purchases');
    await page.waitForLoadState('networkidle');

    // Purchases page has number inputs for price fields (placeholder "0.00")
    const priceInputs = page.locator('input[placeholder="0.00"]');
    await expect(priceInputs.first()).toBeVisible({ timeout: 5000 });
  });

  test('UI-004: Price inputs accept decimal values', async ({ page }) => {
    test.setTimeout(20000);
    await page.goto('/purchases');
    await page.waitForLoadState('networkidle');

    // Find price input and type a decimal
    const priceInput = page.locator('input[placeholder="0.00"]').first();
    await expect(priceInput).toBeVisible({ timeout: 5000 });

    await priceInput.fill('0.5');
    const value = await priceInput.inputValue();
    expect(value).toBe('0.5');
  });
});
