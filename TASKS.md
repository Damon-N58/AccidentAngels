# Accident Angels — Build Progress Tracker

Last updated: 2026-04-26  
Stack: Next.js 16 · TypeScript · Tailwind v4 · shadcn/ui · Prisma · Supabase  
To resume: read this file first, then continue from the first unchecked item.

---

## FOUNDATION
- [x] Next.js 16 + TypeScript + Tailwind v4 + shadcn/ui scaffold
- [x] All npm dependencies installed (prisma, supabase, bcryptjs, jose, zod, react-hook-form, @react-pdf/renderer, sonner, date-fns, lucide-react)
- [x] shadcn/ui initialized + all components added (badge, card, drawer, form, input, label, progress, select, separator, sheet, skeleton, tabs, textarea, sonner, avatar, checkbox, dialog)
- [x] Prisma initialized
- [x] Directory structure created
- [x] `config/brand.ts` — central branding config (easy rebrand)
- [x] `.env.local` — all env vars with placeholders
- [x] `CREDENTIALS_NEEDED.md` — full guide on getting each credential
- [ ] `prisma/schema.prisma` — full DB schema
- [ ] `prisma/seed.ts` — associations + platform config seed data
- [ ] `middleware.ts` — subdomain routing
- [ ] `next.config.ts` — updated with PWA, security headers
- [ ] `app/globals.css` — design system tokens

---

## LOGOS & ASSETS
- [ ] `/public/logos/accident-angels-logo.svg` — angel wings logo (SVG)
- [ ] `/public/logos/gets-logo.svg` — GETS logo placeholder
- [ ] `/public/logos/wings-icon.svg` — standalone wings icon
- [ ] `/public/driver/manifest.json` — PWA manifest (Angels Driver)
- [ ] `/public/parent/manifest.json` — PWA manifest (Angels parent)
- [ ] PWA icons (192px, 512px) — placeholder SVG icons
- [ ] `/public/contract-template.html` — contract legal text placeholder

---

## LIB / SHARED UTILITIES
- [ ] `lib/db.ts` — Prisma singleton
- [ ] `lib/auth.ts` — OTP auth logic (send, verify, hash)
- [ ] `lib/sms/africas-talking.ts` — SMS provider (abstracted)
- [ ] `lib/storage/supabase.ts` — file upload helpers
- [ ] `lib/pdf/contract-generator.ts` — PDF generation with @react-pdf/renderer
- [ ] `lib/utils/formatters.ts` — phone, date, currency formatters
- [ ] `lib/utils/validators.ts` — SA ID, phone validators
- [ ] `lib/utils/cents.ts` — toRands, toCents, formatZAR
- [ ] `lib/payments/types.ts` — PaymentProvider interface
- [ ] `lib/payments/index.ts` — getPaymentProvider factory
- [ ] `lib/payments/retry.ts` — retry schedule logic
- [ ] `lib/payments/providers/paystack-card.ts` — FULL implementation
- [ ] `lib/payments/providers/debicheck.ts` — stub (NotImplemented)
- [ ] `lib/payments/providers/capitec-pay-vrp.ts` — stub (NotImplemented)

---

## SHARED COMPONENTS
- [ ] `components/shared/OtpInput.tsx` — 6-cell, numeric, auto-advance
- [ ] `components/shared/PhoneInput.tsx` — +27 SA formatting
- [ ] `components/shared/CameraUpload.tsx` — camera-first file input
- [ ] `components/shared/StatusBadge.tsx` — compliance/contract status badges
- [ ] `components/shared/EmptyState.tsx` — empty state with illustration

---

