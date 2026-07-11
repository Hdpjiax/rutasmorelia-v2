/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Coordinate, TripPlan, TravelSegment } from '@/lib/routing/planner';
import {
  loadShapesNearTrip,
  prefetchAllShapesInBackground,
  prefetchFrequentRoutes,
  prefetchShapesNearCoordinate,
  type PublishedShape,
} from '@/lib/routing/load-published-shapes';
import { planTripAsync, cancelPendingPlanJobs } from '@/lib/routing/plan-trip-client';
import { useTripUiStore } from '@/lib/trip/store';
import { uiTelemetry } from '@/lib/telemetry/ui-events';
import { toast } from '@/lib/ui/toast';
import { sortTripPlans, readTripUrlState, clearTripShareParamsFromLocation } from '@/features/planner';
import { usePublishedRoutes } from '@/features/routes/use-published-routes';
import { cacheRouteMetaList } from '@/lib/offline/store';
import { mockSupabaseClient, type Route } from '@/lib/supabase/client';
import { normalizeTransportType } from '@/lib/transport/classify';

function metaToRoute(r: {
  id: string;
  name: string;
  color: string;
  transportType?: string;
}): Route {
  const kind = normalizeTransportType(r.transportType, r.id, r.name);
  return {
    id: r.id,
    name: r.name,
    description: '',
    color: r.color || '#3b82f6',
    casing_color: '#222222',
    transport_type: kind === 'autobus' ? 'foraneo' : 'combi',
    status: 'approved' as const,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function useTripPlannerWorkflow(favorites: string[]) {
  const [originInput, setOriginInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [originCoords, setOriginCoords] = useState<Coordinate | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<Coordinate | null>(null);
  const [activeSearchField, setActiveSearchField] = useState<'origin' | 'destination' | null>(null);

  const [routes, setRoutes] = useState<Route[]>([]);
  const [shapesLoading, setShapesLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [tripPlans, setTripPlans] = useState<TripPlan[]>([]);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [planTypeFilter, setPlanTypeFilter] = useState<'all' | 'direct' | 'transfer'>('all');

  const planSort = useTripUiStore((s) => s.planSort);
  const setPlanSort = useTripUiStore((s) => s.setPlanSort);
  const geometriesLoading = useTripUiStore((s) => s.geometriesLoading);
  const setGeometriesLoading = useTripUiStore((s) => s.setGeometriesLoading);
  const geocodeDegraded = useTripUiStore((s) => s.geocodeDegraded);

  const shapesRef = useRef<PublishedShape[]>([]);
  const sharedTripOpenRef = useRef(false);
  const pendingSharePlanIndexRef = useRef<number | null>(null);

  const publishedQuery = usePublishedRoutes();

  // Carga de índice de rutas publicadas
  useEffect(() => {
    if (publishedQuery.data?.length) {
      const mapped = publishedQuery.data.map(metaToRoute);
      setRoutes(mapped);
      cacheRouteMetaList(
        mapped.map((r) => ({
          id: r.id,
          name: r.name,
          color: r.color,
          transportType: r.transport_type,
        }))
      );
      setShapesLoading(false);
      prefetchAllShapesInBackground();
      prefetchFrequentRoutes(favorites);
    } else if (publishedQuery.isError) {
      setShapesLoading(false);
      void mockSupabaseClient
        .from('routes')
        .select()
        .then(({ data }) => {
          if (data) setRoutes(data as Route[]);
        });
      toast('No se cargó el índice de rutas publicadas', 'warning');
    } else if (publishedQuery.isLoading) {
      setShapesLoading(true);
    }
  }, [publishedQuery.data, publishedQuery.isError, publishedQuery.isLoading, favorites]);

  // Carga de enlace compartido
  useEffect(() => {
    try {
      const trip = readTripUrlState();
      const isSharedTrip = Boolean(trip.origin && trip.destination);
      if (isSharedTrip) {
        sharedTripOpenRef.current = true;
        if (trip.planIndex != null) pendingSharePlanIndexRef.current = trip.planIndex;
      }

      if (trip.origin) {
        setOriginCoords(trip.origin);
        setOriginInput(
          trip.originLabel || `${trip.origin[1].toFixed(5)}, ${trip.origin[0].toFixed(5)}`
        );
        prefetchShapesNearCoordinate(trip.origin);
      }
      if (trip.destination) {
        setDestinationCoords(trip.destination);
        setDestinationInput(
          trip.destinationLabel || `${trip.destination[1].toFixed(5)}, ${trip.destination[0].toFixed(5)}`
        );
      }

      if (trip.origin || trip.destination || trip.routeId || trip.planIndex != null) {
        clearTripShareParamsFromLocation();
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Enriquecer segmentos de caminata con calles reales mediante el endpoint de proxy de caminata
  const enrichWalkSegments = useCallback(async (plans: TripPlan[]): Promise<TripPlan[]> => {
    return Promise.all(
      plans.map(async (plan) => {
        const enrichedSegments = await Promise.all(
          plan.segments.map(async (seg) => {
            if (seg.type === 'walk' && seg.walkFrom && seg.walkTo) {
              const [fromLng, fromLat] = seg.walkFrom;
              const [toLng, toLat] = seg.walkTo;
              try {
                const res = await fetch(
                  `/api/walk-route?fromLng=${fromLng}&fromLat=${fromLat}&toLng=${toLng}&toLat=${toLat}`
                );
                if (res.ok) {
                  const data = await res.json();
                  const geometry = data.feature?.geometry;
                  if (geometry?.coordinates && geometry.coordinates.length >= 2) {
                    // Retener coordenadas viales en una propiedad customizada del segmento
                    return {
                      ...seg,
                      walkCoords: geometry.coordinates as Coordinate[],
                    };
                  }
                }
              } catch (err) {
                console.warn('[planner-workflow] Walk route API failed, using straight line:', err);
              }
            }
            return seg;
          })
        );

        return {
          ...plan,
          segments: enrichedSegments as TravelSegment[],
        };
      })
    );
  }, []);

  // Proceso de planificación
  useEffect(() => {
    if (!originCoords || !destinationCoords) {
      setTripPlans([]);
      setPlanningError(null);
      setPlanning(false);
      return;
    }

    let cancelled = false;
    setPlanning(true);
    setPlanningError(null);
    cancelPendingPlanJobs();

    const run = async () => {
      try {
        setGeometriesLoading(true);
        const { shapes } = await loadShapesNearTrip(originCoords, destinationCoords);
        if (cancelled) return;
        shapesRef.current = shapes;
        setGeometriesLoading(false);
        const { plans, durationMs } = await planTripAsync(
          originCoords,
          destinationCoords,
          shapes,
          {
            transferOnlyIfNecessary: false,
            allowTransfers: true,
            maxWalkDistanceMeters: 950,
            maxDirectWalkTotalM: 1400,
            maxDirectPlans: 6,
            maxTransferPlans: 6,
            walkSpeedMeterPerSec: 1.2,
            transitSpeedMeterPerSec: 6.1,
          }
        );
        if (cancelled) return;

        const sorted = sortTripPlans(plans, useTripUiStore.getState().planSort);
        
        // Carga progresiva: dibujar primero las líneas rectas y luego enriquecerlas con la red de calles
        setTripPlans(sorted);

        const sharePlan = pendingSharePlanIndexRef.current;
        if (sharePlan != null && sharePlan >= 0 && sharePlan < sorted.length) {
          setSelectedPlanIndex(sharePlan);
        } else {
          setSelectedPlanIndex(0);
        }
        pendingSharePlanIndexRef.current = null;
        setPlanTypeFilter('all');
        setPlanning(false);

        if (sorted.length === 0) {
          setPlanningError(
            'No encontramos combis útiles cerca de esos puntos. Prueba mover origen o destino unos cientos de metros, o toca el mapa.'
          );
          uiTelemetry.planEmpty();
          toast('Sin rutas directas ni transbordos cercanos', 'warning');
        } else {
          uiTelemetry.planOk(sorted.length, durationMs);
          toast(
            sharedTripOpenRef.current
              ? 'Viaje compartido'
              : `${sorted.length} opción${sorted.length > 1 ? 'es' : ''} · ${
                  sorted[0].type === 'direct' ? 'directas' : 'con transbordo'
                }`,
            'success',
            'Viaje'
          );

          // Enriquecimiento de caminatas viales reales de forma asíncrona
          void enrichWalkSegments(sorted).then((enriched) => {
            if (!cancelled) {
              setTripPlans(enriched);
            }
          });
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.message === 'cancelled') return;
        console.error(err);
        setGeometriesLoading(false);
        setPlanning(false);
        setPlanningError('No se pudo calcular el viaje. Revisa la conexión e inténtalo de nuevo.');
        toast('Error al planificar', 'error');
      }
    };
    void run();

    return () => {
      cancelled = true;
      cancelPendingPlanJobs();
    };
  }, [originCoords, destinationCoords, setGeometriesLoading, enrichWalkSegments]);

  const swapOriginDestination = useCallback(() => {
    setOriginInput(destinationInput);
    setDestinationInput(originInput);
    setOriginCoords(destinationCoords);
    setDestinationCoords(originCoords);
  }, [originInput, destinationInput, originCoords, destinationCoords]);

  return {
    originInput,
    setOriginInput,
    destinationInput,
    setDestinationInput,
    originCoords,
    setOriginCoords,
    destinationCoords,
    setDestinationCoords,
    activeSearchField,
    setActiveSearchField,
    routes,
    shapesLoading,
    planning,
    tripPlans,
    setTripPlans,
    selectedPlanIndex,
    setSelectedPlanIndex,
    planningError,
    setPlanningError,
    planTypeFilter,
    setPlanTypeFilter,
    planSort,
    setPlanSort,
    geometriesLoading,
    geocodeDegraded,
    shapesRef,
    sharedTripOpenRef,
    swapOriginDestination,
  };
}
