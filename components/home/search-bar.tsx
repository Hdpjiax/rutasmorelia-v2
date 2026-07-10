'use client';

import React from 'react';
import {
  Search,
  ChevronDown,
  ChevronUp,
  MapPin,
  Navigation,
  Loader2,
  LocateFixed,
  ArrowUpDown,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { PlaceHit } from '@/lib/search/morelia-places';
import type { SearchField } from '@/lib/trip/home-store';
import { cn } from '@/lib/utils/cn';

type Props = {
  searchExpanded: boolean;
  originInput: string;
  destinationInput: string;
  originReady: boolean;
  destinationReady: boolean;
  activeSearchField: SearchField;
  planning: boolean;
  locating: boolean;
  shapesLoading: boolean;
  tripPlanCount: number;
  suggestions: PlaceHit[];
  searchLoading: boolean;
  favoriteLocationKeys?: Set<string>;
  onExpand: () => void;
  onCollapse: () => void;
  onOriginChange: (v: string) => void;
  onDestinationChange: (v: string) => void;
  onOriginFocus: () => void;
  onDestinationFocus: () => void;
  onClearOrigin: () => void;
  onClearDestination: () => void;
  onSwap: () => void;
  onRequestLocation: () => void;
  onSeeOptions: () => void;
  onSelectSuggestion: (place: PlaceHit) => void;
  onToggleLocationFavorite?: (place: PlaceHit) => void;
  renderExtraSuggestions?: React.ReactNode;
};

export function SearchBar({
  searchExpanded,
  originInput,
  destinationInput,
  originReady,
  destinationReady,
  activeSearchField,
  planning,
  locating,
  shapesLoading,
  tripPlanCount,
  suggestions,
  searchLoading,
  onExpand,
  onCollapse,
  onOriginChange,
  onDestinationChange,
  onOriginFocus,
  onDestinationFocus,
  onClearOrigin,
  onClearDestination,
  onSwap,
  onRequestLocation,
  onSeeOptions,
  onSelectSuggestion,
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      id="search-panel"
      className="pointer-events-auto absolute z-40 w-auto sm:max-w-[min(92vw,22rem)]"
      style={{
        top: 'var(--vm-search-top)',
        left: 'max(0.75rem, var(--vm-safe-left))',
        right: 'max(0.75rem, var(--vm-safe-right))',
      }}
    >
      {!searchExpanded && (
        <button
          type="button"
          onClick={onExpand}
          className="vm-panel vm-press flex w-full items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-left cursor-pointer shadow-xl"
          aria-expanded={false}
          aria-controls="trip-search-fields"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
            <Search className="h-4 w-4 text-emerald-700" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">
              {originInput || destinationInput
                ? `${originInput || 'Origen'} → ${destinationInput || 'Destino'}`
                : '¿A dónde vas?'}
            </p>
            <p className="text-[11px] font-medium text-slate-600">
              {originReady && destinationReady
                ? planning
                  ? 'Calculando viaje…'
                  : tripPlanCount
                    ? `${tripPlanCount} opción(es) · toca para editar`
                    : 'Toca para editar origen o destino'
                : 'Escribe un lugar o toca el mapa'}
            </p>
          </div>
          {(planning || locating) && (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-700" aria-hidden />
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-600" aria-hidden />
        </button>
      )}

      {searchExpanded && (
        <div
          id="trip-search-fields"
          className="vm-panel w-full rounded-2xl border p-3 shadow-xl"
          role="search"
          aria-label="Planear viaje"
        >
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-slate-900">Planear viaje</p>
              <p className="text-[10px] text-slate-600">
                Escribe o toca el mapa para marcar punto
              </p>
            </div>
            <div className="flex items-center gap-1">
              {(planning || shapesLoading || locating) && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-700" aria-hidden />
              )}
              <button
                type="button"
                onClick={onCollapse}
                className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-700 transition hover:bg-slate-100 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-700"
              >
                Listo
                <ChevronUp className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>

          <div className="relative mb-2">
            <label
              htmlFor="search-origin"
              className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-600" aria-hidden />
              1. Origen (sale de)
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-emerald-600" aria-hidden />
              <input
                id="search-origin"
                data-testid="search-origin"
                type="text"
                placeholder="Ej: Centro, mi ubicación…"
                value={originInput}
                onChange={(e) => onOriginChange(e.target.value)}
                onFocus={onOriginFocus}
                autoComplete="off"
                className={cn(
                  'w-full rounded-xl border bg-white py-2.5 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-emerald-700/35',
                  activeSearchField === 'origin'
                    ? 'border-emerald-600 ring-2 ring-emerald-700/20'
                    : 'border-slate-300'
                )}
              />
              {originInput && (
                <button
                  type="button"
                  onClick={onClearOrigin}
                  className="absolute right-2 top-2.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                  aria-label="Borrar origen"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {activeSearchField === 'origin' && (
              <SuggestionsList
                suggestions={suggestions}
                loading={searchLoading}
                onSelect={onSelectSuggestion}
              />
            )}
          </div>

          <div className="mb-2 flex justify-center">
            <button
              type="button"
              onClick={onSwap}
              className="flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-[10px] font-bold text-slate-800 shadow-sm cursor-pointer hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-700"
              title="Intercambiar origen y destino"
            >
              <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
              Intercambiar
            </button>
          </div>

          <div className="relative mb-3">
            <label
              htmlFor="search-destination"
              className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-rose-800"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-rose-600" aria-hidden />
              2. Destino (vas a)
            </label>
            <div className="relative">
              <Navigation className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-rose-600" aria-hidden />
              <input
                id="search-destination"
                data-testid="search-destination"
                type="text"
                placeholder="Ej: Metrópolis, Aldea…"
                value={destinationInput}
                onChange={(e) => onDestinationChange(e.target.value)}
                onFocus={onDestinationFocus}
                autoComplete="off"
                className={cn(
                  'w-full rounded-xl border bg-white py-2.5 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-rose-700/35',
                  activeSearchField === 'destination'
                    ? 'border-rose-600 ring-2 ring-rose-700/20'
                    : 'border-slate-300'
                )}
              />
              {destinationInput && (
                <button
                  type="button"
                  onClick={onClearDestination}
                  className="absolute right-2 top-2.5 text-slate-500 hover:text-slate-800 cursor-pointer"
                  aria-label="Borrar destino"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {activeSearchField === 'destination' && (
              <SuggestionsList
                suggestions={suggestions}
                loading={searchLoading}
                onSelect={onSelectSuggestion}
              />
            )}
          </div>

          {activeSearchField && (
            <p className="mb-2 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px] font-medium text-sky-950">
              También puedes <strong>tocar el mapa</strong> para fijar el{' '}
              {activeSearchField === 'origin' ? 'origen' : 'destino'}.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRequestLocation}
              disabled={locating}
              className="flex min-h-11 flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 py-2.5 text-[11px] font-bold text-emerald-950 cursor-pointer disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              {locating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <LocateFixed className="h-3.5 w-3.5" aria-hidden />
              )}
              Usar mi ubicación
            </button>
            <button
              type="button"
              onClick={onSeeOptions}
              disabled={!originReady || !destinationReady}
              className="flex min-h-11 flex-1 touch-manipulation items-center justify-center gap-1 rounded-xl bg-slate-900 py-2.5 text-[11px] font-bold text-white cursor-pointer disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-emerald-700"
            >
              {planning ? 'Buscando…' : 'Ver opciones'}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function SuggestionsList({
  suggestions,
  loading,
  onSelect,
}: {
  suggestions: PlaceHit[];
  loading: boolean;
  onSelect: (p: PlaceHit) => void;
}) {
  if (loading && suggestions.length === 0) {
    return (
      <div
        className="mt-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] text-slate-600"
        role="status"
      >
        Buscando…
      </div>
    );
  }
  if (!suggestions.length) return null;
  return (
    <ul
      data-testid="search-autocomplete"
      className="absolute left-0 right-0 z-50 mt-1 max-h-[min(28vh,9.5rem)] overflow-y-auto overscroll-contain rounded-xl border border-slate-300 bg-white shadow-lg sm:max-h-40"
      role="listbox"
    >
      {suggestions.map((place) => (
        <li key={place.id} role="option" aria-selected={false}>
          <button
            type="button"
            onClick={() => onSelect(place)}
            className="flex min-h-11 w-full touch-manipulation flex-col justify-center px-2.5 py-2 text-left hover:bg-emerald-50 cursor-pointer focus-visible:bg-emerald-50 focus-visible:outline-none border-b border-slate-50 last:border-0"
          >
            <span className="truncate text-[12px] font-semibold leading-tight text-slate-900">
              {place.name}
            </span>
            <span className="truncate text-[10px] leading-tight text-slate-600">
              {place.description || place.category}
              {place.source === 'geocode'
                ? ' · mapa'
                : place.source === 'favorite'
                  ? ' · favorito'
                  : ''}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
