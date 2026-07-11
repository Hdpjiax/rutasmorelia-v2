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
  Heart,
} from 'lucide-react';
import { motion } from 'motion/react';
import type { PlaceHit } from '@/lib/search/morelia-places';
import type { SearchField } from '@/lib/trip/home-store';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/lib/ui/toast';

/** Clave estable nombre+coords para marcar favoritos. */
export function placeFavoriteKey(name: string, coordinates: [number, number]): string {
  return `${name.trim().toLowerCase()}|${coordinates[0].toFixed(5)},${coordinates[1].toFixed(5)}`;
}

type Props = {
  searchExpanded: boolean;
  originInput: string;
  destinationInput: string;
  originReady: boolean;
  destinationReady: boolean;
  originCoords?: [number, number] | null;
  destinationCoords?: [number, number] | null;
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
  originCoords = null,
  destinationCoords = null,
  activeSearchField,
  planning,
  locating,
  shapesLoading,
  tripPlanCount,
  suggestions,
  searchLoading,
  favoriteLocationKeys,
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
  onToggleLocationFavorite,
}: Props) {
  const [recordingField, setRecordingField] = React.useState<'origin' | 'destination' | null>(null);

  const startSpeechRecognition = async (field: 'origin' | 'destination') => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast('Tu navegador no soporta reconocimiento de voz', 'error');
      return;
    }

    // Pedir permiso de micrófono de forma explícita (WebView Android / Chrome / tablet).
    // Luego liberamos el stream para que SpeechRecognition pueda usar el mic.
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
      }
    } catch (err) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        toast(
          'Necesitamos permiso de micrófono para buscar por voz. Actívalo en Ajustes del navegador o de la app.',
          'error'
        );
      } else if (name === 'NotFoundError') {
        toast('No se encontró un micrófono en este dispositivo', 'error');
      } else {
        toast('No se pudo acceder al micrófono', 'error');
      }
      setRecordingField(null);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-MX';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setRecordingField(field);
      toast(
        `Escuchando… Di el punto de ${field === 'origin' ? 'origen' : 'destino'}`,
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
        toast(
          'Permiso de micrófono denegado. Revisa los permisos del sitio o de la app.',
          'error'
        );
      } else if (event.error === 'no-speech') {
        toast('No se detectó voz. Intenta de nuevo.', 'warning');
      } else if (event.error === 'audio-capture') {
        toast('No se pudo capturar audio del micrófono', 'error');
      } else if (event.error !== 'aborted') {
        toast('No se escuchó con claridad. Intenta de nuevo.', 'warning');
      }
      setRecordingField(null);
    };

    recognition.onend = () => {
      setRecordingField(null);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error('[speech] start failed', e);
      setRecordingField(null);
      toast('No se pudo iniciar el reconocimiento de voz', 'error');
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 360, damping: 28 }}
      id="search-panel"
      className="pointer-events-auto absolute z-40 w-auto sm:max-w-[min(92vw,22rem)] md:max-w-[22rem] lg:max-w-[24rem]"
      style={{
        top: 'var(--vm-search-top)',
        left: 'max(0.5rem, var(--vm-safe-left))',
        right: 'max(0.5rem, var(--vm-safe-right))',
      }}
    >
      {!searchExpanded && (
        <div
          className="vm-panel flex w-full items-center gap-1.5 rounded-xl border p-1.5 shadow-lg sm:gap-2 sm:rounded-xl sm:p-1.5 sm:shadow-xl"
        >
          {/* Botón principal para expandir la búsqueda */}
          <button
            type="button"
            onClick={onExpand}
            className="flex min-w-0 flex-1 items-center gap-2 text-left cursor-pointer focus:outline-none"
            aria-expanded={false}
            aria-controls="trip-search-fields"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 sm:h-7 sm:w-7">
              <Search className="h-3.5 w-3.5 text-emerald-700 sm:h-3.5 sm:w-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold leading-tight text-slate-900 sm:text-sm">
                {originInput || destinationInput
                  ? `${originInput || 'Origen'} → ${destinationInput || 'Destino'}`
                  : '¿A dónde vas?'}
              </p>
              <p className="truncate text-[10px] font-medium leading-tight text-slate-600 sm:text-[11px]">
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
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm transition hover:bg-slate-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-700 sm:h-7 sm:w-7"
              title="Intercambiar"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-slate-600" aria-hidden />
            </button>
          )}

          {/* Icono de chevron para desplegar */}
          <button
            type="button"
            onClick={onExpand}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-slate-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-700 sm:h-7 sm:w-7"
            aria-label="Abrir opciones de búsqueda"
          >
            <ChevronDown className="h-4 w-4 text-slate-500" />
          </button>
        </div>
      )}

      {searchExpanded && (
        <div
          id="trip-search-fields"
          className="vm-panel rounded-xl border p-3 shadow-2xl sm:rounded-2xl sm:p-3.5 md:p-3"
        >
          <div className="mb-1.5 flex items-center justify-between border-b border-slate-100 pb-1.5 sm:mb-2">
            <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-600 sm:text-xs">
              Planificar viaje
            </h2>
            <div className="flex items-center gap-1">
              {(planning || shapesLoading || locating) && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-700" aria-hidden />
              )}
              <button
                type="button"
                onClick={onCollapse}
                className="flex min-h-8 items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-700 transition hover:bg-slate-100 cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-700 sm:text-xs md:min-h-8 md:px-2.5"
              >
                Listo
                <ChevronUp className="h-3.5 w-3.5" aria-hidden />
              </button>
            </div>
          </div>

          <div className="relative mb-1.5 sm:mb-2">
            <label
              htmlFor="search-origin"
              className="mb-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-emerald-800 sm:text-[10px]"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600 sm:h-2 sm:w-2" aria-hidden />
              1. Origen (sale de)
            </label>
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-emerald-600 sm:left-2.5 sm:top-2.5 sm:h-4 sm:w-4" aria-hidden />
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
                  'w-full rounded-lg border bg-white py-2 pl-8 pr-7 text-[13px] text-slate-900 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-emerald-700/35 sm:rounded-xl sm:py-2 sm:pl-9 sm:pr-8 sm:text-sm md:py-2 md:text-sm',
                  activeSearchField === 'origin'
                    ? 'border-emerald-600 ring-2 ring-emerald-700/20'
                    : 'border-slate-300'
                )}
              />
              {originInput ? (
                <button
                  type="button"
                  onClick={onClearOrigin}
                  className="absolute right-1.5 top-2 text-slate-500 hover:text-slate-800 cursor-pointer sm:right-2 sm:top-2"
                  aria-label="Borrar origen"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startSpeechRecognition('origin')}
                  className={cn(
                    "absolute right-1.5 top-2 cursor-pointer sm:right-2 sm:top-2 text-slate-400 hover:text-emerald-700 transition",
                    recordingField === 'origin' && "text-rose-600 animate-pulse"
                  )}
                  title="Buscar por voz"
                >
                  <Mic className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              )}
            </div>
            {activeSearchField === 'origin' && (
              <SuggestionsList
                suggestions={suggestions}
                loading={searchLoading}
                favoriteLocationKeys={favoriteLocationKeys}
                onSelect={onSelectSuggestion}
                onToggleFavorite={onToggleLocationFavorite}
              />
            )}
            {originReady && originCoords && onToggleLocationFavorite && (
              <SavePlaceFavoriteButton
                name={originInput.trim() || 'Origen en el mapa'}
                description="Origen del viaje"
                coordinates={originCoords}
                favoriteLocationKeys={favoriteLocationKeys}
                onToggle={onToggleLocationFavorite}
              />
            )}
          </div>

          <div className="mb-1.5 flex justify-center sm:mb-2">
            <button
              type="button"
              onClick={onSwap}
              className="flex min-h-7 items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[9px] font-bold text-slate-800 shadow-sm cursor-pointer hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-emerald-700 sm:min-h-8 sm:px-3 sm:py-1 sm:text-[10px]"
              title="Intercambiar origen y destino"
            >
              <ArrowUpDown className="h-3 w-3 sm:h-3.5 sm:w-3.5" aria-hidden />
              Intercambiar
            </button>
          </div>

          <div className="relative mb-2 sm:mb-2.5">
            <label
              htmlFor="search-destination"
              className="mb-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide text-rose-800 sm:text-[10px]"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-600 sm:h-2 sm:w-2" aria-hidden />
              2. Destino (vas a)
            </label>
            <div className="relative">
              <Navigation className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-rose-600 sm:left-2.5 sm:top-2.5 sm:h-4 sm:w-4" aria-hidden />
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
                  'w-full rounded-lg border bg-white py-2 pl-8 pr-7 text-[13px] text-slate-900 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-rose-700/35 sm:rounded-xl sm:py-2 sm:pl-9 sm:pr-8 sm:text-sm md:py-2 md:text-sm',
                  activeSearchField === 'destination'
                    ? 'border-rose-600 ring-2 ring-rose-700/20'
                    : 'border-slate-300'
                )}
              />
              {destinationInput ? (
                <button
                  type="button"
                  onClick={onClearDestination}
                  className="absolute right-1.5 top-2 text-slate-500 hover:text-slate-800 cursor-pointer sm:right-2 sm:top-2"
                  aria-label="Borrar destino"
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startSpeechRecognition('destination')}
                  className={cn(
                    "absolute right-1.5 top-2 cursor-pointer sm:right-2 sm:top-2 text-slate-400 hover:text-rose-700 transition",
                    recordingField === 'destination' && "text-rose-600 animate-pulse"
                  )}
                  title="Buscar por voz"
                >
                  <Mic className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </button>
              )}
            </div>
            {activeSearchField === 'destination' && (
              <SuggestionsList
                suggestions={suggestions}
                loading={searchLoading}
                favoriteLocationKeys={favoriteLocationKeys}
                onSelect={onSelectSuggestion}
                onToggleFavorite={onToggleLocationFavorite}
              />
            )}
            {destinationReady && destinationCoords && onToggleLocationFavorite && (
              <SavePlaceFavoriteButton
                name={destinationInput.trim() || 'Destino en el mapa'}
                description="Destino del viaje"
                coordinates={destinationCoords}
                favoriteLocationKeys={favoriteLocationKeys}
                onToggle={onToggleLocationFavorite}
              />
            )}
          </div>

          {activeSearchField && (
            <p className="mb-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-medium text-sky-950 sm:mb-2 sm:px-2.5 sm:py-1.5 sm:text-[11px]">
              También puedes <strong>tocar el mapa</strong> para fijar el{' '}
              {activeSearchField === 'origin' ? 'origen' : 'destino'}.
              {onToggleLocationFavorite ? ' Toca el corazón para guardar una dirección.' : ''}
            </p>
          )}

          <div className="flex gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onRequestLocation}
              disabled={locating}
              className="flex min-h-9 flex-1 touch-manipulation items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 py-2 text-[10px] font-bold text-emerald-950 cursor-pointer disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-emerald-700 sm:min-h-10 sm:gap-1.5 sm:rounded-xl sm:py-2 sm:text-[11px] md:min-h-10 md:text-xs"
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
              className="flex min-h-9 flex-1 touch-manipulation items-center justify-center gap-1 rounded-lg bg-slate-900 py-2 text-[10px] font-bold text-white cursor-pointer disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-emerald-700 sm:min-h-10 sm:rounded-xl sm:py-2 sm:text-[11px] md:min-h-10 md:text-xs"
            >
              {planning ? 'Buscando…' : 'Ver opciones'}
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function SavePlaceFavoriteButton({
  name,
  description,
  coordinates,
  favoriteLocationKeys,
  onToggle,
}: {
  name: string;
  description?: string;
  coordinates: [number, number];
  favoriteLocationKeys?: Set<string>;
  onToggle: (place: PlaceHit) => void;
}) {
  const key = placeFavoriteKey(name, coordinates);
  const isFav = favoriteLocationKeys?.has(key) ?? false;
  return (
    <button
      type="button"
      data-testid="save-place-favorite"
      onClick={() =>
        onToggle({
          id: `fav-${key}`,
          name,
          description: description || 'Dirección guardada',
          category: 'favorite',
          coordinates,
          source: 'favorite',
        })
      }
      className={cn(
        'mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[10px] font-bold cursor-pointer touch-manipulation',
        isFav
          ? 'border-rose-200 bg-rose-50 text-rose-800'
          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
      )}
    >
      <Heart className={cn('h-3.5 w-3.5', isFav && 'fill-rose-500 text-rose-500')} aria-hidden />
      {isFav ? 'En favoritos (tocar para quitar)' : 'Guardar dirección en favoritos'}
    </button>
  );
}

