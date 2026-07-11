/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, Navigation, Search, X, Clock, Home, Briefcase } from 'lucide-react';
import type { Route } from '@/lib/supabase/client';
import { normalizeTransportType, transportBadgeClass, type TransportFilter } from '@/lib/transport/classify';
import { availabilityLabel, parseRouteDisplay } from '@/lib/routes/route-display';
import type { RecentRoute } from '@/lib/search/recent';
import type { SavedPlaceSlot } from '@/lib/search/recent';

type Props = {
  routes: Route[];
  filteredRoutes: Route[];
  shapesLoading: boolean;
  routeQuery: string;
  onRouteQueryChange: (q: string) => void;
  transportFilter: TransportFilter;
  onTransportFilter: (f: TransportFilter) => void;
  selectedRouteId: string | null;
  favorites: string[];
  recentRoutes: RecentRoute[];
  favRoutes: Route[];
  homePlace: SavedPlaceSlot;
  workPlace: SavedPlaceSlot;
  onToggleFavorite: (routeId: string) => void;
  onViewRoute: (route: Route) => void;
  onPickHome?: () => void;
  onPickWork?: () => void;
};

/**
 * Lista de rutas con navegación por teclado (↑↓ Enter) y botón Ver ruta.
 */
export function RouteExplorerList({
  routes,
  filteredRoutes,
  shapesLoading,
  routeQuery,
  onRouteQueryChange,
  transportFilter,
  onTransportFilter,
  selectedRouteId,
  favorites,
  recentRoutes,
  favRoutes,
  homePlace,
  workPlace,
  onToggleFavorite,
  onViewRoute,
  onPickHome,
  onPickWork,
}: Props) {
  const [focusIndex, setFocusIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    setFocusIndex(0);
  }, [routeQuery, transportFilter, filteredRoutes.length]);

  const moveFocus = useCallback(
    (delta: number) => {
      if (!filteredRoutes.length) return;
      setFocusIndex((i) => {
        const next = Math.max(0, Math.min(filteredRoutes.length - 1, i + delta));
        requestAnimationFrame(() => {
          itemRefs.current[next]?.scrollIntoView({ block: 'nearest' });
          itemRefs.current[next]?.focus();
        });
        return next;
      });
    },
    [filteredRoutes.length]
  );

  const onListKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(-1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      const route = filteredRoutes[focusIndex];
      if (route) {
        e.preventDefault();
        onViewRoute(route);
      }
    } else if (e.key === 'Home') {
      e.preventDefault();
      setFocusIndex(0);
      itemRefs.current[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      const last = filteredRoutes.length - 1;
      setFocusIndex(last);
      itemRefs.current[last]?.focus();
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 md:gap-2 md:p-3">
      <p className="text-[11px] leading-snug text-slate-500">
        Busca por color, colonia o número. Usa flechas y Enter, o <strong>Ver ruta</strong>.
        {shapesLoading ? ' Cargando listado…' : ` ${routes.length} rutas.`}
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="search"
          data-testid="search-routes"
          inputMode="search"
          enterKeyHint="search"
          placeholder="Morada, cam, centro, naranja 2…"
          value={routeQuery}
          onChange={(e) => onRouteQueryChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 md:py-2 md:text-sm"
          aria-controls="route-explorer-list"
        />
        {routeQuery && (
          <button
            type="button"
            onClick={() => onRouteQueryChange('')}
            className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="mb-1 flex flex-wrap items-center gap-1.5 md:gap-2">
        {(
          [
            { id: 'all' as const, label: 'Todos' },
            { id: 'combi' as const, label: 'Combis' },
            { id: 'autobus' as const, label: 'Autobuses' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`filter-transport-${t.id}`}
            onClick={() => onTransportFilter(t.id)}
            className={`min-h-9 rounded-full border px-2.5 py-1 text-[11px] font-bold cursor-pointer touch-manipulation md:min-h-8 md:px-2.5 md:py-1 md:text-[11px] ${
              transportFilter === t.id
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] font-semibold text-slate-400 md:text-xs">
          {filteredRoutes.length}/{routes.length}
        </span>
      </div>

      {!routeQuery.trim() && (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
          {(homePlace || workPlace) && (
            <div className="flex flex-wrap gap-1.5">
              {homePlace && onPickHome && (
                <button
                  type="button"
                  className="inline-flex min-h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-800 touch-manipulation"
                  onClick={onPickHome}
                >
                  <Home className="h-3.5 w-3.5 text-emerald-700" /> Casa
                </button>
              )}
              {workPlace && onPickWork && (
                <button
                  type="button"
                  className="inline-flex min-h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-800 touch-manipulation"
                  onClick={onPickWork}
                >
                  <Briefcase className="h-3.5 w-3.5 text-sky-700" /> Trabajo
                </button>
              )}
            </div>
          )}
          {recentRoutes.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <Clock className="h-3 w-3" /> Rutas recientes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recentRoutes.slice(0, 5).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 touch-manipulation"
                    onClick={() => {
                      const full = routes.find((x) => x.id === r.id);
                      if (full) onViewRoute(full);
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: r.color || '#94a3b8' }}
                    />
                    <span className="truncate">{r.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {favRoutes.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <Heart className="h-3 w-3" /> Favoritas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {favRoutes.slice(0, 5).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full border border-rose-100 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 touch-manipulation"
                    onClick={() => onViewRoute(r)}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                    <span className="truncate">{r.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {shapesLoading && (
        <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
          <span className="vm-spinner" /> Cargando red de rutas…
        </div>
      )}
      {!shapesLoading && filteredRoutes.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-400">
          {routes.length === 0
            ? 'No hay rutas publicadas disponibles.'
            : 'Ninguna ruta coincide. Prueba sin acentos o con el color (ej. morada, cam).'}
        </div>
      )}

      <div
        id="route-explorer-list"
        ref={listRef}
        role="listbox"
        aria-label="Rutas disponibles"
        aria-activedescendant={
          filteredRoutes[focusIndex]
            ? `route-option-${filteredRoutes[focusIndex].id}`
            : undefined
        }
        tabIndex={0}
        onKeyDown={onListKeyDown}
        className="flex flex-col gap-2 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
      >
        {filteredRoutes.map((route, index) => {
          const isFav = favorites.includes(route.id);
          const isSelected = selectedRouteId === route.id;
          const isFocused = index === focusIndex;
          const kind = normalizeTransportType(route.transport_type, route.id, route.name);
          const info = parseRouteDisplay(route);
          const avail = availabilityLabel(route.status);
          return (
            <article
              key={route.id}
              id={`route-option-${route.id}`}
              role="option"
              aria-selected={isSelected || isFocused}
              data-testid={`route-item-${route.id}`}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              tabIndex={isFocused ? 0 : -1}
              onFocus={() => setFocusIndex(index)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onViewRoute(route);
                }
              }}
              className={`vm-card rounded-xl border p-2.5 outline-none md:p-3 ${
                isSelected || isFocused ? 'ring-2 ring-emerald-500/35' : ''
              }`}
              style={
                isSelected
                  ? {
                      borderColor: 'var(--vm-selected-border)',
                      background: 'var(--vm-selected-bg)',
                    }
                  : undefined
              }
            >
              <div className="flex items-start gap-2">
                <span
                  className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-white shadow"
                  style={{ backgroundColor: route.color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-snug text-slate-900">
                    {route.name}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${transportBadgeClass(kind)}`}
                    >
                      {kind === 'combi' ? 'Combi' : 'Autobús'}
                    </span>
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                        avail.tone === 'ok'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : avail.tone === 'warn'
                            ? 'border-amber-200 bg-amber-50 text-amber-900'
                            : 'border-rose-200 bg-rose-50 text-rose-800'
                      }`}
                    >
                      {avail.label}
                    </span>
                    {isSelected && (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-bold text-sky-900">
                        En el mapa
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-snug text-slate-600">
                    <span className="font-semibold text-slate-700">Corredor: </span>
                    {info.corridorLabel}
                  </p>
                </div>
                <button
                  type="button"
                  data-testid={`favorite-button-${route.id}`}
                  aria-label={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                  onClick={() => onToggleFavorite(route.id)}
                  className="flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <Heart
                    className={`h-4.5 w-4.5 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`}
                  />
                </button>
              </div>
              <button
                type="button"
                data-testid={`view-route-${route.id}`}
                onClick={() => onViewRoute(route)}
                className="mt-2 flex min-h-9 w-full touch-manipulation items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white cursor-pointer hover:bg-emerald-700 active:scale-[0.99]"
              >
                <Navigation className="h-3.5 w-3.5" aria-hidden />
                Ver ruta
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
