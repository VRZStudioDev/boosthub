import { Link } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { ButtonLink } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useBilling } from '../hooks/useBilling';
import { Button } from '../components/ui/Button';
import { MONTHLY_PRICE_LABEL } from '../lib/stripe';

const features = [
  {
    title: 'Cost-Per-Mile Analysis',
    description:
      'See what an order truly pays per mile after fuel, so you can spot unprofitable trips before you accept them.',
    image: 'https://picsum.photos/seed/boosthub-earnings/640/400',
    icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z',
  },
  {
    title: 'Network Diagnostics',
    description:
      'Check your connection to the BoostHub API and see real-time latency, so you know the app is reachable before your shift.',
    image: 'https://picsum.photos/seed/boosthub-network/640/400',
    icon: 'M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z',
  },
  {
    title: 'Voice Automation (Siri)',
    description:
      'Trigger your own custom Siri actions — open your favorite apps, send a quick message, or start a timer — all hands-free.',
    image: 'https://picsum.photos/seed/boosthub-voice/640/400',
    icon: 'M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z',
  },
];

const steps = [
  {
    step: '1',
    title: 'Create your account',
    body: 'Sign up in seconds with a magic link — no passwords to remember.',
  },
  {
    step: '2',
    title: 'Set your target rate',
    body: 'Tell BoostHub your minimum cost-per-mile so it can flag orders worth taking.',
  },
  {
    step: '3',
    title: 'Drive smarter',
    body: 'Evaluate orders, run voice shortcuts, and track your activity — all from one dashboard.',
  },
];

function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-96 w-96 -translate-x-1/2 rounded-full bg-accent-cyan/20 blur-3xl" />
        <div className="absolute right-0 top-40 h-72 w-72 rounded-full bg-accent-green/10 blur-3xl" />
      </div>

      <div className="container-page relative py-20 text-center sm:py-28">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-medium text-slate-300 animate-fade-in-up">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-green" />
          Built for gig drivers, by people who get it
        </span>

        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-6xl animate-fade-in-up">
          Automate Your Workflow.{' '}
          <span className="gradient-text">Maximize Your Earnings.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-400 animate-fade-in-up">
          Use voice commands to manage your gig workflow. Track mileage, evaluate orders, and keep
          your focus on the road.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-in-up">
          <ButtonLink to="/signup" size="lg" className="animate-pulse-glow">
            Start Saving Time
          </ButtonLink>
          <Link
            to="/#features"
            className="text-sm font-semibold text-slate-300 transition hover:text-white"
          >
            See how it works →
          </Link>
        </div>

        <p className="mt-5 text-sm text-slate-500">
          {MONTHLY_PRICE_LABEL}/month · Cancel anytime
        </p>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="container-page scroll-mt-20 py-16">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">Everything you need to drive smarter</h2>
        <p className="mt-4 text-slate-400">
          BoostHub keeps your workflow moving so you can focus on what pays.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="card overflow-hidden p-0 transition hover:border-accent-cyan/30 hover:shadow-accent-cyan/10"
          >
            <img
              src={f.image}
              alt={f.title}
              loading="lazy"
              className="h-40 w-full object-cover"
            />
            <div className="p-6">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-accent-cyan/20 to-accent-green/20 text-accent-cyan">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d={f.icon} />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">{f.title}</h3>
              <p className="text-sm leading-relaxed text-slate-400">{f.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="border-y border-white/5 bg-navy-900/40 py-16">
      <div className="container-page">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl">Up and running in minutes</h2>
          <p className="mt-4 text-slate-400">Three simple steps between you and a smoother shift.</p>
        </div>
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.step} className="relative text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-accent-cyan/30 bg-navy-950 text-lg font-bold text-accent-cyan">
                {s.step}
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">{s.title}</h3>
              <p className="text-sm text-slate-400">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const perks = [
  'Voice-triggered custom shortcuts',
  'Real-time cost-per-mile insights',
  'Trigger history & usage logs',
  'Works with Siri & your existing tools',
  'Cancel anytime, no contracts',
];

function PricingSection() {
  const { user } = useAuth();
  const { startCheckout, loadingCheckout } = useBilling();

  return (
    <section id="pricing" className="container-page scroll-mt-20 py-16">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <h2 className="text-3xl font-bold text-white sm:text-4xl">Simple, honest pricing</h2>
        <p className="mt-4 text-slate-400">One plan. Everything included. No surprises.</p>
      </div>

      <div className="mx-auto max-w-md">
        <div className="card relative overflow-hidden border-accent-cyan/30 shadow-accent-cyan/10">
          <div className="absolute right-0 top-0 rounded-bl-xl bg-gradient-to-r from-accent-cyan to-accent-green px-3 py-1 text-xs font-bold text-navy-950">
            MOST POPULAR
          </div>
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-cyan">Pro</p>
          <div className="mt-3 flex items-end gap-1">
            <span className="text-5xl font-extrabold text-white">{MONTHLY_PRICE_LABEL}</span>
            <span className="mb-1.5 text-slate-400">/month</span>
          </div>

          <ul className="mt-6 space-y-3">
            {perks.map((perk) => (
              <li key={perk} className="flex items-start gap-3 text-sm text-slate-300">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-green" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                {perk}
              </li>
            ))}
          </ul>

          <div className="mt-8">
            {user ? (
              <Button fullWidth size="lg" loading={loadingCheckout} onClick={startCheckout}>
                Subscribe Now
              </Button>
            ) : (
              <ButtonLink to="/signup" fullWidth size="lg">
                Start Saving Time
              </ButtonLink>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">Secure checkout powered by Stripe</p>
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="container-page py-16">
      <div className="card relative overflow-hidden bg-gradient-to-br from-navy-800 to-navy-900 text-center">
        <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-accent-cyan/20 blur-3xl" />
        <h2 className="relative text-3xl font-bold text-white">Work smarter, not harder.</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-slate-400">
          Stop wasting time on unprofitable deliveries. Track your real earnings per mile and let
          voice automation handle the rest.
        </p>
        <div className="relative mt-8">
          <ButtonLink to="/signup" size="lg">
            Get Started Free
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <PageLayout>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <CtaSection />
    </PageLayout>
  );
}