function SuggestionsList({
  suggestions,
  loading,
  favoriteLocationKeys,
  onSelect,
  onToggleFavorite,
}: {
  suggestions: PlaceHit[];
  loading: boolean;
  favoriteLocationKeys?: Set<string>;
  onSelect: (p: PlaceHit) => void;
  onToggleFavorite?: (p: PlaceHit) => void;
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
      {suggestions.map((place) => {
        const key = placeFavoriteKey(place.name, place.coordinates);
        const isFav = favoriteLocationKeys?.has(key) ?? place.source === 'favorite';
        return (
          <li key={place.id} role="option" aria-selected={false} className="flex items-stretch border-b border-slate-50 last:border-0">
            <button
              type="button"
              onClick={() => onSelect(place)}
              className="flex min-h-11 min-w-0 flex-1 touch-manipulation flex-col justify-center px-2.5 py-2 text-left hover:bg-emerald-50 cursor-pointer focus-visible:bg-emerald-50 focus-visible:outline-none"
            >
              <span className="truncate text-[12px] font-semibold leading-tight text-slate-900">
                {place.name}
              </span>
              <span className="truncate text-[10px] leading-tight text-slate-600">
                {place.description || place.category}
                {place.source === 'geocode'
                  ? ' · mapa'
                  : isFav
                    ? ' · favorito'
                    : ''}
              </span>
            </button>
            {onToggleFavorite && (
              <button
                type="button"
                data-testid={`fav-place-${place.id}`}
                title={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                aria-label={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onToggleFavorite(place);
                }}
                className="flex w-11 shrink-0 items-center justify-center text-slate-400 hover:bg-rose-50 cursor-pointer touch-manipulation"
              >
                <Heart
                  className={cn('h-4 w-4', isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-400')}
                  aria-hidden
                />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
