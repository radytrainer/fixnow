// Quick visual smoke test: loads the mobile web build and screenshots the welcome screen.
import { chromium } from 'playwright';
const out = process.env.SHOT_DIR ?? 'screenshots';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 412, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(process.env.MOBILE_URL ?? 'http://localhost:8081', { waitUntil: 'networkidle', timeout: 180000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: `${out}/mobile-welcome.png` });
console.log('errors:', errors);
await browser.close();
