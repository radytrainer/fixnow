# FixNow demo data guide

Load or restore the demo at any time:

```bash
npm run db:reset
```

The data uses a fixed random seed, so it is the same every time. All dates are relative to the moment you reset, so charts, countdowns and the 3-day warranty window always look current.

**Reset shortly before presenting.** The 3 live requests start with 2:30–4:20 left on their 5-minute countdowns. They expire automatically afterwards, as the business rule requires.

All payments are **DEMO (simulated)**. No real money is involved.

## What's in it

| Area | Data |
|---|---|
| Services | 4 categories, 21 services (18 bookable). Air Conditioning has 6 (cleaning, repair, gas refill, installation, check-up, relocation). Electrical has 7 (wiring, outlets, breakers, lighting, ceiling fans, water-heater wiring, safety inspection). Plumbing has 5 (pipe leak, drain, toilet, water pump, faucet & sink). Home Appliances has 3, all **Coming soon** |
| Customers | 14 across Sen Sok, other Phnom Penh khans and Siem Reap, English and Khmer speakers, with home addresses and GPS pins |
| Technicians | 20 in total: **16 approved** (AC, electrical and **3 plumbers**; mostly Sen Sok, plus Tuol Kouk, Chamkar Mon and Siem Reap), **2 pending** (Bopha, Vichea), **1 rejected** (Vuthy, with reason), **1 suspended** (Kosal) |
| Bookings | ~120 over 30 days (about 1 in 5 combines two services, e.g. AC Cleaning + Gas Refill), in every status: live requests, accepted, in progress, finished (awaiting payment), paid, rated, closed, expired, declined, cancelled, customer not available, disputed, refunded |
| Money | ~$2,450 gross paid, 15% commission (about $368). Payouts in every state: paid with ABA references, processing, pending, and failed (one bank rejection, one cancelled by a refund) |
| Ratings | ~64 reviews in English and Khmer; top technicians average 4.4–4.6★ |
| Care | 3 warranty claims (open, accepted, resolved), 7 support tickets (open, in review, resolved, closed), including a dispute and a refund |
| Activity | ~140 notifications (some unread in each demo account) and ~240 audit-log entries by 2 admins (Ops and Finance) |

## Sign-in accounts

**Every customer and technician in the demo data can be signed into.** Any name you see in the app (a technician in a customer's list, a customer in a technician's jobs) is on the *Demo accounts* screen. Featured accounts are listed first, each card shows the specialty, area, rating and active bookings, and you can search by name.

**Admin dashboard** (http://localhost:3000): `+85512000001` / `FixNowAdmin#2026` (Ops). A finance admin, `+85512000002`, uses the same password.

**Mobile app:** tap a card under *Demo accounts*; technicians are on the **Technicians** tab. Open each person in a **separate browser window** (or a private window) so you can watch both sides at once.

## Demo pairs: the same booking seen from both sides

Every booking below links a demo customer with a demo technician. Booking codes are the same after every `npm run db:reset`.

| Code | Customer | Technician | Service | State after reset | What to do in the demo |
|---|---|---|---|---|---|
| **FN-1116** | Malis Ouk | Vannak Sok | AC Repair + AC Gas Refill | **Live request** (5:00 countdown) | Vannak accepts → Malis sees *Accepted* |
| **FN-1117** | Dara Kim (Khmer) | Rithy Heng | AC Cleaning | **Live request** | Rithy accepts or declines → Dara sees the result |
| **FN-1118** | Malis Ouk | Piseth Long | Pipe Leak Repair (plumbing) | **Live request** | Piseth accepts → address unlocks for him |
| **FN-1114** | Dara Kim | Sophea Lim | Wiring Repair | **In progress** | Sophea finishes with an amount → Dara pays by QR |
| **FN-1109** | Sokha Chan | Sophea Lim | Outlet & Switch Install | **Finished, $18 due** | Sokha pays by QR → admin confirms → Sophea's earnings update |
| **FN-1113** | Sokha Chan | Vannak Sok | AC Check-up + AC Cleaning | **Accepted**, tomorrow | Shows on Sokha's Home and in Vannak's Schedule |
| **FN-1105** | Sokha Chan | Vannak Sok | AC Gas Refill | **Paid**, inside the 3-day warranty | Sokha requests warranty → Vannak sees it in Schedule |

History for the same pairs (rated jobs with reviews) also appears on both sides. Sokha and Vannak have a 5★ AC cleaning. Dara and Sophea have a breaker repair reviewed in Khmer. Sokha and Piseth have a toilet repair. Malis and Piseth have a drain unclogging.

The three live requests expire 5 minutes after a reset, as the business rule requires. Reset just before presenting, or create a new booking from the customer app.

## Accounts at a glance

| Account | Phone | Role |
|---|---|---|
| **Sokha Chan** | +85512000101 | Customer (English): payment due, upcoming visit, warranty-eligible job, AC + electrical + plumbing history |
| **Dara Kim** | +85512000102 | Customer (**Khmer UI**): job in progress, live request, Khmer reviews |
| **Malis Ouk** | +85512000103 | Customer: two live requests (AC and plumbing) |
| **Vannak Sok** | +85512000201 | Top-rated AC technician: live request, in-progress install, upcoming visit, earnings |
| **Sophea Lim** | +85512000202 | Electrician: in-progress job (Dara), payment due (Sokha), payout ticket |
| **Rithy Heng** | +85512000203 | AC + electrical: live request (Dara), upcoming job |
| **Piseth Long** | +85512000218 | **Plumber**: live request (Malis), upcoming faucet install, earnings |
| **Bopha Nuon** | +85512000204 | Technician **pending approval**: approve her in the admin dashboard |
| **Kosal Meas** | +85512000205 | Technician **suspended** |

## What the admin dashboard shows straight after a reset

- **Needs attention:** 2 technician applications, 2 payments to confirm ($50 in total), and 3 live requests counting down.
- **Charts:** 30 days of growing bookings and revenue, with a status donut (in progress, completed, expired/declined, cancelled/disputed).
- **Payments:** confirm Sokha's or David's finished job with **Confirm (demo)**, and see the refund and disputed cases.
- **Payouts:** move pending → processing → paid (a bank reference is required); one failed payout can be retried.
- **Support:** an open dispute linked to a disputed booking, and a resolved refund complaint.
- **Warranty:** open, accepted and resolved claims, each routed to the original technician.
- **Audit log:** approvals, the commission change (18% → 15%), payment confirmations, payouts, refunds and ticket updates, each with actor and time.
