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

const TRIAL_PERIOD_DAYS = Number(Deno.env.get('TRIAL_PERIOD_DAYS') ?? '7');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const requestBody = await req.json().catch(() => ({}));
    const trialRequested = requestBody.trial !== false;
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
      .select('id, email, stripe_customer_id, trial_used_at, first_trial_at, fraud_review_status, stripe_payment_method_fingerprint')
      .eq('id', user.id)
      .maybeSingle();

    const trialAssessment = await assessTrial(supabase, profile, user.email ?? '', getClientIp(req));
    const useTrial = Boolean(trialRequested && trialAssessment.decision === 'allow');

    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    if (trialRequested && !useTrial) {
      await supabase
        .from('profiles')
        .update({
          last_trial_denied_reason: trialAssessment.reasonCode,
          fraud_risk_score: trialAssessment.riskScore,
          fraud_decision: trialAssessment.decision,
          fraud_review_status: trialAssessment.decision === 'review' ? 'open' : profile?.fraud_review_status ?? 'none',
        })
        .eq('id', user.id);
    }

    if (useTrial) {
      const now = new Date().toISOString();
      await supabase
        .from('profiles')
        .update({
          trial_used_at: now,
          first_trial_at: profile?.trial_used_at ? profile.first_trial_at : now,
          last_trial_denied_reason: null,
          fraud_risk_score: trialAssessment.riskScore,
          fraud_decision: 'allow',
        })
        .eq('id', user.id);
    }

    await recordAntifraudEvent(supabase, {
      event_type: 'checkout_trial_decision',
      signal_source: 'edge:stripe-checkout',
      risk_score: trialAssessment.riskScore,
      decision: trialAssessment.decision,
      reason_code: trialAssessment.reasonCode,
      evidence_json: trialAssessment.evidence,
      related_profile_id: user.id,
      related_stripe_customer_id: customerId,
    });

    const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: Deno.env.get('STRIPE_PRICE_ID')!, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${siteUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/dashboard?checkout=canceled`,
      metadata: { supabase_user_id: user.id },
      subscription_data: {
        ...(useTrial && TRIAL_PERIOD_DAYS > 0 ? { trial_period_days: TRIAL_PERIOD_DAYS } : {}),
        metadata: { supabase_user_id: user.id, trial_decision: trialAssessment.decision },
      },
    });

    return json({
      url: session.url,
      sessionId: session.id,
      trial: {
        requested: trialRequested,
        applied: useTrial,
        decision: trialAssessment.decision,
        reason_code: trialAssessment.reasonCode,
        paid_checkout_available: true,
      },
    }, 200);
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

async function assessTrial(admin: any, profile: any, email: string, ip: string) {
  const salt = Deno.env.get('ANTIFRAUD_IP_HASH_SALT') ?? 'dev-salt';
  const ipHash = await hash(`${salt}:${ip}`);
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  const { data: disposable } = await admin
    .from('disposable_email_domains')
    .select('domain')
    .eq('domain', domain)
    .eq('active', true)
    .maybeSingle();

  const ipCount = await updateIpWindow(admin, ipHash);
  const signals = {
    disposable_email: Boolean(disposable),
    trial_already_used: Boolean(profile?.trial_used_at),
    repeated_payment_signal: Boolean(profile?.stripe_payment_method_fingerprint),
    prior_review_rejected: profile?.fraud_review_status === 'rejected',
    ip_window_count: ipCount,
    email_domain: domain,
  };

  let score = 0;
  if (signals.disposable_email) score += 35;
  if (signals.trial_already_used) score += 45;
  if (signals.repeated_payment_signal) score += 45;
  if (signals.prior_review_rejected) score += 70;
  if (ipCount >= 30) score += 55;
  else if (ipCount >= 12) score += 25;
  else if (ipCount >= 6) score += 10;
  score = Math.min(score, 100);
  const decision = score >= 80 ? 'block' : score >= 45 ? 'review' : 'allow';
  const reasonCode = decision === 'allow' ? 'low_risk' : decision === 'review' ? 'elevated_risk_score' : 'critical_risk_score';
  if (decision === 'review' && profile?.id) {
    await admin.from('fraud_review_queue').insert({
      profile_id: profile.id,
      stripe_customer_id: profile.stripe_customer_id,
      risk_score: score,
      reason_code: reasonCode,
      evidence_json: signals,
    });
  }
  return { riskScore: score, decision, reasonCode, evidence: signals };
}

async function updateIpWindow(admin: any, ipHash: string) {
  const windowStart = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString();
  const { data: current } = await admin.from('antifraud_ip_rate_limits').select('window_start, request_count').eq('ip_hash', ipHash).maybeSingle();
  const next = current?.window_start === windowStart ? Number(current.request_count ?? 0) + 1 : 1;
  await admin.from('antifraud_ip_rate_limits').upsert({ ip_hash: ipHash, window_start: windowStart, request_count: next, last_decision: next >= 30 ? 'block' : next >= 12 ? 'review' : 'allow', updated_at: new Date().toISOString() });
  return next;
}

async function recordAntifraudEvent(admin: any, event: Record<string, unknown>) {
  await admin.from('antifraud_events').insert(event);
}

function getClientIp(req: Request) {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

async function hash(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
