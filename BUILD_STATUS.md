# Accident Angels — Build Status

> Last updated: 2026-04-27
> Stack: Next.js 16 · TypeScript · Prisma · Supabase · Tailwind · shadcn/ui

---

## ✅ Done

### Foundation
- [x] Prisma schema — all models (User, Driver, Parent, Child, Contract, Transaction, ComplianceDocument, Association, Payout, PlatformConfig, OtpToken)
- [x] `proxy.ts` — subdomain routing (driver / parent / admin), API routes excluded (renamed from deprecated `middleware.ts` for Next.js 16)
- [x] Global CSS + design system tokens (AA brand colours, status utilities)
- [x] `app/layout.tsx` — Geist font, viewport, PWA meta, Sonner toaster
- [x] `app/page.tsx` — redirects to /login
- [x] `.env.local` template with all required vars documented
- [x] `vercel.json` — cron schedules (check-expiry daily 06:00, billing 1st of month 05:00)

### Lib / utilities
- [x] `lib/auth.ts` — OTP create/verify, JWT session, parent signing token
- [x] `lib/db.ts` — Prisma singleton
- [x] `lib/sms/africas-talking.ts` — sendSms, all SMS templates
- [x] `lib/storage/supabase.ts` — presigned upload URLs, public URLs, path helpers
- [x] `lib/pdf/contract-generator.ts` — @react-pdf/renderer, fully styled PDF
- [x] `lib/payments/types.ts` — PaymentProvider interface
- [x] `lib/payments/index.ts` — provider factory
- [x] `lib/payments/providers/paystack-card.ts` — card tokenisation + charging
- [x] `lib/payments/providers/debicheck.ts` — stub (DEBICHECK_ENABLED=false)
- [x] `lib/payments/providers/capitec-pay-vrp.ts` — stub (CAPITEC_VRP_ENABLED=false)
- [x] `lib/payments/retry.ts` — configurable retry scheduling (RETRY_DAY_1, RETRY_DAY_2)
- [x] `lib/utils/validators.ts` — SA phone validation, SA ID Luhn check, Zod schemas
- [x] `lib/utils/formatters.ts` — date/phone formatters, expiry colour helper
- [x] `lib/utils/cents.ts` — ZAR formatting

### Driver PWA (`app/driver-app/`)
- [x] Login page — phone entry, calls /api/auth/send-otp
- [x] Verify page — OTP entry, auto-submits, calls /api/auth/verify-otp
- [x] Onboarding page — 4-step wizard (details / vehicle / association / banking)
- [x] Dashboard — compliance banner, children list
- [x] Compliance list page
- [x] Compliance doc upload page — camera/file, presigned upload, date fields
- [x] Children list page
- [x] Add child page — 4-step wizard, sends parent invite SMS
- [x] Child detail page
- [x] Contracts list page
- [x] Contract detail page — OTP-based signing, sends parent signing link
- [x] Payments page — banking preview, earnings estimate
- [x] Profile page
- [x] `(driver-app)/layout.tsx` — bottom nav

### Parent PWA (`app/parent-app/`)
- [x] Login page
- [x] Verify page
- [x] Dashboard — children, contracts summary
- [x] Sign contract page — token-gated, multi-step (cover → review → agree → sign → done)
- [x] Payments page — method picker (Paystack card / DebiCheck / Capitec VRP)
- [x] Driver profile page
- [x] Tracking page (placeholder — Phase 2)
- [x] `(parent-app)/layout.tsx` — bottom nav

### Admin portal (`app/admin/`)
- [x] Dashboard — stats, recent drivers table
- [x] Drivers list — search, status filter, doc count
- [x] Driver detail — all 6 compliance docs, approve/reject with notes
- [x] Settings — PAYMENTS_LIVE toggle, fee config, retry days
- [x] `(admin)/layout.tsx` — sidebar nav

### API routes (`app/api/`)
- [x] `POST /api/auth/send-otp`
- [x] `POST /api/auth/verify-otp`
- [x] `GET  /api/associations`
- [x] `POST /api/driver/onboard`
- [x] `POST /api/compliance/upload-url`
- [x] `POST /api/compliance/[docId]/save`
- [x] `GET  /api/contracts/[contractId]`
- [x] `GET  /api/contracts/sign-info/[token]`
- [x] `POST /api/contracts/sign`
- [x] `POST /api/children`
- [x] `POST /api/payments/setup`
- [x] `GET  /api/payments/callback`
- [x] `POST /api/payments/webhook`
- [x] `GET  /api/admin/compliance`
- [x] `POST /api/admin/compliance/[docId]/review`
- [x] `GET  /api/admin/drivers/[driverId]`
- [x] `GET  /api/admin/config`
- [x] `POST /api/admin/config`
- [x] `POST /api/cron/check-expiry`
- [x] `POST /api/cron/billing`

