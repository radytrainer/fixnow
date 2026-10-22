# FixNow — feature status checklist

Legend: ✅ implemented and tested · 🟡 implemented, simulated (demo stand-in for an external provider) · ⚠️ implemented, not verified on the target platform · ❌ not implemented / deferred

"Tested" means covered by `services/api/test/api.test.ts` (API integration, real PostgreSQL) and/or the browser E2E scripts `e2e/flow.mjs` + `e2e/flow2.mjs` (mobile app rendered via Expo web + admin dashboard, real API and DB).

Last full run: 2026-10-18 (milestone 2) — API tests 29/29 pass; `flow.mjs` pass; `flow2.mjs` pass; `expo export --platform android` bundle compiles; `next build` passes; all three apps typecheck.

## P0 — must work

| Requirement | Status | Evidence / notes |
|---|---|---|
| FR-01 Demo sign-in (seeded accounts) | ✅ | E2E flow; API test |
| FR-01 Phone + OTP sign-in | 🟡 | Real OTP generation, hashing, expiry, attempt limits, rate limit. **SMS is not sent**: in DEMO_MODE the code is shown on screen labelled "DEMO". E2E flow2 |
| FR-02 Server-side role checks; no self-granted admin/approved role | ✅ | API tests (403s, OTP cannot create ADMIN, PATCH /me rejects role) |
| One role per phone number | ✅ | `users.phone_e164` UNIQUE + single `role` column |
| FR-03 Technician onboarding → PENDING; admin approve/reject/suspend/reinstate | ✅ | E2E flow2 (sign-up, ID upload, reject with reason, resubmit, approve, app unlocks) |
| FR-04 Customer profile + home location; per-booking service location | ✅ | **Areas across Cambodia:** 45 areas (6 Sen Sok sangkats incl. the 2 pilot ones, 13 other Phnom Penh khans, 24 provinces) in a searchable picker for home, booking and technician service area; customers only see technicians within 30 km (API tests + browser check). Coordinates are approximate centres. API test; booking form (area chips, address, GPS pin) |
| FR-05 Service catalogue; AC + Electrical active, Plumbing + Appliances "Coming soon" | ✅ | API test (coming-soon booking → 409); admin can edit prices/status |
| FR-06 Technician discovery (approved only, rating, experience, area, distance, no phone) | ✅ | API test (pending hidden, no phone regex in payload) |
| FR-07 Booking request (service, technician, description, photo/video, time, location) | ✅ | **Multi-service:** one visit can include up to 5 services (e.g. AC Cleaning + Gas Refill); only technicians offering all of them are listed; estimate and final-amount limits are the summed ranges (API tests + E2E). E2E flow (photo upload tested in flow2 via onboarding; same upload path) |
| FR-08 Server-enforced 5-minute deadline; accept/decline only before expiry; EXPIRED → choose another | ✅ | API tests (deadline = created+300 s, accept-after-deadline 409, 5 concurrent accepts → exactly 1 wins); E2E flow2 (expired → rebook) |
| FR-09 Address/name hidden until accept; no private data in notifications | ✅ | API test + E2E check (address absent before accept, present after). No push payloads exist |
| FR-10 Job progress (start) + mark FINISHED + completion photos | ✅ | E2E flow; API test |
| FR-11 Booking-linked QR, payable only after FINISHED | 🟡 | Real unique QR payload + PNG with exact amount and booking ref. **Not a real KHQR** — mock payload `FIXNOW-DEMO-QR|ref=…|amt=…` |
| FR-11 Payment confirmation as separate admin action, labelled simulated | 🟡 | Admin "Confirm (demo)" → audited; `is_demo=true`; DEMO label on mobile + admin |
| FR-12 Commission (default 15%, admin-configurable, snapshotted per payment) | ✅ | API tests ($25 → $3.75 / $21.25; rate change applies to new payments only) |
| FR-13 Rating only by booking customer after payment; no duplicates | ✅ | API tests; E2E flow |
| FR-15 Admin: approvals, bookings filter/detail, services, demo payment, refund, dispute, payouts, audit | ✅ | E2E flow + API tests |
| FR-17 Language switch EN/KM; Plus Jakarta Sans + Noto Sans Khmer | ✅ | E2E flow (Khmer home screenshot). **Khmer text is machine-assisted; needs native review** |
| FR-18 Admin reports (users, bookings by status, gross/commission/net) | ✅ | API test; overview + reports pages |
| NFR-03 Atomic conditional updates for accept/expire | ✅ | Concurrency test |
| NFR-04 No customer self-confirm | ✅ | API test (customer → 403) |
| NFR-05 Loading/empty/error/retry states; seed/reset script | ✅ | `npm run db:reset`; every screen has loading/error/empty states |
| NFR-08 Audit log (approval, payment, refund, commission, payout, services, tickets, phone reveal) | ✅ | API tests; admin audit page |
| NFR-10 No hard-coded mobile UI text (translation keys) | ✅ | `apps/mobile/src/i18n/{en,km}.ts` |
| Seed data / repeatable demo | ✅ | `database/seed/demo-seed.ts` |

