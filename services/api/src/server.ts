import { createApp } from './app';
import { config } from './config';
import { migrate } from './db/migrate';
import { expireOverdueBookings } from './domain/bookings';

await migrate();
const app = createApp();
app.listen(config.port, '0.0.0.0', () => {
  console.log(`[api] FixNow API listening on http://localhost:${config.port} (demoMode=${config.demoMode})`);
});

// Background expiry sweep. Reads and actions also run the same check, so correctness never depends on this timer.
setInterval(() => {
  expireOverdueBookings()
    .then((rows) => rows.length && console.log(`[expiry] expired ${rows.map((r) => r.booking_code).join(', ')}`))
    .catch((err) => console.error('[expiry] sweep failed', err));
}, config.expirySweepMs);
