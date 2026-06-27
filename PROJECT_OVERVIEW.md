# Accident Angels — Platform Overview

_Scholar transport compliance & operations platform for the Alliance transport association._
_Last updated: 2026-06-26_

---

## 1. What this is

A single codebase serving **three apps** that digitise scholar-transport operations: driver compliance, parent booking & visibility, trip running, payments (dormant), safety reporting, waiting-time billing, and driver ratings.

Built after a January 2026 fatal scholar-transport accident led Gauteng to mandate electronic compliance. Pitched to the Alliance association (40 members) → pilot agreed.

| App | Who | Purpose |
|-----|-----|---------|
| **Angels Driver** | Drivers | Compliance docs, trips, route map, waiting charges, ratings received |
| **Angels Parent** | Parents | Pick/rate driver, track trips, view charges, report concerns |
| **Admin Portal** | Association admin | Verify compliance, review reports, settings — **no payment amounts** |

---

## 2. Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router) + React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Supabase (PostgreSQL) — accessed via service-role client |
| Auth | Custom OTP (SMS) → JWT session cookie (`jose`), `bcryptjs` for OTP hashing |
| Maps | Leaflet + OpenStreetMap tiles + OSRM routing |
| SMS | Africa's Talking (currently sandbox/stub) |
| Payments | Paystack + DebiCheck + Capitec VRP (built, **dormant** behind `PAYMENTS_LIVE`) |
| Email | Resend |
| Hosting | Vercel |
| Tests | Vitest (unit), Playwright (browser) |

---

## 3. Architecture

### Subdomain routing (`proxy.ts`)
The same deployment serves all three apps; the host header rewrites the path:

```
driver.accidentangels.co.za   →  /driver-app/*
parent.accidentangels.co.za   →  /parent-app/*
admin.accidentangels.co.za    →  /admin/*
(localhost / preview)         →  NEXT_PUBLIC_LOCAL_APP (default: driver)
```

Live now at **https://accident-angels.vercel.app** (use `/driver-app`, `/parent-app`, `/admin` paths until custom domains are wired).

### Request flow
```
Browser ──▶ proxy.ts (host→path rewrite)
         ──▶ Page (server component): getSession(cookie) → role guard
         ──▶ API route: getSession → role check → Supabase service-role query
         ──▶ Supabase (RLS exists as anon-key backstop; server bypasses via service role)
```

### Security model
- **Auth:** OTP via SMS → signed JWT in an httpOnly cookie. Role (`DRIVER`/`PARENT`/`ADMIN`) is in the token.
- **Access control:** enforced at the **API-route layer** (service-role bypasses RLS). RLS policies in `scripts/rls-policies.sql` protect against direct anon-key access.
- **Privacy (enforced):** admin never sees payment amounts/bank details; parents see only their own child; drivers see only their own data + their parents' payment status.
- **Payment gate:** `PAYMENTS_LIVE` (a DB config in `PlatformConfig`, read via `lib/config.ts`) — **currently `false`**. No real charges fire until switched on.

---

## 4. Data model (15 tables)

| Table | Purpose |
|-------|---------|
| `User` | Identity (phone, role, name) |
| `OtpToken` | One-time login codes |
| `Driver` | Vehicle, compliance status, **ratingAvg/ratingCount** |
| `Parent` | Parent profile, payment-setup status |
| `Child` | Pickup/dropoff address + coords, assigned driver |
| `Association` | The transport association |
| `ComplianceDocument` | 6 mandatory doc types per driver, expiry tracking |
| `Contract` | Parent↔driver transport agreement |
| `Transaction` | Monthly fee billing records (dormant) |
| `Payout` | Driver payouts (dormant) |
| `PlatformConfig` | Feature flags incl. `PAYMENTS_LIVE` |
| `Trip` / `TripStop` | Generated daily trips + per-child stops (**arrivedAt, waitingChargeCents**) |
| `Notification` | In-app notifications (driver + parent bells) |
| `Report` | Parent safety reports on drivers/vehicles |
| `WaitingCharge` | **Waiting-time billing ledger** |
| `DriverRating` | **Parent ratings of drivers** |

_(SQL lives in `scripts/`; consolidated Phase 3–5 migration = `scripts/MIGRATE-phase3-5.sql`.)_

---

## 5. What's been built

### ✅ Foundation (Phases 1–2)
| Feature | Notes |
|---------|-------|
| OTP auth + 3-app routing | Login verified end-to-end |
| Compliance docs | 6 mandatory types, upload to Supabase Storage, admin review, expiry cron (30/14/7/1-day alerts) |
| Children & scheduling | Add child, schedules, overrides, geocoding |
| Trip generation | Auto-generates daily trips + route optimisation (nearest-neighbour) |
| Trip running | Start, mark stops complete/missed, live Leaflet navigation + GPS + OSRM |
| Privacy controls | Role-scoped data; admin payment-blind; driver-switch lock on unpaid balance |
| Notifications | In-app bell (driver + parent) + SMS stubs |
| Parent safety reporting | Report unsafe vehicle/driver → admin; driver notified a report was filed (not content) |
| Payments infra | Paystack/DebiCheck/Capitec built but **dormant** |

