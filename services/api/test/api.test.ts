/**
 * Integration tests for the FixNow API against a real PostgreSQL test database.
 * Covers the spec's critical checks: roles, privacy, 5-minute timer, races, payment state, commission, ratings.
 */
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import type { AddressInfo } from 'node:net';

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://fixnow@localhost:5440/fixnow_test';
process.env.STORAGE_DIR = process.env.STORAGE_DIR_TEST ?? `${process.cwd()}/storage-test`;
process.env.DEMO_MODE = 'true';

const { createApp } = await import('../src/app');
const { pool } = await import('../src/db/pool');
const { resetAndSeed } = await import('../src/db/seed');
const { splitCommission } = await import('@fixnow/shared');

let base = '';
let server: import('node:http').Server;
let ids: Awaited<ReturnType<typeof resetAndSeed>>;
const tokens: Record<string, string> = {};

async function api(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json, raw: text };
}

async function demoLogin(phone: string) {
  const r = await api('POST', '/auth/demo-login', undefined, { phone });
  assert.equal(r.status, 200, r.raw);
  return r.body.token as string;
}

async function newBooking(token = tokens.sokha, technicianId = ids.vannak, serviceId = ids.services.acRepair) {
  const r = await api('POST', '/bookings', token, {
    serviceId, technicianId, problemDescription: 'AC is not cooling at all',
    scheduledAt: new Date(Date.now() + 3600_000).toISOString(), serviceArea: 'PHNOM_PENH_THMEI',
    serviceAddressText: 'Borey Peng Huoth, House 12B', serviceLat: 11.5961, serviceLng: 104.8902,
  });
  assert.equal(r.status, 201, r.raw);
  return r.body;
}

const PHONE_RE = /\+855\d{8,9}/;

before(async () => {
  ids = await resetAndSeed(false);
  server = createApp().listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  tokens.sokha = await demoLogin('+85512000101');
  tokens.dara = await demoLogin('+85512000102');
  tokens.vannak = await demoLogin('+85512000201');
  tokens.sophea = await demoLogin('+85512000202');
  tokens.bopha = await demoLogin('+85512000204'); // PENDING technician
  const admin = await api('POST', '/auth/admin-login', undefined, { phone: '+85512000001', password: 'FixNowAdmin#2026' });
  assert.equal(admin.status, 200);
  tokens.admin = admin.body.token;
});

after(async () => {
  server?.close();
  await pool.end();
});

describe('authentication & roles', () => {
  test('invalid session is rejected with 401', async () => {
    assert.equal((await api('GET', '/me', 'not-a-token')).status, 401);
    assert.equal((await api('GET', '/me')).status, 401);
  });

  test('admin login rejects wrong password; demo login cannot be used for admin', async () => {
    assert.equal((await api('POST', '/auth/admin-login', undefined, { phone: '+85512000001', password: 'wrong' })).status, 401);
    assert.equal((await api('POST', '/auth/demo-login', undefined, { phone: '+85512000001' })).status, 401);
  });

  test('customer cannot call technician or admin endpoints; technician cannot call admin', async () => {
    assert.equal((await api('GET', '/admin/reports/summary', tokens.sokha)).status, 403);
    assert.equal((await api('GET', '/technician/earnings', tokens.sokha)).status, 403);
    assert.equal((await api('GET', '/admin/technicians', tokens.vannak)).status, 403);
    assert.equal((await api('POST', '/admin/payments/00000000-0000-0000-0000-000000000000/confirm-demo', tokens.vannak)).status, 403);
  });

  test('OTP sign-up creates CUSTOMER and cannot self-assign ADMIN', async () => {
    const req = await api('POST', '/auth/otp/request', undefined, { phone: '012 345 678' });
    assert.equal(req.status, 200);
    assert.equal(req.body.simulated, true);
    const bad = await api('POST', '/auth/otp/verify', undefined, { phone: '+85512345678', code: req.body.demoCode, role: 'ADMIN' });
    assert.equal(bad.status, 400);
    const needsRole = await api('POST', '/auth/otp/verify', undefined, { phone: '+85512345678', code: req.body.demoCode });
    assert.equal(needsRole.status, 400);
    assert.equal(needsRole.body.details.needsRole, true);
    // the same code still works once a role is chosen
    const ok = await api('POST', '/auth/otp/verify', undefined, { phone: '+85512345678', code: req.body.demoCode, role: 'CUSTOMER', name: 'New User' });
    assert.equal(ok.status, 200, ok.raw);
    assert.equal(ok.body.role, 'CUSTOMER');
    // codes are single use
    assert.equal((await api('POST', '/auth/otp/verify', undefined, { phone: '+85512345678', code: req.body.demoCode })).status, 401);
    const me = await api('GET', '/me', ok.body.token);
    assert.equal(me.body.role, 'CUSTOMER');
    // PATCH /me cannot change role
    assert.equal((await api('PATCH', '/me', ok.body.token, { role: 'ADMIN' })).status, 400);
  });

  test('customer can save name and home location', async () => {
    const r = await api('PATCH', '/me', tokens.dara, { name: 'Dara K.', homeAddressText: 'Street 598 House 45', homeArea: 'TUEK_THLA', homeLat: 11.57, homeLng: 104.87 });
    assert.equal(r.status, 200);
    assert.equal(r.body.name, 'Dara K.');
    assert.equal(r.body.customerProfile.homeArea, 'TUEK_THLA');
  });
});

