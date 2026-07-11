'use client';

import React from 'react';
import { AlertCircle, MapPinOff, NavigationOff, SearchX, WifiOff } from 'lucide-react';

type Variant = 'no-gps' | 'no-routes' | 'geocode-down' | 'generic' | 'no-results';

const ICONS = {
  'no-gps': MapPinOff,
  'no-routes': NavigationOff,
  'geocode-down': WifiOff,
  generic: AlertCircle,
  'no-results': SearchX,
} as const;

type Props = {
  variant?: Variant;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  className?: string;
};

export function EmptyState({
  variant = 'generic',
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  className = '',
}: Props) {
  const Icon = ICONS[variant];
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-center md:p-3.5 ${className}`}
      role="status"
      data-testid={`empty-state-${variant}`}
    >
      <div className="mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 md:h-10 md:w-10">
        <Icon className="h-4.5 w-4.5 text-slate-500 md:h-5 md:w-5" aria-hidden />
      </div>
      <p className="text-sm font-bold text-slate-900 md:text-sm">{title}</p>
      {description && (
        <p className="mt-1 text-[12px] leading-snug text-slate-600 md:text-[12px]">
          {description}
        </p>
      )}
      <div className="mt-2.5 flex flex-col gap-1.5 md:mt-3">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="w-full rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white cursor-pointer hover:bg-emerald-700 md:min-h-9 md:py-2 md:text-xs"
          >
            {actionLabel}
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-50 md:min-h-9 md:py-2 md:text-xs"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
