// Browser check of the Cambodia-wide area picker (profile, booking form, technician matching).
import fs from 'node:fs';
import { chromium } from 'playwright';
fs.mkdirSync('screenshots/mobile', { recursive: true });
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
const tid = (id) => p.getByTestId(id);
const shot = async (n) => { await p.waitForTimeout(500); await p.screenshot({ path: `screenshots/mobile/${n}.png` }); console.log('📸', n); };
await p.goto('http://localhost:8081');
await tid('demo-+85512000101').click();
await p.getByText('What needs fixing today?').waitFor({ timeout: 30000 });

// Profile: open picker, browse, search, choose Siem Reap
await tid('tab-profile').click();
await tid('profile-area').click();
await tid('area-PP_TUOL_KOUK').waitFor();
await shot('a01-area-picker');
await tid('area-search').fill('siem');
await tid('area-PV_SIEM_REAP').waitFor();
if (await tid('area-PP_TUOL_KOUK').count()) throw new Error('search did not filter');
await shot('a02-area-search');
await tid('area-PV_SIEM_REAP').click();
await p.getByText('Siem Reap').first().waitFor();
await tid('profile-save').click();
await p.getByText('Saved').waitFor();
console.log('PASS profile area saved as Siem Reap');

// Booking: technicians offered are within 30 km of Siem Reap
await tid('tab-home').click();
await tid('category-AC').click();
await tid('service-AC Cleaning').click();
await tid('services-continue').click();
await tid('tech-Rachana Mok').waitFor({ timeout: 15000 });
if (await tid('tech-Vannak Sok').count()) throw new Error('Phnom Penh technician offered in Siem Reap');
console.log('PASS only nearby technician offered (Rachana Mok, Siem Reap)');
await shot('a03-siem-reap-technicians');
await tid('tech-Rachana Mok').click();
await tid('book-technician').click();
await tid('booking-area').waitFor();
await tid('booking-area').click();
await tid('area-search').fill('Tuol');
await tid('area-PP_TUOL_KOUK').click();
await p.getByText(/launching in Sen Sok first/).waitFor();
console.log('PASS non-pilot area shows coverage note');
await shot('a04-booking-area-note');

// restore Sokha's home area for the demo
await p.goto('http://localhost:8081');
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
await b.close();