describe('catalogue & discovery', () => {
  test('coming-soon categories are listed but cannot be booked', async () => {
    const cats = (await api('GET', '/services')).body.items;
    assert.equal(cats.find((c: any) => c.code === 'PLUMBING').status, 'COMING_SOON');
    const appliances = cats.find((c: any) => c.code === 'APPLIANCES');
    assert.equal(appliances.status, 'COMING_SOON');
    const admin = (await api('GET', '/admin/services', tokens.admin)).body.items;
    const pipe = admin.find((c: any) => c.code === 'APPLIANCES').services[0];
    const r = await api('POST', '/bookings', tokens.sokha, {
      serviceId: pipe.id, technicianId: ids.vannak, problemDescription: 'Leaking pipe', scheduledAt: new Date(Date.now() + 3600_000).toISOString(),
      serviceArea: 'PHNOM_PENH_THMEI', serviceAddressText: 'House 12B street',
    });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'SERVICE_NOT_ACTIVE');
  });

  test('technician list shows only approved technicians and never phone numbers', async () => {
    const r = await api('GET', `/technicians?serviceId=${ids.services.acClean}&area=PHNOM_PENH_THMEI`, tokens.sokha);
    assert.equal(r.status, 200);
    const names = r.body.items.map((t: any) => t.name);
    assert.ok(names.includes('Vannak Sok'));
    assert.ok(!names.includes('Bopha Nuon'), 'pending technician must not be listed');
    assert.ok(!PHONE_RE.test(r.raw), 'no phone numbers in payload');
    const profile = await api('GET', `/technicians/${ids.vannak}`, tokens.sokha);
    assert.ok(!PHONE_RE.test(profile.raw));
    assert.equal(profile.body.idDocumentUrl, undefined);
  });

  test('pending technician cannot accept jobs and cannot be booked', async () => {
    const pending = (await api('GET', '/admin/technicians?status=PENDING', tokens.admin)).body.items[0];
    const r = await api('POST', '/bookings', tokens.sokha, {
      serviceId: ids.services.acClean, technicianId: pending.id, problemDescription: 'Clean my AC please',
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(), serviceArea: 'PHNOM_PENH_THMEI', serviceAddressText: 'House 12B street',
    });
    assert.equal(r.status, 409);
    const b = await newBooking();
    assert.equal((await api('POST', `/bookings/${b.id}/accept`, tokens.bopha)).status, 403);
    await api('POST', `/bookings/${b.id}/cancel`, tokens.sokha, {});
  });
});

