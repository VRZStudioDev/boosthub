import { type ReactNode, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { BarChart3, DollarSign, ThumbsDown } from 'lucide-react';
import { useDecisionsStats } from '../../hooks/useDecisionsStats';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/shadcn/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/shadcn/card';
import { Skeleton } from '../ui/shadcn/skeleton';

interface DecisionsStatsProps {
  className?: string;
}

interface AnimatedValues {
  declines: number;
  savings: number;
  rate: number;
}

const initialAnimatedValues: AnimatedValues = {
  declines: 0,
  savings: 0,
  rate: 0,
};

function formatUsd(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function useIsInView<T extends HTMLElement>(threshold = 0.25) {
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

export function DecisionsStats({ className }: DecisionsStatsProps) {
  const { data, isLoading, isError } = useDecisionsStats();
  const { ref, isInView } = useIsInView<HTMLDivElement>(0.35);

  const [animatedValues, setAnimatedValues] = useState<AnimatedValues>(initialAnimatedValues);
  const animatedRef = useRef<AnimatedValues>(initialAnimatedValues);

  useEffect(() => {
    if (!data || !isInView) return;

    const startValues = { ...animatedRef.current };

    const tween = gsap.to(startValues, {
      declines: data.declines,
      savings: data.estimatedSavings,
      rate: data.declineRate,
      duration: 1,
      ease: 'power2.out',
      onUpdate: () => {
        const next = {
          declines: startValues.declines,
          savings: startValues.savings,
          rate: startValues.rate,
        };
        animatedRef.current = next;
        setAnimatedValues(next);
      },
    });

    return () => {
      tween.kill();
    };
  }, [data, isInView]);

  return (
    <Card ref={ref} className={cn('border-gray-700 bg-gray-800', className)}>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold text-white">Decisions summary</CardTitle>
            <CardDescription>30-day performance from accept/decline commands.</CardDescription>
          </div>
          <Badge variant="secondary">Last 30 days</Badge>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        ) : isError || !data ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            Could not load your decision stats right now.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              icon={<ThumbsDown className="h-4 w-4" />}
              title="Declines"
              value={Math.round(animatedValues.declines).toString()}
              subtitle="Decisions declined"
              badge="30d"
            />

            <StatCard
              icon={<DollarSign className="h-4 w-4" />}
              title="Estimated Savings"
              value={formatUsd(animatedValues.savings)}
              subtitle="Sum of declined amounts"
              badge="USD"
            />

            <StatCard
              icon={<BarChart3 className="h-4 w-4" />}
              title="Decline Rate"
              value={`${animatedValues.rate.toFixed(1)}%`}
              subtitle={`${data.totalDecisions} decisions tracked`}
              badge="Rate"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
  badge,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  subtitle: string;
  badge: string;
}) {
  return (
    <Card className="h-full border-gray-700 bg-gray-900/70 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
          {icon}
        </div>
        <Badge variant="outline">{badge}</Badge>
      </div>
      <p className="mt-4 text-sm text-gray-400">{title}</p>
      <p className="mt-1 text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
    </Card>
  );
}