'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Coordinate } from '@/lib/routing/planner';

type Props = {
  onReady?: (map: MapLibreMap) => void;
  onMapClick?: (coords: Coordinate) => void;
  className?: string;
  'data-testid'?: string;
};

/**
 * MapLibre con code-split (dynamic import).
 * No carga maplibre-gl hasta montar en cliente.
 */
export function MapCanvas({
  onReady,
  onMapClick,
  className = 'rm-map-canvas absolute inset-0 z-0 h-full w-full touch-none',
  'data-testid': testId = 'map-container',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onReadyRef = useRef(onReady);
  const onClickRef = useRef(onMapClick);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    onClickRef.current = onMapClick;
  }, [onMapClick]);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    let map: MapLibreMap | null = null;

    (async () => {
      try {
        await import('maplibre-gl/dist/maplibre-gl.css');
        const mapMod = await import('@/lib/map/init-map');
        if (cancelled || !containerRef.current) return;
        map = mapMod.initMoreliaMap({
          container: containerRef.current,
          includeWalkLayers: true,
          basemapTheme: 'light',
          onReady: (m) => {
            mapRef.current = m;
            onReadyRef.current?.(m);
          },
        });
        map.on('click', (e) => {
          onClickRef.current?.([e.lngLat.lng, e.lngLat.lat]);
        });
        mapRef.current = map;
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('No se pudo cargar el mapa');
      }
    })();

    return () => {
      cancelled = true;
      void import('@/lib/map/init-map').then((mapMod) => {
        mapMod.destroyMoreliaMap(map);
      });
      mapRef.current = null;
    };
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        data-testid={testId}
        className={className}
        role="application"
        aria-label="Mapa de Morelia"
        /* Pinch/pan solo aquí; la página no hace zoom */
        style={{ touchAction: 'pan-x pan-y pinch-zoom' }}
      />
      {error && (
        <div
          className="absolute inset-x-4 top-1/2 z-10 -translate-y-1/2 rounded-2xl border border-rose-200 bg-white p-4 text-center text-sm text-rose-800 shadow-lg"
          role="alert"
        >
          {error}
        </div>
      )}
    </>
  );
}
