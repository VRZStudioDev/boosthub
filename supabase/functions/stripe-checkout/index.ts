// Supabase Edge Function: stripe-checkout
// Creates a Stripe Checkout Session for the $19.99/mo subscription and returns
// its URL. Requires an authenticated request (Authorization: Bearer <jwt>).
//
// Deploy:  supabase functions deploy stripe-checkout
// Secrets: supabase secrets set STRIPE_SECRET_KEY=... STRIPE_PRICE_ID=... \
//                               SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SITE_URL=...
//
// deno-lint-ignore-file no-explicit-any
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header.' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const jwt = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(jwt);
    if (userError || !user) return json({ error: 'Invalid user.' }, 401);

    // Load or create the Stripe customer for this user.
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: Deno.env.get('STRIPE_PRICE_ID')!, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${siteUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/dashboard?checkout=canceled`,
      metadata: { supabase_user_id: user.id },
      subscription_data: { metadata: { supabase_user_id: user.id } },
    });

    return json({ url: session.url, sessionId: session.id }, 200);
  } catch (err) {
    console.error('stripe-checkout error:', err);
    return json({ error: (err as any)?.message ?? 'Internal error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
