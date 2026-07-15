import * as React from 'react';
import { cn } from '../../../lib/utils';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'outline';

const variants: Record<BadgeVariant, string> = {
  default: 'border-transparent bg-cyan-600 text-white',
  secondary: 'border-transparent bg-gray-700 text-gray-100',
  success: 'border-transparent bg-emerald-600/20 text-emerald-300',
  warning: 'border-transparent bg-amber-500/20 text-amber-300',
  outline: 'border-gray-600 text-gray-200',
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}