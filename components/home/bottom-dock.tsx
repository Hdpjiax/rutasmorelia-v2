'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Navigation, List, LocateFixed, Eraser, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type Props = {
  locating?: boolean;
  /** GPS en vivo activo (punto azul moviéndose) */
  gpsLive?: boolean;
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
  gpsLive,
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
      <div className="pointer-events-auto mx-auto flex w-full max-w-md items-stretch gap-0 rounded-xl border border-slate-200/80 bg-white/95 p-0.5 shadow-xl backdrop-blur-md sm:max-w-md sm:gap-0.5 sm:rounded-2xl sm:p-1 sm:shadow-2xl md:max-w-lg md:p-1">
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
          label={gpsLive ? 'En vivo' : 'GPS'}
          icon={locating ? Loader2 : LocateFixed}
          tone="emerald"
          spinning={locating}
          disabled={locating}
          active={gpsLive}
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
  active,
}: {
  onClick: () => void;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'emerald' | 'sky' | 'rose';
  spinning?: boolean;
  disabled?: boolean;
  testId?: string;
  active?: boolean;
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
      aria-pressed={active || undefined}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        // Móvil compacto; escritorio solo un poco más grande
        'flex min-h-11 min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-slate-800 transition cursor-pointer disabled:opacity-40 sm:min-h-11 sm:gap-0.5 sm:rounded-xl sm:px-1 sm:py-1.5 md:min-h-12 md:py-2',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700',
        hover,
        active && 'bg-emerald-50 ring-1 ring-emerald-300'
      )}
    >
      <Icon
        className={cn(
          'h-5 w-5 shrink-0 sm:h-5 sm:w-5 md:h-6 md:w-6',
          color,
          spinning && 'animate-spin',
          active && 'text-emerald-600'
        )}
        aria-hidden
      />
      <span className="max-w-full truncate text-[10px] font-bold leading-none sm:text-[10px] md:text-[11px]">
        {label}
      </span>
    </button>
  );
}
