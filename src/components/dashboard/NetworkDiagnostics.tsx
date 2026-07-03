import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
const HEALTH_ENDPOINT = `${SUPABASE_URL}/auth/v1/health`;
const PING_COUNT = 3;

type Status = 'checking' | 'operational' | 'degraded' | 'offline';

const STATUS_META: Record<Status, { label: string; dot: string; text: string }> = {
  checking: { label: 'Checking…', dot: 'bg-slate-400', text: 'text-slate-300' },
  operational: { label: 'Operational', dot: 'bg-accent-green', text: 'text-accent-green' },
  degraded: { label: 'Degraded', dot: 'bg-amber-400', text: 'text-amber-400' },
  offline: { label: 'Unreachable', dot: 'bg-red-400', text: 'text-red-400' },
};

async function pingOnce(signal: AbortSignal): Promise<number> {
  const start = performance.now();
  const res = await fetch(HEALTH_ENDPOINT, {
    method: 'GET',
    headers: { apikey: SUPABASE_ANON_KEY },
    cache: 'no-store',
    signal,
  });
  if (!res.ok) throw new Error(`Health check returned ${res.status}`);
  return performance.now() - start;
}

function classify(latency: number): Status {
  if (latency < 300) return 'operational';
  return 'degraded';
}

export function NetworkDiagnostics() {
  const [status, setStatus] = useState<Status>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runCheck = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('checking');
    setLatency(null);

    try {
      const samples: number[] = [];
      for (let i = 0; i < PING_COUNT; i++) {
        samples.push(await pingOnce(controller.signal));
      }
      const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
      setLatency(avg);
      setStatus(classify(avg));
      setLastChecked(new Date());
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setStatus('offline');
      setLatency(null);
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    runCheck();
    return () => abortRef.current?.abort();
  }, [runCheck]);

  const meta = STATUS_META[status];
  const isChecking = status === 'checking';

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Network diagnostics</h2>
        <span className="text-xs text-slate-500">API connectivity</span>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Check your connection to the BoostHub API so you know the app is reachable before your shift.
      </p>

      <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-navy-950/60 px-4 py-4">
        <div className="flex items-center gap-3">
          {isChecking ? (
            <Spinner className="h-4 w-4 text-slate-400" />
          ) : (
            <span className={`relative flex h-3 w-3`}>
              <span className={`absolute inline-flex h-full w-full rounded-full ${meta.dot} opacity-60 ${status === 'operational' ? 'animate-ping' : ''}`} />
              <span className={`relative inline-flex h-3 w-3 rounded-full ${meta.dot}`} />
            </span>
          )}
          <div>
            <p className={`text-base font-semibold ${meta.text}`}>{meta.label}</p>
            {lastChecked && (
              <p className="text-xs text-slate-500">
                Checked {lastChecked.toLocaleTimeString(undefined, { timeStyle: 'short' })}
              </p>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="text-2xl font-extrabold text-white">
            {latency !== null ? latency : '—'}
            <span className="text-sm font-medium text-slate-500"> ms</span>
          </p>
          <p className="text-xs text-slate-500">avg latency</p>
        </div>
      </div>

      <Button variant="secondary" size="sm" className="mt-4" onClick={runCheck} disabled={isChecking}>
        Run check
      </Button>
    </div>
  );
}
