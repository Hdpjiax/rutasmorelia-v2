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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28, delay: 0.05 }}
      className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none"
      aria-label="Acciones principales"
    >
      <div className="pointer-events-auto vm-panel flex w-full max-w-md items-stretch gap-1 rounded-2xl border p-1.5 shadow-2xl">
        <DockBtn onClick={onPlan} label="Viaje" icon={Navigation} tone="emerald" />
        <DockBtn
          onClick={onRoutes}
          label={routeCount ? `Rutas (${routeCount})` : 'Rutas'}
          icon={List}
          tone="sky"
          testId="open-routes"
        />
        <DockBtn
          onClick={onLocation}
          label="Ubicación"
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
        'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-slate-800 transition cursor-pointer disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700',
        hover
      )}
    >
      <Icon className={cn('h-5 w-5', color, spinning && 'animate-spin')} aria-hidden />
      <span className="text-[10px] font-bold">{label}</span>
    </button>
  );
}
