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
      className={`rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-center md:rounded-3xl md:p-6 lg:p-7 ${className}`}
      role="status"
      data-testid={`empty-state-${variant}`}
    >
      <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 md:mb-3 md:h-14 md:w-14">
        <Icon className="h-5 w-5 text-slate-500 md:h-7 md:w-7" aria-hidden />
      </div>
      <p className="text-sm font-bold text-slate-900 md:text-xl lg:text-2xl">{title}</p>
      {description && (
        <p className="mt-1 text-[12px] leading-snug text-slate-600 md:mt-2 md:text-base md:leading-relaxed lg:text-lg">
          {description}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-2 md:mt-5 md:gap-2.5">
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white cursor-pointer hover:bg-emerald-700 md:min-h-13 md:rounded-2xl md:py-3.5 md:text-base"
          >
            {actionLabel}
          </button>
        )}
        {secondaryLabel && onSecondary && (
          <button
            type="button"
            onClick={onSecondary}
            className="w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-50 md:min-h-12 md:rounded-2xl md:py-3 md:text-base"
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}
