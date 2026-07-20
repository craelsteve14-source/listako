import { chromium } from '@playwright/test';

const BASE = 'http://localhost:5174';
const OUT = '/tmp/claude-0/-home-user-listako/71662e5e-3841-5429-be01-7090627710f7/scratchpad';

// ── Mock data ────────────────────────────────────────────────────────────────
const USER_ID = 'ea6bfe17-b863-413f-bb89-599fe30fb23d';
const BIZ_ID = 'aabb1122-dead-beef-cafe-001122334455';
const EMAIL = 'craelsteve14@gmail.com';
const NOW = Math.floor(Date.now() / 1000);

const fakeUser = {
  id: USER_ID, aud: 'authenticated', role: 'authenticated', email: EMAIL,
  email_confirmed_at: '2024-01-01T00:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {}, created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z'
};

const fakeSession = {
  access_token: 'mock.access.token.listako',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: NOW + 3600,
  refresh_token: 'mock-refresh-token-listako',
  user: fakeUser
};

const fakeProfile = {
  id: USER_ID, full_name: 'Crael Steve', email: EMAIL,
  role: 'owner', business_id: BIZ_ID, branch_id: null, pin: null,
  created_at: '2024-01-01T00:00:00.000Z', updated_at: '2024-01-01T00:00:00.000Z'
};

const fakeBusiness = {
  id: BIZ_ID, name: 'ListaKo Demo Store', owner_id: USER_ID, status: 'active',
  trial_ends_at: null, gcash_qr_url: null, gcash_name: null, maya_qr_url: null,
  monthly_revenue_target: 50000, low_stock_alert_enabled: true,
  discount_types_allowed: 'both', allow_negative_stock: false,
  require_pin_for_discount: false, auto_print_receipt: false,
  currency: 'PHP', tax_rate: 0, created_at: '2024-01-01T00:00:00.000Z'
};

// ── Supabase route interceptor ───────────────────────────────────────────────
const mockSupabase = async (page) => {
  await page.route('**/*.supabase.co/**', async (route) => {
    const url = route.request().url();
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    // Auth
    if (url.includes('/auth/v1/user'))            return json(fakeUser);
    if (url.includes('/auth/v1/token'))            return json(fakeSession);
    if (url.includes('/auth/v1/logout') || url.includes('/auth/v1/signout')) return route.fulfill({ status: 204 });

    // REST API
    if (url.includes('/rest/v1/profiles'))         return json([fakeProfile]);
    if (url.includes('/rest/v1/businesses'))       return json([fakeBusiness]);
    if (url.includes('/rest/v1/branches'))         return json([{ id: 'branch-001', business_id: BIZ_ID, name: 'Main Branch', address: 'Manila', is_main: true, status: 'active', created_at: '2024-01-01T00:00:00.000Z' }]);
    if (url.includes('/rest/v1/super_admins'))     return json([]);
    if (url.includes('/rest/v1/products'))         return json([
      { id: 'prod-001', business_id: BIZ_ID, name: 'Sample Product A', price: 150, cost_price: 80, stock: 42, category: 'Food', unit: 'pc', low_stock_threshold: 5, status: 'active', image_url: null, barcode: null, supplier_id: null, created_at: '2024-01-01T00:00:00.000Z' },
      { id: 'prod-002', business_id: BIZ_ID, name: 'Sample Product B', price: 250, cost_price: 130, stock: 8, category: 'Beverages', unit: 'pc', low_stock_threshold: 10, status: 'active', image_url: null, barcode: null, supplier_id: null, created_at: '2024-01-01T00:00:00.000Z' },
      { id: 'prod-003', business_id: BIZ_ID, name: 'Sample Product C', price: 75, cost_price: 0, stock: 3, category: 'Snacks', unit: 'pc', low_stock_threshold: 5, status: 'active', image_url: null, barcode: null, supplier_id: null, created_at: '2024-01-01T00:00:00.000Z' },
    ]);
    if (url.includes('/rest/v1/transactions'))     return json([
      { id: 'tx-001', business_id: BIZ_ID, branch_id: 'branch-001', total_amount: 400, payment_method: 'cash', status: 'completed', created_at: new Date().toISOString() },
      { id: 'tx-002', business_id: BIZ_ID, branch_id: 'branch-001', total_amount: 250, payment_method: 'gcash', status: 'completed', created_at: new Date().toISOString() },
    ]);
    if (url.includes('/rest/v1/transaction_items')) return json([]);
    if (url.includes('/rest/v1/utang_records'))   return json([
      { id: 'utang-001', business_id: BIZ_ID, customer_name: 'Juan dela Cruz', customer_phone: '09171234567', amount: 350, balance: 350, status: 'unpaid', due_date: null, notes: null, created_at: new Date().toISOString() }
    ]);
    if (url.includes('/rest/v1/staff'))            return json([
      { id: 'staff-001', business_id: BIZ_ID, user_id: 'user-002', full_name: 'Maria Santos', role: 'cashier', branch_id: 'branch-001', status: 'active', created_at: '2024-01-01T00:00:00.000Z' }
    ]);
    if (url.includes('/rest/v1/expenses'))         return json([
      { id: 'exp-001', business_id: BIZ_ID, amount: 1200, category: 'Utilities', description: 'Electric bill', expense_date: new Date().toISOString().split('T')[0], created_at: new Date().toISOString() },
      { id: 'exp-002', business_id: BIZ_ID, amount: 800, category: 'Supplies', description: 'Packaging materials', expense_date: new Date().toISOString().split('T')[0], created_at: new Date().toISOString() },
    ]);
    if (url.includes('/rest/v1/suppliers'))        return json([
      { id: 'sup-001', business_id: BIZ_ID, name: 'ABC Wholesale', contact_name: 'Bob', phone: '09181234567', notes: null, created_at: '2024-01-01T00:00:00.000Z' }
    ]);
    if (url.includes('/rest/v1/customers'))        return json([
      { id: 'cust-001', business_id: BIZ_ID, name: 'Juan dela Cruz', phone: '09171234567', total_spent: 1500, visit_count: 3, created_at: '2024-01-01T00:00:00.000Z' }
    ]);
    if (url.includes('/rest/v1/notifications'))   return json([]);
    if (url.includes('/rest/v1/audit_logs'))      return json([]);
    if (url.includes('/rest/v1/stock_transfers')) return json([]);
    if (url.includes('/rest/v1/pending_orders'))  return json([]);
    if (url.includes('/rest/v1/shifts'))          return json([]);
    if (url.includes('/rest/v1/'))                return json([]);

    // Realtime — abort gracefully
    if (url.includes('/realtime/')) return route.abort('failed');

    // RPC calls (functions)
    if (url.includes('/rest/v1/rpc/')) return json({});

    route.abort('failed');
  });
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox']
});

