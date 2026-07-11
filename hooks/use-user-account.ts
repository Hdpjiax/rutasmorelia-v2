/* eslint-disable react-hooks/set-state-in-effect */
'use client';

/**
 * Preferencias del usuario en este dispositivo (sin cuentas).
 * Favoritos, recientes, casa/trabajo → localStorage.
 */

import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/lib/ui/toast';
import {
  addFavoriteLocation,
  loadLocalFavoriteLocations,
  loadLocalFavoriteRoutes,
  removeFavoriteLocation,
  toggleFavoriteRoute,
  type FavoriteLocation,
} from '@/features/favorites';
import {
  loadHomePlace,
  loadRecentPlaces,
  loadRecentRoutes,
  loadWorkPlace,
  pushRecentPlace,
  pushRecentRoute,
  type RecentPlace,
  type RecentRoute,
  type SavedPlaceSlot,
} from '@/lib/search/recent';
import type { PlaceHit } from '@/lib/search/morelia-places';

export function useUserAccount() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<RecentPlace[]>([]);
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([]);
  const [homePlace, setHomePlace] = useState<SavedPlaceSlot>(null);
  const [workPlace, setWorkPlace] = useState<SavedPlaceSlot>(null);

  useEffect(() => {
    setFavorites(loadLocalFavoriteRoutes());
    setFavoriteLocations(loadLocalFavoriteLocations());
    setRecentPlaces(loadRecentPlaces());
    setRecentRoutes(loadRecentRoutes());
    setHomePlace(loadHomePlace());
    setWorkPlace(loadWorkPlace());
  }, []);

  const toggleFavorite = useCallback(async (routeId: string) => {
    const next = await toggleFavoriteRoute(routeId, favorites);
    setFavorites(next);
    toast(
      next.includes(routeId) ? 'Ruta en favoritos (en este dispositivo)' : 'Ruta quitada de favoritos',
      next.includes(routeId) ? 'success' : 'info'
    );
  }, [favorites]);

  const toggleLocationFavorite = useCallback(
    async (hit: { name: string; description?: string; coordinates: [number, number] }) => {
      const existing = favoriteLocations.find(
        (l) =>
          l.name.toLowerCase() === hit.name.toLowerCase() &&
          Math.abs(l.coordinates[0] - hit.coordinates[0]) < 1e-4 &&
          Math.abs(l.coordinates[1] - hit.coordinates[1]) < 1e-4
      );
      if (existing) {
        const next = await removeFavoriteLocation(existing.id, favoriteLocations);
        setFavoriteLocations(next);
        toast('Ubicación quitada de favoritos', 'info');
      } else {
        const next = await addFavoriteLocation(
          {
            name: hit.name,
            description: hit.description,
            coordinates: hit.coordinates,
          },
          favoriteLocations
        );
        setFavoriteLocations(next);
        toast('Ubicación guardada en este dispositivo', 'success');
      }
    },
    [favoriteLocations]
  );

  const addRecentPlace = useCallback((place: PlaceHit) => {
    const next = pushRecentPlace({
      id: place.id,
      name: place.name,
      description: place.description,
      coordinates: place.coordinates,
    });
    setRecentPlaces(next);
  }, []);

  const addRecentRoute = useCallback((route: { id: string; name: string; color: string }) => {
    const next = pushRecentRoute(route);
    setRecentRoutes(next);
  }, []);

  return {
    favorites,
    setFavorites,
    favoriteLocations,
    setFavoriteLocations,
    recentPlaces,
    recentRoutes,
    homePlace,
    workPlace,
    toggleFavorite,
    toggleLocationFavorite,
    addRecentPlace,
    addRecentRoute,
  };
}
