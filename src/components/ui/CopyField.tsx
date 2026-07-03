import { useState } from 'react';
import { useToast } from '../feedback/ToastProvider';

/** A read-only value with a one-click copy button. */
export function CopyField({ value, label }: { value: string; label?: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success('Copied to clipboard');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy. Copy it manually.');
    }
  }

  return (
    <div className="w-full">
      {label && <p className="mb-1.5 text-sm font-medium text-slate-300">{label}</p>}
      <div className="flex items-stretch gap-2">
        <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-xl border border-white/10 bg-navy-950/70 px-4 py-3 text-sm text-accent-cyan">
          {value}
        </code>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-medium text-slate-200 transition hover:border-accent-cyan/50 hover:bg-white/10"
          aria-label="Copy to clipboard"
        >
          {copied ? (
            <svg className="h-4 w-4 text-accent-green" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75"
              />
            </svg>
          )}
          <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
}
