// Supabase Edge Function: voice-token
// Authenticated endpoint that returns/regenerates the logged-in user's voice token for the Dashboard.
//
// Deploy: supabase functions deploy voice-token
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true }, 200);
  const path = new URL(req.url).pathname;
  const isRegenerate = req.method === 'POST' && path.endsWith('/regenerate');
  if (req.method !== 'GET' && !isRegenerate) return json({ error: 'Method not allowed.' }, 405);

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

    if (isRegenerate) {
      const nextToken = crypto.randomUUID();
      const { data: updated, error: updateError } = await admin
        .from('profiles')
        .update({ voice_token: nextToken })
        .eq('id', user.id)
        .select('voice_token')
        .single();
      if (updateError) throw updateError;
      return json({ voice_token: updated.voice_token }, 200);
    }

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('voice_token')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;

    return json({ voice_token: profile?.voice_token ?? null }, 200);
  } catch (err) {
    console.error('voice-token error:', err);
    return json({ error: (err as any)?.message ?? 'Internal error' }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}