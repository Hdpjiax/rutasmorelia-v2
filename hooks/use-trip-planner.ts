/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useRef, useState } from 'react';
import type { Coordinate, TripPlan } from '@/lib/routing/planner';
import { loadShapesNearTrip, type PublishedShape } from '@/lib/routing/load-published-shapes';
import { planTripAsync, cancelPendingPlanJobs } from '@/lib/routing/plan-trip-client';
import { sortTripPlans } from '@/features/planner';
import { useTripUiStore } from '@/lib/trip/store';
import { uiTelemetry } from '@/lib/telemetry/ui-events';
import { toast } from '@/lib/ui/toast';

type Opts = {
  originCoords: Coordinate | null;
  destinationCoords: Coordinate | null;
  shapesRef: React.MutableRefObject<PublishedShape[]>;
  onPlansReady?: (plans: TripPlan[]) => void;
  sharedTripRef?: React.MutableRefObject<boolean>;
  pendingSharePlanIndexRef?: React.MutableRefObject<number | null>;
};

/**
 * Planificación con Web Worker + cancelación al cambiar OD.
 */
export function useTripPlanner({
  originCoords,
  destinationCoords,
  shapesRef,
  onPlansReady,
  sharedTripRef,
  pendingSharePlanIndexRef,
}: Opts) {
  const [tripPlans, setTripPlans] = useState<TripPlan[]>([]);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [planning, setPlanning] = useState(false);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [planTypeFilter, setPlanTypeFilter] = useState<'all' | 'direct' | 'transfer'>('all');
  const planSort = useTripUiStore((s) => s.planSort);
  const setGeometriesLoading = useTripUiStore((s) => s.setGeometriesLoading);
  const genRef = useRef(0);

  useEffect(() => {
    if (!originCoords || !destinationCoords) {
      setTripPlans([]);
      setPlanningError(null);
      setPlanning(false);
      return;
    }

    const gen = ++genRef.current;
    let cancelled = false;
    setPlanning(true);
    setPlanningError(null);
    cancelPendingPlanJobs();

    const run = async () => {
      try {
        setGeometriesLoading(true);
        const { shapes } = await loadShapesNearTrip(originCoords, destinationCoords);
        if (cancelled || gen !== genRef.current) return;
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
        if (cancelled || gen !== genRef.current) return;

        const sorted = sortTripPlans(plans, useTripUiStore.getState().planSort);
        setTripPlans(sorted);
        const sharePlan = pendingSharePlanIndexRef?.current;
        if (sharePlan != null && sharePlan >= 0 && sharePlan < sorted.length) {
          setSelectedPlanIndex(sharePlan);
        } else {
          setSelectedPlanIndex(0);
        }
        if (pendingSharePlanIndexRef) pendingSharePlanIndexRef.current = null;
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
          onPlansReady?.(sorted);
          toast(
            sharedTripRef?.current
              ? 'Viaje compartido'
              : `${sorted.length} opción${sorted.length > 1 ? 'es' : ''} · ${
                  sorted[0].type === 'direct' ? 'directas' : 'con transbordo'
                }`,
            'success',
            'Viaje'
          );
        }
      } catch (err) {
        if (cancelled || gen !== genRef.current) return;
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
  }, [
    originCoords,
    destinationCoords,
    setGeometriesLoading,
    shapesRef,
    onPlansReady,
    sharedTripRef,
    pendingSharePlanIndexRef,
  ]);

  return {
    tripPlans,
    setTripPlans,
    selectedPlanIndex,
    setSelectedPlanIndex,
    planning,
    planningError,
    planTypeFilter,
    setPlanTypeFilter,
    planSort,
  };
}
