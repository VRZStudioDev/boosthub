// Supabase Edge Function: analyze-order
// Public Siri/Shortcuts endpoint for serverless order analysis.
// Identifies a user with profiles.voice_token (UUID), validates active license,
// rate-limits by token/profile, computes net payout and decision, and returns
// JSON for Siri to speak/use. It does not call Telegram.
//
// Deploy: supabase functions deploy analyze-order --no-verify-jwt
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const RATE_LIMIT = 30;
const WINDOW_MS = 60_000;
const DEFAULT_GAS_PRICE = 3.5;
const DEFAULT_MPG = 25;
const ACCEPT_THRESHOLD = 1.5;
const DECLINE_THRESHOLD = 0.8;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-voice-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({ ok: true }, 200);
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  let profile: any = null;
  let voiceToken = '';
  let amount = Number.NaN;
  let distance = Number.NaN;

  try {
    const body = await req.json().catch(() => ({}));
    voiceToken = getVoiceToken(req, body);
    amount = Number(body.amount);
    distance = Number(body.distance);

    if (!voiceToken) return json({ error: 'Missing voice_token.' }, 400);

    const { data: profileData, error: profileError } = await admin
      .from('profiles')
      .select('id, license_status, gas_price, mpg')
      .eq('voice_token', voiceToken)
      .maybeSingle();

    if (profileError) throw profileError;
    profile = profileData;
    if (!profile) return json({ error: 'Invalid voice_token.' }, 401);
    if (profile.license_status !== 'active') return json({ error: 'Subscription is inactive.' }, 403);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('amount must be a positive number.');
    }
    if (!Number.isFinite(distance) || distance <= 0) {
      throw new Error('distance must be a positive number.');
    }

    const rate = await checkRateLimit(admin, profile.id);
    if (!rate.allowed) {
      return json(
        { error: 'Too many requests.', retry_after_seconds: rate.retryAfterSeconds },
        429,
      );
    }

    const gasPrice = positiveNumber(profile.gas_price, DEFAULT_GAS_PRICE);
    const mpg = positiveNumber(profile.mpg, DEFAULT_MPG);
    const fuelCost = (distance / mpg) * gasPrice;
    const netPayout = amount - fuelCost;
    const perMile = netPayout / distance;
    const decision = decide(perMile);
    const savings = decision === 'decline' ? amount : 0;
    const reason = buildReason(decision, perMile);

    await admin.from('voice_analysis_logs').insert({
      profile_id: profile.id,
      amount: roundMoney(amount),
      distance: round(distance, 2),
      gas_price: roundMoney(gasPrice),
      mpg: round(mpg, 2),
      fuel_cost: roundMoney(fuelCost),
      net_payout: roundMoney(netPayout),
      per_mile: roundMoney(perMile),
      decision,
      reason,
    });

    return json(
      {
        decision,
        reason,
        net_payout: roundMoney(netPayout),
        savings: roundMoney(savings),
        fuel_cost: roundMoney(fuelCost),
        per_mile: roundMoney(perMile),
      },
      200,
    );
  } catch (err) {
    console.error('analyze-order error:', err);
    if (profile?.id) {
      await persistError(admin, {
        profileId: profile.id,
        voiceToken,
        amount,
        distance,
        errorMessage: (err as any)?.message ?? 'Internal error',
      });
    }
    return json({ error: (err as any)?.message ?? 'Internal error' }, 500);
  }
});

async function persistError(
  admin: any,
  {
    profileId,
    voiceToken,
    amount,
    distance,
    errorMessage,
  }: { profileId: string; voiceToken: string; amount: number; distance: number; errorMessage: string },
) {
  try {
    await admin.from('voice_analysis_logs').insert({
      profile_id: profileId,
      voice_token: voiceToken,
      amount: Number.isFinite(amount) ? amount : null,
      distance: Number.isFinite(distance) ? distance : null,
      decision: 'error',
      error_message: errorMessage,
      status: 'failed',
    });
  } catch (auditErr) {
    console.error('failed to persist analyze-order error audit:', auditErr);
  }
}

function getVoiceToken(req: Request, body: Record<string, unknown>): string {
  return String(
    req.headers.get('x-voice-token') ??
      req.headers.get('voice-token') ??
      body.voice_token ??
      body.voiceToken ??
      '',
  ).trim();
}

async function checkRateLimit(admin: any, profileId: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
  const nextWindow = new Date(windowStart.getTime() + WINDOW_MS);

  const { data: current, error: readError } = await admin
    .rpc('check_voice_rate_limit', {
      p_profile_id: profileId,
      p_window_start: windowStart.toISOString(),
      p_limit: RATE_LIMIT,
    });
  if (readError) throw readError;

  const result = current?.[0];
  if (!result?.allowed) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((nextWindow.getTime() - now.getTime()) / 1000)),
    };
  }

  return { allowed: true };
}

function positiveNumber(value: unknown, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? next : fallback;
}

function decide(perMile: number): 'accept' | 'decline' | 'marginal' {
  if (perMile > ACCEPT_THRESHOLD) return 'accept';
  if (perMile < DECLINE_THRESHOLD) return 'decline';
  return 'marginal';
}

function buildReason(decision: 'accept' | 'decline' | 'marginal', perMile: number): string {
  const value = `$${roundMoney(perMile).toFixed(2)}/mile`;
  if (decision === 'accept') return `You're making ${value} — worth it!`;
  if (decision === 'decline') return `You're making ${value} — below your target.`;
  return `You're making ${value} — marginal. Consider wait time and demand.`;
}

function roundMoney(value: number): number {
  return round(value, 2);
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}