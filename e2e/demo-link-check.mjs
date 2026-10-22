// Any person seen in the app can be found on the demo sign-in list and opened.
import fs from 'node:fs';
import { chromium } from 'playwright';
fs.mkdirSync('screenshots/demo', { recursive: true });
const b = await chromium.launch();
const errors = [];
const fresh = async () => {
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:8081');
  await p.getByTestId('open-demo').click();
  await p.getByTestId('demo-search').waitFor({ timeout: 60000 });
  return p;
};
const shot = async (p, n) => { await p.waitForTimeout(500); await p.screenshot({ path: `screenshots/demo/${n}.png`, fullPage: false }); console.log('📸', n); };

// 1) Sokha browses plumbers and notes a name that is NOT featured
const sokha = await fresh();
await shot(sokha, 'd01-customers-list');
await sokha.getByTestId('seg-TECHNICIAN').click();
await shot(sokha, 'd02-technicians-list');
await sokha.getByTestId('seg-CUSTOMER').click();
await sokha.getByTestId('demo-+85512000101').click();
await sokha.getByTestId('category-PLUMBING').click();
await sokha.getByTestId('service-Drain Unclogging').click();
await sokha.getByTestId('services-continue').click();
await sokha.getByTestId('tech-Sambath Nhim').waitFor({ timeout: 15000 });
console.log('Seen in Sokha\'s plumber list: Sambath Nhim');

// 2) Find that technician on the sign-in screen and sign in as them
const tech = await fresh();
await tech.getByTestId('seg-TECHNICIAN').click();
await tech.getByTestId('demo-search').fill('Sambath');
await tech.getByText('Plumbing · Tuek Thla').first().waitFor();
await shot(tech, 'd03-search-sambath');
await tech.getByTestId('demo-+85512000219').click();
await tech.getByText('Hello, Sambath').waitFor({ timeout: 30000 });
console.log('PASS signed in as Sambath Nhim from the demo list');

// 3) Reverse direction: a customer name seen by a technician can be opened too
const vannak = await fresh();
await vannak.getByTestId('seg-TECHNICIAN').click();
await vannak.getByTestId('demo-+85512000201').click();
await vannak.getByText(/· Rotha Seng$/).first().waitFor({ timeout: 30000 });
console.log('Seen in Vannak\'s jobs: customer Rotha Seng');
const cust = await fresh();
await cust.getByTestId('demo-search').fill('Rotha');
await cust.getByTestId('demo-+85512000105').click();
await cust.getByText('Hello, Rotha').waitFor({ timeout: 30000 });
await cust.getByTestId('tab-bookings').click();
await cust.getByText(/· Vannak Sok$/).first().waitFor({ timeout: 15000 });
console.log('PASS signed in as Rotha Seng and she sees the same job with Vannak');

console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
await b.close();
