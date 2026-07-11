/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap, Marker, GeoJSONSource } from 'maplibre-gl';
import type { Coordinate, TripPlan } from '@/lib/routing/planner';
import type { PublishedShape } from '@/lib/routing/load-published-shapes';
import { ROUTES_SOURCE_ID, setTripStopsData } from '@/lib/map/route-layers';
import { createLiveGpsElement, createOrbElement } from '@/components/home/map-markers';
import { loadShapesForRouteIds } from '@/lib/routing/load-published-shapes';
import { mockDb, type Route } from '@/lib/supabase/client';
import { parseRouteDisplay } from '@/lib/routes/route-display';
import { toSingleCorridorDisplay, type RouteFeatureCollection, type RouteDirection } from '@/lib/gis/direction-mode';
import { uiTelemetry } from '@/lib/telemetry/ui-events';
import { toast } from '@/lib/ui/toast';

// Elemento DOM para el orbe de transbordo fusionado
function createTransferOrbElement(color1: string, color2: string) {
  const container = document.createElement('div');
  container.className = 'relative flex items-center justify-center';
  container.style.width = '42px';
  container.style.height = '32px';

  container.innerHTML = `
    <!-- Anillo pulsante en el fondo -->
    <span class="absolute w-[36px] h-[36px] rounded-full border-2 border-amber-500 opacity-60 animate-ping" style="animation-duration: 2s;"></span>
    <!-- Orbe izquierdo (Ruta 1) -->
    <div class="absolute w-6 h-6 rounded-full border-2 border-white shadow-md" style="background-color: ${color1}; left: 2px; z-index: 1;"></div>
    <!-- Orbe derecho (Ruta 2) -->
    <div class="absolute w-6 h-6 rounded-full border-2 border-white shadow-md" style="background-color: ${color2}; right: 2px; z-index: 2;"></div>
  `;
  return container;
}

type SetupProps = {
  originCoords: Coordinate | null;
  destinationCoords: Coordinate | null;
  /** Posición GPS en vivo (punto azul). Se mueve con setLngLat sin recrear el DOM. */
  liveUserCoords?: Coordinate | null;
  selectedRouteId: string | null;
  setSelectedRouteId: (id: string | null) => void;
  tripPlans: TripPlan[];
  selectedPlanIndex: number;
  routes: Route[];
  routeDirection: 'both' | RouteDirection;
  setRouteDirection: (dir: 'both' | RouteDirection) => void;
  activeSearchField: 'origin' | 'destination' | null;
  pinDropMode: 'origin' | 'destination' | null;
  onMapClick: (coords: Coordinate) => void;
  shapesRef: React.MutableRefObject<PublishedShape[]>;
};

