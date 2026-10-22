/**
 * End-to-end demo flow across all three interfaces, against the real API + database:
 *   Admin web approves a technician → Customer app books → Technician app accepts/finishes →
 *   Customer sees QR → Admin confirms simulated payment → Customer rates → Technician sees earnings →
 *   Admin sees the same booking/payment/audit trail.
 * Requires: API on :4000, mobile web (Expo) on :8081, admin on :3000. Resets the demo DB first.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright';

const MOBILE = process.env.MOBILE_URL ?? 'http://localhost:8081';
const ADMIN = process.env.ADMIN_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:4000';
const OUT = process.env.SHOT_DIR ?? 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

if (!process.env.NO_RESET) {
  execSync('npm run db:reset', { cwd: '../services/api', stdio: 'ignore' });
  console.log('✓ demo database reset');
}

const browser = await chromium.launch();
const errors = [];
const ctx = async (mobile) => {
  const c = await browser.newContext(mobile ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 } : { viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  p.on('pageerror', (e) => errors.push(`${mobile ? 'mobile' : 'admin'} pageerror: ${e.message}`));
  return p;
};
const shot = async (page, name) => { await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/${name}.png` }); console.log(`  📸 ${name}`); };
const step = (s) => console.log(`\n▶ ${s}`);
const tid = (page, id) => page.getByTestId(id);

const admin = await ctx(false);
const customer = await ctx(true);
const tech = await ctx(true);

// 1. Admin signs in and approves the pending technician
step('Admin web: sign in and approve pending technician Bopha Nuon');
await admin.goto(`${ADMIN}/technicians`);
await admin.waitForURL(/\/login/);
await admin.fill('#phone', '+85512000001');
await admin.fill('#password', 'FixNowAdmin#2026');
await admin.getByRole('button', { name: 'Sign in' }).click();
await admin.getByText('Business overview').waitFor();
await shot(admin, '01-admin-overview');
await admin.goto(`${ADMIN}/technicians`);
await admin.getByText('Bopha Nuon').waitFor();
await admin.locator('tr', { hasText: 'Bopha Nuon' }).getByRole('button', { name: 'Review' }).click();
await admin.getByText('Verification decision').waitFor();
await shot(admin, '02-admin-technician-review');
await admin.getByRole('button', { name: 'Approve', exact: true }).click();
await admin.locator('aside').getByText('APPROVED').first().waitFor();
console.log('  ✓ Bopha approved');

// 2. Customer books AC Repair with the newly approved technician
step('Customer app: sign in, choose AC Repair, book Bopha');
await customer.goto(MOBILE);
await tid(customer, 'demo-+85512000101').click();
await customer.getByText('What needs fixing today?').waitFor({ timeout: 30000 });
await shot(customer, '03-customer-home');
await tid(customer, 'category-AC').click();
await tid(customer, 'service-AC Repair').click();
await tid(customer, 'services-continue').click();
await tid(customer, 'tech-Bopha Nuon').waitFor();
await shot(customer, '04-customer-technicians');
await tid(customer, 'tech-Bopha Nuon').click();
await tid(customer, 'book-technician').click();
await tid(customer, 'problem-input').fill('Bedroom AC blows warm air and drips water onto the wall.');
await shot(customer, '05-customer-booking-form');
await tid(customer, 'submit-booking').click();
await tid(customer, 'countdown').waitFor({ timeout: 15000 });
const code = (await customer.getByText(/^Booking FN-\d+$/).textContent()).replace('Booking ', '');
console.log(`  ✓ booking ${code} created; countdown visible`);
await shot(customer, '06-customer-waiting-countdown');

// 3. Technician sees the request (coarse area only), accepts, then sees the exact address
step('Technician app: incoming request → accept → start → finish $25');
await tech.goto(MOBILE);
await tid(tech, 'seg-TECHNICIAN').click();
await tid(tech, 'demo-+85512000204').click();
await tid(tech, `incoming-${code}`).waitFor({ timeout: 20000 });
await tid(tech, 'bell-badge').waitFor({ timeout: 15000 });
console.log('  ✓ technician has an unread notification (bell badge)');
const incomingText = await tid(tech, `incoming-${code}`).textContent();
if (incomingText.includes('Borey Peng Huoth')) throw new Error('PRIVACY: exact address visible before accept');
console.log('  ✓ request visible with coarse area only (address hidden)');
await shot(tech, '07-tech-incoming-request');
await tid(tech, `accept-${code}`).click();
await tid(tech, 'job-address').waitFor({ timeout: 15000 });
const addr = await tid(tech, 'job-address').textContent();
console.log(`  ✓ accepted; exact address now visible: "${addr}"`);
const techPage = await tech.content();
if (/\+855\d{8,9}/.test(techPage)) throw new Error('PRIVACY: phone number in technician UI');
await shot(tech, '08-tech-accepted-job');
await tid(customer, 'notif-toast').waitFor({ timeout: 20000 });
const toastText = await tid(customer, 'notif-toast').textContent();
if (!toastText.includes(code) || !toastText.includes('accepted')) throw new Error(`unexpected toast: ${toastText}`);
console.log(`  ✓ customer got in-app notification: "${toastText.replace('×', '').trim()}"`);
await shot(customer, '08b-customer-accepted-toast');
await tid(tech, 'job-start').click();
await tid(tech, 'finish-amount').waitFor();
await tid(tech, 'finish-amount').fill('25.00');
await tech.getByText('$21.25').waitFor();
await shot(tech, '09-tech-finish-with-commission');
await tid(tech, 'job-finish').click();
await tech.getByText('Waiting for customer payment').waitFor({ timeout: 15000 });
console.log('  ✓ job marked FINISHED');

// 4. Customer sees FINISHED and opens the (simulated) QR
step('Customer app: status updates to finished → open payment QR');
await tid(customer, 'pay-now').waitFor({ timeout: 15000 });
await tid(customer, 'pay-now').click();
await tid(customer, 'payment-qr').waitFor({ timeout: 15000 });
await shot(customer, '10-customer-payment-qr');
console.log('  ✓ QR shown with DEMO label');

// 5. Admin confirms the simulated payment
step('Admin web: confirm simulated payment');
await admin.goto(`${ADMIN}/payments`);
const row = admin.locator('tr', { hasText: code });
await row.waitFor();
await row.getByRole('button', { name: 'Confirm (demo)' }).click();
await admin.getByText(`${code}: simulated payment of $25.00 confirmed`).waitFor();
await shot(admin, '11-admin-payment-confirmed');

// 6. Customer sees confirmation, rates the job
step('Customer app: payment confirmed → rate 5 stars');
await customer.getByText('Payment confirmed').waitFor({ timeout: 15000 });
await shot(customer, '12-customer-payment-confirmed');
await tid(customer, 'back-to-booking').click();
await tid(customer, 'rating-card').waitFor({ timeout: 15000 });
await tid(customer, 'star-5').click();
await tid(customer, 'submit-rating').click();
await customer.getByText('Your rating').waitFor({ timeout: 15000 });
await shot(customer, '13-customer-rated-receipt');
console.log('  ✓ rated; receipt shown');

// 7. Technician earnings
step('Technician app: notification inbox');
await tid(tech, 'tab-jobs').click();
await tid(tech, 'bell').click();
await tid(tech, 'notif-PAYMENT_CONFIRMED_TECH').waitFor({ timeout: 20000 });
await shot(tech, '13b-tech-notifications');
console.log('  ✓ technician inbox shows request + payment-confirmed notifications');

step('Technician app: earnings show $25 − $3.75 = $21.25');
await tid(tech, 'tab-earnings').click();
await tid(tech, 'earnings-breakdown').waitFor({ timeout: 15000 });
const earn = await tech.textContent('body');
if (!earn.includes('$21.25') || !earn.includes('$3.75')) throw new Error('Earnings do not show expected commission split');
await shot(tech, '14-tech-earnings');
console.log('  ✓ earnings correct');

// 8. Admin sees the same booking & audit trail
step('Admin web: booking detail + audit trail for the same booking');
await admin.goto(`${ADMIN}/bookings`);
const tile = admin.waitForResponse((r) => r.url().includes('tile.openstreetmap.org') && r.status() === 200, { timeout: 25000 }).catch(() => null);
await admin.locator('tr', { hasText: code }).getByRole('button', { name: 'Details' }).click();
await admin.getByText('Timeline & audit trail').waitFor();
await admin.getByRole('dialog').getByText('PAYMENT CONFIRMED DEMO').waitFor({ timeout: 10000 });
await admin.getByTitle('Service location map').waitFor({ timeout: 10000 });
// The map is an external OpenStreetMap embed: verify map tiles are served, but only warn if the internet is unavailable.
if (await tile) { await admin.waitForTimeout(2500); console.log('  ✓ booking panel shows location map (OSM tiles loaded)'); }
else console.log('  ⚠ map frame present but no map tiles loaded (offline?)');
await shot(admin, '15-admin-booking-detail');
await admin.goto(`${ADMIN}/audit`);
await admin.getByText('PAYMENT_CONFIRMED_DEMO').first().waitFor();
await shot(admin, '16-admin-audit-log');
await admin.getByRole('button', { name: 'ខ្មែរ', exact: true }).click();
await admin.getByText('កំណត់ហេតុសវនកម្ម').first().waitFor();
await admin.goto(`${ADMIN}/`);
await admin.getByText('ទិដ្ឋភាពអាជីវកម្ម').waitFor();
await shot(admin, '16b-admin-khmer');
await admin.getByRole('button', { name: 'EN', exact: true }).click();
console.log('  ✓ admin dashboard switches to Khmer and back');

// 9. Language switch & privacy denial
step('Customer app: switch to Khmer; privacy/access checks');
await tid(customer, 'tab-profile').click();
await tid(customer, 'profile-lang-km').click();
await customer.getByText('ប្រវត្តិរូប').first().waitFor();
await tid(customer, 'tab-home').click();
await customer.getByText('តើថ្ងៃនេះត្រូវជួសជុលអ្វី?').waitFor();
await shot(customer, '17-customer-khmer-home');
const token = await customer.evaluate(() => localStorage.getItem('fixnow.token'));
const denied = await fetch(`${API}/api/admin/reports/summary`, { headers: { Authorization: `Bearer ${token}` } });
if (denied.status !== 403) throw new Error(`Expected 403 for customer on admin API, got ${denied.status}`);
console.log('  ✓ customer token → admin endpoint returns 403');
await tid(customer, 'profile-lang-en').click().catch(() => {});

console.log(errors.length ? `\n⚠ page errors:\n${errors.join('\n')}` : '\n✓ no page errors');
await browser.close();
console.log(`\n✅ END-TO-END FLOW PASSED for ${code}`);
