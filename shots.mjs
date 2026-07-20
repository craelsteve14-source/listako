import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5174';
const OUT = '/tmp/claude-0/-home-user-listako/71662e5e-3841-5429-be01-7090627710f7/scratchpad';

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const shot = async (page, name) => {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log('✓', name);
};

const goMore = async (page, subTab) => {
  await page.evaluate((t) => {
    localStorage.setItem('owner_tab', t);
    localStorage.setItem('active_tab', 'more');
  }, subTab);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
};

const goMain = async (page, tab) => {
  await page.evaluate((t) => {
    localStorage.setItem('owner_tab', t);
    localStorage.setItem('active_tab', t);
  }, tab);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
};

// ── Sign-in page (desktop) ──────────────────────────────────────────────────
const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desk.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
await desk.waitForTimeout(1500);
await shot(desk, '01-sign-in');
await desk.close();

// ── Log in ───────────────────────────────────────────────────────────────────
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(1500);
await page.locator('input[type="email"]').fill(process.env.APP_EMAIL || '');
await page.locator('input[type="password"]').fill(process.env.APP_PASSWORD || '');
await page.locator('input[type="password"]').press('Enter');
await page.waitForTimeout(6000);

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(800);

// ── Main tabs ────────────────────────────────────────────────────────────────
await goMain(page, 'dashboard');
await shot(page, '02-dashboard');

await goMain(page, 'sales');
await shot(page, '03-pos-sales');

await goMain(page, 'products');
await shot(page, '04-inventory');

await goMain(page, 'staff');
await shot(page, '05-staff');

// ── More menu landing ────────────────────────────────────────────────────────
await page.evaluate(() => {
  localStorage.setItem('active_tab', 'more');
  localStorage.setItem('owner_tab', '');
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(2000);
await shot(page, '06-more-menu');

// ── Analytics – Revenue ──────────────────────────────────────────────────────
await goMore(page, 'analytics');
await shot(page, '07-analytics-revenue');

// ── Analytics – Payments ────────────────────────────────────────────────────
const paymentsBtn = page.locator('button').filter({ hasText: /^Payments$/ });
if (await paymentsBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  await paymentsBtn.click();
  await page.waitForTimeout(1500);
}
await shot(page, '08-analytics-payments');

// ── Analytics – P&L ─────────────────────────────────────────────────────────
const plBtn = page.locator('button').filter({ hasText: /^P&L$/ });
if (await plBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  await plBtn.click();
  await page.waitForTimeout(1500);
}
await shot(page, '09-analytics-pl');

// ── Analytics – Products ────────────────────────────────────────────────────
const prodBtn = page.locator('button').filter({ hasText: /^Products$/ });
if (await prodBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  await prodBtn.click();
  await page.waitForTimeout(1500);
}
await shot(page, '10-analytics-products');

// ── Analytics – Cashiers ────────────────────────────────────────────────────
const cashBtn = page.locator('button').filter({ hasText: /^Cashiers$/ });
if (await cashBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  await cashBtn.click();
  await page.waitForTimeout(1500);
}
await shot(page, '11-analytics-cashiers');

// ── Branches ─────────────────────────────────────────────────────────────────
await goMore(page, 'branches');
await shot(page, '12-branches');

// ── Customers ────────────────────────────────────────────────────────────────
await goMore(page, 'customers');
await shot(page, '13-customers');

// ── Expenses / Gastos ────────────────────────────────────────────────────────
await goMore(page, 'expenses');
await shot(page, '14-gastos-expenses');

// ── Suppliers ────────────────────────────────────────────────────────────────
await goMore(page, 'suppliers');
await shot(page, '15-suppliers');

// ── Settings ─────────────────────────────────────────────────────────────────
await goMore(page, 'settings');
await shot(page, '16-settings');

await browser.close();
console.log('\nAll done!');
