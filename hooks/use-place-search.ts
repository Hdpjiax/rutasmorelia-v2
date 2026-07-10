'use client';

import { useCallback, useRef, useState } from 'react';
import type { Coordinate } from '@/lib/routing/planner';
import { searchLocalPlaces, type PlaceHit } from '@/lib/search/morelia-places';
import { mergeAndRankPlaces } from '@/lib/search/rank-places';
import type { FavoriteLocation } from '@/features/favorites';
import {
  loadHomePlace,
  loadRecentPlaces,
  loadWorkPlace,
  pushRecentPlace,
  type RecentPlace,
  type SavedPlaceSlot,
} from '@/lib/search/recent';
import { saveLastTripSearch } from '@/lib/offline/store';
import { useTripUiStore } from '@/lib/trip/store';

export type SearchField = 'origin' | 'destination' | null;

export function usePlaceSearch(favoriteLocations: FavoriteLocation[]) {
  const [originInput, setOriginInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [originCoords, setOriginCoords] = useState<Coordinate | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<Coordinate | null>(null);
  const [activeSearchField, setActiveSearchField] = useState<SearchField>(null);
  const [suggestions, setSuggestions] = useState<PlaceHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recentPlaces, setRecentPlaces] = useState<RecentPlace[]>([]);
  const [homePlace, setHomePlace] = useState<SavedPlaceSlot>(null);
  const [workPlace, setWorkPlace] = useState<SavedPlaceSlot>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSearchFieldRef = useRef(activeSearchField);
  activeSearchFieldRef.current = activeSearchField;

  const setGeocodeDegraded = useTripUiStore((s) => s.setGeocodeDegraded);
  const geocodeDegraded = useTripUiStore((s) => s.geocodeDegraded);

  const hydrateLocal = useCallback(() => {
    setRecentPlaces(loadRecentPlaces());
    setHomePlace(loadHomePlace());
    setWorkPlace(loadWorkPlace());
  }, []);

  const runSearch = useCallback(
    async (val: string) => {
      const q = val.trim();
      if (!q) {
        const quick: PlaceHit[] = [];
        if (homePlace) {
          quick.push({
            id: 'slot-home',
            name: homePlace.name || 'Casa',
            description: homePlace.description || 'Casa',
            category: 'home',
            coordinates: homePlace.coordinates,
            source: 'favorite',
          });
        }
        if (workPlace) {
          quick.push({
            id: 'slot-work',
            name: workPlace.name || 'Trabajo',
            description: workPlace.description || 'Trabajo',
            category: 'work',
            coordinates: workPlace.coordinates,
            source: 'favorite',
          });
        }
        for (const p of recentPlaces.slice(0, 5)) {
          if (quick.some((x) => x.id === p.id)) continue;
          quick.push({
            id: p.id,
            name: p.name,
            description: p.description || 'Reciente',
            category: 'recent',
            coordinates: p.coordinates,
            source: 'favorite',
          });
        }
        for (const f of favoriteLocations.slice(0, 6)) {
          if (quick.some((x) => x.id === f.id)) continue;
          quick.push({
            id: f.id,
            name: f.name,
            description: f.description || 'Favorito',
            category: 'favorite',
            coordinates: f.coordinates,
            source: 'favorite',
            isFavorite: true,
          });
        }
        setSuggestions(quick.slice(0, 10));
        setSearchLoading(false);
        return;
      }

      setSearchLoading(true);
      const local = searchLocalPlaces(q, 24);
      const favHits: PlaceHit[] = favoriteLocations
        .filter((f) => {
          const n = f.name.toLowerCase();
          const qq = q.toLowerCase();
          return n.includes(qq) || (f.description || '').toLowerCase().includes(qq);
        })
        .map((f) => ({
          id: f.id,
          name: f.name,
          description: f.description || 'Favorito',
          category: 'favorite',
          coordinates: f.coordinates,
          source: 'favorite' as const,
          isFavorite: true,
        }));

      setSuggestions(mergeAndRankPlaces([favHits, local], q, 20));

      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
          cache: 'no-store',
        });
        if (res.status === 429) {
          setGeocodeDegraded(true);
        } else if (res.ok) {
          const data = await res.json();
          if (data.degraded || data.error) setGeocodeDegraded(true);
          else setGeocodeDegraded(false);
          const remote: PlaceHit[] = (data.results ?? []).map(
            (r: PlaceHit & { source?: string }) => ({
              ...r,
              source: 'geocode' as const,
            })
          );
          setSuggestions(mergeAndRankPlaces([favHits, local, remote], q, 24));
        } else {
          setGeocodeDegraded(true);
        }
      } catch {
        setGeocodeDegraded(true);
      } finally {
        setSearchLoading(false);
      }
    },
    [favoriteLocations, homePlace, workPlace, recentPlaces, setGeocodeDegraded]
  );

  const handleSearchChange = useCallback(
    (field: 'origin' | 'destination', val: string) => {
      if (field === 'origin') {
        setOriginInput(val);
        if (!val.trim()) setOriginCoords(null);
      } else {
        setDestinationInput(val);
        if (!val.trim()) setDestinationCoords(null);
      }
      setActiveSearchField(field);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => void runSearch(val), 220);
    },
    [runSearch]
  );

  const selectSuggestion = useCallback(
    (place: PlaceHit, field?: SearchField) => {
      const f = field ?? activeSearchFieldRef.current;
      if (f === 'origin') {
        setOriginInput(place.name);
        setOriginCoords(place.coordinates);
      } else if (f === 'destination') {
        setDestinationInput(place.name);
        setDestinationCoords(place.coordinates);
      }
      setRecentPlaces(
        pushRecentPlace({
          id: place.id,
          name: place.name,
          description: place.description,
          coordinates: place.coordinates,
        })
      );
      setSuggestions([]);
      setActiveSearchField(null);
      return place.coordinates;
    },
    []
  );

  const persistLastTrip = useCallback(() => {
    saveLastTripSearch({
      originLabel: originInput,
      destinationLabel: destinationInput,
      origin: originCoords,
      destination: destinationCoords,
    });
  }, [originInput, destinationInput, originCoords, destinationCoords]);

  const dismissKeyboard = useCallback(() => {
    if (typeof document === 'undefined') return;
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
  }, []);

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
    activeSearchFieldRef,
    suggestions,
    setSuggestions,
    searchLoading,
    recentPlaces,
    homePlace,
    workPlace,
    hydrateLocal,
    runSearch,
    handleSearchChange,
    selectSuggestion,
    persistLastTrip,
    dismissKeyboard,
    geocodeDegraded,
  };
}
