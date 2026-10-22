# FixNow — competition MVP

Home-repair booking marketplace for the Sen Sok pilot (Phnom Penh Thmei & Tuek Thla): air-conditioning and electrical repairs, with plumbing and home appliances shown as "Coming soon".

Three interfaces share one backend and one database:

```
CUSTOMER MOBILE APP ─────┐
  (apps/mobile, customer role)
                         ├── BACKEND REST API (services/api) ── PostgreSQL
TECHNICIAN MOBILE APP ───┤          │
  (apps/mobile, technician role)    └── private file storage (signed URLs)
                         │
ADMIN WEB DASHBOARD ─────┘
  (apps/admin)
```

| Folder | What it is | Tech |
|---|---|---|
| `apps/mobile` | Android app: customer and technician experiences, with separate role-based navigation (Customer: Home · Bookings · Profile; Technician: Jobs · Schedule · Earnings · Profile) | React Native 0.88, Expo SDK 58, TypeScript |
| `apps/admin` | Admin web dashboard (sidebar, tables, filters, charts, detail panels) | Next.js 16, TypeScript, Tailwind CSS 4 |
| `services/api` | Shared REST API, booking state machine, auth, storage | Node 22, Express 5, TypeScript, `pg` |
| `packages/shared` | Shared types, constants, decimal-safe money maths | TypeScript |
| `database/schema` | SQL migrations | PostgreSQL |
| `database/seed` | Repeatable demo scenario | TypeScript |
| `e2e` | Browser end-to-end scripts across all three interfaces | Playwright |
| `docs/FEATURE_STATUS.md` | **What is real, simulated, or deferred** | — |

## Setup guide

### 1. Prerequisites

Install these before you start:

