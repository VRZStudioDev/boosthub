# BoostHub

Voice-automated workflow shortcuts and earnings tracking for gig drivers. Trigger custom Siri
shortcuts by voice, evaluate orders with cost-per-mile insights, and keep your focus on the road.

Built with **React + TypeScript + Vite**, **TailwindCSS**, **Supabase** (Auth + Postgres), and
**Stripe** (subscriptions).

---

## Features

- 🎙️ Voice-triggered custom shortcuts (via Siri / automation apps)
- 📊 Earnings & cost-per-mile framing to spot unprofitable orders
- 🔐 Passwordless auth (magic link) + optional Google OAuth
- 💳 Stripe subscription ($99.00/mês) with Customer Portal
- 🗂️ Trigger history / usage logs
- 🌙 Mobile-first dark UI

---

## Project structure

```
src/
  components/
    feedback/      ToastProvider
    layout/        Navbar, Footer, Logo, PageLayout, ProtectedRoute
    ui/            Button, Input, Badge, Spinner, CopyField, ConfirmModal
  context/         AuthContext (React Context for auth state)
  hooks/           useProfile, useUsageLogs, useBilling (TanStack Query)
  lib/             supabaseClient, stripe
  pages/           Landing, Login, Signup, AuthCallback, Dashboard, Settings, NotFound
  types/           database.types.ts
supabase/
  migrations/      0001_init.sql   (tables, RLS, triggers)
  functions/       stripe-checkout, stripe-webhook, create-portal-session, delete-account
  config.toml
```

State: **React Context** for auth, **TanStack Query** for data fetching.

---

## 1. Setup

```bash
npm install
cp .env.example .env      # then fill in your values
```

### Environment variables (client)

| Variable                      | Description                                   |
| ----------------------------- | --------------------------------------------- |
| `VITE_SUPABASE_URL`           | Supabase project URL                          |
| `VITE_SUPABASE_ANON_KEY`      | Supabase anon/public key                      |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (`pk_...`)             |
| `VITE_SITE_URL`               | App origin for auth redirects                 |
| `VITE_WORKER_BASE_URL`        | Base URL of your automation worker (optional) |

Run the dev server:

```bash
npm run dev
```

---

## 2. Database

Apply the migration with the Supabase CLI:

```bash
supabase db push
# or paste supabase/migrations/0001_init.sql into the SQL editor
```

This creates `profiles` and `usage_logs`, enables **Row Level Security** (users can only read
their own rows), adds an `updated_at` trigger, and auto-creates a `profiles` row on sign-up.

---

## 3. Stripe

1. Create a **recurring $99.00/mês** Price in the Stripe dashboard and copy its `price_...` ID.
2. Set Edge Function secrets (server-side, never exposed to the browser):

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  STRIPE_PRICE_ID=price_xxx \
  SITE_URL=http://localhost:5173
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are reserved
Supabase Edge Function secrets and are auto-injected by Supabase. Do not add a
separate `SUPABASE_SERVICE_KEY`; use `SUPABASE_SERVICE_ROLE_KEY` everywhere a
server-side service-role key is needed (for example, the Telegram bot VPS env).

3. Deploy the functions:

```bash
supabase functions deploy stripe-checkout
supabase functions deploy create-portal-session
supabase functions deploy delete-account
supabase functions deploy trial-eligibility
supabase functions deploy fraud-assess-signup --no-verify-jwt
supabase functions deploy fraud-review --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```

### Free Trial Anti-Fraud

Free-trial access is decided only in backend Edge Functions. The frontend may request a trial,
but `stripe-checkout` always re-evaluates eligibility before creating the Stripe Checkout Session.
If trial is denied or sent to review, paid checkout remains available.

Server secrets:

```bash
supabase secrets set \
  ANTIFRAUD_IP_HASH_SALT=<random-long-secret> \
  FRAUD_REVIEW_SECRET=<ops-review-secret> \
  TRIAL_PERIOD_DAYS=7
```

Core tables:

