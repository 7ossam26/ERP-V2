// @ts-check
const { test, expect } = require('@playwright/test');

test('login page loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/ERP/i);
});
