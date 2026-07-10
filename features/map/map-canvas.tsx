'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Coordinate } from '@/lib/routing/planner';

export type MapLoadErrorKind =
  | 'offline'
  | 'tiles'
  | 'init'
  | 'unknown';

type Props = {
  onReady?: (map: MapLibreMap) => void;
  onMapClick?: (coords: Coordinate) => void;
  onLoadState?: (state: { loading: boolean; error: MapLoadErrorKind | null }) => void;
  className?: string;
  'data-testid'?: string;
};

function classifyMapError(err: unknown): { kind: MapLoadErrorKind; message: string } {
  const offline =
    typeof navigator !== 'undefined' && navigator.onLine === false;
  if (offline) {
    return {
      kind: 'offline',
      message: 'Sin conexión. Revisa tu internet e inténtalo de nuevo.',
    };
  }
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const lower = msg.toLowerCase();
  if (
    lower.includes('failed to fetch') ||
    lower.includes('network') ||
    lower.includes('load') ||
    lower.includes('tile') ||
    lower.includes('style')
  ) {
    return {
      kind: 'tiles',
      message: 'Servicio cartográfico no disponible. Puedes reintentar en unos segundos.',
    };
  }
  if (lower.includes('init') || lower.includes('container')) {
    return {
      kind: 'init',
      message: 'Error al iniciar el mapa. Toca Reintentar.',
    };
  }
  return {
    kind: 'unknown',
    message: 'No se pudo cargar el mapa de Morelia.',
  };
}

/**
 * MapLibre con code-split (dynamic import).
 * Skeleton de carga + reintentar + errores diferenciados.
 */
export function MapCanvas({
  onReady,
  onMapClick,
  onLoadState,
  className = 'rm-map-canvas absolute inset-0 z-0 h-full w-full touch-none',
  'data-testid': testId = 'map-container',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onReadyRef = useRef(onReady);
  const onClickRef = useRef(onMapClick);
  const onLoadStateRef = useRef(onLoadState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ kind: MapLoadErrorKind; message: string } | null>(
    null
  );
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    onClickRef.current = onMapClick;
  }, [onMapClick]);
  useEffect(() => {
    onLoadStateRef.current = onLoadState;
  }, [onLoadState]);

  useEffect(() => {
    onLoadStateRef.current?.({ loading, error: error?.kind ?? null });
  }, [loading, error]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    setRetryKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;

    (async () => {
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
          throw new Error('offline');
        }
        await import('maplibre-gl/dist/maplibre-gl.css');
        const mapMod = await import('@/lib/map/init-map');
        if (cancelled || !containerRef.current) return;
        map = mapMod.initMoreliaMap({
          container: containerRef.current,
          includeWalkLayers: true,
          basemapTheme: 'light',
          onReady: (m) => {
            if (cancelled) return;
            mapRef.current = m;
            setLoading(false);
            setError(null);
            onReadyRef.current?.(m);
          },
        });
        map.on('click', (e) => {
          onClickRef.current?.([e.lngLat.lng, e.lngLat.lat]);
        });
        map.on('error', (e) => {
          // Errores de tiles no siempre son fatales; solo si aún no cargó
          if (cancelled || !loading) return;
          console.warn('[MapCanvas] map error', e);
        });
        mapRef.current = map;
        // Fallback si onReady no dispara (style ya listo)
        const t = window.setTimeout(() => {
          if (!cancelled && mapRef.current && loading) {
            setLoading(false);
          }
        }, 8000);
        map.once('load', () => {
          window.clearTimeout(t);
        });
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          const classified =
            e instanceof Error && e.message === 'offline'
              ? {
                  kind: 'offline' as const,
                  message: 'Sin conexión. Revisa tu internet e inténtalo de nuevo.',
                }
              : classifyMapError(e);
          setError(classified);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      void import('@/lib/map/init-map').then((mapMod) => {
        mapMod.destroyMoreliaMap(map);
      });
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retryKey forces remount of map
  }, [retryKey]);

  return (
    <>
      {/* Fondo tipo calles + skeleton mientras carga */}
      {(loading || error) && (
        <div
          className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
          aria-hidden={!loading}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: '#e8eef3',
              backgroundImage: `
                linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px),
                linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px),
                linear-gradient(135deg, #dfe7ee 0%, #eef3f7 40%, #d5e0ea 100%)
              `,
              backgroundSize: '48px 48px, 48px 48px, 100% 100%',
            }}
          />
          {loading && !error && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
              <div className="h-10 w-10 animate-pulse rounded-2xl bg-white/80 shadow-md ring-1 ring-slate-200" />
              <div className="h-3 w-40 animate-pulse rounded-full bg-white/70" />
              <div className="h-3 w-28 animate-pulse rounded-full bg-white/50" />
              <p className="mt-2 text-center text-sm font-semibold text-slate-700">
                Cargando mapa de Morelia…
              </p>
            </div>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        data-testid={testId}
        className={className}
        role="application"
        aria-label="Mapa de Morelia"
        style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
      />

      {error && (
        <div
          className="absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 rounded-2xl border border-rose-200 bg-white p-4 text-center shadow-lg"
          role="alert"
        >
          <p className="text-sm font-bold text-rose-900">No se pudo cargar el mapa</p>
          <p className="mt-1 text-[12px] leading-snug text-rose-800/90">{error.message}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-3 min-h-11 w-full touch-manipulation rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white cursor-pointer active:scale-[0.99]"
          >
            Reintentar
          </button>
        </div>
      )}
    </>
  );
}
