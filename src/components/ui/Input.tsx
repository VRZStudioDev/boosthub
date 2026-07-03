import { forwardRef, type InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, id, className = '', ...props },
  ref,
) {
  const inputId = id ?? props.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`w-full rounded-xl border border-white/10 bg-navy-800/60 px-4 py-3 text-white placeholder:text-slate-500 transition focus:border-accent-cyan/60 focus:outline-none focus:ring-2 focus:ring-accent-cyan/30 ${className}`}
        {...props}
      />
      {hint && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
});
