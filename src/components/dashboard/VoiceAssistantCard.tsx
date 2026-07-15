import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/Button';
import { CopyField } from '../ui/CopyField';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../hooks/useProfile';
import { useToast } from '../feedback/ToastProvider';
import { supabase } from '../../lib/supabaseClient';

const ANALYZE_URL_FALLBACK = 'https://SEU_PROJETO.supabase.co/functions/v1/analyze-order';
const TELEGRAM_URL_FALLBACK = 'https://SEU_BOT_URL';
const ICLOUD_SHORTCUT_LINK =
  import.meta.env.VITE_ICLOUD_SHORTCUT_LINK ?? 'https://www.icloud.com/shortcuts/xxxxxx';

export function VoiceAssistantCard({ className = '' }: { className?: string }) {
  const { user } = useAuth();
  const { data: profile, isLoading } = useProfile();
  const queryClient = useQueryClient();
  const toast = useToast();

  const [loadingRegenerate, setLoadingRegenerate] = useState(false);
  const [voiceToken, setVoiceToken] = useState('');
  const [loadingVoiceToken, setLoadingVoiceToken] = useState(true);

  const supabaseBaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  const analyzeUrl = supabaseBaseUrl
    ? `${supabaseBaseUrl}/functions/v1/analyze-order`
    : ANALYZE_URL_FALLBACK;
  const telegramCommandBaseUrl = supabaseBaseUrl
    ? `${supabaseBaseUrl}/functions/v1/telegram-voice-command`
    : TELEGRAM_URL_FALLBACK;

  const tokenForDisplay = voiceToken || 'VOICE_TOKEN';
  const contentTypeHeader = 'Content-Type: application/json';
  const analyzeBody = `{
  "voice_token": "${tokenForDisplay}",
  "amount": "{{AMOUNT}}",
  "distance": "{{DISTANCE}}"
}`;
  const telegramDeclineUrl = `${telegramCommandBaseUrl}?token=${tokenForDisplay}&decision=decline&amount={{AMOUNT}}`;

  useEffect(() => {
    let cancelled = false;

    async function loadVoiceToken() {
      setLoadingVoiceToken(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) throw new Error('Missing session');

        const { data, error } = await supabase.functions.invoke<{ voice_token: string | null }>(
          'voice-token',
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${session.access_token}` },
          },
        );
        if (error) throw error;
        if (!cancelled) setVoiceToken(data?.voice_token ?? profile?.voice_token ?? '');
      } catch {
        if (!cancelled) setVoiceToken(profile?.voice_token ?? '');
      } finally {
        if (!cancelled) setLoadingVoiceToken(false);
      }
    }

    loadVoiceToken();
    return () => {
      cancelled = true;
    };
  }, [profile?.voice_token]);

  async function handleRegenerateToken() {
    if (!user) return;

    setLoadingRegenerate(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error('Your session has expired. Please sign in again.');

      const { data, error } = await supabase.functions.invoke<{ voice_token: string }>(
        'voice-token/regenerate',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );
      if (error) throw error;
      setVoiceToken(data?.voice_token ?? '');

      await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      toast.success('Voice token regenerated successfully.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not regenerate token.');
    } finally {
      setLoadingRegenerate(false);
    }
  }

  return (
    <div id="voice-assistant" className={`card ${className}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-white">Voice Assistant</h2>
        <div className="flex flex-col items-center gap-1 sm:flex-row sm:gap-2">
          <img
            src="/siri.png"
            alt="How it works"
            className="mx-auto  w-10 max-w-2xl"
            style={{ height: 'auto' }}
          />
          <span className="text-xs text-slate-500">Siri setup</span>
        </div>
      </div>

      <p className="mt-1 text-sm text-slate-400">
        Configure Siri with your personal voice token and automate order analysis + decision logging.
      </p>

      <div className="mt-5 space-y-4">
        <CopyField label="Voice token" value={tokenForDisplay} />

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full sm:w-auto"
            loading={loadingRegenerate}
            onClick={handleRegenerateToken}
            disabled={!user || isLoading || loadingVoiceToken}
          >
            Regenerate Token
          </Button>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <p className="text-sm font-medium text-white">iCloud Shortcut Link</p>
          <p className="mt-1 text-sm text-slate-300">
            Use this link to install the test shortcut quickly. After importing it in the Shortcuts app,
            confirm the request uses the endpoint below, method <span className="text-slate-100">POST</span>,
            header <span className="text-slate-100">Content-Type: application/json</span>, and a JSON body
            containing <span className="text-slate-100">voice_token</span>, <span className="text-slate-100">amount</span>,
            and <span className="text-slate-100">distance</span>.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            For validation, run the shortcut with a known amount and distance, then check that Siri reads
            the returned decision/reason and the Dashboard updates the Last Voice Assistant card.
          </p>
        </div>

        <CopyField label="iCloud Link" value={ICLOUD_SHORTCUT_LINK} />

        <div className="rounded-xl border border-white/10 bg-navy-950/60 p-4">
          <p className="text-sm font-medium text-white">Manual Siri Shortcut Setup</p>
          <ol className="mt-3 list-decimal space-y-2 break-words pl-5 text-sm text-slate-300 marker:text-slate-500">
            <li>Open the Shortcuts app and create a new shortcut.</li>
            <li>Add <span className="text-slate-100">Ask for Text</span> for order amount.</li>
            <li>Add <span className="text-slate-100">Ask for Text</span> for distance.</li>
            <li>Add <span className="text-slate-100">Get Contents of URL</span> and set method to <span className="text-slate-100">POST</span>.</li>
            <li>Set header to <span className="text-slate-100">Content-Type: application/json</span>.</li>
            <li>Paste the JSON body below and map <span className="text-slate-100">{'{{AMOUNT}}'}</span> and <span className="text-slate-100">{'{{DISTANCE}}'}</span> to Siri variables.</li>
            <li>Add <span className="text-slate-100">Speak Text</span> to read the returned decision out loud.</li>
          </ol>
        </div>

        <CopyField label="Analyze endpoint" value={analyzeUrl} />
        <CopyField label="Method" value="POST" />
        <CopyField label="Header" value={contentTypeHeader} />
        <CopyField label="Body (JSON)" value={analyzeBody} />
        <CopyField label="Telegram decline URL" value={telegramDeclineUrl} />

        {!profile?.telegram_chat_id && (
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            Link Telegram in Settings before running the decline command step.
          </div>
        )}
      </div>
    </div>
  );
}