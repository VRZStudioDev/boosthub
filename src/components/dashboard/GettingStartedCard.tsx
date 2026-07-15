import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CopyField } from '../ui/CopyField';
import { useProfile } from '../../hooks/useProfile';

const SHADOWROCKET_URL = 'https://apps.apple.com/us/app/shadowrocket/id932747118';
const BOOSTHUB_CONF_URL =
  'https://raw.githubusercontent.com/VRZStudioDev/boosthub/main/boosthub_config/boosthub.conf';

function StepBadge({ done, doneLabel, pendingLabel }: { done: boolean; doneLabel: string; pendingLabel: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
        done
          ? 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300'
          : 'border-slate-500/30 bg-slate-500/10 text-slate-300'
      }`}
    >
      {done ? `✅ ${doneLabel}` : pendingLabel}
    </span>
  );
}

export function GettingStartedCard() {
  const { data: profile } = useProfile();

  const telegramLinked = Boolean(profile?.telegram_chat_id);
  const voiceConfigured = Boolean(profile?.voice_token);

  const completedSteps = useMemo(
    () => [telegramLinked, voiceConfigured].filter(Boolean).length,
    [telegramLinked, voiceConfigured],
  );

  const progressPercent = (completedSteps / 2) * 100;

  return (
    <div className="card mb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-white">Getting Started</h2>
          <p className="mt-1 text-sm text-slate-400">
            BoostHub runs in two layers: network (Shadowrocket + .conf) and decision (Siri + Edge Function).
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Complete the steps below. Steps 2 and 3 are verified automatically when configured.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
          Auto-verified: {completedSteps}/2
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-violet-500 to-emerald-500 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm font-semibold text-cyan-200">Step 1: Connectivity (Network)</p>
          </div>

          <p className="mt-2 text-sm text-slate-300">
            Download Shadowrocket and import the network profile.
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a
              href={SHADOWROCKET_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20 sm:w-auto"
            >
              Download Shadowrocket
            </a>
          </div>

          <div className="mt-3">
            <CopyField label=".conf URL" value={BOOSTHUB_CONF_URL} />
          </div>

          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            Open Shadowrocket &gt; Config &gt; Add Configuration &gt; paste the URL &gt; select and enable.
          </p>
        </section>

        <section className="rounded-2xl border border-violet-400/20 bg-violet-500/5 p-4">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-violet-200">Step 2: Linking (Telegram)</p>
            <StepBadge done={telegramLinked} doneLabel="Linked" pendingLabel="⏳ Pending" />
          </div>

          <p className="mt-2 text-sm text-slate-300">
            Link your Telegram account to receive notifications and status updates.
          </p>

          <div className="mt-4">
            <Link
              to="/settings#telegram-link"
              className="inline-flex w-full items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20 sm:w-auto"
            >
              Go to Telegram Link
            </Link>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Status and notifications depend on this link to work properly.
          </p>
        </section>

        <section className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-emerald-200">Step 3: Voice (Siri)</p>
            <StepBadge done={voiceConfigured} doneLabel="Configured" pendingLabel="⏳ Pending" />
          </div>

          <p className="mt-2 text-sm text-slate-300">
            Configure your voice assistant for instant decisions.
          </p>

          <div className="mt-4">
            <Link
              to="/settings#voice-assistant"
              className="inline-flex w-full items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 sm:w-auto"
            >
              Go to Voice Assistant
            </Link>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Generate your token, download the shortcut, and complete the Siri flow in the card below.
          </p>
        </section>
      </div>
    </div>
  );
}