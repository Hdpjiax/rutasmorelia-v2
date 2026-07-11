'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Navigation, List, LocateFixed, Eraser, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Props = {
  locating?: boolean;
  hasMapContent?: boolean;
  routeCount?: number;
  onPlan: () => void;
  onRoutes: () => void;
  onLocation: () => void;
  onClear: () => void;
};

/** Dock inferior pegado al borde real del viewport (safe-area iPhone). */
export function BottomDock({
  locating,
  hasMapContent,
  routeCount,
  onPlan,
  onRoutes,
  onLocation,
  onClear,
}: Props) {
  return (
    <motion.nav
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28, delay: 0.05 }}
      className="pointer-events-none absolute inset-x-0 bottom-0 z-40"
      style={{
        paddingLeft: 'max(0.5rem, var(--vm-safe-left))',
        paddingRight: 'max(0.5rem, var(--vm-safe-right))',
        paddingBottom: 'max(0.35rem, var(--vm-safe-bottom))',
        paddingTop: '0.25rem',
      }}
      aria-label="Acciones principales"
    >
      <div className="pointer-events-auto mx-auto flex w-full max-w-md items-stretch gap-0 rounded-xl border border-slate-200/80 bg-white/95 p-0.5 shadow-xl backdrop-blur-md sm:max-w-lg sm:gap-0.5 sm:rounded-2xl sm:p-1 sm:shadow-2xl md:max-w-xl md:gap-0.5 md:rounded-2xl md:p-1.5 lg:max-w-xl lg:p-1.5">
        <DockBtn onClick={onPlan} label="Viaje" icon={Navigation} tone="emerald" />
        <DockBtn
          onClick={onRoutes}
          label={routeCount && routeCount > 0 ? `Rutas` : 'Rutas'}
          icon={List}
          tone="sky"
          testId="open-routes"
        />
        <DockBtn
          onClick={onLocation}
          label="GPS"
          icon={locating ? Loader2 : LocateFixed}
          tone="emerald"
          spinning={locating}
          disabled={locating}
        />
        <DockBtn
          onClick={onClear}
          label="Limpiar"
          icon={Eraser}
          tone="rose"
          disabled={!hasMapContent}
          testId="clear-map"
        />
      </div>
    </motion.nav>
  );
}

function DockBtn({
  onClick,
  label,
  icon: Icon,
  tone,
  spinning,
  disabled,
  testId,
}: {
  onClick: () => void;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'emerald' | 'sky' | 'rose';
  spinning?: boolean;
  disabled?: boolean;
  testId?: string;
}) {
  const color =
    tone === 'emerald' ? 'text-emerald-700' : tone === 'sky' ? 'text-sky-700' : 'text-rose-600';
  const hover =
    tone === 'emerald'
      ? 'hover:bg-emerald-50'
      : tone === 'sky'
        ? 'hover:bg-sky-50'
        : 'hover:bg-rose-50';
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // Móvil compacto; escritorio un poco más grande (sin pasarse)
        'flex min-h-11 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-slate-800 transition cursor-pointer disabled:opacity-40 sm:min-h-12 sm:gap-1 sm:rounded-xl sm:px-1 sm:py-2 md:min-h-[3.5rem] md:gap-1 md:rounded-xl md:px-1.5 md:py-2 lg:min-h-14',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700',
        hover
      )}
    >
      <Icon
        className={cn(
          'h-5 w-5 shrink-0 sm:h-6 sm:w-6 md:h-7 md:w-7 lg:h-7 lg:w-7',
          color,
          spinning && 'animate-spin'
        )}
        aria-hidden
      />
      <span className="max-w-full truncate text-[10px] font-bold leading-none sm:text-[11px] md:text-xs lg:text-[13px]">
        {label}
      </span>
    </button>
  );
}
