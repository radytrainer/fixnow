// Regression check for the OTP code field: typing, pasting with spaces/extra text, the "Use this code" button, then sign-in.
import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 412, height: 900 } });
const errors = []; p.on('pageerror', (e) => errors.push(e.message));
await p.goto('http://localhost:8081');
const phone = `09${Math.floor(1000000 + Math.random() * 8999999)}`;
await p.getByTestId('phone-input').fill(phone);
await p.getByTestId('send-code').click();
const code = (await p.getByText(/DEMO: SMS not sent/).textContent()).match(/\d{6}/)[0];
const input = p.getByTestId('code-input');
const check = async (label, expected) => { const v = await input.inputValue(); console.log(`${v === expected ? 'PASS' : 'FAIL'} ${label}: "${v}"`); if (v !== expected) process.exitCode = 1; };

await input.click(); await p.keyboard.type(code, { delay: 40 }); await check('typed 6 digits', code);
await input.fill(''); await p.keyboard.type(code + '9', { delay: 40 }); await check('typed 7th digit is ignored', code);
await input.fill(`${code.slice(0, 3)} ${code.slice(3)}`); await check('pasted with a space', code);
await input.fill(`DEMO: SMS not sent. Your code is ${code}`); await check('pasted whole message', code);
await input.fill(''); await p.getByTestId('use-demo-code').click(); await check('"Use this code" button', code);

await p.getByTestId('verify-code').click();
await p.getByText('New number — how will you use FixNow?').waitFor({ timeout: 10000 });
await p.getByTestId('verify-code').click();
await p.getByText('What needs fixing today?').waitFor({ timeout: 15000 });
console.log('PASS signed in with the 6-digit code');
console.log(errors.length ? `page errors: ${errors.join(' | ')}` : 'no page errors');
await b.close();
