'use client';

/**
 * Compat: reexporta el store de UI de viaje desde home-store.
 * Preferir useHomeUiStore para panel/search; este alias mantiene planSort.
 */
export {
  useHomeUiStore as useTripUiStore,
  useHomeUiStore,
  useTripDraftStore,
} from './home-store';
