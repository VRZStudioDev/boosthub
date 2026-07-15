#!/usr/bin/env bash
set -euo pipefail

# Manual smoke checks for Phase 3 readiness.
# Required for API checks:
#   SUPABASE_URL
#   SUPABASE_SERVICE_ROLE_KEY
# Optional for billing check:
#   SUPABASE_ACCESS_TOKEN  # browser user's JWT after magic-link login
# Optional for decision verification:
#   TELEGRAM_CHAT_ID       # user's linked Telegram chat_id

need() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing $name"
    return 1
  fi
}

echo "1) Auth manual check"
echo "   - Open the app, request a Magic Link, click it, and confirm /dashboard loads."
echo "   - Copy the user's access token from the authenticated browser session if you want to run check #2."
echo

echo "2) Billing Edge Function check"
if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" && -n "${SUPABASE_URL:-}" ]]; then
  curl -sS -X POST "${SUPABASE_URL}/functions/v1/stripe-checkout" \
    -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    -d '{}' | tee /tmp/boosthub-checkout-response.json
  echo
  echo "   Expect JSON containing a Stripe Checkout url or sessionId."
else
  echo "   Skipped: set SUPABASE_URL and SUPABASE_ACCESS_TOKEN to run this check."
fi
echo

echo "3) Decision logging check"
echo "   - In Telegram, send: /accept 5.50"
if [[ -n "${SUPABASE_URL:-}" && -n "${SUPABASE_SERVICE_ROLE_KEY:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
  profile_json=$(curl -sS "${SUPABASE_URL}/rest/v1/profiles?telegram_chat_id=eq.${TELEGRAM_CHAT_ID}&select=id" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}")
  profile_id=$(printf '%s' "$profile_json" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s);console.log(j[0]?.id||'')})")
  if [[ -z "$profile_id" ]]; then
    echo "   No profile found for TELEGRAM_CHAT_ID=${TELEGRAM_CHAT_ID}"
    exit 1
  fi
  curl -sS "${SUPABASE_URL}/rest/v1/usage_logs?profile_id=eq.${profile_id}&decision=eq.accept&amount=eq.5.50&select=id,triggered_at,status,decision,amount&order=triggered_at.desc&limit=1" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" | tee /tmp/boosthub-decision-response.json
  echo
  echo "   Expect one recent row with status=accept, decision=accept, amount=5.50."
else
  echo "   Skipped API verification: set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and TELEGRAM_CHAT_ID."
fi