| Tool | Version | Needed for | Check with |
|---|---|---|---|
| [Git](https://git-scm.com/) | any recent | cloning the repo | `git --version` |
| [Node.js](https://nodejs.org/) | **22 or newer** (includes npm) | API, admin, mobile, scripts | `node -v` |
| **One** of the following for the database: | | | |
| &nbsp;&nbsp;• [Docker Desktop](https://www.docker.com/products/docker-desktop/) | any recent | PostgreSQL 16 in a container (easiest) | `docker --version` |
| &nbsp;&nbsp;• [PostgreSQL](https://www.postgresql.org/download/) | 14 or newer | a local cluster managed by `scripts/local-db.mjs` | `psql --version` |
| [Expo Go](https://expo.dev/go) app (Android) | must support **Expo SDK 58** | running the mobile app on a phone (optional: you can use the browser instead) | — |

Ports used: **4000** (API), **3000** (admin), **8081** (Expo / mobile web), **5440** (PostgreSQL). Make sure nothing else is using them.

### 2. Clone and install

```bash
git clone https://github.com/<your-username>/fixnow.git
cd fixnow
npm run install:all          # installs services/api, apps/admin, apps/mobile and e2e
```

There is no root `node_modules`; each part has its own dependencies. `packages/shared` is linked automatically and needs no build step.

### 3. Start the database

Pick **one** option (both listen on port 5440 and create the `fixnow` and `fixnow_test` databases, so don't run both).

**Option A: Docker (recommended)**
```bash
docker compose up -d         # stop later with: docker compose down
```

**Option B: local PostgreSQL install**
```bash
npm run db:init              # first time only: creates a cluster in database/.pgdata and starts it
npm run db:start             # on later days / after a reboot
npm run db:stop              # when you're done
```
The script auto-detects PostgreSQL in `C:/Program Files/PostgreSQL/<version>/bin` (Windows) or the usual Linux/macOS paths. If it can't find it, set `PG_BIN` to your PostgreSQL `bin` folder, for example:
```bash
# macOS/Linux
PG_BIN=/usr/lib/postgresql/16/bin npm run db:init
# Windows PowerShell
$env:PG_BIN="C:/Program Files/PostgreSQL/16/bin"; npm run db:init
```

### 4. Create the environment files

Copy each example file to `.env` (these are git-ignored; never commit them):

```bash
cp services/api/.env.example services/api/.env
cp apps/admin/.env.example   apps/admin/.env.local
cp apps/mobile/.env.example  apps/mobile/.env
```

Then edit `services/api/.env` and set `JWT_SECRET` to any long random string. To generate one:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The defaults work out of the box for local development:

| File | Variable | Default | Notes |
|---|---|---|---|
| `services/api/.env` | `PORT` | `4000` | API port |
| | `DATABASE_URL` | `postgres://fixnow@localhost:5440/fixnow` | matches both database options |
| | `JWT_SECRET` | — | **set this**; required when `NODE_ENV=production` |
| | `DEMO_MODE` | `true` | demo sign-in and on-screen OTP, no SMS. Use `false` in production |
| | `CORS_ORIGINS` | `*` | comma-separated list of allowed origins |
| | `STORAGE_DIR` | `./storage` | where private uploads are stored |
| `apps/admin/.env.local` | `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | where the admin dashboard finds the API |
| `apps/mobile/.env` | `EXPO_PUBLIC_API_URL` | *(empty)* | leave empty for a phone on the same Wi-Fi; use `http://10.0.2.2:4000` for the Android emulator |

### 5. Create tables and load demo data

```bash
npm run db:reset             # runs the migrations in database/schema and loads the demo dataset
```
It is safe to run again at any time; it wipes and reloads the demo data.

### 6. Run the apps

Open **three terminals** in the project folder:

| Terminal | Command | Open |
|---|---|---|
| 1. Backend API | `npm run api` | http://localhost:4000/api/health should return OK |
| 2. Admin dashboard | `npm run admin` (or `npm run admin:prod` for a production build) | http://localhost:3000 |
| 3. Mobile app | `npm run mobile` (phone) or `npm run mobile:web` (browser) | scan the QR code with Expo Go, or open http://localhost:8081 |

Admin login: **+85512000001 / FixNowAdmin#2026** (demo account). In the mobile app, tap any card under *Demo accounts* to sign in as a customer or technician.

**Using a real Android phone:** the phone and computer must be on the same Wi-Fi, and your firewall must allow incoming connections on port 4000 (and 8081 for Expo). The app finds the API through the computer's LAN IP automatically.

**Installable APK:** `npx eas-cli build -p android --profile preview` (needs a free Expo account; not done yet).

### 7. Check everything works (optional)

```bash
npm run typecheck            # TypeScript checks for api, mobile and admin
npm run test:api             # API integration tests (uses the fixnow_test database)

npx --prefix e2e playwright install chromium   # first time only: downloads the browser
npm run test:e2e             # full booking flow; needs the API, admin and mobile web running
```

### Troubleshooting

| Problem | Fix |
|---|---|
| `PostgreSQL binaries not found` | Set `PG_BIN` (see step 3) or use Docker instead. |
| `ECONNREFUSED 127.0.0.1:5440` | The database isn't running: `docker compose up -d` or `npm run db:start`. |
| Port 5440 / 4000 / 3000 / 8081 already in use | Stop the other program, or change the port (`PORT` in the API `.env`; update `DATABASE_URL` / `NEXT_PUBLIC_API_URL` to match). |
| `[config] JWT_SECRET not set` warning | You didn't create `services/api/.env` or left `JWT_SECRET` empty. |
| Phone shows a network error | Same Wi-Fi? Firewall allows port 4000? Otherwise set `EXPO_PUBLIC_API_URL=http://<your-computer-LAN-IP>:4000` in `apps/mobile/.env` and restart `npm run mobile`. |
| Expo Go says the project is incompatible | Update Expo Go from the Play Store; it must support SDK 58. |
| Live 5-minute requests have expired in the demo | Run `npm run db:reset` again just before presenting. |
| Playwright says the browser is missing | `npx --prefix e2e playwright install chromium` |

## Demo accounts and data (DEMO_MODE=true)

`npm run db:reset` loads a small, focused demo dataset:
- 21 services (AC and electrical bookable; plumbing and home appliances coming soon).
- 3 customers and 3 technicians (2 approved, 1 pending approval).
- 43 bookings in every status, including 3 live 5-minute requests.
- Payments, payouts, ratings, a warranty claim, support tickets, notifications and an audit trail.

**Reset just before presenting** so the live countdowns are running.

| Role | Name | Phone | Use it to show |
|---|---|---|---|
| Admin | Sreyneang (Ops) | +85512000001 / FixNowAdmin#2026 | Admin dashboard |
| Admin | Visal (Finance) | +85512000002 / FixNowAdmin#2026 | Second admin in the audit log |
| Customer | Sokha Chan | +85512000101 | Upcoming job, payment due, warranty-eligible job |
| Customer | Dara Kim | +85512000102 | Khmer UI, job in progress |
| Customer | Malis Ouk | +85512000103 | Live requests, job in progress, rated history |
| Technician | Vannak Sok | +85512000201 | AC: live requests, in-progress job, earnings |
| Technician | Sophea Lim | +85512000202 | Electrician: live request, awaiting customer payment |
| Technician | Bopha Nuon | +85512000204 | **Pending** — approve her live in the demo |

In the app, tap a card under *Demo accounts*; technicians are on the **Technicians** tab. No SMS is sent. Full details are in [`docs/DEMO_DATA.md`](docs/DEMO_DATA.md).

## Competition demo script (one booking through all three interfaces)

1. **Admin** → Technician approvals → review Bopha Nuon (ID/certificate shown via signed links) → Approve.
2. **Customer** (Sokha) → Air Conditioning → AC Repair → Bopha Nuon → describe the problem → Send request. The 5:00 countdown starts (server deadline).
3. **Technician** (Bopha) → Jobs: the request shows only the area. Accept → the exact address and customer name appear, plus Navigate. Start job → Finish with $25 (shows $3.75 commission / $21.25 net).
4. **Customer** → status updates to Finished → Pay with QR (DEMO QR for exactly $25.00).
5. **Admin** → Payments → Confirm (demo). Audited; payout record created.
6. **Customer** → Payment confirmed → rate 5★. **Technician** → Earnings shows the split.
7. **Admin** → Bookings → open the booking: same record, payment, timeline and audit trail.
8. Toggle Khmer in the app (and ខ្មែរ in the admin top bar); a customer token calling an admin API gets 403.

Throughout, the 🔔 bell in each app shows notifications for every step (new request, accepted, finished, payment confirmed, rating), without phone numbers or addresses.

`npm run test:e2e` runs exactly this flow automatically and saves screenshots to `e2e/screenshots/`.

## Key rules (how they are enforced)

- **5-minute response window**: `response_deadline_at = now() + 300 s` set by the database. Accept/decline use a single conditional `UPDATE … WHERE status='REQUESTED' AND response_deadline_at > now()`, so accept-after-expiry and double-accept are impossible. Expiry runs as a 5-second background sweep and on every read/action. The client countdown is display-only.
- **Privacy**: phone numbers are never returned to customers or technicians. The technician DTO hides customer name, address and coordinates until ACCEPTED. Admin sees masked phones, and revealing one is audited. ID/certificate files are private and served only through 15-minute HMAC-signed URLs issued after an admin check.
- **Payment integrity**: the QR exists only after FINISHED. Only an admin can confirm (demo), refund, or change payouts, and every change is audited. Money is computed in integer cents, and the commission rate is snapshotted per payment.

## Known limitations

See [`docs/FEATURE_STATUS.md`](docs/FEATURE_STATUS.md). In short: payments and SMS are **simulated**; remote push is replaced by an in-app notification feed plus local Android notifications. The mobile app has been verified in a browser and as a compiled Android bundle, **but not yet on a physical Android device**. The Khmer translations need native-speaker review.
