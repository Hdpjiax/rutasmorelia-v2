'use client';

import * as React from 'react';
import { cn } from '@/lib/utils/cn';

const variants = {
  default: 'border-transparent bg-emerald-700 text-white',
  secondary: 'border-transparent bg-slate-200 text-slate-900',
  outline: 'border-slate-300 bg-white text-slate-800',
  warn: 'border-amber-300 bg-amber-50 text-amber-950',
} as const;

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: keyof typeof variants }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