const shot = async (page, name) => {
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log('✓', name);
};

const goMore = async (page, subTab) => {
  await page.evaluate((t) => {
    localStorage.setItem('owner_tab', t);
    localStorage.setItem('active_tab', 'more');
  }, subTab);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
};

const goMain = async (page, tab) => {
  await page.evaluate((t) => {
    localStorage.setItem('owner_tab', t);
    localStorage.setItem('active_tab', t);
  }, tab);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
};

// ── Sign-in page (no auth, desktop) ─────────────────────────────────────────
const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desk.goto(BASE, { waitUntil: 'networkidle', timeout: 25000 });
await desk.waitForSelector('#splash', { state: 'detached', timeout: 8000 }).catch(() => {});
await desk.waitForTimeout(1000);
await shot(desk, '01-sign-in');
await desk.close();

// ── Create authenticated session via mock ────────────────────────────────────
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

// Inject session into localStorage BEFORE the page loads (runs before any scripts)
await page.addInitScript(({ key, session }) => {
  localStorage.setItem(key, JSON.stringify(session));
}, { key: 'listako-session', session: fakeSession });

// Mock all Supabase API calls
await mockSupabase(page);

// Load the app — it will find the session in localStorage and call auth APIs (mocked)
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 25000 });
await page.waitForSelector('#splash', { state: 'detached', timeout: 10000 }).catch(() => {});
await page.waitForTimeout(4000);

const bodySnip = (await page.textContent('body')).replace(/\s+/g, ' ').slice(0, 200);
console.log('After mock auth:', bodySnip);
await page.screenshot({ path: `${OUT}/login-check.png` });

// ── Main tabs ────────────────────────────────────────────────────────────────
await goMain(page, 'dashboard');
await shot(page, '02-dashboard');

await goMain(page, 'sales');
await shot(page, '03-pos-sales');

await goMain(page, 'products');
await shot(page, '04-inventory');

await goMain(page, 'staff');
await shot(page, '05-staff');

// ── More menu ────────────────────────────────────────────────────────────────
await page.evaluate(() => {
  localStorage.setItem('active_tab', 'more');
  localStorage.setItem('owner_tab', '');
});
await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3000);
await shot(page, '06-more-menu');

// ── Analytics ────────────────────────────────────────────────────────────────
await goMore(page, 'analytics');
await shot(page, '07-analytics-revenue');

const clickTab = async (label) => {
  const btn = page.locator('button').filter({ hasText: new RegExp(`^${label}$`) });
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(1500);
  }
};

await clickTab('Payments');
await shot(page, '08-analytics-payments');

await clickTab('P&L');
await shot(page, '09-analytics-pl');

await clickTab('Products');
await shot(page, '10-analytics-products');

await clickTab('Cashiers');
await shot(page, '11-analytics-cashiers');

// ── Other More tabs ──────────────────────────────────────────────────────────
await goMore(page, 'branches');
await shot(page, '12-branches');

await goMore(page, 'customers');
await shot(page, '13-customers');

await goMore(page, 'expenses');
await shot(page, '14-gastos-expenses');

await goMore(page, 'suppliers');
await shot(page, '15-suppliers');

await goMore(page, 'settings');
await shot(page, '16-settings');

await browser.close();
console.log('\nAll done!');
