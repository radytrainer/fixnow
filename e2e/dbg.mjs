import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
p.on('console', m => console.log('console', m.type(), m.text()));
await p.goto('http://localhost:3000/login'); await p.fill('#phone','+85512000001'); await p.fill('#password','FixNowAdmin#2026');
await p.getByRole('button',{name:'Sign in'}).click(); await p.getByText('Business overview').waitFor();
await p.goto('http://localhost:3000/bookings'); await p.getByRole('button',{name:'Details'}).first().click();
await p.getByText('Timeline & audit trail').waitFor(); await p.waitForTimeout(3000);
await p.screenshot({ path: 'screenshots/dbg.png' }); await b.close();