describe('booking lifecycle', () => {
  test('server sets a deadline exactly five minutes after creation', async () => {
    const b = await newBooking();
    const diff = new Date(b.responseDeadlineAt).getTime() - new Date(b.createdAt).getTime();
    assert.equal(diff, 300_000);
    assert.equal(b.status, 'REQUESTED');
    await api('POST', `/bookings/${b.id}/cancel`, tokens.sokha, {});
  });

  test('address privacy: hidden before accept, visible to assigned technician after', async () => {
    const b = await newBooking();
    const before = await api('GET', `/bookings/${b.id}`, tokens.vannak);
    assert.equal(before.body.serviceAddressText, null);
    assert.equal(before.body.customer, null);
    assert.equal(before.body.serviceArea, 'PHNOM_PENH_THMEI');
    assert.ok(!before.raw.includes('Borey Peng Huoth'));
    // other technician cannot view at all
    assert.equal((await api('GET', `/bookings/${b.id}`, tokens.sophea)).status, 403);
    // other customer cannot view
    assert.equal((await api('GET', `/bookings/${b.id}`, tokens.dara)).status, 403);
    // other technician cannot accept
    assert.equal((await api('POST', `/bookings/${b.id}/accept`, tokens.sophea)).status, 403);
    const acc = await api('POST', `/bookings/${b.id}/accept`, tokens.vannak);
    assert.equal(acc.status, 200, acc.raw);
    assert.equal(acc.body.serviceAddressText, 'Borey Peng Huoth, House 12B');
    assert.equal(acc.body.customer.name, 'Sokha Chan');
    assert.ok(!PHONE_RE.test(acc.raw));
    await api('POST', `/bookings/${b.id}/cancel`, tokens.sokha, {});
  });

  test('two concurrent accepts: exactly one succeeds', async () => {
    const b = await newBooking();
    const results = await Promise.all(Array.from({ length: 5 }, () => api('POST', `/bookings/${b.id}/accept`, tokens.vannak)));
    assert.equal(results.filter((r) => r.status === 200).length, 1);
    assert.ok(results.filter((r) => r.status === 409).length === 4);
    await api('POST', `/bookings/${b.id}/cancel`, tokens.sokha, {});
  });

  test('accept after deadline fails; booking becomes EXPIRED; customer can rebook another technician', async () => {
    const b = await newBooking();
    await pool.query(`UPDATE bookings SET response_deadline_at = now() - interval '1 second' WHERE id = $1`, [b.id]);
    const acc = await api('POST', `/bookings/${b.id}/accept`, tokens.vannak);
    assert.equal(acc.status, 409);
    assert.equal(acc.body.code, 'BOOKING_EXPIRED');
    const view = await api('GET', `/bookings/${b.id}`, tokens.sokha);
    assert.equal(view.body.status, 'EXPIRED');
    const alt = await api('GET', `/technicians?serviceId=${ids.services.acRepair}&excludeId=${ids.vannak}`, tokens.sokha);
    assert.ok(alt.body.items.length >= 1);
    const re = await api('POST', `/bookings/${b.id}/rebook`, tokens.sokha, { technicianId: alt.body.items[0].id });
    assert.equal(re.status, 201, re.raw);
    assert.equal(re.body.status, 'REQUESTED');
    await api('POST', `/bookings/${re.body.id}/cancel`, tokens.sokha, {});
  });

  test('decline before deadline', async () => {
    const b = await newBooking();
    const r = await api('POST', `/bookings/${b.id}/decline`, tokens.vannak);
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'DECLINED');
    assert.equal((await api('POST', `/bookings/${b.id}/accept`, tokens.vannak)).status, 409);
  });

  test('full happy path: finish → QR → demo payment → commission → rating', async () => {
    const b = await newBooking();
    await api('POST', `/bookings/${b.id}/accept`, tokens.vannak);
    // payment QR not available before finished
    assert.equal((await api('POST', `/bookings/${b.id}/payment/qr`, tokens.sokha)).status, 409);
    // only assigned technician can finish
    assert.equal((await api('POST', `/bookings/${b.id}/finish`, tokens.sophea, { amount: '25.00' })).status, 403);
    // rating locked before payment
    assert.equal((await api('POST', `/bookings/${b.id}/ratings`, tokens.sokha, { score: 5 })).status, 409);
    const start = await api('POST', `/bookings/${b.id}/start`, tokens.vannak);
    assert.equal(start.body.status, 'CONFIRMED');
    // amount outside service price range is rejected
    assert.equal((await api('POST', `/bookings/${b.id}/finish`, tokens.vannak, { amount: '500' })).status, 400);
    const fin = await api('POST', `/bookings/${b.id}/finish`, tokens.vannak, { amount: '25.00' });
    assert.equal(fin.status, 200, fin.raw);
    assert.equal(fin.body.status, 'FINISHED');
    assert.equal(fin.body.payment.status, 'PENDING');
    assert.equal(fin.body.payment.commissionAmount, '3.75');
    assert.equal(fin.body.payment.technicianNet, '21.25');

    const qr = await api('POST', `/bookings/${b.id}/payment/qr`, tokens.sokha);
    assert.equal(qr.status, 200);
    assert.ok(qr.body.qrPayload.includes(fin.body.bookingCode));
    assert.ok(qr.body.qrPayload.includes('amt=25.00'));
    assert.ok(qr.body.qrImageDataUrl.startsWith('data:image/png;base64,'));
    assert.equal(qr.body.isDemo, true);

    // customer cannot self-confirm
    assert.equal((await api('POST', `/admin/payments/${fin.body.payment.id}/confirm-demo`, tokens.sokha)).status, 403);
    const conf = await api('POST', `/admin/payments/${fin.body.payment.id}/confirm-demo`, tokens.admin);
    assert.equal(conf.status, 200, conf.raw);
    assert.equal(conf.body.simulated, true);
    assert.equal((await api('POST', `/admin/payments/${fin.body.payment.id}/confirm-demo`, tokens.admin)).status, 409);

    const tl = await api('GET', `/admin/bookings/${b.id}/timeline`, tokens.admin);
    assert.equal(tl.status, 200, tl.raw);
    assert.ok(tl.body.events.some((e: any) => e.label === 'PAYMENT_CONFIRMED_DEMO'));
    assert.ok(!PHONE_RE.test(tl.raw), 'timeline phones are masked');

    const paid = await api('GET', `/bookings/${b.id}`, tokens.sokha);
    assert.equal(paid.body.status, 'PAID');
    assert.equal(paid.body.payment.qrPayload, null);

    // audit log records actor + time
    const logs = (await api('GET', '/admin/audit-logs?entityType=payment', tokens.admin)).body.items;
    const entry = logs.find((l: any) => l.entityId === fin.body.payment.id && l.action === 'PAYMENT_CONFIRMED_DEMO');
    assert.ok(entry);
    assert.ok(entry.actor);
    assert.ok(entry.createdAt);

    // earnings reflect the job
    const earn = await api('GET', '/technician/earnings', tokens.vannak);
    const item = earn.body.items.find((i: any) => i.bookingId === b.id);
    assert.equal(item.commission, '3.75');
    assert.equal(item.net, '21.25');
    assert.equal(item.payoutStatus, 'PENDING');

    // other customer cannot rate; owner can rate once
    assert.equal((await api('POST', `/bookings/${b.id}/ratings`, tokens.dara, { score: 1 })).status, 403);
    const rate = await api('POST', `/bookings/${b.id}/ratings`, tokens.sokha, { score: 5, comment: 'Great' });
    assert.equal(rate.status, 201, rate.raw);
    assert.equal(rate.body.status, 'RATED');
    const dup = await api('POST', `/bookings/${b.id}/ratings`, tokens.sokha, { score: 4 });
    assert.equal(dup.status, 409);

    // warranty within 3 days routed to the same technician
    const w = await api('POST', `/bookings/${b.id}/warranty`, tokens.sokha, { description: 'Still dripping a little' });
    assert.equal(w.status, 201, w.raw);
    const techWarranty = await api('GET', '/warranty', tokens.vannak);
    assert.ok(techWarranty.body.items.some((x: any) => x.bookingId === b.id));
    const sopheaWarranty = await api('GET', '/warranty', tokens.sophea);
    assert.ok(!sopheaWarranty.body.items.some((x: any) => x.bookingId === b.id));
  });

  test('warranty is refused after the 3-day window', async () => {
    const list = (await api('GET', '/bookings?status=PAID', tokens.sokha)).body.items;
    const old = list[0];
    await pool.query(`UPDATE bookings SET paid_at = now() - interval '4 days' WHERE id = $1`, [old.id]);
    const r = await api('POST', `/bookings/${old.id}/warranty`, tokens.sokha, { description: 'Problem came back' });
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'WARRANTY_EXPIRED');
  });
});

