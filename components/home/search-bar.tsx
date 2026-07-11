/* eslint-disable @typescript-eslint/no-explicit-any */
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
  ArrowRightLeft,
  X,
  Mic,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { PlaceHit } from '@/lib/search/morelia-places';
import type { SearchField } from '@/lib/trip/home-store';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/lib/ui/toast';

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
  const [recordingField, setRecordingField] = React.useState<'origin' | 'destination' | null>(null);

  const startSpeechRecognition = (field: 'origin' | 'destination') => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast('Tu navegador no soporta reconocimiento de voz', 'error');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setRecordingField(field);
      toast(
        `Escuchando... Di el punto de ${field === 'origin' ? 'origen' : 'destino'}`,
        'info',
        'ViaMorelia'
      );
    };

    recognition.onresult = (event: any) => {
      const resultText = event.results[0][0].transcript;
      if (field === 'origin') {
        onOriginChange(resultText);
        requestAnimationFrame(() => {
          const el = document.getElementById('search-origin') as HTMLInputElement;
          if (el) {
            el.focus();
            el.value = resultText;
          }
        });
      } else {
        onDestinationChange(resultText);
        requestAnimationFrame(() => {
          const el = document.getElementById('search-destination') as HTMLInputElement;
          if (el) {
            el.focus();
            el.value = resultText;
          }
        });
      }
      toast(`Buscando: "${resultText}"`, 'success', 'ViaMorelia');
    };

    recognition.onerror = (event: any) => {
      console.error('[speech] Error:', event.error);
      if (event.error === 'not-allowed') {
        toast('Permiso de micrófono denegado', 'error');
      } else if (event.error === 'no-speech') {
        // Ignorar o toast silencioso
      } else {
        toast('No se escuchó con claridad. Intenta de nuevo.', 'warning');
      }
      setRecordingField(null);
    };

    recognition.onend = () => {
      setRecordingField(null);
    };

    recognition.start();
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      id="search-panel"
      className="pointer-events-auto absolute z-40 w-auto sm:max-w-[min(92vw,26rem)] md:max-w-[30rem] lg:max-w-[34rem]"
      style={{
        top: 'var(--vm-search-top)',
        left: 'max(0.5rem, var(--vm-safe-left))',
        right: 'max(0.5rem, var(--vm-safe-right))',
      }}
    >
      {!searchExpanded && (
        <div
          className="vm-panel flex w-full items-center gap-2 rounded-xl border p-1.5 shadow-lg sm:gap-2.5 sm:rounded-2xl sm:p-2 sm:shadow-xl md:gap-3 md:rounded-2xl md:p-2.5 lg:p-3"
        >
          {/* Botón principal para expandir la búsqueda */}
          <button
            type="button"
            onClick={onExpand}
            className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer focus:outline-none md:gap-2.5"
            aria-expanded={false}
            aria-controls="trip-search-fields"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 sm:h-9 sm:w-9 sm:rounded-xl md:h-11 md:w-11 md:rounded-xl">
              <Search className="h-3.5 w-3.5 text-emerald-700 sm:h-4 sm:w-4 md:h-5 md:w-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-tight text-slate-900 sm:text-sm md:text-base lg:text-lg">
                {originInput || destinationInput
                  ? `${originInput || 'Origen'} → ${destinationInput || 'Destino'}`
                  : '¿A dónde vas?'}
              </p>
              <p className="truncate text-[10px] font-medium leading-tight text-slate-600 sm:text-[11px] md:text-xs lg:text-sm">
                {originReady && destinationReady
                  ? planning
                    ? 'Calculando viaje…'
                    : tripPlanCount
                      ? `${tripPlanCount} opción(es) · toca para editar`
                      : 'Toca para editar origen o destino'
                  : 'Escribe un lugar o toca el mapa'}
              </p>
            </div>
          </button>

          {/* Botón de Swap directo (solo si hay origen y destino listos) */}
          {originReady && destinationReady && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSwap();
              }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-700 sm:h-9 sm:w-9 sm:rounded-xl md:h-10 md:w-10"
              title="Intercambiar"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-slate-600 sm:h-4 sm:w-4 md:h-5 md:w-5" aria-hidden />
            </button>
          )}

          {/* Icono de chevron para desplegar */}
          <button
            type="button"
            onClick={onExpand}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-slate-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-700 sm:h-9 sm:w-9 sm:rounded-xl md:h-10 md:w-10"
            aria-label="Abrir opciones de búsqueda"
          >
            <ChevronDown className="h-4 w-4 text-slate-500 sm:h-4.5 sm:w-4.5 md:h-5 md:w-5" />
          </button>
        </div>
      )}

      {searchExpanded && (
        <div
          id="trip-search-fields"
          className="vm-panel rounded-2xl border p-3.5 shadow-2xl sm:p-4 md:rounded-3xl md:p-5"
        >
          <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 sm:mb-3 md:mb-3 md:pb-2.5">
            <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-600 sm:text-xs md:text-sm">
              Planificar viaje
            </h2>
            <div className="flex items-center gap-1">
              {(planning || shapesLoading || locating) && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-700 md:h-5 md:w-5" aria-hidden />
              )}
              <button
                type="button"
                onClick={onCollapse}
                className="flex min-h-8 items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-700 transition hover:bg-slate-100 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-700 sm:text-sm md:min-h-12 md:px-4 md:text-base"
              >
                Listo
                <ChevronUp className="h-3.5 w-3.5 md:h-5 md:w-5" aria-hidden />
              </button>
            </div>
          </div>

          <div className="relative mb-1.5 sm:mb-2 md:mb-3">
            <label
              htmlFor="search-origin"
              className="mb-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-emerald-800 sm:text-[10px] md:text-xs"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 sm:h-2 sm:w-2 md:h-2.5 md:w-2.5" aria-hidden />
              1. Origen (sale de)
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-emerald-600 sm:left-2.5 sm:top-2.5 sm:h-4 sm:w-4 md:left-3.5 md:top-3.5 md:h-6 md:w-6" aria-hidden />
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
                  'w-full rounded-lg border bg-white py-2 pl-8 pr-7 text-[13px] text-slate-900 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-emerald-700/35 sm:rounded-xl sm:py-2.5 sm:pl-9 sm:pr-8 sm:text-sm md:rounded-2xl md:py-4 md:pl-12 md:pr-10 md:text-lg',
                  activeSearchField === 'origin'
                    ? 'border-emerald-600 ring-2 ring-emerald-700/20'
                    : 'border-slate-300'
                )}
              />
              {originInput ? (
                <button
                  type="button"
                  onClick={onClearOrigin}
                  className="absolute right-1.5 top-2 text-slate-500 hover:text-slate-800 cursor-pointer sm:right-2 sm:top-2.5 md:right-3.5 md:top-3.5 md:scale-130"
                  aria-label="Borrar origen"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startSpeechRecognition('origin')}
                  className={cn(
                    "absolute right-1.5 top-2 cursor-pointer sm:right-2 sm:top-2.5 md:right-3.5 md:top-3.5 md:scale-130 text-slate-400 hover:text-emerald-700 transition",
                    recordingField === 'origin' && "text-rose-600 animate-pulse"
                  )}
                  title="Buscar por voz"
                >
                  <Mic className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
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

          <div className="mb-1.5 flex justify-center sm:mb-2 md:mb-3">
            <button
              type="button"
              onClick={onSwap}
              className="flex min-h-7 items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[9px] font-bold text-slate-800 shadow-sm cursor-pointer hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-700 sm:min-h-8 sm:px-3 sm:py-1 sm:text-[10px] md:min-h-10 md:px-4 md:py-2 md:text-xs"
              title="Intercambiar origen y destino"
            >
              <ArrowUpDown className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4.5 md:w-4.5" aria-hidden />
              Intercambiar
            </button>
          </div>

          <div className="relative mb-2 sm:mb-3 md:mb-4">
            <label
              htmlFor="search-destination"
              className="mb-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-rose-800 sm:text-[10px] md:text-xs"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-600 sm:h-2 sm:w-2 md:h-2.5 md:w-2.5" aria-hidden />
              2. Destino (vas a)
            </label>
            <div className="relative">
              <Navigation className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-rose-600 sm:left-2.5 sm:top-2.5 sm:h-4 sm:w-4 md:left-3.5 md:top-3.5 md:h-6 md:w-6" aria-hidden />
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
                  'w-full rounded-lg border bg-white py-2 pl-8 pr-7 text-[13px] text-slate-900 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-rose-700/35 sm:rounded-xl sm:py-2.5 sm:pl-9 sm:pr-8 sm:text-sm md:rounded-2xl md:py-4 md:pl-12 md:pr-10 md:text-lg',
                  activeSearchField === 'destination'
                    ? 'border-rose-600 ring-2 ring-rose-700/20'
                    : 'border-slate-300'
                )}
              />
              {destinationInput ? (
                <button
                  type="button"
                  onClick={onClearDestination}
                  className="absolute right-1.5 top-2 text-slate-500 hover:text-slate-800 cursor-pointer sm:right-2 sm:top-2.5 md:right-3.5 md:top-3.5 md:scale-130"
                  aria-label="Borrar destino"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startSpeechRecognition('destination')}
                  className={cn(
                    "absolute right-1.5 top-2 cursor-pointer sm:right-2 sm:top-2.5 md:right-3.5 md:top-3.5 md:scale-130 text-slate-400 hover:text-rose-700 transition",
                    recordingField === 'destination' && "text-rose-600 animate-pulse"
                  )}
                  title="Buscar por voz"
                >
                  <Mic className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
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
            <p className="mb-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-medium text-sky-950 sm:mb-2 sm:px-2.5 sm:py-1.5 sm:text-[11px] md:text-xs md:p-2 md:mb-3">
              También puedes <strong>tocar el mapa</strong> para fijar el{' '}
              {activeSearchField === 'origin' ? 'origen' : 'destino'}.
            </p>
          )}

          <div className="flex gap-1.5 sm:gap-2 md:gap-3">
            <button
              type="button"
              onClick={onRequestLocation}
              disabled={locating}
              className="flex min-h-9 flex-1 touch-manipulation items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 py-2 text-[10px] font-bold text-emerald-950 cursor-pointer disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-emerald-700 sm:min-h-11 sm:gap-1.5 sm:rounded-xl sm:py-2.5 sm:text-[11px] md:min-h-14 md:gap-2.5 md:rounded-2xl md:py-3.5 md:text-base lg:text-lg"
            >
              {locating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin md:h-5 md:w-5" aria-hidden />
              ) : (
                <LocateFixed className="h-3.5 w-3.5 md:h-5 md:w-5" aria-hidden />
              )}
              Usar mi ubicación
            </button>
            <button
              type="button"
              onClick={onSeeOptions}
              disabled={!originReady || !destinationReady}
              className="flex min-h-9 flex-1 touch-manipulation items-center justify-center gap-1 rounded-lg bg-slate-900 py-2 text-[10px] font-bold text-white cursor-pointer disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-emerald-700 sm:min-h-11 sm:rounded-xl sm:py-2.5 sm:text-[11px] md:min-h-14 md:rounded-2xl md:py-3.5 md:text-base lg:text-lg"
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
