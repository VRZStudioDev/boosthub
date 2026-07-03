# PROJECT BRIEF: BoostHub

You are an expert full-stack developer tasked with building the complete frontend for **BoostHub**, a SaaS product designed for delivery drivers (DoorDash, UberEats, etc.). 

## 1. CONTEXT & BUSINESS RATIONALE
Delivery drivers lose **Acceptance Rate (AR)** when they decline low-paying orders (< $5). This deactivates their "Top Dasher" status, reducing their ability to schedule shifts and earn high-paying orders. 
**BoostHub** solves this by allowing the driver to trigger a 2-second VPN disconnect via a Siri voice command ("Hey Siri, trigger 1") before declining. The app simulates a "network hiccup," allowing them to decline without penalty.

**The Core Pitch (CTA):** *"Every low-paying order you accept costs you time, fuel, and money. BoostHub protects your acceptance rate so you only take what's worth it. Don't work harder, work smarter. Stop losing money today."*

## 2. TECH STACK
- **Frontend:** React (functional components) + TypeScript + Vite.
- **Styling:** TailwindCSS (with a modern, dark/light theme - default to clean dark mode for drivers at night).
- **Backend/Database:** Supabase (PostgreSQL) for Auth and User Management.
- **Payments:** Stripe (Subscription/Monthly recurring).
- **Hosting:** Vercel or Netlify (static site generation or SPA).

## 3. DATABASE SCHEMA (Supabase)
Create the following tables via SQL migrations or the Supabase dashboard. Define strict Row Level Security (RLS) policies.

- **Table: `profiles`** (linked to `auth.users`)
  - `id` (uuid, primary key, references auth.users)
  - `email` (text, unique)
  - `license_status` (text, default: 'inactive', values: 'active' | 'inactive' | 'canceled')
  - `stripe_customer_id` (text, unique)
  - `subscription_id` (text) - Stripe Subscription ID
  - `telegram_user_id` (text, nullable) - For linking to the existing Cloudflare Worker
  - `created_at` (timestamp)
  - `updated_at` (timestamp)

- **Table: `usage_logs`** (Optional but recommended for monitoring)
  - `id` (uuid)
  - `profile_id` (uuid, references profiles.id)
  - `triggered_at` (timestamp)
  - `status` (text) - 'success' | 'failed'

## 4. AUTHENTICATION FLOW (Supabase)
- Implement Supabase Auth using **Magic Link (Email OTP)** or **Email/Password**.
- After login, redirect to `/dashboard`.
- Protect routes: `/dashboard` and `/settings` should redirect to `/login` if unauthenticated.
- Upon first login, auto-create the profile row using database triggers (or handle it in the code).

## 5. PAYMENT FLOW (Stripe)
- **Pricing:** Monthly subscription (e.g., $19.99/month).
- **Integration:**
  - Create a `POST /api/create-checkout-session` endpoint (or use Supabase Edge Functions) to generate a Stripe Checkout session.
  - On successful payment, Stripe redirects to `/dashboard?session_id={id}`.
  - **Webhook Handling:** You don't need to code the webhook now, but provide a `stripe-webhook` endpoint (Edge Function) that updates the `profiles` table (`license_status = 'active'`) upon `checkout.session.completed` or `invoice.paid`.

## 6. FRONTEND PAGES & COMPONENTS

### A. Landing Page (`/`)
- **Hero Section:** Strong visual headline: *"Protect Your Acceptance Rate. Reject Bad Orders."*
- **Sub-headline:** *"BoostHub triggers a network disconnect via Siri. Maintain your Top Dasher status without accepting $2 deliveries."*
- **CTA Button:** "Start Earning Smarter" -> Redirects to `/signup`.
- **Features Section (3 cards):**
  1. **Hands-Free Siri:** "Just say 'Hey Siri, trigger 1' and decline."
  2. **Zero Penalty:** "Simulate network instability. DoorDash won't punish you."
  3. **Instant Setup:** "Integrates with your existing VPN in 2 minutes."
- **Pricing Card:** Display the monthly price prominently. CTA: "Subscribe Now" (leads to signup if not logged in, or directly to Stripe Checkout if logged in).

### B. Authentication Pages (`/login`, `/signup`)
- Simple, clean forms.
- Supabase Magic Link: User enters email, clicks "Send Magic Link". Show a confirmation message: "Check your email to log in."
- Option for Google OAuth (if desired, but Magic Link is safer for simplicity).

### C. Dashboard (`/dashboard`) *[Protected]*
- **Header:** Welcome, `{User Email}`. Logout button.
- **License Status Card:**
  - Green badge: "Active" | Red badge: "Inactive".
  - If Inactive: Show a "Reactivate Subscription" button redirecting to Stripe.
  - If Active: Show "Next billing date".
- **Configuration Card (Crucial for the user):**
  - Show the user their unique `ID` (the `uuid` or `telegram_user_id`).
  - Display pre-filled setup instructions:
    1.  *"Copy your unique ID: `xxxx-xxxx`."*
    2.  *"Install Pushcut and create a Shortcut (VPN Toggle)."*
    3.  *"Set your Siri Shortcut URL to: `https://your-worker.workers.dev/disparar?usuario=YOUR_UNIQUE_ID`"*
    4.  *"Train Siri to say 'Trigger 1'."*
- **Usage Logs:** A simple table showing the last 10 times the service was triggered (Date + Status).

### D. Settings (`/settings`) *[Protected]*
- "Manage Subscription" button -> Redirects to Stripe Customer Portal (using a `create-portal-session` endpoint).
- Update Email (Supabase).
- Delete Account (with confirmation modal).

## 7. UI/UX VIBE (Design Guidelines)
- **Colors:** Deep Navy/Charcoal background (for night driving) with vibrant Cyan/Green accents for CTAs (evoking "go" and "profit").
- **Typography:** Sans-serif, bold headlines.
- **Animations:** Smooth fade-ins on scroll. Hover effects on CTAs (glow or scale).
- **Mobile-First:** 90% of users will access this from their phones. Ensure everything is responsive on iPhone 12/13/14/15 sizes.
- **Error Handling:** User-friendly error toasts (e.g., "Payment failed, try again").

## 8. TECHNICAL INSTRUCTIONS FOR THE AI AGENT (Agents.md compliance)
- **Code Structure:** `src/components` (atoms, molecules), `src/pages`, `src/hooks` (custom hooks for Supabase and Stripe), `src/utils`.
- **State Management:** Use React Context for Auth state, React Query (TanStack Query) for fetching profile data and logs.
- **Environment Variables:** Create a `.env.example` file with placeholders for `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`.
- **Type Safety:** Generate TypeScript types for all database tables and API responses.
- **Edge Functions:** Provide the code for two Supabase Edge Functions: `stripe-checkout` and `stripe-webhook` (using the Supabase CLI).
- **Testing:** (Optional but nice) Provide basic unit tests for the login flow.
- **Deployment:** Include a `vercel.json` or instructions for deploying to Vercel.

## 9. DELIVERABLES EXPECTED
1. Full source code.
2. README.md with setup instructions (`npm install`, environment variables).
3. Database migration SQL scripts.
4. The two Stripe Edge Function scripts.