export function useMaplibreSetup({
  originCoords,
  destinationCoords,
  liveUserCoords = null,
  selectedRouteId,
  setSelectedRouteId,
  tripPlans,
  selectedPlanIndex,
  routes,
  routeDirection,
  setRouteDirection,
  activeSearchField,
  pinDropMode,
  onMapClick,
  shapesRef,
}: SetupProps) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const transferMarkersRef = useRef<Marker[]>([]);
  const mlRef = useRef<typeof import('maplibre-gl') | null>(null);
  const [styleLoaded, setStyleLoaded] = useState(false);

  const handleMapReady = useCallback((m: MapLibreMap) => {
    mapRef.current = m;
    setStyleLoaded(true);
    m.resize();
    void import('maplibre-gl').then((mod) => {
      mlRef.current = mod;
    });

    // Añadir efectos hover sobre las líneas de ruta
    m.on('mouseenter', 'route-lines', () => {
      m.getCanvas().style.cursor = 'pointer';
    });
    m.on('mouseleave', 'route-lines', () => {
      m.getCanvas().style.cursor = '';
    });
  }, []);

  const zoomBy = useCallback((delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 280 });
  }, []);

  const fitMapToBounds = useCallback((bounds: [[number, number], [number, number]], padding = 56) => {
    const map = mapRef.current;
    if (!map) return;
    map.fitBounds(bounds, { padding, maxZoom: 15, essential: true });
  }, []);

  const handleMapClickInternal = useCallback((e: any) => {
    const coords: Coordinate = [e.lngLat.lng, e.lngLat.lat];
    onMapClick(coords);
  }, [onMapClick]);

  // Manejo de eventos de click en el mapa
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    map.on('click', handleMapClickInternal);
    return () => {
      map.off('click', handleMapClickInternal);
    };
  }, [styleLoaded, handleMapClickInternal]);

  // Cambiar cursor en modo Pin Drop o búsqueda activa
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    if (pinDropMode || activeSearchField) {
      map.getCanvas().style.cursor = 'crosshair';
    } else {
      map.getCanvas().style.cursor = '';
    }
  }, [pinDropMode, activeSearchField, styleLoaded]);

  // Marcadores de origen y destino (Orbes) — recrear solo si cambian de existencia
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    let cancelled = false;

    const run = async () => {
      if (!mlRef.current) {
        mlRef.current = await import('maplibre-gl');
      }
      if (cancelled || !mapRef.current) return;
      const { Marker } = mlRef.current;

      const ok = (c: Coordinate | null | undefined): c is Coordinate =>
        !!c && Number.isFinite(c[0]) && Number.isFinite(c[1]) && Math.abs(c[0]) > 0.01;

      const upsert = (key: 'origin' | 'destination', coords: Coordinate | null, kind: 'origin' | 'dest') => {
        if (!ok(coords)) {
          markersRef.current[key]?.remove();
          delete markersRef.current[key];
          return;
        }
        const existing = markersRef.current[key];
        if (existing) {
          existing.setLngLat(coords);
          return;
        }
        markersRef.current[key] = new Marker({
          element: createOrbElement(kind),
          anchor: 'center',
        })
          .setLngLat(coords)
          .addTo(map);
      };

      upsert('origin', originCoords, 'origin');
      upsert('destination', destinationCoords, 'dest');
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [originCoords, destinationCoords, styleLoaded]);

  // Punto GPS en vivo: actualizar posición sin destruir el marcador (smooth)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    let cancelled = false;

    const run = async () => {
      if (!mlRef.current) {
        mlRef.current = await import('maplibre-gl');
      }
      if (cancelled || !mapRef.current) return;
      const { Marker } = mlRef.current;

      const ok =
        !!liveUserCoords &&
        Number.isFinite(liveUserCoords[0]) &&
        Number.isFinite(liveUserCoords[1]) &&
        Math.abs(liveUserCoords[0]) > 0.01;

      if (!ok) {
        markersRef.current.live?.remove();
        delete markersRef.current.live;
        return;
      }

      const existing = markersRef.current.live;
      if (existing) {
        existing.setLngLat(liveUserCoords!);
        return;
      }
      markersRef.current.live = new Marker({
        element: createLiveGpsElement(),
        anchor: 'center',
      })
        .setLngLat(liveUserCoords!)
        .addTo(map);
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [liveUserCoords, styleLoaded]);

  // Dibujar ruta explorada
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    if (tripPlans.length > 0) return;

    if (selectedRouteId) {
      void loadShapesForRouteIds([selectedRouteId])
        .then(async (shapes) => {
          shapes.forEach((s) => {
            const idx = shapesRef.current.findIndex(
              (x) => x.route_id === s.route_id && x.direction === s.direction
            );
            if (idx >= 0) shapesRef.current[idx] = s;
            else shapesRef.current.push(s);
          });
          const meta = routes.find((r) => r.id === selectedRouteId);
          const file = `/routes/${selectedRouteId}.geojson`;
          const res = await fetch(file);
          if (!res.ok) {
            uiTelemetry.routeGeojsonMissing(selectedRouteId);
            throw new Error('Error al cargar rutas');
          }
          const data = (await res.json()) as RouteFeatureCollection;
          const source = map.getSource(ROUTES_SOURCE_ID) as GeoJSONSource;
          const prefer = routeDirection === 'both' ? undefined : routeDirection;
          const single = toSingleCorridorDisplay(data, {
            role: 'full',
            preferDirection: prefer,
            color: meta?.color,
          });

          let display = single;
          if (routeDirection !== 'both' && single.features) {
            display = {
              ...single,
              features: single.features.filter((f) => {
                const d = String(f.properties?.direction ?? f.properties?.name ?? '').toLowerCase();
                if (f.properties?.type === 'sense-label') {
                  return d.includes(routeDirection);
                }
                return d === routeDirection || d.includes(routeDirection);
              }),
            };
            if (!display.features?.length) display = single;
          }
          source?.setData(display as unknown as GeoJSON.FeatureCollection);

          const lineFeat = (display.features ?? []).find(
            (f) => f.geometry?.type === 'LineString' && Array.isArray(f.geometry.coordinates)
          );
          const lineCoords = (lineFeat?.geometry?.coordinates ?? []) as Coordinate[];
          const info = meta ? parseRouteDisplay(meta) : null;
          if (lineCoords.length >= 2) {
            setTripStopsData(map, [
              {
                type: 'Feature',
                properties: {
                  label: (info?.terminalIda || 'Inicio').slice(0, 28),
                  kind: 'sube',
                  stack: 'center',
                },
                geometry: { type: 'Point', coordinates: lineCoords[0] },
              },
              {
                type: 'Feature',
                properties: {
                  label: (info?.terminalVuelta || 'Final').slice(0, 28),
                  kind: 'baja',
                  stack: 'center',
                },
                geometry: {
                  type: 'Point',
                  coordinates: lineCoords[lineCoords.length - 1],
                },
              },
            ]);
          } else {
            setTripStopsData(map, []);
          }

          const all: Coordinate[] = [];
          for (const f of display.features ?? []) {
            if (
              f.properties?.type !== 'sense-label' &&
              f.geometry?.type === 'LineString' &&
              Array.isArray(f.geometry.coordinates)
            ) {
              all.push(...(f.geometry.coordinates as Coordinate[]));
            }
          }
          if (all.length) {
            const lngs = all.map((c) => c[0]);
            const lats = all.map((c) => c[1]);
            fitMapToBounds(
              [
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)],
              ],
              56
            );
          }
        })
        .catch(() => {
          const offline = typeof navigator !== 'undefined' && !navigator.onLine;
          toast(
            offline
              ? 'Sin conexión al cargar la ruta'
              : 'No se pudo cargar la ruta',
            'error'
          );
        });
    } else {
      const source = map.getSource(ROUTES_SOURCE_ID) as GeoJSONSource;
      source?.setData({ type: 'FeatureCollection', features: [] });
      setTripStopsData(map, []);
    }
  }, [selectedRouteId, styleLoaded, tripPlans.length, routes, routeDirection, fitMapToBounds]);

  const findClosestCoordinateIndex = (coords: Coordinate[], target: Coordinate) => {
    let min = Infinity;
    let index = -1;
    coords.forEach((c, i) => {
      const d = Math.hypot(c[0] - target[0], c[1] - target[1]);
      if (d < min) {
        min = d;
        index = i;
      }
    });
    return index;
  };

  // Dibujar plan de viaje activo
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    // Limpiar marcadores de transbordo anteriores
    transferMarkersRef.current.forEach((m) => m.remove());
    transferMarkersRef.current = [];

    if (tripPlans.length === 0) {
      setTripStopsData(map, []);
      return;
    }

    const plan = tripPlans[selectedPlanIndex];
    if (!plan) return;

    const features: Array<{
      type: string;
      properties: Record<string, unknown>;
      geometry: { type: string; coordinates: Coordinate[] };
    }> = [];

    const resolveShapeCoords = (
      routeId: string,
      direction: 'ida' | 'vuelta'
    ): Coordinate[] => {
      const pub = shapesRef.current.find(
        (s) => s.route_id === routeId && s.direction === direction
      );
      if (pub?.coordinates?.length) return pub.coordinates;
      const mock = mockDb.route_shapes.find(
        (s) => s.route_id === routeId && s.direction === direction
      );
      return (mock?.geom.coordinates as Coordinate[]) ?? [];
    };

    // 1) Líneas completas de fondo por routeId
    const routeMeta = new Map<string, { color: string; prefer: 'ida' | 'vuelta' }>();
    for (const seg of plan.segments) {
      if (seg.type === 'ride' && seg.routeId) {
        routeMeta.set(seg.routeId, {
          color: seg.color || '#3b82f6',
          prefer: seg.direction || 'ida',
        });
      }
    }

    for (const [routeId, meta] of routeMeta) {
      const ida = resolveShapeCoords(routeId, 'ida');
      const vu = resolveShapeCoords(routeId, 'vuelta');
      const fc: RouteFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          ...(ida.length >= 2
            ? [
                {
                  type: 'Feature' as const,
                  properties: { direction: 'ida', name: 'Ida', color: meta.color },
                  geometry: { type: 'LineString' as const, coordinates: ida },
                },
              ]
            : []),
          ...(vu.length >= 2
            ? [
                {
                  type: 'Feature' as const,
                  properties: { direction: 'vuelta', name: 'Vuelta', color: meta.color },
                  geometry: { type: 'LineString' as const, coordinates: vu },
                },
              ]
            : []),
        ],
      };
      const single = toSingleCorridorDisplay(fc, {
        color: meta.color,
        preferDirection: meta.prefer,
        role: 'full',
      });
      for (const f of single.features ?? []) {
        features.push({
          type: 'Feature',
          properties: { ...(f.properties ?? {}), routeId },
          geometry: f.geometry as { type: string; coordinates: Coordinate[] },
        });
      }
    }

    // 2) Tramos del viaje (sube→baja) resaltado + caminatas (viales o rectas)
    plan.segments.forEach((seg) => {
      if (seg.type === 'walk' && seg.walkFrom && seg.walkTo) {
        // Usar coordenadas viales reales si están enriquecidas, de lo contrario línea recta
        const pathCoords = (seg as any).walkCoords || [seg.walkFrom, seg.walkTo];
        features.push({
          type: 'Feature',
          properties: {
            type: 'walk',
            walkKind: seg.walkKind || 'to_board',
            name: '',
            color: '#64748b',
          },
          geometry: { type: 'LineString', coordinates: pathCoords },
        });
      } else if (seg.type === 'ride' && seg.routeId && seg.direction) {
        let coordinates = resolveShapeCoords(seg.routeId, seg.direction);

        if (seg.boardingPoint && seg.alightingPoint && coordinates.length > 0) {
          const startIdx = findClosestCoordinateIndex(coordinates, seg.boardingPoint);
          const endIdx = findClosestCoordinateIndex(coordinates, seg.alightingPoint);
          if (startIdx >= 0 && endIdx >= 0) {
            coordinates =
              startIdx <= endIdx
                ? coordinates.slice(startIdx, endIdx + 1)
                : coordinates.slice(endIdx, startIdx + 1).reverse();
          }
        }

        if (coordinates.length >= 2) {
          features.push({
            type: 'Feature',
            properties: {
              type: 'ride',
              role: 'segment',
              color: seg.color || '#3b82f6',
              casingColor: '#111111',
              name: '',
            },
            geometry: { type: 'LineString', coordinates },
          });
        }
      }
    });

    const source = map.getSource(ROUTES_SOURCE_ID) as GeoJSONSource;
    const geojsonPayload = {
      type: 'FeatureCollection',
      features,
    } as unknown as GeoJSON.FeatureCollection;
    source?.setData(geojsonPayload);

    const isMapCoord = (c?: Coordinate | null): c is Coordinate => {
      if (!c || c.length < 2) return false;
      const [lng, lat] = c;
      return (
        Number.isFinite(lng) &&
        Number.isFinite(lat) &&
        lng >= -101.55 &&
        lng <= -100.75 &&
        lat >= 19.4 &&
        lat <= 20.05
      );
    };

    const sameSpot = (a: Coordinate, b: Coordinate, maxM = 35) => {
      const dLng = (a[0] - b[0]) * 111320 * Math.cos((a[1] * Math.PI) / 180);
      const dLat = (a[1] - b[1]) * 110540;
      return Math.hypot(dLng, dLat) <= maxM;
    };

    type StopFeat = {
      type: 'Feature';
      properties: {
        label: string;
        kind: 'sube' | 'baja' | 'transbordo';
        stack: 'up' | 'down' | 'center';
      };
      geometry: { type: 'Point'; coordinates: [number, number] };
    };
    const stopFeatures: StopFeat[] = [];

    const pushStop = (
      coords: Coordinate,
      label: string,
      kind: StopFeat['properties']['kind'],
      stack: StopFeat['properties']['stack'] = 'center'
    ) => {
      const lng = coords[0];
      let lat = coords[1];
      if (stack === 'up') lat += 0.00012;
      if (stack === 'down') lat -= 0.00012;
      stopFeatures.push({
        type: 'Feature',
        properties: { label, kind, stack },
        geometry: { type: 'Point', coordinates: [lng, lat] },
      });
    };

    // Identificar transbordos para marcadores fusionados
    const transferSegments: Array<{ coords: Coordinate; col1: string; col2: string }> = [];

    plan.segments.forEach((seg, idx) => {
      if (seg.type === 'walk' && seg.walkKind === 'transfer') {
        const from = isMapCoord(seg.walkFrom) ? seg.walkFrom : null;
        const to = isMapCoord(seg.walkTo) ? seg.walkTo : null;
        if (from && to) {
          const mid: Coordinate = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
          const prevSeg = plan.segments[idx - 1];
          const nextSeg = plan.segments[idx + 1];
          
          if (prevSeg?.type === 'ride' && nextSeg?.type === 'ride') {
            transferSegments.push({
              coords: mid,
              col1: prevSeg.color || '#3b82f6',
              col2: nextSeg.color || '#10b981',
            });
            pushStop(mid, 'Transbordo', 'transbordo', 'center');
            return;
          }
        }
      }
      if (seg.type !== 'ride') return;
      if (isMapCoord(seg.boardingPoint)) {
        const prev = plan.segments[idx - 1];
        const afterTransfer = prev?.type === 'walk' && prev.walkKind === 'transfer';
        if (!afterTransfer) {
          pushStop(seg.boardingPoint, 'Sube aquí', 'sube', 'center');
        }
      }
      if (isMapCoord(seg.alightingPoint)) {
        const next = plan.segments[idx + 1];
        const isTransfer = next?.type === 'walk' && next.walkKind === 'transfer';
        if (!isTransfer) {
          pushStop(seg.alightingPoint, 'Baja aquí', 'baja', 'center');
        }
      }
    });

    // Combinar marcadores coincidentes
    const merged: StopFeat[] = [];
    const used = new Set<number>();
    for (let i = 0; i < stopFeatures.length; i++) {
      if (used.has(i)) continue;
      const a = stopFeatures[i];
      let fused = false;
      for (let j = i + 1; j < stopFeatures.length; j++) {
        if (used.has(j)) continue;
        const b = stopFeatures[j];
        if (
          sameSpot(a.geometry.coordinates as Coordinate, b.geometry.coordinates as Coordinate) &&
          a.properties.kind !== b.properties.kind
        ) {
          const mid: Coordinate = [
            (a.geometry.coordinates[0] + b.geometry.coordinates[0]) / 2,
            (a.geometry.coordinates[1] + b.geometry.coordinates[1]) / 2,
          ];
          const hasSube =
            a.properties.kind === 'sube' ||
            b.properties.kind === 'sube' ||
            a.properties.label.includes('Sube') ||
            b.properties.label.includes('Sube');
          const hasBaja =
            a.properties.kind === 'baja' ||
            b.properties.kind === 'baja' ||
            a.properties.label.includes('Baja') ||
            b.properties.label.includes('Baja');
          const label =
            hasSube && hasBaja
              ? 'Baja y sube aquí'
              : hasSube
                ? 'Sube aquí'
                : 'Baja aquí';
          merged.push({
            type: 'Feature',
            properties: { label, kind: 'transbordo', stack: 'center' },
            geometry: { type: 'Point', coordinates: mid },
          });
          used.add(i);
          used.add(j);
          fused = true;
          break;
        }
      }
      if (!fused) merged.push(a);
    }
    setTripStopsData(map, merged);

    // Inyectar marcadores HTML de transbordo fusionados (doble orbe entrelazado)
    void import('maplibre-gl').then(({ Marker }) => {
      transferSegments.forEach(({ coords, col1, col2 }) => {
        const marker = new Marker({
          element: createTransferOrbElement(col1, col2),
          anchor: 'center',
        })
          .setLngLat(coords)
          .addTo(map);
        transferMarkersRef.current.push(marker);
      });
    });

    // Bounds encuadre completo
    const allCoords: Coordinate[] = [];
    features.forEach((f) => {
      if (f.properties.role === 'full' || f.properties.type === 'walk') {
        allCoords.push(...f.geometry.coordinates);
      }
    });
    if (allCoords.length === 0) {
      features.forEach((f) => allCoords.push(...f.geometry.coordinates));
    }
    if (originCoords) allCoords.push(originCoords);
    if (destinationCoords) allCoords.push(destinationCoords);
    if (allCoords.length) {
      const lngs = allCoords.map((c) => c[0]);
      const lats = allCoords.map((c) => c[1]);
      fitMapToBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        64
      );
    }
  }, [tripPlans, selectedPlanIndex, styleLoaded, originCoords, destinationCoords, fitMapToBounds]);

  // Limpiar mapa al resetear
  const clearMap = useCallback(() => {
    setSelectedRouteId(null);
    setRouteDirection('both');
    const map = mapRef.current;
    if (map) {
      const source = map.getSource(ROUTES_SOURCE_ID) as GeoJSONSource | undefined;
      source?.setData({ type: 'FeatureCollection', features: [] });
      setTripStopsData(map, []);
    }
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};
    transferMarkersRef.current.forEach((m) => m.remove());
    transferMarkersRef.current = [];
  }, [setSelectedRouteId, setRouteDirection]);

  return {
    mapRef,
    styleLoaded,
    zoomBy,
    fitMapToBounds,
    clearMap,
    handleMapReady,
  };
}
