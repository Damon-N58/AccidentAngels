# Credentials Needed

All of these are required before the app is fully functional.
Add them to `.env.local` locally and to Vercel via `vercel env add` for deployment.

---

## 1. Supabase (Database + Storage)
**What:** Managed PostgreSQL database + file storage for compliance documents  
**Get it:** https://supabase.com → New Project → Settings → API

```
DATABASE_URL          postgresql connection string (Settings → Database → Connection string)
NEXT_PUBLIC_SUPABASE_URL     Project URL (Settings → API)
NEXT_PUBLIC_SUPABASE_ANON_KEY  anon/public key (Settings → API)
SUPABASE_SERVICE_ROLE_KEY    service_role key (Settings → API — keep secret!)
```

---

## 2. Africa's Talking (SMS)
**What:** SMS API used to send OTP codes and driver/parent notifications  
**Note:** This is the SA-native SMS provider (like Twilio but for Africa). Widely used in SA.  
**Get it:** https://africastalking.com → Register → Create App → API Key

```
AT_API_KEY       your API key
AT_USERNAME      your username (use "sandbox" for testing)
AT_SENDER_ID     "AccidentAngels" (must be approved by Africa's Talking for production)
```

**Testing:** You can use the sandbox environment to test SMS without real sends.

---

## 3. Paystack (Card Payments)
**What:** Payment processor for card tokenization and recurring charges  
**Note:** South African merchant account required. Paystack is owned by Stripe and widely used in SA.  
**Get it:** https://paystack.com → Register SA business account

```
PAYSTACK_SECRET_KEY              sk_live_... (keep secret!)
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY  pk_live_... (safe to expose)
PAYSTACK_WEBHOOK_SECRET          set in Paystack dashboard → Webhooks
```

---

## 4. Resend (Email)
**What:** Transactional email (contract notifications, compliance alerts)  
**Get it:** https://resend.com → API Keys → Create API Key

```
RESEND_API_KEY    re_...
```

---

## 5. Auth Secret
**What:** Secret used to sign OTP session tokens  
**Generate:** Run `openssl rand -base64 32` in your terminal

```
NEXTAUTH_SECRET    (result of above command)
CRON_SECRET        (run openssl rand -base64 32 again for this one)
```

---

## 6. Future: DebiCheck Provider
**What:** Bank-to-bank debit order system. Provider TBD (e.g. Netcash).  
**Status:** UI built, backend stub only. Leave blank until provider chosen.

---

## 7. Future: Capitec Pay VRP Provider  
**What:** Capitec recurring payment via Stitch / EBANX / direct.  
**Status:** UI built, backend stub only. Leave blank until provider chosen.

---

## Also needed (not env vars):
- **Accident Angels logo** → `/public/logos/accident-angels-logo.svg` (placeholder exists)
- **GETS logo** → `/public/logos/gets-logo.svg` (placeholder exists)
- **Contract legal text** → `/public/contract-template.html` (placeholder exists)
- **App domain config** → Set subdomains in Vercel: `driver.`, `parent.`, `admin.`
