// Checks that demo customer <-> technician pairs show the same bookings on both sides.
import fs from 'node:fs';
import { chromium } from 'playwright';
const OUT = 'screenshots/pairs'; fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const errors = [];
const phone = async (who, tab) => {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:8081');
  await p.getByTestId('open-demo').click();
  if (tab) { await p.getByTestId('seg-TECHNICIAN').waitFor({ timeout: 60000 }); await p.getByTestId('seg-TECHNICIAN').click(); }
  await p.getByTestId(`demo-${who}`).click();
  return p;
};
const shot = async (p, n) => { await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/${n}.png` }); console.log('📸', n); };
const ok = (m) => console.log('PASS', m);

// Malis <-> Sophea: live electrical request
const malis = await phone('+85512000103');
await malis.getByText('What needs fixing today?').waitFor({ timeout: 30000 });
await malis.getByTestId('tab-bookings').click();
const malisCode = (await malis.getByText(/^FN-\d+ · Sophea Lim$/).first().textContent()).match(/FN-\d+/)[0];
ok(`Malis sees her live electrical request ${malisCode}`);
await shot(malis, 'p01-malis-bookings');

const sophea = await phone('+85512000202', true);
await sophea.getByTestId(`incoming-${malisCode}`).waitFor({ timeout: 30000 });
ok(`Sophea sees the same request ${malisCode} as incoming`);
await shot(sophea, 'p02-sophea-incoming');
await sophea.getByTestId(`accept-${malisCode}`).click();
await sophea.getByTestId('job-address').waitFor({ timeout: 15000 });
ok('Sophea accepted; address revealed');
await malis.getByText(/^FN-\d+ · Sophea Lim$/).first().click();
await malis.getByText('Accepted').first().waitFor({ timeout: 15000 });
ok('Malis sees the booking as Accepted');
await shot(malis, 'p03-malis-accepted');

// Sokha <-> Sophea: finished job awaiting payment
const sokha = await phone('+85512000101');
await sokha.getByText('Finished – awaiting payment').first().waitFor({ timeout: 30000 });
await sophea.getByTestId('tab-jobs').waitFor({ timeout: 30000 });
await sophea.getByText('Sokha Chan').first().waitFor({ timeout: 15000 });
ok('Sokha has a finished $18 job; Sophea sees the same job with customer Sokha');
// Dara <-> Sophea: in progress
await sophea.getByText(/· Dara Kim$/).first().waitFor();
ok('Sophea sees Dara\'s in-progress wiring job');
await shot(sophea, 'p04-sophea-jobs');

console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
await b.close();
