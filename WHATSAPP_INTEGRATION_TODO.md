# ⚠️ WhatsApp integration — NOT BUILT (hand-off)

**Status: STUB ONLY. Payment reminders are queued but NEVER sent.**

The payment dunning flow (a parent's card fails → we want to remind them on
WhatsApp) is wired up to the point of **queueing** a message, but the actual
WhatsApp sending is **not implemented**. This is a deliberate, marked gap for
another developer to complete.

## What already works
- `lib/notifications/whatsapp.ts` → `queueWhatsAppReminder()` writes the reminder
  to the **`WhatsAppOutbox`** table (`status = 'QUEUED'`) and logs a loud
  `[WHATSAPP GAP — NOT SENT]` warning.
- The billing/dunning code calls it on terminal payment failure.
- Parents can store a WhatsApp number: `Parent.whatsappPhone` (falls back to
  their login phone). Capture it on the parent profile screen.

## What YOU need to build
1. Choose a provider: **Meta WhatsApp Cloud API** (recommended), Twilio, or 360dialog.
2. Add credentials to env + Infisical (e.g. `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`).
3. Implement a sender and a worker/cron that drains the outbox:
   ```
   SELECT * FROM "WhatsAppOutbox" WHERE status = 'QUEUED' ORDER BY "createdAt" LIMIT 100;
   -- send each; on success: status='SENT', sentAt=now(); on failure: status='FAILED'
   ```
4. Use approved WhatsApp **message templates** (WhatsApp requires pre-approved
   templates for business-initiated messages). The queued `body` is plain text —
   map it to your template.
5. Replace the stub's console warning once sending is live.

## Where it's called from
- `lib/payments/retry.ts` — on terminal `FAILED` (all retries exhausted).
- `app/api/payments/retry/route.ts` — manual retry endpoint (parent/admin).

Until this is built, **treat payment reminders as not delivered.**