describe('admin', () => {
  test('approving a pending technician makes them discoverable and is audited', async () => {
    const pending = (await api('GET', '/admin/technicians?status=PENDING', tokens.admin)).body.items[0];
    const detail = await api('GET', `/admin/technicians/${pending.id}`, tokens.admin);
    assert.ok(detail.body.idDocumentUrl);
    const file = await fetch(`${base}${detail.body.idDocumentUrl}`);
    assert.equal(file.status, 200);
    const tampered = await fetch(`${base}${detail.body.idDocumentUrl.replace(/sig=.{4}/, 'sig=AAAA')}`);
    assert.equal(tampered.status, 403);
    const r = await api('POST', `/admin/technicians/${pending.id}/approve`, tokens.admin);
    assert.equal(r.body.status, 'APPROVED');
    const list = await api('GET', `/technicians?serviceId=${ids.services.acClean}`, tokens.sokha);
    assert.ok(list.body.items.some((t: any) => t.id === pending.id));
    const logs = (await api('GET', '/admin/audit-logs?entityType=technician_profile', tokens.admin)).body.items;
    assert.ok(logs.some((l: any) => l.entityId === pending.id && l.action === 'TECHNICIAN_APPROVED'));
  });

  test('commission setting change is validated, audited and applied to new payments only', async () => {
    assert.equal((await api('PUT', '/admin/settings/commission_rate', tokens.admin, { value: 90 })).status, 400);
    assert.equal((await api('PUT', '/admin/settings/commission_rate', tokens.admin, { value: 10 })).status, 200);
    const b = await newBooking();
    await api('POST', `/bookings/${b.id}/accept`, tokens.vannak);
    const fin = await api('POST', `/bookings/${b.id}/finish`, tokens.vannak, { amount: '25' });
    assert.equal(fin.body.payment.commissionRate, '10.00');
    assert.equal(fin.body.payment.commissionAmount, '2.50');
    await api('PUT', '/admin/settings/commission_rate', tokens.admin, { value: 15 });
  });

  test('refund and payout transitions are audited', async () => {
    const payments = (await api('GET', '/admin/payments?status=PAID', tokens.admin)).body.items;
    const p = payments.find((x: any) => x.payoutStatus === 'PENDING');
    const payouts = (await api('GET', '/admin/payouts', tokens.admin)).body.items;
    const other = payouts.find((x: any) => x.status === 'PENDING' && x.bookingCode !== p.bookingCode);
    assert.equal((await api('PATCH', `/admin/payouts/${other.id}`, tokens.admin, { status: 'PAID' })).status, 400);
    assert.equal((await api('PATCH', `/admin/payouts/${other.id}`, tokens.admin, { status: 'PROCESSING' })).status, 200);
    assert.equal((await api('PATCH', `/admin/payouts/${other.id}`, tokens.admin, { status: 'PAID', reference: 'ABA-123' })).status, 200);
    assert.equal((await api('PATCH', `/admin/payouts/${other.id}`, tokens.admin, { status: 'PENDING' })).status, 409);
    const ref = await api('POST', `/admin/payments/${p.id}/refund`, tokens.admin, { reason: 'Customer complaint upheld' });
    assert.equal(ref.status, 200, ref.raw);
    assert.equal(ref.body.payoutCancelled, true);
    const logs = (await api('GET', '/admin/audit-logs', tokens.admin)).body.items.map((l: any) => l.action);
    assert.ok(logs.includes('PAYMENT_REFUNDED'));
    assert.ok(logs.includes('PAYOUT_PAID'));
  });

  test('reports summary and CSV export', async () => {
    const s = await api('GET', '/admin/reports/summary', tokens.admin);
    assert.equal(s.status, 200);
    assert.ok(Number(s.body.money.gross) > 0);
    assert.equal(s.body.daily.length, 14);
    const csv = await fetch(`${base}/api/admin/reports/bookings.csv`, { headers: { Authorization: `Bearer ${tokens.admin}` } });
    assert.equal(csv.status, 200);
    assert.match(await csv.text(), /booking_code,status/);
  });

  test('support tickets: user creates, admin resolves', async () => {
    const t = await api('POST', '/support-tickets', tokens.sokha, { category: 'GENERAL', description: 'How do I change my address?' });
    assert.equal(t.status, 201);
    const r = await api('PATCH', `/admin/support-tickets/${t.body.id}`, tokens.admin, { status: 'RESOLVED', adminNote: 'Answered by phone' });
    assert.equal(r.body.status, 'RESOLVED');
    const mine = await api('GET', '/support-tickets', tokens.sokha);
    assert.equal(mine.body.items[0].status, 'RESOLVED');
  });
});