### Components
- [x] `PhoneInput`, `OtpInput`, `CameraUpload`, `StatusBadge`, `EmptyState`
- [x] `DriverTopBar`, `DriverBottomNav`, `ComplianceBadge`, `DocumentUploadCard`
- [x] `ParentTopBar`, `ParentBottomNav`
- [x] `PaymentMethodPicker`, `PaymentMethodBadge`, `PaystackCardSetup`, `DebiCheckSetup`, `CapitecVRPSetup`
- [x] shadcn/ui — button, card, input, label, select, sheet, dialog, checkbox, textarea, badge, avatar, tabs, progress, skeleton, separator, sonner, drawer

### Assets & config
- [x] `public/logos/` — wings-icon.svg, accident-angels-logo.svg, gets-logo.svg
- [x] `public/driver/manifest.json` — PWA manifest
- [x] `public/parent/manifest.json` — PWA manifest
- [x] `public/contract-template.html` — placeholder legal text
- [x] `prisma/seed.ts` — platform config defaults + 5 associations + admin user
- [x] `config/brand.ts` — centralised branding

---

## 🔲 Still to do

### Blockers (need credentials before testable end-to-end)
- [ ] Supply Supabase project URL + keys → run `prisma db push` + `prisma db seed`
- [ ] Supply Africa's Talking API key → OTPs will work in prod
- [ ] Supply Paystack keys → payment setup flow
- [ ] Supply Resend API key → email notifications (not yet implemented)
- [ ] Generate `NEXTAUTH_SECRET` + `CRON_SECRET` (openssl rand -base64 32)

### Phase 1 loose ends
- [ ] Email notifications (Resend) — contract signed, compliance approved/rejected
  - Currently SMS only; email is a nice-to-have for Phase 1
- [ ] Admin login — admin portal has no auth guard (relies on subdomain only)
  - Add session check + redirect to /admin/login for unauthenticated requests
- [ ] Admin login page — simple phone/OTP flow for ADMIN-role users
- [ ] Parent signing token expiry check in send-otp (currently silently proceeds)
- [ ] PWA icons — `/driver/icons/icon-192.png`, `/driver/icons/icon-512.png`, `/parent/icons/...`
  - Without these the PWA installs but shows a blank icon
- [ ] Supabase Storage buckets — create `compliance-docs` and `contracts` buckets in Supabase dashboard
- [ ] Supabase Storage bucket policies — set compliance-docs to private (service role only), contracts to public

### Phase 2 (out of scope for now)
- [ ] Live GPS tracking (parent app `/tracking`)
- [ ] DebiCheck integration (provider TBD — Netcash or similar)
- [ ] Capitec Pay VRP integration (provider TBD — Stitch or direct)
- [ ] Parent-to-driver messaging
- [ ] Driver payout management in admin
- [ ] Associations management page in admin
- [ ] Payments history page in admin
- [ ] Push notifications (PWA — contract signed, compliance status change)
- [ ] Multi-language support (Zulu, Sotho, Xhosa)

---

## Dev commands

```bash
npm run dev              # driver app at localhost:3000
npm run dev:parent       # parent app at localhost:3000
npm run dev:admin        # admin portal at localhost:3000

npm run db:push          # push schema to Supabase (needs DATABASE_URL)
npm run db:seed          # seed platform config + associations
npm run db:studio        # Prisma Studio GUI
npm run db:generate      # regenerate Prisma client after schema changes
```

## Cron endpoints (Vercel fires these automatically)
- `POST /api/cron/check-expiry` — daily at 06:00 SAST — expires docs, suspends drivers, sends SMS
- `POST /api/cron/billing` — 1st of month at 05:00 SAST — charges parents (only if PAYMENTS_LIVE=true)
- Both require `Authorization: Bearer {CRON_SECRET}` header

## Payments gate
**`PAYMENTS_LIVE=false`** is the hard kill switch. No charges fire until an admin sets this to `true` in the Settings page. All payment infrastructure is wired up and dormant.