### ✅ Phase 3 — Waiting Time Charges _(shipped 2026-06-26)_
- Driver taps **Arrived** (two-stage: Arrived → Confirm pickup)
- **3-minute free grace**, then **R5/min** (rounded up per minute)
- Accrues to `WaitingCharge` ledger; gated by `PAYMENTS_LIVE`
- Parent arrival notification (in-app + SMS); missed-stop notify + reroute
- Live waiting timer + running cost on the driver's screen
- Parent charges page + dashboard callout

### ✅ Phase 4 — Route Map paid/unpaid _(shipped 2026-06-26)_
- **Green = paid, red = overdue** markers on the driver's route map
- "X paying · Y overdue" summary chips
- Driver-only — payment status stripped from parent/admin views
- Driver decides who to skip (no auto-stranding of children — safety)

### ✅ Phase 5 — Ratings + Recommendation _(shipped 2026-06-26)_
- Parents rate their driver **Google-style (x/5 + comment)**
- Driver can **hide a comment's text, never the score**
- Anonymised public reviews on the driver page
- **Recommendation engine** ranks eligible drivers (ACTIVE + 6 docs + capacity) by `0.6·proximity + 0.4·rating`; proximity from the driver's children pickup centroid
- Driver "My Ratings" page

### Quality
- 34 unit tests passing · production build clean (93 routes) · full E2E run · deployed & smoke-tested live.

---

## 6. What's remaining

### Deferred (not in the stakeholder's confirmed scope yet)
| Item | Phase | Notes |
|------|-------|-------|
| Admin route-overlap view | P4-B | Zone overlaps for collective fuel/insurance bargaining |
| "Driver of the Month" | P5-B | Admin nomination + badge + testimonials |
| Per-child levy system | Phase 6 | R1–10/child/month to association; monthly invoicing (needs Paystack split payments) |
| Dress-code monitoring | Pitch ask | Not started |

### Operational blockers before pilot go-live
| Item | Status |
|------|--------|
| Africa's Talking SMS credentials | ⏳ Sandbox — OTP shows on screen for now |
| Paystack live keys | ⏳ Needed before `PAYMENTS_LIVE=true` |
| Resend (email) key | ⏳ |
| Custom subdomains (driver./parent./admin.) | ⏳ Point DNS to Vercel |
| Trevor's "day in the life" shadowing | ⏳ Informs future GPS-based waiting detection |
| 3–5 pilot driver accounts + association admin | ⏳ |

### Known follow-ups
- **GPS waiting detection** — v1 uses a manual Arrived button; stakeholder wants auto-start when the vehicle is stationary (deferred until shadowing).
- **Timezone:** all DB timestamp comparisons must use `lib/dates.ts` `toUtcDate()` (Supabase returns timestamps without `Z`).

---

## 7. Repository map

```
app/
  driver-app/     Driver PWA (dashboard, trips, compliance, ratings, profile)
  parent-app/     Parent PWA (driver pick, trips, charges, report, children)
  admin/          Admin portal (drivers, reports, settings)
  api/            ~45 route handlers (auth, trips, ratings, waiting-charges, …)
components/
  trips/          TripMap, ActiveTripNavigation (Leaflet)
  ratings/        StarRating, RateDriverPanel, HideCommentToggle
  driver/ parent/ shared/   Top bars, nav, NotificationBell, BackButton
lib/
  auth.ts         OTP + JWT sessions
  supabase.ts     Service-role client
  config.ts       PAYMENTS_LIVE / PlatformConfig reads
  dates.ts        UTC-safe timestamp parsing
  geo.ts          Haversine + centroid
  trips/          generate, optimize, eta, waiting-charge
  payments/       balance-check, overdue-parents
  drivers/        recommend (ranking engine)
  sms/            Africa's Talking
scripts/          *.sql schema + RLS (run in Supabase SQL Editor)
prisma/           schema.prisma (documentation only — runtime uses Supabase client)
```

---

## 8. Running & deploying

```bash
npm run dev            # localhost:3000 (driver app by default)
npm run dev:parent     # parent app
npm run dev:admin      # admin portal
npm run test           # vitest unit tests
npm run build          # production build
vercel --prod --yes    # deploy to production
```

**DB migrations:** there is no automated migration runner — paste the relevant `scripts/*.sql` into the **Supabase SQL Editor** and run. Latest = `scripts/MIGRATE-phase3-5.sql` (already applied).

**Test login (dev):** OTP is shown on screen (and in dev logs). Sample accounts:
- Driver (ACTIVE): `+27711234567`
- Parent: `+27831111111`
- Admin: `+27000000000`

---

## 9. Status at a glance

| Area | State |
|------|-------|
| Auth & 3-app routing | ✅ Live |
| Compliance + expiry alerts | ✅ Live |
| Trips + navigation | ✅ Live |
| Privacy controls | ✅ Live |
| Safety reporting | ✅ Live |
| Waiting-time charges (P3) | ✅ Live (dormant billing) |
| Route paid/unpaid map (P4) | ✅ Live |
| Ratings + recommendation (P5) | ✅ Live |
| Per-child levy (P6) | ⛔ Not started |
| Real SMS / payments | ⏳ Awaiting credentials |
| Pilot onboarding | ⏳ Pending |
