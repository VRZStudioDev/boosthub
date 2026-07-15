import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../hooks/useProfile';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../feedback/ToastProvider';

function toNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

interface Verdict {
  label: string;
  className: string;
  hint: string;
}

function getVerdict(perMile: number, target: number): Verdict {
  if (perMile <= 0) {
    return { label: '—', className: 'text-slate-400', hint: 'Enter pay and distance to evaluate.' };
  }
  if (perMile >= target) {
    return {
      label: 'Worth it',
      className: 'text-accent-green',
      hint: 'This order meets your target rate.',
    };
  }
  if (perMile >= target * 0.8) {
    return {
      label: 'Marginal',
      className: 'text-amber-400',
      hint: 'Close to your target — consider distance and demand.',
    };
  }
  return {
    label: 'Below target',
    className: 'text-red-400',
    hint: 'This order pays less than your target per mile.',
  };
}

export function EarningsCalculator() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [pay, setPay] = useState('');
  const [miles, setMiles] = useState('');
  const [gasPrice, setGasPrice] = useState('');
  const [mpg, setMpg] = useState('');
  const [target, setTarget] = useState('1.50');
  const [savingDefaults, setSavingDefaults] = useState(false);

  useEffect(() => {
    if (profile?.gas_price && !gasPrice) setGasPrice(String(profile.gas_price));
    if (profile?.mpg && !mpg) setMpg(String(profile.mpg));
  }, [gasPrice, mpg, profile?.gas_price, profile?.mpg]);

  const result = useMemo(() => {
    const payNum = toNumber(pay);
    const milesNum = toNumber(miles);
    const gasNum = toNumber(gasPrice);
    const mpgNum = toNumber(mpg);

    const fuelCost = mpgNum > 0 ? (milesNum / mpgNum) * gasNum : 0;
    const net = payNum - fuelCost;
    const grossPerMile = milesNum > 0 ? payNum / milesNum : 0;
    const netPerMile = milesNum > 0 ? net / milesNum : 0;

    return { fuelCost, net, grossPerMile, netPerMile };
  }, [pay, miles, gasPrice, mpg]);

  const verdict = getVerdict(result.netPerMile || result.grossPerMile, toNumber(target) || 1.5);
  const money = (n: number) => `$${n.toFixed(2)}`;

  async function saveDefaults() {
    if (!user) return;
    const nextGasPrice = toNumber(gasPrice);
    const nextMpg = toNumber(mpg);
    if (nextGasPrice <= 0 || nextMpg <= 0) {
      toast.error('Enter a positive gas price and MPG before saving.');
      return;
    }

    setSavingDefaults(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ gas_price: nextGasPrice, mpg: nextMpg })
        .eq('id', user.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      toast.success('Analysis defaults saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save defaults.');
    } finally {
      setSavingDefaults(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Cost-per-mile calculator</h2>
        <span className="text-xs text-slate-500">Decide before you accept</span>
      </div>
      <p className="mt-1 text-sm text-slate-400">
        Estimate what an order really pays per mile so you only take what&apos;s worth it.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Input
          label="Order pay ($)"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="7.50"
          value={pay}
          onChange={(e) => setPay(e.target.value)}
        />
        <Input
          label="Distance (mi)"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.1"
          placeholder="4.2"
          value={miles}
          onChange={(e) => setMiles(e.target.value)}
        />
        <Input
          label="Gas price ($/gal)"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="3.60"
          value={gasPrice}
          onChange={(e) => setGasPrice(e.target.value)}
        />
        <Input
          label="Vehicle MPG"
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          placeholder="28"
          value={mpg}
          onChange={(e) => setMpg(e.target.value)}
        />
      </div>

      

      <div className="mt-4">
        <Input
          label="Target ($/mile)"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.05"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          hint="Your minimum acceptable rate. A common starting point is $1.50/mi."
        />
      </div>

    <Button
        variant="secondary"
        size="sm"
        className="mt-4 w-full sm:w-auto"
        loading={savingDefaults}
        onClick={saveDefaults}
      >
        Save analysis defaults
      </Button>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Gross / mi" value={money(result.grossPerMile)} />
        <Stat label="Est. fuel" value={money(result.fuelCost)} />
        <Stat label="Net payout" value={money(result.net)} />
        <Stat label="Net / mi" value={money(result.netPerMile)} highlight />
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-white/10 bg-navy-950/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className={`text-base font-semibold ${verdict.className}`}>{verdict.label}</p>
          <p className="text-xs text-slate-500">{verdict.hint}</p>
        </div>
        <span className={`text-xl font-extrabold sm:text-2xl ${verdict.className}`}>
          {money(result.netPerMile || result.grossPerMile)}
          <span className="text-sm font-medium text-slate-500">/mi</span>
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 ${
        highlight ? 'border-accent-cyan/30 bg-accent-cyan/5' : 'border-white/10 bg-navy-950/40'
      }`}
    >
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${highlight ? 'text-accent-cyan' : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}
