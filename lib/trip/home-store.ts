'use client';

import { create } from 'zustand';
import type { Coordinate, TripPlan } from '@/lib/routing/planner';
import type { PlanSortMode } from '@/lib/trip/format';

export type PanelMode = 'search' | 'results' | 'favorites' | 'routes';
export type SearchField = 'origin' | 'destination' | null;

type HomeUiState = {
  panel: PanelMode;
  resultsOpen: boolean;
  searchExpanded: boolean;
  authOpen: boolean;
  activeSearchField: SearchField;
  planTypeFilter: 'all' | 'direct' | 'transfer';
  planSort: PlanSortMode;
  selectedPlanIndex: number;
  geometriesLoading: boolean;
  geocodeDegraded: boolean;
  setPanel: (p: PanelMode) => void;
  setResultsOpen: (v: boolean) => void;
  setSearchExpanded: (v: boolean) => void;
  setAuthOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  setActiveSearchField: (f: SearchField) => void;
  setPlanTypeFilter: (f: 'all' | 'direct' | 'transfer') => void;
  setPlanSort: (s: PlanSortMode) => void;
  setSelectedPlanIndex: (i: number) => void;
  setGeometriesLoading: (v: boolean) => void;
  setGeocodeDegraded: (v: boolean) => void;
  openPanel: (panel: PanelMode) => void;
};

/** UI de la home (Zustand real). Coords/planes siguen en el componente o queries. */
export const useHomeUiStore = create<HomeUiState>((set) => ({
  panel: 'results',
  resultsOpen: false,
  searchExpanded: false,
  authOpen: false,
  activeSearchField: null,
  planTypeFilter: 'all',
  planSort: 'time',
  selectedPlanIndex: 0,
  geometriesLoading: false,
  geocodeDegraded: false,
  setPanel: (panel) => set({ panel }),
  setResultsOpen: (resultsOpen) => set({ resultsOpen }),
  setSearchExpanded: (searchExpanded) => set({ searchExpanded }),
  setAuthOpen: (v) =>
    set((s) => ({ authOpen: typeof v === 'function' ? v(s.authOpen) : v })),
  setActiveSearchField: (activeSearchField) => set({ activeSearchField }),
  setPlanTypeFilter: (planTypeFilter) => set({ planTypeFilter }),
  setPlanSort: (planSort) => set({ planSort }),
  setSelectedPlanIndex: (selectedPlanIndex) => set({ selectedPlanIndex }),
  setGeometriesLoading: (geometriesLoading) => set({ geometriesLoading }),
  setGeocodeDegraded: (geocodeDegraded) => set({ geocodeDegraded }),
  openPanel: (panel) => set({ panel, resultsOpen: true, authOpen: false }),
}));

export type TripDraft = {
  origin: Coordinate | null;
  destination: Coordinate | null;
  originLabel: string;
  destinationLabel: string;
  plans: TripPlan[];
  planning: boolean;
  planningError: string | null;
};

type TripDraftState = TripDraft & {
  setOrigin: (c: Coordinate | null, label?: string) => void;
  setDestination: (c: Coordinate | null, label?: string) => void;
  setLabels: (o?: string, d?: string) => void;
  setPlans: (plans: TripPlan[]) => void;
  setPlanning: (v: boolean) => void;
  setPlanningError: (e: string | null) => void;
  swapOd: () => void;
  clearTrip: () => void;
};

export const useTripDraftStore = create<TripDraftState>((set) => ({
  origin: null,
  destination: null,
  originLabel: '',
  destinationLabel: '',
  plans: [],
  planning: false,
  planningError: null,
  setOrigin: (origin, label) =>
    set((s) => ({
      origin,
      originLabel: label !== undefined ? label : s.originLabel,
    })),
  setDestination: (destination, label) =>
    set((s) => ({
      destination,
      destinationLabel: label !== undefined ? label : s.destinationLabel,
    })),
  setLabels: (o, d) =>
    set((s) => ({
      originLabel: o !== undefined ? o : s.originLabel,
      destinationLabel: d !== undefined ? d : s.destinationLabel,
    })),
  setPlans: (plans) => set({ plans }),
  setPlanning: (planning) => set({ planning }),
  setPlanningError: (planningError) => set({ planningError }),
  swapOd: () =>
    set((s) => ({
      origin: s.destination,
      destination: s.origin,
      originLabel: s.destinationLabel,
      destinationLabel: s.originLabel,
    })),
  clearTrip: () =>
    set({
      origin: null,
      destination: null,
      originLabel: '',
      destinationLabel: '',
      plans: [],
      planning: false,
      planningError: null,
    }),
}));