describe('service areas across Cambodia', () => {
  test('customers only see technicians within 30 km of the job', async () => {
    const pp = await api('GET', `/technicians?serviceId=${ids.services.acClean}&area=PHNOM_PENH_THMEI`, tokens.sokha);
    const ppNames = pp.body.items.map((t: any) => t.name);
    assert.ok(ppNames.includes('Vannak Sok'));
    assert.ok(pp.body.items.every((t: any) => t.distanceKm === null || t.distanceKm <= 30));

    const sr = await api('GET', `/technicians?serviceId=${ids.services.acClean}&area=PV_SIEM_REAP`, tokens.sokha);
    assert.equal(sr.body.items.length, 0, 'Sen Sok technicians are too far from Siem Reap');

    const far = await api('GET', `/technicians?serviceId=${ids.services.acClean}&area=PV_RATANAKIRI`, tokens.sokha);
    assert.equal(far.body.items.length, 0, 'nobody serves Ratanakiri yet');
  });

  test('bookings and technician registration accept any Cambodian area; unknown codes are rejected', async () => {
    const r = await api('POST', '/bookings', tokens.sokha, {
      serviceIds: [ids.services.acClean], technicianId: ids.vannak, problemDescription: 'Clean the AC at my office',
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(), serviceArea: 'PP_TUOL_KOUK', serviceAddressText: 'St. 315, Tuol Kouk',
    });
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.body.serviceArea, 'PP_TUOL_KOUK');
    await api('POST', `/bookings/${r.body.id}/cancel`, tokens.sokha, {});
    const bad = await api('POST', '/bookings', tokens.sokha, {
      serviceIds: [ids.services.acClean], technicianId: ids.vannak, problemDescription: 'Clean the AC please',
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(), serviceArea: 'ATLANTIS', serviceAddressText: 'Somewhere far away',
    });
    assert.equal(bad.status, 400);
  });
});

