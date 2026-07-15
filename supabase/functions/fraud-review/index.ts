// Operational manual review endpoint protected by FRAUD_REVIEW_SECRET.
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-review-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true }, 200);
  const expected = Deno.env.get('FRAUD_REVIEW_SECRET');
  const actual = req.headers.get('x-review-secret');
  if (!expected || actual !== expected) return json({ error: 'Unauthorized' }, 401);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  try {
    if (req.method === 'GET') {
      const { data, error } = await admin.from('fraud_review_queue').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return json({ reviews: data ?? [] }, 200);
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const status = String(body.status ?? '');
      if (status !== 'approved' && status !== 'rejected') return json({ error: 'status must be approved or rejected' }, 400);
      const { data, error } = await admin.from('fraud_review_queue').update({
        status,
        reviewer_note: body.reviewer_note ?? null,
        reviewed_by: body.reviewed_by ?? 'ops',
        reviewed_at: new Date().toISOString(),
      }).eq('id', body.review_id).select('*').single();
      if (error) throw error;

      if (data?.profile_id) {
        await admin.from('profiles').update({ fraud_review_status: status, fraud_decision: status === 'approved' ? 'allow' : 'block' }).eq('id', data.profile_id);
      }
      await admin.from('antifraud_events').insert({
        event_type: 'manual_review_resolved',
        signal_source: 'edge:fraud-review',
        risk_score: data.risk_score ?? 0,
        decision: status === 'approved' ? 'allow' : 'block',
        reason_code: `manual_${status}`,
        evidence_json: { review_id: body.review_id, reviewer_note: body.reviewer_note ?? null },
        related_profile_id: data.profile_id,
        related_stripe_customer_id: data.stripe_customer_id,
      });
      return json({ review: data }, 200);
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (err) {
    console.error('fraud-review error:', err instanceof Error ? err.message : 'unknown');
    return json({ error: 'Internal error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}