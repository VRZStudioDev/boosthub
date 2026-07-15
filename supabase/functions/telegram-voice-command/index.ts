// Supabase Edge Function: telegram-voice-command
// Public Siri/Shortcuts endpoint that sends /accept or /decline to the Telegram
// bot without exposing TELEGRAM_TOKEN in the frontend or shortcut URL.
//
// Deploy:  supabase functions deploy telegram-voice-command --no-verify-jwt
// Secrets: TELEGRAM_TOKEN plus Supabase's auto-injected SUPABASE_URL and
//          SUPABASE_SERVICE_ROLE_KEY.
//
// Example:
//   /telegram-voice-command?token=<profile.voice_token>&decision=accept&amount=4.50
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

  try {
    const url = new URL(req.url);
    const params = req.method === 'POST' ? await readBody(req) : Object.fromEntries(url.searchParams);

    const token = String(params.token ?? '').trim();
    const decision = String(params.decision ?? '').trim().toLowerCase();
    const amountRaw = String(params.amount ?? '').trim().replace(',', '.');
    const amount = Number(amountRaw);

    if (!token) return json({ error: 'Missing voice token.' }, 400);
    if (decision !== 'accept' && decision !== 'decline') {
      return json({ error: 'Decision must be accept or decline.' }, 400);
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: 'Amount must be a positive number.' }, 400);
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('telegram_chat_id, license_status')
      .eq('voice_token', token)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile?.telegram_chat_id) return json({ error: 'Telegram is not linked.' }, 404);
    if (profile.license_status !== 'active') return json({ error: 'Subscription is inactive.' }, 403);

    const telegramToken = Deno.env.get('TELEGRAM_TOKEN');
    if (!telegramToken) return json({ error: 'Telegram token is not configured.' }, 500);

    const command = `/${decision} ${amount.toFixed(2)} voice`;
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${telegramToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: profile.telegram_chat_id, text: command }),
      },
    );

    const telegramBody = await telegramResponse.json().catch(() => null);
    if (!telegramResponse.ok) {
      console.error('Telegram sendMessage failed:', telegramBody);
      return json({ error: 'Could not send the Telegram command.' }, 502);
    }

    return json({ ok: true, command }, 200);
  } catch (err) {
    console.error('telegram-voice-command error:', err);
    return json({ error: (err as any)?.message ?? 'Internal error' }, 500);
  }
});

async function readBody(req: Request): Promise<Record<string, unknown>> {
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) return await req.json();
  const form = await req.formData();
  return Object.fromEntries(form.entries());
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}