describe('multi-service bookings', () => {
  const body = (serviceIds: string[], technicianId: string) => ({
    serviceIds, technicianId, problemDescription: 'Clean the AC and top up the gas please',
    scheduledAt: new Date(Date.now() + 3600_000).toISOString(), serviceArea: 'PHNOM_PENH_THMEI', serviceAddressText: 'House 12B street',
  });

  test('discovery only lists technicians who offer every selected service', async () => {
    const r = await api('GET', `/technicians?serviceIds=${ids.services.acClean},${ids.services.elOutlet}`, tokens.sokha);
    assert.equal(r.status, 200);
    const names = r.body.items.map((t: any) => t.name);
    assert.ok(names.includes('Sophea Lim'), 'Sophea does AC cleaning and outlets');
    assert.ok(!names.includes('Vannak Sok'), 'Vannak does not do electrical');
    assert.ok(r.body.items.every((t: any) => [ids.services.acClean, ids.services.elOutlet].every((s) => t.serviceIds.includes(s))));
  });

  test('one booking covers several services; price range and finish limits are the sums', async () => {
    const created = await api('POST', '/bookings', tokens.sokha, body([ids.services.acClean, ids.services.acGas], ids.vannak));
    assert.equal(created.status, 201, created.raw);
    assert.equal(created.body.services.length, 2);
    assert.equal(created.body.service.nameEn, 'AC Cleaning + AC Gas Refill');
    assert.equal(created.body.service.minPrice, '40.00'); // 15 + 25
    assert.equal(created.body.service.maxPrice, '80.00'); // 30 + 50
    const n = await api('GET', '/notifications', tokens.vannak);
    assert.ok(n.body.items.some((x: any) => x.bookingId === created.body.id && x.params.serviceEn === 'AC Cleaning + AC Gas Refill'));

    await api('POST', `/bookings/${created.body.id}/accept`, tokens.vannak);
    assert.equal((await api('POST', `/bookings/${created.body.id}/finish`, tokens.vannak, { amount: '85.00' })).status, 400);
    const fin = await api('POST', `/bookings/${created.body.id}/finish`, tokens.vannak, { amount: '60.00' });
    assert.equal(fin.status, 200, fin.raw);
    assert.equal(fin.body.payment.commissionAmount, '9.00');
  });

  test('technician must offer all selected services; duplicates are ignored', async () => {
    const r = await api('POST', '/bookings', tokens.sokha, body([ids.services.acClean, ids.services.elOutlet], ids.vannak));
    assert.equal(r.status, 409);
    assert.equal(r.body.code, 'TECHNICIAN_NOT_ELIGIBLE');
    const dup = await api('POST', '/bookings', tokens.sokha, body([ids.services.acClean, ids.services.acClean], ids.vannak));
    assert.equal(dup.status, 201, dup.raw);
    assert.equal(dup.body.services.length, 1);
    await api('POST', `/bookings/${dup.body.id}/cancel`, tokens.sokha, {});
    assert.equal((await api('POST', '/bookings', tokens.sokha, body([], ids.vannak))).status, 400);
  });
});

