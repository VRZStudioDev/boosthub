import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { MONTHLY_PRICE_USD } from '../../lib/stripe';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/shadcn/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/shadcn/card';
import { Slider } from '../ui/shadcn/slider';

const WEEKS_PER_MONTH = 4.33;

function formatUsd(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, isInView };
}

export function RoiCalculatorSection() {
  const [badRunsPerDay, setBadRunsPerDay] = useState(5);
  const [avgBadRunValue, setAvgBadRunValue] = useState(4);
  const [workDaysPerWeek, setWorkDaysPerWeek] = useState(6);

  const { ref, isInView } = useInView<HTMLDivElement>(0.25);

  const monthlySavings = useMemo(() => {
    return badRunsPerDay * avgBadRunValue * workDaysPerWeek * WEEKS_PER_MONTH;
  }, [avgBadRunValue, badRunsPerDay, workDaysPerWeek]);

  const [animatedSavings, setAnimatedSavings] = useState(0);
  const animatedRef = useRef({ value: 0 });

  useEffect(() => {
    if (!isInView) return;

    const tween = gsap.to(animatedRef.current, {
      value: monthlySavings,
      duration: 0.9,
      ease: 'power2.out',
      onUpdate: () => {
        setAnimatedSavings(animatedRef.current.value);
      },
    });

    return () => {
      tween.kill();
    };
  }, [isInView, monthlySavings]);

  const effectiveSavings = animatedSavings;
  const roiTimes = MONTHLY_PRICE_USD > 0 ? effectiveSavings / MONTHLY_PRICE_USD : 0;

  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4" ref={ref}>
        <img
        src="/motoboy-3.png"
        alt="How it works"
        className="mx-auto  w-full max-w-2xl"
        style={{ height: 'auto' }}
      />
        <Card
          className={cn(
            'border-white/10 bg-navy-900/70 backdrop-blur transition-all duration-700',
            isInView ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
          )}
        >
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-2xl sm:text-3xl">ROI calculator</CardTitle>
                <CardDescription>
                  Simulate how much low-paying orders cost you every month.
                </CardDescription>
              </div>
              <Badge variant="secondary">Interactive</Badge>
            </div>
          </CardHeader>

          <CardContent>
            <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
              <div className="space-y-6">
                <SliderField
                  label="Bad orders per day"
                  value={badRunsPerDay}
                  min={1}
                  max={20}
                  step={1}
                  onChange={setBadRunsPerDay}
                  formatValue={(v) => `${Math.round(v)} orders`}
                />

                <SliderField
                  label="Average bad order value"
                  value={avgBadRunValue}
                  min={2}
                  max={20}
                  step={0.5}
                  onChange={setAvgBadRunValue}
                  formatValue={(v) => formatUsd(v)}
                />

                <SliderField
                  label="Working days per week"
                  value={workDaysPerWeek}
                  min={1}
                  max={7}
                  step={1}
                  onChange={setWorkDaysPerWeek}
                  formatValue={(v) => `${Math.round(v)} days`}
                />
              </div>

              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-6">
                <p className="text-sm text-slate-400">Estimated result</p>
                <p className="mt-3 text-4xl font-extrabold text-cyan-300 sm:text-5xl">
                  {formatUsd(effectiveSavings)}
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  With BoostHub, you save about {formatUsd(effectiveSavings)} per month.
                  {' '}That is {roiTimes.toFixed(1)}x the monthly subscription price.
                </p>

                <div className="mt-6 rounded-xl border border-white/10 bg-navy-950/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Subscription impact</p>
                  <p className="mt-2 text-xl font-semibold text-white">
                    {roiTimes.toFixed(1)}x the monthly subscription price
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Current monthly plan: {formatUsd(MONTHLY_PRICE_USD)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue: (value: number) => string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-white">{label}</label>
        <span className="rounded-md border border-white/10 bg-navy-950/60 px-2 py-1 text-sm text-cyan-300">
          {formatValue(value)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(nextValue) => onChange(nextValue[0] ?? value)}
      />
      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
        <span>{formatValue(min)}</span>
        <span>{formatValue(max)}</span>
      </div>
    </div>
  );
}