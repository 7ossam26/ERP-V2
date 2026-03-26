// Screenshot Capture Script — captures key ERP pages for PDF report embedding
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5173';
const SCREENSHOTS_DIR = path.resolve(__dirname, '../../test-results/screenshots');
const AUTH_DIR = path.resolve(__dirname, '../.auth');

const VIEWPORT = { width: 1280, height: 720 };

// Screenshot definitions: each entry specifies a page to capture
const PAGES = [
  {
    name: 'login-page',
    route: '/',
    storageState: null, // no auth — captures the login screen
  },
  {
    name: 'dashboard',
    route: '/superadmin/users',
    storageState: path.join(AUTH_DIR, 'superadmin.json'),
  },
  {
    name: 'pos-page',
    route: '/pos',
    storageState: path.join(AUTH_DIR, 'cashier.json'),
  },
  {
    name: 'purchases-page',
    route: '/purchases',
    storageState: path.join(AUTH_DIR, 'branch-mgr.json'),
  },
  {
    name: 'items-page',
    route: '/items',
    storageState: path.join(AUTH_DIR, 'superadmin.json'),
  },
  {
    name: 'inventory-page',
    route: '/inventory',
    storageState: path.join(AUTH_DIR, 'branch-mgr.json'),
  },
  {
    name: 'branches-page',
    route: '/branches',
    storageState: path.join(AUTH_DIR, 'superadmin.json'),
  },
  {
    name: 'stock-transfer-page',
    route: '/stock-transfer',
    storageState: path.join(AUTH_DIR, 'branch-mgr.json'),
  },
];

async function captureScreenshots() {
  // Ensure output directory exists
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  console.log(`Capturing ${PAGES.length} screenshots...\n`);

  let successCount = 0;
  let failCount = 0;

  for (const page of PAGES) {
    const outputPath = path.join(SCREENSHOTS_DIR, `${page.name}.png`);
    try {
      // Build context options
      const contextOptions = { viewport: VIEWPORT };
      if (page.storageState) {
        contextOptions.storageState = page.storageState;
      }

      const context = await browser.newContext(contextOptions);
      const tab = await context.newPage();

      const url = `${BASE_URL}${page.route}`;
      console.log(`  [${page.name}] Navigating to ${url} ...`);

      await tab.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

      // Small extra delay to let any remaining renders / animations settle
      await tab.waitForTimeout(500);

      await tab.screenshot({ path: outputPath, fullPage: true });
      console.log(`  [${page.name}] Saved -> ${outputPath}`);
      successCount++;

      await context.close();
    } catch (err) {
      console.error(`  [${page.name}] FAILED: ${err.message}`);
      failCount++;
    }
  }

  await browser.close();

  console.log(`\nDone. ${successCount} captured, ${failCount} failed.`);
  console.log(`Screenshots directory: ${SCREENSHOTS_DIR}`);
}

captureScreenshots().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