describe('notifications', () => {
  test('booking lifecycle notifies the right person without private data', async () => {
    const b = await newBooking();
    const techN = await api('GET', '/notifications', tokens.vannak);
    const req = techN.body.items.find((n: any) => n.bookingId === b.id && n.type === 'BOOKING_REQUESTED');
    assert.ok(req, 'technician notified of new request');
    assert.equal(req.params.area, 'PHNOM_PENH_THMEI');
    assert.ok(!JSON.stringify(techN.body).includes('Borey Peng Huoth'), 'no exact address in notifications');
    assert.ok(!PHONE_RE.test(JSON.stringify(techN.body)), 'no phone numbers in notifications');
    assert.ok(!JSON.stringify(req).includes('Sokha'), 'no customer name before accept');

    await api('POST', `/bookings/${b.id}/accept`, tokens.vannak);
    const custN = await api('GET', '/notifications', tokens.sokha);
    assert.ok(custN.body.items.some((n: any) => n.bookingId === b.id && n.type === 'BOOKING_ACCEPTED'));
    assert.ok(custN.body.unread >= 1);
    // other users never see these
    const daraN = await api('GET', '/notifications', tokens.dara);
    assert.ok(!daraN.body.items.some((n: any) => n.bookingId === b.id));
    // mark read
    const m = await api('POST', '/notifications/read', tokens.sokha, {});
    assert.ok(m.body.marked >= 1);
    assert.equal((await api('GET', '/notifications', tokens.sokha)).body.unread, 0);
    await api('POST', `/bookings/${b.id}/cancel`, tokens.sokha, {});
    const cancelled = await api('GET', '/notifications', tokens.vannak);
    assert.ok(cancelled.body.items.some((n: any) => n.bookingId === b.id && n.type === 'BOOKING_CANCELLED'));
  });

  test('expiry notifies customer and technician', async () => {
    const b = await newBooking();
    await pool.query(`UPDATE bookings SET response_deadline_at = now() - interval '1 second' WHERE id = $1`, [b.id]);
    const custN = await api('GET', '/notifications', tokens.sokha);
    assert.ok(custN.body.items.some((n: any) => n.bookingId === b.id && n.type === 'BOOKING_EXPIRED'));
    const techN = await api('GET', '/notifications', tokens.vannak);
    assert.ok(techN.body.items.some((n: any) => n.bookingId === b.id && n.type === 'BOOKING_EXPIRED_TECH'));
  });

  test('technician is notified when reinstated', async () => {
    assert.equal((await api('POST', `/admin/technicians/${ids.sophea}/suspend`, tokens.admin, { reason: 'Test suspension' })).status, 200);
    assert.equal((await api('POST', `/admin/technicians/${ids.sophea}/reinstate`, tokens.admin)).status, 200);
    const n = await api('GET', '/notifications', tokens.sophea);
    assert.equal(n.body.items[0].type, 'TECHNICIAN_REINSTATED');
  });
});

