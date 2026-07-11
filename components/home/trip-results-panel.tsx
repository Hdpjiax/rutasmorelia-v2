'use client';

import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowRightLeft,
  Bus,
  Footprints,
  Loader2,
  Share2,
  Link2,
  LocateFixed,
} from 'lucide-react';
import type { TripPlan } from '@/lib/routing/planner';
import {
  formatDistanceKm,
  formatDurationSec,
  formatWalkMeters,
  type PlanSortMode,
  transferCount,
} from '@/lib/trip/format';
import { EmptyState } from '@/components/ui/empty-state';

type Props = {
  planning: boolean;
  geometriesLoading: boolean;
  planningError: string | null;
  tripPlans: TripPlan[];
  sortedPlans: Array<{ plan: TripPlan; idx: number }>;
  selectedPlanIndex: number;
  planTypeFilter: 'all' | 'direct' | 'transfer';
  planSort: PlanSortMode;
  directCount: number;
  transferCountPlans: number;
  originCoords: boolean;
  geocodeDegraded?: boolean;
  activeTrackingIndex?: number | null;
  onToggleTracking?: (idx: number) => void;
  onSelectPlan: (idx: number) => void;
  onPlanTypeFilter: (f: 'all' | 'direct' | 'transfer') => void;
  onPlanSort: (s: PlanSortMode) => void;
  onStartSearch: () => void;
  onBrowseRoutes: () => void;
  onShare: () => void;
  onCopyLink: () => void;
};