## DRIVER APP — `app/(driver-app)/`
- [ ] `layout.tsx` — shell: DriverTopBar + DriverBottomNav
- [ ] `components/driver/DriverTopBar.tsx`
- [ ] `components/driver/DriverBottomNav.tsx`
- [ ] `login/page.tsx` — phone entry
- [ ] `verify/page.tsx` — OTP entry
- [ ] `onboarding/page.tsx` — 4-step wizard
- [ ] `dashboard/page.tsx` — compliance banner + children list
- [ ] `compliance/page.tsx` — document checklist
- [ ] `compliance/[docType]/page.tsx` — per-doc upload screen
- [ ] `components/driver/ComplianceChecklist.tsx`
- [ ] `components/driver/ComplianceBadge.tsx`
- [ ] `components/driver/DocumentUploadCard.tsx`
- [ ] `children/page.tsx` — children list
- [ ] `children/add/page.tsx` — add child form
- [ ] `children/[childId]/page.tsx` — child detail
- [ ] `components/driver/ChildCard.tsx`
- [ ] `components/driver/AddChildForm.tsx`
- [ ] `contracts/page.tsx` — contracts list
- [ ] `contracts/[contractId]/page.tsx` — view + sign
- [ ] `components/driver/ContractViewer.tsx`
- [ ] `components/driver/SignatureFlow.tsx` — OTP bottom sheet
- [ ] `payments/page.tsx` — banking + earnings preview
- [ ] `profile/page.tsx`

---

## PARENT APP — `app/(parent-app)/`
- [ ] `layout.tsx` — shell: ParentTopBar + ParentBottomNav
- [ ] `components/parent/ParentTopBar.tsx`
- [ ] `components/parent/ParentBottomNav.tsx`
- [ ] `login/page.tsx`
- [ ] `verify/page.tsx`
- [ ] `dashboard/page.tsx` — child cards + driver status
- [ ] `driver/[driverId]/page.tsx` — driver trust profile
- [ ] `sign/[token]/page.tsx` — token-based contract signing (NO login)
- [ ] `payments/page.tsx` — payment method setup
- [ ] `tracking/page.tsx` — Phase 2 placeholder
- [ ] `components/parent/ChildSummaryCard.tsx`
- [ ] `components/parent/DriverTrustCard.tsx`
- [ ] `components/parent/ContractSigningFlow.tsx`
- [ ] `components/parent/TrackingMap.tsx` — Phase 2 placeholder
- [ ] `components/payments/PaymentMethodPicker.tsx`
- [ ] `components/payments/CapitecVRPSetup.tsx`
- [ ] `components/payments/PaystackCardSetup.tsx`
- [ ] `components/payments/DebiCheckSetup.tsx`
- [ ] `components/payments/PaymentMethodBadge.tsx`

---

## ADMIN PORTAL — `app/(admin)/`
- [ ] `layout.tsx` — sidebar layout
- [ ] `dashboard/page.tsx` — stats + activity feed
- [ ] `drivers/page.tsx` — drivers table
- [ ] `drivers/[driverId]/page.tsx` — compliance review
- [ ] `associations/page.tsx` — associations management
- [ ] `payments/page.tsx` — transaction log
- [ ] `payments/config/page.tsx` — fee config + PAYMENTS_LIVE toggle

---

## API ROUTES — `app/api/`
- [ ] `auth/send-otp/route.ts`
- [ ] `auth/verify-otp/route.ts`
- [ ] `compliance/upload-url/route.ts` — Supabase presigned URL
- [ ] `compliance/[docId]/review/route.ts` — admin approve/reject
- [ ] `contracts/generate/route.ts` — PDF generation
- [ ] `contracts/sign/route.ts` — OTP-based signing
- [ ] `contracts/[contractId]/parent-link/route.ts` — generate parent token
- [ ] `payments/setup/route.ts`
- [ ] `payments/setup/[provider]/callback/route.ts`
- [ ] `cron/collect/route.ts` — monthly billing (gated by PAYMENTS_LIVE)
- [ ] `cron/compliance-check/route.ts` — daily expiry warnings
- [ ] `webhooks/paystack/route.ts` — full implementation
- [ ] `webhooks/debicheck/route.ts` — stub + logging
- [ ] `webhooks/capitec-vrp/route.ts` — stub + logging

---

## PHASE 2 (DO NOT BUILD YET)
- [ ] Live GPS tracking (Discovery Drive API + mapcn.dev)
- [ ] Driver earnings dashboard + payout history
- [ ] Parent tracking map
- [ ] Actual payment collection (post PAYMENTS_LIVE=true)

---

## DEPLOYMENT
- [ ] Vercel project linked
- [ ] Subdomain config (driver., parent., admin.)
- [ ] Environment variables pushed to Vercel
- [ ] Cron jobs configured in vercel.json
- [ ] Production test: full end-to-end flow

---

## SESSION NOTES
**Session 1 (2026-04-26):** Foundation scaffold complete. All deps installed, directories created, brand config + env template written. Starting Prisma schema + core lib files next.
