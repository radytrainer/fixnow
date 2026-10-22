# FixNow demo data guide

Load or restore the demo at any time:

```bash
npm run db:reset
```

The data uses a fixed random seed, so it is the same every time. All dates are relative to the moment you reset, so charts, countdowns and the 3-day warranty window always look current.

**Reset shortly before presenting.** The 3 live requests start with 4:30–4:50 left on their 5-minute countdowns. They expire automatically afterwards, as the business rule requires.

All payments are **DEMO (simulated)**. No real money is involved.

## What's in it

The dataset is deliberately small: 3 customers and 3 technicians, so every name on screen is one of the demo accounts below.

| Area | Data |
|---|---|
| Services | 4 categories, 21 services (13 bookable). Air Conditioning has 6 (cleaning, repair, gas refill, installation, check-up, relocation). Electrical has 7 (wiring, outlets, breakers, lighting, ceiling fans, water-heater wiring, safety inspection). Plumbing (5) and Home Appliances (3) are **Coming soon** |
| Customers | 3 in Sen Sok (Phnom Penh Thmei and Tuek Thla), English and Khmer speakers, with home addresses and GPS pins |
| Technicians | 3: **2 approved** (Vannak for AC, Sophea for electrical plus AC cleaning/repair) and **1 pending** (Bopha) |
| Bookings | 43 over 30 days, in every status: live requests, accepted, in progress, finished (awaiting payment), paid, rated, closed, expired, cancelled, disputed, refunded |
| Money | ~$870 gross paid, 15% commission (about $130). Payouts in every state: paid with ABA references, processing, pending, and failed |
| Ratings | 20 reviews in English and Khmer; Vannak averages 4.8★, Sophea 4.4★ |
| Care | 1 open warranty claim, 7 support tickets (open, in review, resolved, closed), including a dispute and a refund |
| Activity | ~50 notifications (some unread in each demo account) and ~90 audit-log entries by 2 admins (Ops and Finance) |

## Sign-in accounts

**Admin dashboard** (http://localhost:3000): `+85512000001` / `FixNowAdmin#2026` (Ops). A finance admin, `+85512000002`, uses the same password.

**Mobile app:** tap a card under *Demo accounts*; technicians are on the **Technicians** tab. Open each person in a **separate browser window** (or a private window) so you can watch both sides at once.

| Account | Phone | Role |
|---|---|---|
| **Sokha Chan** | +85512000101 | Customer (English): payment due, upcoming visit, warranty-eligible job, AC + electrical history |
| **Dara Kim** | +85512000102 | Customer (**Khmer UI**): job in progress, live request, open warranty claim, Khmer reviews |
| **Malis Ouk** | +85512000103 | Customer: two live requests (AC and electrical), AC install in progress, upcoming lighting job |
| **Vannak Sok** | +85512000201 | Top-rated AC technician: live requests, in-progress install, upcoming visit, earnings |
| **Sophea Lim** | +85512000202 | Electrician (also AC cleaning/repair): live request, in-progress job (Dara), payment due (Sokha), payout ticket |
| **Bopha Nuon** | +85512000204 | Technician **pending approval**: approve her in the admin dashboard |

## Demo pairs: the same booking seen from both sides

Every booking links a demo customer with a demo technician. Booking codes are the same after every `npm run db:reset`.

| Code | Customer | Technician | Service | State after reset | What to do in the demo |
|---|---|---|---|---|---|
| **FN-1041** | Malis Ouk | Vannak Sok | AC Repair + AC Gas Refill | **Live request** (5:00 countdown) | Vannak accepts → Malis sees *Accepted* |
| **FN-1042** | Dara Kim (Khmer) | Vannak Sok | AC Cleaning | **Live request** | Vannak accepts or declines → Dara sees the result |
| **FN-1043** | Malis Ouk | Sophea Lim | Outlet & Switch Install | **Live request** | Sophea accepts → address unlocks for her |
| **FN-1040** | Dara Kim | Sophea Lim | Wiring Repair | **In progress** | Sophea finishes with an amount → Dara pays by QR |
| **FN-1038** | Malis Ouk | Vannak Sok | AC Installation | **In progress** | Vannak finishes with an amount → Malis pays by QR |
| **FN-1036** | Sokha Chan | Sophea Lim | Outlet & Switch Install | **Finished, $18 due** | Sokha pays by QR → admin confirms → Sophea's earnings update |
| **FN-1039** | Sokha Chan | Vannak Sok | AC Check-up + AC Cleaning | **Accepted**, tomorrow | Shows on Sokha's Home and in Vannak's Schedule |
| **FN-1037** | Malis Ouk | Sophea Lim | Lighting Installation | **Accepted**, tomorrow | Shows on Malis's Home and in Sophea's Schedule |
| **FN-1034** | Sokha Chan | Vannak Sok | AC Gas Refill | **Paid**, inside the 3-day warranty | Sokha requests warranty → Vannak sees it in Schedule |
| **FN-1035** | Dara Kim | Vannak Sok | AC Cleaning | **Paid**, warranty claim open | Vannak responds to the claim |

Rated history for the same pairs also appears on both sides, for example Sokha and Vannak's 5★ AC cleaning, and Dara and Sophea's breaker repair reviewed in Khmer.

The three live requests expire 5 minutes after a reset, as the business rule requires. Reset just before presenting, or create a new booking from the customer app.

## What the admin dashboard shows straight after a reset

- **Needs attention:** 1 technician application (Bopha), 1 payment to confirm ($18), and 3 live requests counting down.
- **Charts:** 30 days of bookings and revenue, with a status donut (in progress, completed, expired/declined, cancelled/disputed).
- **Payments:** confirm Sokha's finished job with **Confirm (demo)**, and see the refund and disputed cases.
- **Payouts:** move pending → processing → paid (a bank reference is required); failed payouts can be retried.
- **Support:** an open dispute linked to a disputed booking, and a resolved refund complaint.
- **Warranty:** Dara's open claim, routed to Vannak, the original technician.
- **Audit log:** approvals, the commission change (18% → 15%), payment confirmations, payouts, refunds and ticket updates, each with actor and time.