describe('uploads, profile photo, pagination, rate limit', () => {
  test('video upload is accepted; unsupported type rejected; size capped', async () => {
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypmp42'), Buffer.alloc(64)]).toString('base64');
    const ok = await api('POST', '/uploads', tokens.sokha, { purpose: 'PROBLEM', mimeType: 'video/mp4', dataBase64: mp4 });
    assert.equal(ok.status, 201, ok.raw);
    assert.equal(ok.body.mediaType, 'VIDEO');
    const bad = await api('POST', '/uploads', tokens.sokha, { purpose: 'PROBLEM', mimeType: 'text/html', dataBase64: mp4 });
    assert.equal(bad.status, 400);
    const big = Buffer.alloc(9 * 1024 * 1024).toString('base64');
    const tooBig = await api('POST', '/uploads', tokens.sokha, { purpose: 'PROBLEM', mimeType: 'video/mp4', dataBase64: big });
    assert.ok([400, 413].includes(tooBig.status), `got ${tooBig.status}`);
    // customer cannot upload technician documents
    assert.equal((await api('POST', '/uploads', tokens.sokha, { purpose: 'ID_DOCUMENT', mimeType: 'image/png', dataBase64: mp4 })).status, 403);
    // booking with video attached
    const r = await api('POST', '/bookings', tokens.sokha, {
      serviceId: ids.services.acClean, technicianId: ids.vannak, problemDescription: 'See the video please',
      scheduledAt: new Date(Date.now() + 3600_000).toISOString(), serviceArea: 'PHNOM_PENH_THMEI', serviceAddressText: 'House 12B street', mediaIds: [ok.body.id],
    });
    assert.equal(r.status, 201, r.raw);
    assert.equal(r.body.media[0].mediaType, 'VIDEO');
    await api('POST', `/bookings/${r.body.id}/cancel`, tokens.sokha, {});
  });

  test('technician can update profile photo and bio', async () => {
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const up = await api('POST', '/uploads', tokens.vannak, { purpose: 'PROFILE_PHOTO', mimeType: 'image/png', dataBase64: png });
    const r = await api('PATCH', '/technician/profile', tokens.vannak, { photoMediaId: up.body.id, bio: 'Updated bio' });
    assert.equal(r.status, 200, r.raw);
    assert.ok(r.body.technicianProfile.photoUrl);
    assert.equal(r.body.technicianProfile.bio, 'Updated bio');
    const pub = await api('GET', `/technicians/${ids.vannak}`, tokens.sokha);
    assert.ok(pub.body.photoUrl);
  });

  test('admin lists are paginated', async () => {
    const r = await api('GET', '/admin/payments?page=1&pageSize=2', tokens.admin);
    assert.equal(r.body.items.length, 2);
    assert.ok(r.body.total > 2);
    const p2 = await api('GET', '/admin/payments?page=2&pageSize=2', tokens.admin);
    assert.notEqual(p2.body.items[0].id, r.body.items[0].id);
    const t = await api('GET', '/admin/technicians?pageSize=1', tokens.admin);
    assert.equal(t.body.items.length, 1);
    assert.ok(t.body.total >= 3);
  });

  test('admin login is rate limited per phone', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push((await api('POST', '/auth/admin-login', undefined, { phone: '+85512999999', password: 'wrong' })).status);
    }
    assert.equal(statuses.slice(0, 10).every((s) => s === 401), true);
    assert.equal(statuses[11], 429);
  });

  test('security headers are set', async () => {
    const r = await fetch(`${base}/api/health`);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-frame-options'), 'DENY');
  });
});

describe('money', () => {
  test('$25 at 15% = $3.75 commission, $21.25 net', () => {
    assert.deepEqual(splitCommission('25.00', '15'), { amount: '25.00', commissionRate: '15.00', commissionAmount: '3.75', technicianNet: '21.25' });
    assert.equal(splitCommission('22.50', '15').commissionAmount, '3.38');
    assert.equal(splitCommission('0.10', '15').technicianNet, '0.08');
  });
});