export function TripResultsPanel({
  planning,
  geometriesLoading,
  planningError,
  tripPlans,
  sortedPlans,
  selectedPlanIndex,
  planTypeFilter,
  planSort,
  directCount,
  transferCountPlans,
  originCoords,
  geocodeDegraded,
  activeTrackingIndex = null,
  onToggleTracking,
  onSelectPlan,
  onPlanTypeFilter,
  onPlanSort,
  onStartSearch,
  onBrowseRoutes,
  onShare,
  onCopyLink,
}: Props) {
  return (
    <div data-testid="trip-planner-results" className="flex flex-col gap-2 p-3 md:gap-2.5 md:p-3">
      {geocodeDegraded && (
        <p
          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900 md:text-[11px]"
          role="status"
        >
          Búsqueda en mapa limitada. Usa lugares de Morelia del catálogo o toca el mapa.
        </p>
      )}

      {!planning && tripPlans.length === 0 && !planningError && (
        <EmptyState
          variant="generic"
          title="¿Cómo llegar?"
          description="Elige origen y destino (o toca el mapa). Te mostramos combis y opciones con puntos sugeridos para subir y bajar."
          actionLabel={originCoords ? 'Elegir destino' : 'Empezar: ¿desde dónde sales?'}
          onAction={onStartSearch}
          secondaryLabel="O ver todas las rutas del mapa"
          onSecondary={onBrowseRoutes}
        />
      )}

      {planning && (
        <div
          className="flex flex-col gap-1.5 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-700 md:py-3 md:text-sm"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" aria-hidden />
            {geometriesLoading
              ? 'Cargando geometrías de rutas cercanas…'
              : 'Calculando mejores opciones…'}
          </div>
          <p className="text-[11px] text-slate-500">
            Solo usamos rutas del área de tu viaje para ir más rápido.
          </p>
        </div>
      )}

      {planningError && (
        <EmptyState
          variant="no-routes"
          title="Sin rutas útiles entre estos puntos"
          description={planningError}
          actionLabel="Ajustar origen o destino"
          onAction={onStartSearch}
          secondaryLabel="Explorar rutas"
          onSecondary={onBrowseRoutes}
        />
      )}

      {!planning && tripPlans.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
            {(
              [
                { id: 'all' as const, label: `Todos (${tripPlans.length})` },
                { id: 'direct' as const, label: `Directo (${directCount})` },
                { id: 'transfer' as const, label: `Transbordo (${transferCountPlans})` },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onPlanTypeFilter(f.id)}
                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold cursor-pointer transition md:min-h-8 md:px-2.5 md:py-1 md:text-[11px] ${
                  planTypeFilter === f.id
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Ordenar por">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Orden:
            </span>
            {(
              [
                { id: 'time' as const, label: 'Menos tiempo' },
                { id: 'walk' as const, label: 'Menos caminata' },
                { id: 'transfers' as const, label: 'Menos transbordos' },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                data-testid={`plan-sort-${s.id}`}
                onClick={() => onPlanSort(s.id)}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-bold cursor-pointer md:min-h-8 md:px-2.5 md:py-1 md:text-[11px] ${
                  planSort === s.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              data-testid="share-trip"
              onClick={onShare}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-[11px] font-bold text-slate-800 cursor-pointer hover:bg-slate-50 md:min-h-9 md:py-2 md:text-[11px]"
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden />
              Compartir
            </button>
            <button
              type="button"
              data-testid="copy-trip-link"
              onClick={onCopyLink}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-[11px] font-bold text-slate-800 cursor-pointer hover:bg-slate-50 md:min-h-9 md:py-2 md:text-[11px]"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden />
              Copiar enlace
            </button>
          </div>
        </>
      )}

      {!planning &&
        sortedPlans.map(({ plan, idx }, listIdx) => {
          const walkSegs = plan.segments.filter((s) => s.type === 'walk');
          const firstWalk = walkSegs[0];
          const rideSegs = plan.segments.filter((s) => s.type === 'ride');
          const xfers = transferCount(plan);
          return (
            <motion.div
              key={idx}
              role="button"
              tabIndex={0}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: listIdx * 0.04 }}
              onClick={() => onSelectPlan(idx)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectPlan(idx);
                }
              }}
              className={`vm-card vm-press w-full rounded-xl border p-2.5 text-left cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 md:rounded-xl md:p-3 ${
                selectedPlanIndex === idx ? 'ring-2 ring-emerald-600/40 shadow-md' : ''
              }`}
              style={
                selectedPlanIndex === idx
                  ? {
                      borderColor: 'var(--vm-selected-border)',
                      background: 'var(--vm-selected-bg)',
                    }
                  : undefined
              }
              aria-pressed={selectedPlanIndex === idx}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2 md:mb-2">
                <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-emerald-800">
                  {plan.type === 'direct' ? (
                    <>
                      <Bus className="h-3.5 w-3.5" aria-hidden /> Directo
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden /> Transbordo
                      {xfers > 0 ? ` · ${xfers}` : ''}
                    </>
                  )}
                </span>
                <span className="text-right text-xs font-bold text-slate-800">
                  {formatDurationSec(plan.totalDuration)}
                  <span className="mt-0.5 block text-[10px] font-semibold text-slate-500">
                    {formatDistanceKm(plan.totalDistance)} · {formatWalkMeters(plan.walkDistanceTotal)}
                  </span>
                </span>
              </div>

              {rideSegs.length > 0 && (
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5 md:mb-2">
                  {rideSegs.map((r, ri) => (
                    <span
                      key={`${r.routeId}-${ri}`}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-800"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full ring-1 ring-slate-300"
                        style={{ backgroundColor: r.color || '#3b82f6' }}
                      />
                      {ri + 1}. {r.routeName}
                    </span>
                  ))}
                </div>
              )}

              {firstWalk && firstWalk.distance > 0 && (
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-sky-800">
                  <Footprints className={`h-3.5 w-3.5 ${selectedPlanIndex === idx ? 'vm-walk-active' : ''}`} aria-hidden />
                  Camina {formatWalkMeters(firstWalk.distance)} hasta el punto de subida
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                {plan.segments.map((seg, sIdx) => (
                  <div key={sIdx} className="flex gap-2 text-[11px]">
                    <div
                      className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                        seg.walkKind === 'transfer'
                          ? 'bg-violet-600 ring-2 ring-violet-200'
                          : seg.type === 'walk'
                            ? 'bg-slate-400'
                            : 'bg-emerald-600'
                      }`}
                      style={seg.type === 'ride' ? { backgroundColor: seg.color } : undefined}
                      aria-hidden
                    />
                    <p className="leading-snug text-slate-800">
                      <span className="font-semibold">{seg.instruction}</span>
                      {seg.duration > 0 && (
                        <span className="ml-1 font-medium text-slate-500">
                          · {formatDurationSec(seg.duration)}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>

              {/* Botón de Seguimiento GPS (Seguir mi viaje) */}
              {selectedPlanIndex === idx && onToggleTracking && (
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleTracking(idx);
                    }}
                    className={`flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition shadow-md cursor-pointer touch-manipulation md:min-h-9 md:py-2 md:text-xs ${
                      activeTrackingIndex === idx
                        ? 'bg-rose-600 text-white hover:bg-rose-700 animate-pulse'
                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                    }`}
                  >
                    {activeTrackingIndex === idx ? (
                      <>
                        <span className="h-2.5 w-2.5 rounded-full bg-white animate-ping" />
                        Detener seguimiento GPS activo
                      </>
                    ) : (
                      <>
                        <LocateFixed className="h-4 w-4" />
                        Seguir mi viaje (Alertas GPS)
                      </>
                    )}
                  </button>
                </div>
              )}

              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[9px] font-medium leading-relaxed text-amber-950 md:text-[10px]">
                Los puntos de <strong>subida y bajada</strong> son sugeridos (aprox.). En el mapa
                se marcan con etiquetas Sube / Baja.
              </p>
            </motion.div>
          );
        })}
    </div>
  );
}
