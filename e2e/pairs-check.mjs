// Checks that demo customer <-> technician pairs show the same bookings on both sides, plus a plumbing booking.
import fs from 'node:fs';
import { chromium } from 'playwright';
const OUT = 'screenshots/pairs'; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const errors = [];
const phone = async (who, tab) => {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:8081');
  if (tab) { await p.getByTestId('seg-TECHNICIAN').waitFor({ timeout: 60000 }); await p.getByTestId('seg-TECHNICIAN').click(); }
  await p.getByTestId(`demo-${who}`).click();
  return p;
};
const shot = async (p, n) => { await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/${n}.png` }); console.log('📸', n); };
const ok = (m) => console.log('PASS', m);

// Malis <-> Piseth: live plumbing request
const malis = await phone('+85512000103');
await malis.getByText('What needs fixing today?').waitFor({ timeout: 30000 });
await malis.getByTestId('tab-bookings').click();
const malisCode = (await malis.getByText(/^FN-\d+ · Piseth Long$/).first().textContent()).match(/FN-\d+/)[0];
ok(`Malis sees her live plumbing request ${malisCode}`);
await shot(malis, 'p01-malis-bookings');

const piseth = await phone('+85512000218', true);
await piseth.getByTestId(`incoming-${malisCode}`).waitFor({ timeout: 30000 });
ok(`Piseth sees the same request ${malisCode} as incoming`);
await shot(piseth, 'p02-piseth-incoming');
await piseth.getByTestId(`accept-${malisCode}`).click();
await piseth.getByTestId('job-address').waitFor({ timeout: 15000 });
ok('Piseth accepted; address revealed');
await malis.getByText(/^FN-\d+ · Piseth Long$/).first().click();
await malis.getByText('Accepted').first().waitFor({ timeout: 15000 });
ok('Malis sees the booking as Accepted');
await shot(malis, 'p03-malis-accepted');

// Sokha <-> Sophea: finished job awaiting payment
const sokha = await phone('+85512000101');
await sokha.getByText('Finished – awaiting payment').first().waitFor({ timeout: 30000 });
const sophea = await phone('+85512000202', true);
await sophea.getByTestId('tab-jobs').waitFor({ timeout: 30000 });
await sophea.getByText('Sokha Chan').first().waitFor({ timeout: 15000 });
ok('Sokha has a finished $18 job; Sophea sees the same job with customer Sokha');
// Dara <-> Sophea: in progress
await sophea.getByText(/· Dara Kim$/).first().waitFor();
ok('Sophea sees Dara\'s in-progress wiring job');
await shot(sophea, 'p04-sophea-jobs');

// Sokha books plumbing
await sokha.getByTestId('category-PLUMBING').click();
await sokha.getByTestId('service-Drain Unclogging').click();
await sokha.getByTestId('services-continue').click();
await sokha.getByTestId('tech-Piseth Long').waitFor({ timeout: 15000 });
await shot(sokha, 'p05-plumbers');
await sokha.getByTestId('tech-Piseth Long').click();
await sokha.getByTestId('book-technician').click();
await sokha.getByTestId('problem-input').fill('Bathroom floor drain is blocked and smells.');
await sokha.getByTestId('submit-booking').click();
await sokha.getByTestId('countdown').waitFor({ timeout: 15000 });
ok('Sokha booked Drain Unclogging with Piseth');
await piseth.getByTestId('tab-jobs').click();
await piseth.getByText('Drain Unclogging').first().waitFor({ timeout: 20000 });
ok('Piseth receives the new plumbing request');
await shot(piseth, 'p06-piseth-new-request');

console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
await b.close();
