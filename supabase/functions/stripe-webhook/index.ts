// Supabase Edge Function: stripe-webhook
// Listens for Stripe events and syncs subscription state into public.profiles.
// This endpoint must be PUBLIC (no JWT verification): add to config.toml
//   [functions.stripe-webhook]
//   verify_jwt = false
//
// Deploy:  supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets: supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... \
//                               SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
//
// Point your Stripe webhook at:
//   https://<project-ref>.functions.supabase.co/stripe-webhook
// Subscribe to: checkout.session.completed, invoice.paid,
//               customer.subscription.updated, customer.subscription.deleted
//
// deno-lint-ignore-file no-explicit-any
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('Missing signature', { status: 400 });

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', (err as any)?.message);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subscriptionId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        await activateFromCustomer(session.customer as string, subscriptionId ?? null);
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId =
          typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        await activateFromCustomer(invoice.customer as string, subscriptionId ?? null);
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : 'canceled';
        await admin
          .from('profiles')
          .update({
            license_status: status,
            subscription_id: sub.id,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_customer_id', sub.customer as string);
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return new Response('Handler error', { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

async function activateFromCustomer(customerId: string, subscriptionId: string | null) {
  let periodEnd: string | null = null;
  if (subscriptionId) {
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    periodEnd = new Date(sub.current_period_end * 1000).toISOString();
  }
  await admin
    .from('profiles')
    .update({
      license_status: 'active',
      subscription_id: subscriptionId,
      current_period_end: periodEnd,
    })
    .eq('stripe_customer_id', customerId);
}
