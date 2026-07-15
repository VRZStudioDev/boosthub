// Public lightweight signup risk assessment. This is advisory for UX;
// backend checkout/trial eligibility still performs authoritative checks.
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true }, 200);
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').toLowerCase().trim();
    const domain = email.split('@')[1] ?? '';
    const { data: disposable } = await admin.from('disposable_email_domains').select('domain').eq('domain', domain).eq('active', true).maybeSingle();
    const decision = disposable ? 'review' : 'allow';
    const riskScore = disposable ? 35 : 0;
    const reasonCode = disposable ? 'disposable_email_domain' : 'low_risk';
    await admin.from('antifraud_events').insert({
      event_type: 'signup_assessed',
      signal_source: 'edge:fraud-assess-signup',
      risk_score: riskScore,
      decision,
      reason_code: reasonCode,
      evidence_json: { domain, disposable_email: Boolean(disposable) },
    });
    return json({ decision, risk_score: riskScore, reason_code: reasonCode }, 200);
  } catch (err) {
    console.error('fraud-assess-signup error:', err instanceof Error ? err.message : 'unknown');
    return json({ error: 'Internal error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}