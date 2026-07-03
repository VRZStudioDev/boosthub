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
- 💳 Stripe subscription ($19.99/mo) with Customer Portal
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

1. Create a **recurring $19.99/month** Price in the Stripe dashboard and copy its `price_...` ID.
2. Set Edge Function secrets (server-side, never exposed to the browser):

```bash
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  STRIPE_PRICE_ID=price_xxx \
  SUPABASE_URL=https://<ref>.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=xxx \
  SITE_URL=http://localhost:5173
```

3. Deploy the functions:

```bash
supabase functions deploy stripe-checkout
supabase functions deploy create-portal-session
supabase functions deploy delete-account
supabase functions deploy stripe-webhook --no-verify-jwt
```

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
3. Deploy. (Netlify works too — set build `npm run build`, publish `dist`, and add an SPA redirect.)

---

## Scripts

| Command              | Description               |
| -------------------- | ------------------------- |
| `npm run dev`        | Start the dev server      |
| `npm run build`      | Type-check + prod build   |
| `npm run preview`    | Preview the prod build    |
| `npm run type-check` | TypeScript check only     |

---

## Notes

- The Siri shortcut URL shown on the dashboard points at **your own automation worker**
  (`VITE_WORKER_BASE_URL`). BoostHub stores the user's unique ID and displays setup steps; it does
  not run the shortcut itself.
- `usage_logs` are written server-side (by your worker / an Edge Function using the service role);
  the client only reads them.
