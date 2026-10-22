// Visual review of the admin dashboard at desktop, tablet and phone widths.
import fs from 'node:fs';
import { chromium } from 'playwright';

const ADMIN = process.env.ADMIN_URL ?? 'http://localhost:3000';
const API = process.env.API_URL ?? 'http://localhost:4000';
const OUT = 'screenshots/admin';
fs.mkdirSync(OUT, { recursive: true });

// Create one live request so "Live requests" and attention cards have content.
const post = (p, body, token) => fetch(`${API}/api${p}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body),
}).then((r) => r.json());
const { token } = await post('/auth/demo-login', { phone: '+85512000102' });
const techs = await fetch(`${API}/api/technicians`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
const services = await fetch(`${API}/api/services`).then((r) => r.json());
const svc = services.items.find((c) => c.code === 'ELECTRICAL').services[0];
const tech = techs.items.find((t) => t.serviceIds.includes(svc.id));
await post('/bookings', {
  serviceId: svc.id, technicianId: tech.id, problemDescription: 'Lights flicker in the bedroom', scheduledAt: new Date().toISOString(),
  serviceArea: 'TUEK_THLA', serviceAddressText: 'Street 598, House 45', serviceLat: 11.5741, serviceLng: 104.8779,
}, token);

const browser = await chromium.launch();
const errors = [];
async function session(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${ADMIN}/login`);
  await page.fill('#phone', '+85512000001');
  await page.fill('#password', 'FixNowAdmin#2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByText('Business overview').waitFor();
  await page.waitForTimeout(1500);
  return page;
}
const shot = async (page, name, full = false) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log('📸', name); };

const login = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await login.goto(`${ADMIN}/login`); await shot(login, '00-login-desktop');
const loginM = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
await loginM.goto(`${ADMIN}/login`); await shot(loginM, '00-login-mobile');

const d = await session({ width: 1440, height: 900 });
await shot(d, '01-desktop-overview', true);
await d.getByRole('button', { name: 'Collapse sidebar' }).first().click();
await shot(d, '02-desktop-collapsed');
await d.locator('aside').getByRole('link', { name: 'Bookings', exact: true }).hover();
await shot(d, '02b-collapsed-tooltip');
await d.getByRole('button', { name: 'Expand sidebar' }).first().click();
await d.goto(`${ADMIN}/bookings`); await d.getByText('All bookings').waitFor(); await shot(d, '03-desktop-bookings');
await d.goto(`${ADMIN}/technicians`); await d.getByRole('button', { name: 'Review' }).first().click(); await shot(d, '04-desktop-tech-review');

const t = await session({ width: 820, height: 1180 });
await shot(t, '05-tablet-overview');

const m = await session({ width: 390, height: 844 });
await shot(m, '06-mobile-overview');
await shot(m, '06b-mobile-overview-full', true);
await m.getByRole('button', { name: 'Open menu' }).click();
await shot(m, '07-mobile-menu');
await m.getByRole('link', { name: /^Bookings/ }).click();
await m.getByText('All bookings').waitFor();
await shot(m, '08-mobile-bookings-cards');

console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
await browser.close();
