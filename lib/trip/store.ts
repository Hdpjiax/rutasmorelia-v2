'use client';

import { create } from 'zustand';
import type { PlanSortMode } from './format';

type TripUiState = {
  planSort: PlanSortMode;
  setPlanSort: (m: PlanSortMode) => void;
  geometriesLoading: boolean;
  setGeometriesLoading: (v: boolean) => void;
  geocodeDegraded: boolean;
  setGeocodeDegraded: (v: boolean) => void;
};

export const useTripUiStore = create<TripUiState>((set) => ({
  planSort: 'time',
  setPlanSort: (planSort) => set({ planSort }),
  geometriesLoading: false,
  setGeometriesLoading: (geometriesLoading) => set({ geometriesLoading }),
  geocodeDegraded: false,
  setGeocodeDegraded: (geocodeDegraded) => set({ geocodeDegraded }),
}));
