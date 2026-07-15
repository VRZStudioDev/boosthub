// Authenticated trial eligibility endpoint. Critical trial decisions are made
// server-side and persisted in antifraud_events. Paid checkout remains possible
// when trial is denied/reviewed.
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type Decision = 'allow' | 'review' | 'block';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true }, 200);
  if (req.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header.' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !user) return json({ error: 'Invalid user.' }, 401);

    const ipHash = await hashIp(getClientIp(req), Deno.env.get('ANTIFRAUD_IP_HASH_SALT') ?? 'dev-salt');
    const result = await assessProfile(admin, user.id, user.email ?? '', ipHash);
    await recordEvent(admin, 'trial_eligibility_checked', 'edge:trial-eligibility', result, user.id, null);

    return json({
      eligible: result.decision === 'allow',
      decision: result.decision,
      reason_code: result.reasonCode,
      risk_score: result.riskScore,
      paid_checkout_available: true,
    }, 200);
  } catch (err) {
    console.error('trial-eligibility error:', sanitizeError(err));
    return json({ error: 'Internal error' }, 500);
  }
});

async function assessProfile(admin: any, profileId: string, email: string, ipHash: string) {
  const { data: profile, error } = await admin
    .from('profiles')
    .select('trial_used_at, fraud_review_status')
    .eq('id', profileId)
    .maybeSingle();
  if (error) throw error;

  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  const { data: disposable } = await admin
    .from('disposable_email_domains')
    .select('domain')
    .eq('domain', domain)
    .eq('active', true)
    .maybeSingle();

  const count = await updateIpWindow(admin, ipHash);
  const signals = {
    disposableEmail: Boolean(disposable),
    trialAlreadyUsed: Boolean(profile?.trial_used_at),
    ipWindowCount: count,
    priorReviewRejected: profile?.fraud_review_status === 'rejected',
  };
  return assess(signals);
}

async function updateIpWindow(admin: any, ipHash: string) {
  const windowStart = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString();
  const { data: current } = await admin
    .from('antifraud_ip_rate_limits')
    .select('window_start, request_count')
    .eq('ip_hash', ipHash)
    .maybeSingle();
  const same = current?.window_start === windowStart;
  const next = same ? Number(current.request_count ?? 0) + 1 : 1;
  await admin.from('antifraud_ip_rate_limits').upsert({
    ip_hash: ipHash,
    window_start: windowStart,
    request_count: next,
    last_decision: next >= 30 ? 'block' : next >= 12 ? 'review' : 'allow',
    updated_at: new Date().toISOString(),
  });
  return next;
}

function assess(signals: any) {
  let score = 0;
  if (signals.disposableEmail) score += 35;
  if (signals.trialAlreadyUsed) score += 45;
  if (signals.repeatedPaymentSignal) score += 45;
  if (signals.priorReviewRejected) score += 70;
  if ((signals.ipWindowCount ?? 0) >= 30) score += 55;
  else if ((signals.ipWindowCount ?? 0) >= 12) score += 25;
  else if ((signals.ipWindowCount ?? 0) >= 6) score += 10;
  score = Math.min(score, 100);
  const decision: Decision = score >= 80 ? 'block' : score >= 45 ? 'review' : 'allow';
  return { riskScore: score, decision, reasonCode: decision === 'allow' ? 'low_risk' : decision === 'review' ? 'elevated_risk_score' : 'critical_risk_score', evidence: signals };
}

async function recordEvent(admin: any, eventType: string, signalSource: string, result: any, profileId: string | null, customerId: string | null) {
  await admin.from('antifraud_events').insert({
    event_type: eventType,
    signal_source: signalSource,
    risk_score: result.riskScore,
    decision: result.decision,
    reason_code: result.reasonCode,
    evidence_json: result.evidence ?? {},
    related_profile_id: profileId,
    related_stripe_customer_id: customerId,
  });
}

function getClientIp(req: Request) {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

async function hashIp(ip: string, salt: string) {
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function sanitizeError(err: unknown) { return err instanceof Error ? err.message : 'unknown'; }
function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}