- `antifraud_events`: immutable audit trail for every allow/review/block decision.
- `disposable_email_domains`: backend-maintained disposable-domain signals.
- `antifraud_ip_rate_limits`: per-window IP hash counts; IPs are never stored in cleartext.
- `fraud_review_queue`: operational review queue for elevated-risk signups/checkouts.
- `stripe_webhook_events`: idempotency ledger for Stripe webhook event IDs.

Decision model:

- `allow`: trial may be applied.
- `review`: no trial for now; user may continue to paid checkout; ops can review.
- `block`: trial denied; paid checkout remains available unless future policy explicitly changes.

Operational review:

```bash
curl -H "x-review-secret: $FRAUD_REVIEW_SECRET" \
  https://<ref>.functions.supabase.co/fraud-review

curl -X POST -H "x-review-secret: $FRAUD_REVIEW_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"review_id":"...","status":"approved","reviewer_note":"Legit support case"}' \
  https://<ref>.functions.supabase.co/fraud-review
```

Risks and mitigations implemented:

| Risk | Mitigation |
| --- | --- |
| False positive from shared IP | Multi-signal score and `review` state before block. |
| Bypass via multiple emails | Correlate trial history, Stripe customer/payment method signals, disposable domains, and IP hash history. |
| Frontend-only validation | Trial eligibility and checkout enforcement run in Edge Functions only. |
| Webhook replay | `stripe_webhook_events` idempotency by Stripe `event.id`. |
| Sensitive logs | Errors are sanitized; no secrets/clear IPs are stored. |
| Conversion regression | Trial denial still allows paid checkout; `review` state avoids hard false positives. |
| Improper cancellation | No automatic cancellation; manual review/audit trail required. |
| Verification cost growth | Progressive signal layers; no SMS/vendor calls by default. |
| Stripe/Supabase drift | Webhook event ledger + payment signal persistence enable reconciliation reports. |
| Billing regression | Smoke tests cover checkout, webhook idempotency, portal, and paid fallback. |

Suggested post-release metrics:

- Trial abuse rate and repeat-trial attempts.
- Trial-to-paid conversion by fraud decision (`allow`, `review`, `block`).
- False-positive review reversal rate.
- Percent of antifraud decisions with complete `reason_code` + `evidence_json`.
- Stripe webhook duplicate/replay count.
- Checkout technical error rate and paid-checkout completion rate after trial denial.

4. In Stripe → Developers → Webhooks, add an endpoint pointing to:

```
https://<project-ref>.functions.supabase.co/stripe-webhook
```

Subscribe to: `checkout.session.completed`, `invoice.paid`,
`customer.subscription.updated`, `customer.subscription.deleted`. Copy the signing secret into
`STRIPE_WEBHOOK_SECRET`.

**Flow:** Checkout → success redirect to `/dashboard?session_id=...` → the webhook sets
`profiles.license_status = 'active'`.

---

## 4. Deploy (Vercel)

The included `vercel.json` builds with Vite and rewrites all routes to `index.html` (SPA).

1. Import the repo in Vercel.
2. Add the `VITE_*` environment variables.
3. Deploy. `npm run build`, publish `dist`, and add an SPA redirect.)

---

## Scripts

| Command              | Description               |
| -------------------- | ------------------------- |
| `npm run dev`        | Start the dev server      |
| `npm run build`      | Type-check + prod build   |
| `npm run preview`    | Preview the prod build    |
| `npm run type-check` | TypeScript check only     |

---

## Production Checks

Run the manual Phase 3 smoke script after deploys:

```bash
chmod +x scripts/manual-phase3-checks.sh
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
SUPABASE_ACCESS_TOKEN=<logged-in-user-jwt> \
TELEGRAM_CHAT_ID=<linked-chat-id> \
./scripts/manual-phase3-checks.sh
```

The script covers Magic Link auth instructions, `stripe-checkout`, and verifying
that `/accept 5.50` creates a `usage_logs` decision row.

---

## Notes

- The Siri Shortcut URL shown on the dashboard points at the `telegram-voice-command`
  Edge Function. It uses a per-user `voice_token` and never exposes the Telegram bot token.
- `usage_logs` are written server-side (Telegram bot / Edge Functions using the service role);
  the client only reads them.
