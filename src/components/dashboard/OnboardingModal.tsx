import { type ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Mic, Wifi } from 'lucide-react';

const ONBOARDING_SEEN_KEY = 'boosthub_onboarding_seen';
const SHADOWROCKET_URL = 'https://apps.apple.com/us/app/shadowrocket/id932747118';
const TOTAL_STEPS = 3;

function markSeen() {
  window.localStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
}

export function OnboardingModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = window.localStorage.getItem(ONBOARDING_SEEN_KEY) === 'true';
    if (!seen) setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function closeModal() {
    markSeen();
    setOpen(false);
    setStep(0);
  }

  function goToVoiceStep() {
    closeModal();
    window.setTimeout(() => {
      document.getElementById('voice-assistant')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function goNextStep() {
    setStep((current) => Math.min(current + 1, TOTAL_STEPS - 1));
  }

  function goPreviousStep() {
    setStep((current) => Math.max(current - 1, 0));
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-navy-950/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={closeModal}
    >
      <div
        className="mx-auto mt-6 w-full max-w-2xl rounded-2xl border border-white/10 bg-gradient-to-br from-navy-900 via-navy-900 to-navy-800 p-5 shadow-2xl sm:mt-12 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">Welcome to BoostHub</h2>
            <p className="mt-1 text-sm text-slate-300">
              Complete this 3-step setup to unlock your dashboard automation flow.
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Close onboarding"
          >
            X
          </button>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Step {step + 1} of {TOTAL_STEPS}
          </p>
          <div className="flex items-center gap-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, idx) => (
              <span
                key={idx}
                className={`h-1.5 w-8 rounded-full transition ${
                  idx <= step ? 'bg-cyan-300' : 'bg-white/15'
                }`}
                aria-hidden="true"
              />
            ))}
          </div>
        </div>

        <div className="mt-3">
          {step === 0 && (
            <StepItem
              icon={<Wifi className="h-4 w-4" />}
              title="Network Prerequisites"
              description="Install Shadowrocket first so your setup stack is ready before linking automations."
              action={
                <a
                  href={SHADOWROCKET_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20 sm:w-auto"
                >
                  Open Shadowrocket in App Store
                </a>
              }
            />
          )}

          {step === 1 && (
            <StepItem
              icon={<MessageCircle className="h-4 w-4" />}
              title="Connect Telegram"
              description="Link your Telegram account to receive updates and keep your account synced."
              action={
                <Link
                  to="/settings#telegram-link"
                  onClick={closeModal}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-500/20 sm:w-auto"
                >
                  Go to Telegram Settings
                </Link>
              }
            />
          )}

          {step === 2 && (
            <StepItem
              icon={<Mic className="h-4 w-4" />}
              title="Set Up Voice Assistant"
              description="Finish by configuring Siri voice commands for fast, hands-free order decisions."
              action={
                <button
                  type="button"
                  onClick={goToVoiceStep}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20 sm:w-auto"
                >
                  Open Voice Setup Section
                </button>
              }
            />
          )}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={closeModal}
            className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            Skip setup
          </button>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={goPreviousStep}
              disabled={step === 0}
              className="inline-flex flex-1 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
            >
              Back
            </button>
            {step < TOTAL_STEPS - 1 ? (
              <button
                type="button"
                onClick={goNextStep}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-accent-cyan to-accent-green px-5 py-2 text-sm font-semibold text-navy-950 transition hover:scale-[1.02] sm:flex-none"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-accent-cyan to-accent-green px-5 py-2 text-sm font-semibold text-navy-950 transition hover:scale-[1.02] sm:flex-none"
              >
                Finish setup
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepItem({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-navy-950/60 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
          <div className="mt-3">{action}</div>
        </div>
      </div>
    </div>
  );
}