// Visual review of the customer + technician mobile screens (Expo web, phone viewport).
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright';

const MOBILE = process.env.MOBILE_URL ?? 'http://localhost:8081';
const OUT = 'screenshots/mobile';
fs.mkdirSync(OUT, { recursive: true });
execSync('npm run db:reset', { cwd: '../services/api', stdio: 'ignore' });

const browser = await chromium.launch();
const errors = [];
async function phone() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(MOBILE);
  return p;
}
const tid = (p, id) => p.getByTestId(id);
const shot = async (p, name, full = false) => { await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log('📸', name); };

// ---- customer
const c = await phone();
await tid(c, 'demo-+85512000101').waitFor({ timeout: 60000 });
await shot(c, 'c01-welcome');
await tid(c, 'demo-+85512000101').click();
await c.getByText('What needs fixing today?').waitFor({ timeout: 30000 });
await shot(c, 'c02-home');
await tid(c, 'category-AC').click();
await tid(c, 'service-AC Cleaning').waitFor();
await tid(c, 'service-AC Cleaning').click();
await tid(c, 'service-AC Gas Refill').click();
await tid(c, 'selection-bar').waitFor();
await shot(c, 'c03-services-multi');
await tid(c, 'services-continue').click();
await tid(c, 'tech-Vannak Sok').waitFor();
await shot(c, 'c04-technicians');
await tid(c, 'tech-Vannak Sok').click();
await tid(c, 'book-technician').waitFor();
await shot(c, 'c05-tech-profile');
await tid(c, 'book-technician').click();
await tid(c, 'booking-services').waitFor();
await tid(c, 'problem-input').fill('Clean both units and check the gas, AC is not cold enough.');
await shot(c, 'c06-booking-form');
await tid(c, 'submit-booking').click();
await tid(c, 'countdown').waitFor({ timeout: 15000 });
await shot(c, 'c07-booking-waiting');

// ---- technician sees the request
const tech = await phone();
await tid(tech, 'seg-TECHNICIAN').waitFor({ timeout: 60000 });
await tid(tech, 'seg-TECHNICIAN').click();
await shot(tech, 't00-welcome-technicians');
await tid(tech, 'demo-+85512000201').click();
await tech.getByText(/FN-\d+/).first().waitFor({ timeout: 30000 });
await shot(tech, 't01-jobs-incoming');
await tech.getByTestId(/^accept-FN-/).first().click();
await tid(tech, 'job-address').waitFor({ timeout: 15000 });
await tid(tech, 'booked-services').waitFor();
await shot(tech, 't02-job-accepted');
await tid(tech, 'job-start').click();
await tid(tech, 'finish-amount').fill('60.00');
await tech.getByText('$51.00').first().waitFor();
await shot(tech, 't03-finish', true);
await tid(tech, 'job-finish').click();
await tech.getByText('Waiting for customer payment').waitFor({ timeout: 15000 });

// customer: pay screen
await tid(c, 'pay-now').waitFor({ timeout: 20000 });
await shot(c, 'c08-payment-due');
await tid(c, 'pay-now').click();
await tid(c, 'payment-qr').waitFor({ timeout: 15000 });
await shot(c, 'c09-payment-qr');
await c.getByRole('button', { name: 'Back' }).click();
await tid(c, 'tab-bookings').click();
await tid(c, 'tab-bookings').click();
await shot(c, 'c10-bookings');
await tid(c, 'tab-profile').click();
await tid(c, 'profile-save').waitFor();
await shot(c, 'c11-profile');
await tid(c, 'bell').click();
await shot(c, 'c12-notifications');
await c.getByRole('button', { name: 'Back' }).click();
await tid(c, 'profile-lang-km').click();
await tid(c, 'tab-home').click();
await c.getByText('តើថ្ងៃនេះត្រូវជួសជុលអ្វី?').waitFor();
await shot(c, 'c13-home-khmer');
await tid(c, 'tab-profile').click();
await tid(c, 'profile-lang-en').click();

// technician: other tabs
await tid(tech, 'tab-earnings').click();
await tid(tech, 'earnings-breakdown').waitFor({ timeout: 15000 });
await shot(tech, 't04-earnings');
await tid(tech, 'tab-schedule').click();
await shot(tech, 't05-schedule');
await tid(tech, 'tab-profile').click();
await shot(tech, 't06-profile');

// pending technician
const pend = await phone();
await tid(pend, 'seg-TECHNICIAN').waitFor({ timeout: 60000 });
await tid(pend, 'seg-TECHNICIAN').click();
await tid(pend, 'demo-+85512000204').click();
await tid(pend, 'pending-card').waitFor({ timeout: 20000 });
await shot(pend, 't07-pending');

console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
await browser.close();
