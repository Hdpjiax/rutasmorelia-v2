'use client';

import React from 'react';
import { Share2 } from 'lucide-react';
import type { Route } from '@/lib/supabase/client';
import type { RouteDirection } from '@/lib/gis/direction-mode';
import { normalizeTransportType } from '@/lib/transport/classify';
import { parseRouteDisplay } from '@/lib/routes/route-display';

type Props = {
  route: Route;
  routeDirection: 'both' | RouteDirection;
  onDirectionChange: (d: 'both' | RouteDirection) => void;
  onRemove: () => void;
  onShare: () => void;
  onDetails: () => void;
  onReport: () => void;
};

export function SelectedRouteCard({
  route,
  routeDirection,
  onDirectionChange,
  onRemove,
  onShare,
  onDetails,
  onReport,
}: Props) {
  const kind = normalizeTransportType(route.transport_type, route.id, route.name);
  const info = parseRouteDisplay(route);

  return (
    <div
      className="vm-panel w-full max-w-md rounded-2xl border px-3 py-2.5 shadow-xl"
      role="status"
      aria-live="polite"
      aria-label={`Ruta seleccionada: ${route.name}`}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-white shadow"
          style={{ backgroundColor: route.color || '#10b981' }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{route.name}</p>
          <p className="text-[11px] text-slate-600">
            {kind === 'combi' ? 'Combi' : 'Autobús'} · Ruta completa
            {info.corridorLabel ? ` · ${info.corridorLabel}` : ''}
          </p>
        </div>
      </div>

      <div className="mt-2 flex gap-1" role="group" aria-label="Sentido de la ruta">
        {(
          [
            { id: 'both' as const, label: 'Ambos' },
            { id: 'ida' as const, label: 'Ida' },
            { id: 'vuelta' as const, label: 'Vuelta' },
          ] as const
        ).map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={routeDirection === d.id}
            onClick={() => onDirectionChange(d.id)}
            className={`min-h-9 flex-1 touch-manipulation rounded-lg border px-2 py-1.5 text-[10px] font-bold cursor-pointer ${
              routeDirection === d.id
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onRemove}
          className="min-h-10 flex-1 touch-manipulation rounded-xl bg-slate-100 px-2 py-2 text-[11px] font-bold text-slate-700 cursor-pointer hover:bg-slate-200"
        >
          Quitar
        </button>
        <button
          type="button"
          onClick={onShare}
          className="min-h-10 flex-1 touch-manipulation rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-800 cursor-pointer hover:bg-slate-50"
        >
          <span className="inline-flex items-center justify-center gap-1">
            <Share2 className="h-3.5 w-3.5" aria-hidden /> Compartir
          </span>
        </button>
        <button
          type="button"
          onClick={onDetails}
          className="min-h-10 flex-1 touch-manipulation rounded-xl bg-emerald-600 px-2 py-2 text-[11px] font-bold text-white cursor-pointer hover:bg-emerald-700"
        >
          Detalles
        </button>
        <button
          type="button"
          onClick={onReport}
          className="min-h-10 w-full touch-manipulation rounded-xl border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] font-bold text-amber-950 cursor-pointer hover:bg-amber-100"
        >
          Reportar un problema
        </button>
      </div>
    </div>
  );
}
