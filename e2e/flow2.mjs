/**
 * Secondary flows:
 *  A. New technician signs up with phone OTP (demo code), completes onboarding with an ID photo upload,
 *     sees the pending gate, admin rejects with reason, technician resubmits, admin approves, app unlocks.
 *  B. Customer request expires (deadline forced into the past in the DB, as if 5 minutes passed),
 *     customer sees EXPIRED and re-sends the same request to another technician.
 * Run after flow.mjs (needs the same servers). Does not reset the DB unless RESET=1.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { chromium } from 'playwright';

const MOBILE = process.env.MOBILE_URL ?? 'http://localhost:8081';
const ADMIN = process.env.ADMIN_URL ?? 'http://localhost:3000';
const PSQL = process.env.PSQL ?? 'C:/Program Files/PostgreSQL/18/bin/psql.exe';
const DB = process.env.PSQL_DB ?? 'postgresql://fixnow@localhost:5440/fixnow';
const OUT = 'screenshots';
if (process.env.RESET) execSync('npm run db:reset', { cwd: '../services/api', stdio: 'ignore' });

// 1x1 PNG used as a stand-in ID photo
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync('id-photo.png', PNG);

const browser = await chromium.launch();
const errors = [];
const page = async (mobile) => {
  const c = await browser.newContext(mobile ? { viewport: { width: 412, height: 915 } } : { viewport: { width: 1440, height: 900 } });
  const p = await c.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  return p;
};
const tid = (p, id) => p.getByTestId(id);
const shot = async (p, n) => { await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${n}.png` }); console.log(`  📸 ${n}`); };
const sql = (q) => execSync(`"${PSQL}" "${DB}" -tAc "${q}"`).toString().trim();

// ---------- A. technician sign-up ----------
console.log('\n▶ A. New technician signs up via OTP and onboards');
const phone = `0${Math.floor(10000000 + Math.random() * 89999999)}`; // local format 0XXXXXXXX
const tech = await page(true);
await tech.goto(MOBILE);
await tid(tech, 'phone-input').fill(phone);
await tid(tech, 'send-code').click();
const codeText = await tech.getByText(/DEMO: SMS not sent/).textContent();
const otp = codeText.match(/(\d{6})/)[1];
await tid(tech, 'code-input').fill(otp);
await tid(tech, 'verify-code').click();
await tech.getByText('New number — how will you use FixNow?').waitFor();
await tech.getByText('I am a technician').click();
await shot(tech, '20-signup-role-choice');
await tid(tech, 'verify-code').click(); // same code, now with role
await tech.getByText('Become a FixNow technician').waitFor({ timeout: 15000 });
await tid(tech, 'onboard-name').fill('Chantha Prak');
await tid(tech, 'onboard-years').fill('6');
await tid(tech, 'onboard-service-AC Cleaning').click();
await tid(tech, 'onboard-service-AC Repair').click();
await tid(tech, 'onboard-id').fill('090807066');
const [chooser] = await Promise.all([tech.waitForEvent('filechooser'), tech.getByText('Choose photo').first().click()]);
await chooser.setFiles('id-photo.png');
await tech.getByText('Photo added ✓').first().waitFor({ timeout: 15000 });
await shot(tech, '21-tech-onboarding');
await tid(tech, 'onboard-submit').click();
await tid(tech, 'pending-card').waitFor({ timeout: 15000 });
await shot(tech, '22-tech-pending-gate');
console.log('  ✓ onboarding submitted; pending gate shown (no job screens)');

const admin = await page(false);
await admin.goto(`${ADMIN}/login`);
await admin.fill('#phone', '+85512000001');
await admin.fill('#password', 'FixNowAdmin#2026');
await admin.getByRole('button', { name: 'Sign in' }).click();
await admin.getByText('Business overview').waitFor();
await admin.goto(`${ADMIN}/technicians`);
await admin.locator('tr', { hasText: 'Chantha Prak' }).getByRole('button', { name: 'Review' }).click();
await admin.getByPlaceholder('Reason (required to reject or suspend)').fill('ID photo is unreadable, please re-upload');
await admin.getByRole('button', { name: 'Reject', exact: true }).click();
await admin.locator('aside').getByText('REJECTED').first().waitFor();
console.log('  ✓ admin rejected with reason');
await tid(tech, 'check-status').click();
await tech.getByText('Application not approved').waitFor({ timeout: 10000 });
await tech.getByText(/ID photo is unreadable/).waitFor();
await shot(tech, '23-tech-rejected');
await tech.getByText('Update and resubmit').click();
const [chooser2] = await Promise.all([tech.waitForEvent('filechooser'), tech.getByText('Choose photo').first().click()]);
await chooser2.setFiles('id-photo.png');
await tech.getByText('Photo added ✓').first().waitFor({ timeout: 15000 });
await tid(tech, 'onboard-submit').click();
await tech.getByText('Application under review').waitFor({ timeout: 15000 });
console.log('  ✓ resubmitted → PENDING again');
await admin.reload();
await admin.getByRole('button', { name: 'Approval queue' }).click().catch(() => {});
await admin.locator('tr', { hasText: 'Chantha Prak' }).getByRole('button', { name: 'Review' }).click();
await admin.getByRole('button', { name: 'Approve', exact: true }).click();
await admin.locator('aside').getByText('APPROVED').first().waitFor();
await tid(tech, 'tab-jobs').waitFor({ timeout: 15000 }); // pending gate polls /me and unlocks
await shot(tech, '24-tech-unlocked-after-approval');
console.log('  ✓ approved → technician app unlocked automatically');

// ---------- B. expiry + resend ----------
console.log('\n▶ B. Request expires → customer re-sends to another technician');
const cust = await page(true);
await cust.goto(MOBILE);
await tid(cust, 'demo-+85512000102').click();
await tid(cust, 'category-ELECTRICAL').click();
await tid(cust, 'service-Outlet & Switch Install').click();
await tid(cust, 'services-continue').click();
await tid(cust, 'tech-Rithy Heng').click();
await tid(cust, 'book-technician').click();
await tid(cust, 'problem-input').fill('Kitchen socket sparks when plugging in the kettle.');
await tid(cust, 'submit-booking').click();
await tid(cust, 'countdown').waitFor({ timeout: 15000 });
const code = (await cust.getByText(/^(Booking|ការកក់) FN-\d+$/).textContent()).match(/FN-\d+/)[0];
sql(`UPDATE bookings SET response_deadline_at = now() - interval '1 second' WHERE booking_code = '${code}'`);
console.log(`  (forced ${code} deadline into the past, simulating 5 minutes without response)`);
await cust.getByText(/No response in 5 minutes|គ្មានការឆ្លើយតបក្នុង ៥ នាទី/).waitFor({ timeout: 15000 });
const status = sql(`SELECT status FROM bookings WHERE booking_code = '${code}'`);
if (status !== 'EXPIRED') throw new Error(`expected EXPIRED, got ${status}`);
await shot(cust, '25-customer-expired-alternatives');
await tid(cust, 'tech-Sophea Lim').click();
await tid(cust, 'countdown').waitFor({ timeout: 15000 });
const newCode = (await cust.getByText(/^(Booking|ការកក់) FN-\d+$/).textContent()).match(/FN-\d+/)[0];
console.log(`  ✓ ${code} EXPIRED server-side; re-sent as ${newCode} to Sophea Lim`);
await shot(cust, '26-customer-resent');
await tid(cust, 'cancel-booking').click();
await cust.getByText(/^(Cancelled|បានលុបចោល)$/).first().waitFor({ timeout: 10000 });
console.log(`  ✓ customer cancelled ${newCode} (no fee)`);

console.log(errors.length ? `\n⚠ page errors:\n${errors.join('\n')}` : '\n✓ no page errors');
await browser.close();
fs.rmSync('id-photo.png');
console.log('\n✅ SECONDARY FLOWS PASSED');
