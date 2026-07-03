// Supabase Edge Function: delete-account
// Cancels any active Stripe subscription and permanently deletes the user
// (which cascades to profiles + usage_logs). Requires Authorization: Bearer <jwt>.
//
// Deploy:  supabase functions deploy delete-account
// Secrets: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const jwt = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await admin.auth.getUser(jwt);
    if (userError || !user) return json({ error: 'Invalid user.' }, 401);

    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id, subscription_id')
      .eq('id', user.id)
      .maybeSingle();

    // Best-effort: cancel active subscription before deleting.
    if (profile?.subscription_id) {
      try {
        await stripe.subscriptions.cancel(profile.subscription_id);
      } catch (e) {
        console.warn('Subscription cancel failed (continuing):', (e as any)?.message);
      }
    }

    // Deleting the auth user cascades to profiles and usage_logs via FK.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return json({ success: true }, 200);
  } catch (err) {
    console.error('delete-account error:', err);
    return json({ error: (err as any)?.message ?? 'Internal error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