## P1 — if time allows

| Requirement | Status | Notes |
|---|---|---|
| Photo/video upload to private storage with signed URLs | ✅ | Local private folder + 15-min HMAC-signed links; tampered link → 403. Video upload + booking with video, type/size/role limits covered by API tests. Picking a real video from an Android gallery not yet verified on device ⚠️ |
| Photo compression for low-cost Android (NFR-06) | ⚠️ | Photos downscaled to ≤1280 px, JPEG 60% via expo-image-manipulator before upload (falls back to picker output). Compiles; not measured on a device |
| Notifications | ✅ / 🟡 | **In-app notification feed is real**: server creates notifications on every state change (request, accept, decline, expiry, start, finish, payment, refund, payout, rating, warranty, approval, tickets, disputes); bell with unread badge, inbox, mark-read, tap-to-open booking, pop-up toast — API tests + E2E. Params never contain phone, name or exact address (API test). On Android the app also raises a **local** system notification while running (expo-notifications; not verified on device ⚠️). **Remote push (FCM) is not integrated** — needs a Firebase project + development build |
| Booking history + receipts | ✅ | Customer Bookings tab (Active/History), receipt card after payment |
| Payout records | ✅ | Admin payouts ledger (PENDING→PROCESSING→PAID/FAILED, reference required to mark paid); technician payout history. Record-only — no money moves |
| Support / dispute tickets | ✅ | Mobile support screen (both roles), admin support page, admin can mark booking DISPUTED |
| 3-day warranty request routed to same technician | ✅ | API tests (in-window OK, after 3 days 409, only assigned technician sees it). Decision: 3 days (not 30) |
| CSV export | ✅ | Bookings + payments CSV (formula-injection safe) |
| Technician availability toggle | ✅ | Unavailable technicians are hidden from discovery |
| Navigation handoff to maps | ⚠️ | Opens Google Maps directions URL; not verified on a physical Android device |
| Map display | ✅ | Admin booking panel embeds an OpenStreetMap map with the pin (E2E verifies tiles load); customer can open their location in Maps |
| Technician profile editing (bio, public photo) | ✅ | API test (photo appears on public profile). ID/certificates stay locked after approval |
| Offline / slow network handling (NFR-05) | ✅ | Offline banner (NetInfo), every screen keeps last data and retries; polling resumes automatically |
| Auth brute-force protection (NFR-01) | ✅ | Rate limits: admin login 10/15 min per IP+phone, OTP verify 20/15 min, OTP request 30/h, demo login 60/min; security headers (API tests) |
| Admin list pagination (NFR-06) | ✅ | Technicians, customers, payments (+ booking-code search), payouts (server totals), support tickets, bookings, audit log (API test) |

## Deferred / not implemented (P2 or out of scope)

| Item | Status |
|---|---|
| Real KHQR gateway, verified webhooks, auto-confirmation | ❌ `/api/payments/webhook/:provider` returns 501 by design |
| Real money holding / escrow | ❌ Ledger records only |
| Real SMS OTP provider | ❌ (demo code shown on screen) |
| Firebase remote push notifications | ❌ In-app feed + local notifications instead |
| Interactive map pin picker (drag a pin) | ❌ Area chips + address text + "use current GPS location" instead (spec allows map link / location pin) |
| Google Play release / signed APK | ❌ Not built in this environment (no Android SDK). Use `eas build -p android --profile preview` |
| Admin UI in Khmer | 🟡 Partial: EN/ខ្មែរ switch translates navigation, page titles, buttons, filters, table headers, statuses and cards (E2E). Dynamic sentences with numbers (e.g. "6 paid jobs") and some page descriptions remain English |
| Cancellation fees, deposit, customer-not-available visit fee | ❌ No policy defined; basic cancel only, no fees |
| Dark mode | ❌ Light theme only |
| Production hosting, monitoring, compliance review | ❌ |

## Environment limitations encountered

- **No Android SDK/emulator/adb on the build machine.** The mobile app was tested through Expo's web target in Chromium (phone-sized viewport) and its Android Hermes bundle was compiled with `expo export --platform android`. It has **not** been run on a physical Android device yet — do this before the competition (Expo Go or a development build).
- Existing PostgreSQL services on the machine required unknown credentials, so a project-local cluster (`database/.pgdata`, port 5440, trust auth on localhost) is used.
