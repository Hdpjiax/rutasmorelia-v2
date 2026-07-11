/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  addFavoriteLocation,
  loadFavoriteLocations,
  loadFavoriteRoutes,
  loadLocalFavoriteLocations,
  loadLocalFavoriteRoutes,
  removeFavoriteLocation,
  toggleFavoriteRoute,
  type FavoriteLocation,
} from '@/features/favorites';
import type { SessionUser } from '@/features/auth';
import type { PlaceHit } from '@/lib/search/morelia-places';

export function useUserFavorites(user: SessionUser | null) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);

  useEffect(() => {
    setFavorites(loadLocalFavoriteRoutes());
    setFavoriteLocations(loadLocalFavoriteLocations());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [routes, locs] = await Promise.all([
        loadFavoriteRoutes(user?.id),
        loadFavoriteLocations(user?.id),
      ]);
      if (cancelled) return;
      setFavorites(routes);
      setFavoriteLocations(locs);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const toggleFavorite = useCallback(
    async (routeId: string) => {
      const next = await toggleFavoriteRoute(routeId, favorites, user?.id);
      setFavorites(next);
    },
    [favorites, user?.id]
  );

  const toggleLocationFavorite = useCallback(
    async (place: PlaceHit) => {
      const exists = favoriteLocations.some(
        (f) =>
          f.id === place.id ||
          (Math.abs(f.coordinates[0] - place.coordinates[0]) < 1e-5 &&
            Math.abs(f.coordinates[1] - place.coordinates[1]) < 1e-5)
      );
      if (exists) {
        const match = favoriteLocations.find(
          (f) =>
            f.id === place.id ||
            (Math.abs(f.coordinates[0] - place.coordinates[0]) < 1e-5 &&
              Math.abs(f.coordinates[1] - place.coordinates[1]) < 1e-5)
        );
        if (match) {
          const next = await removeFavoriteLocation(match.id, favoriteLocations, user?.id);
          setFavoriteLocations(next);
        }
      } else {
        const next = await addFavoriteLocation(
          {
            name: place.name,
            description: place.description,
            coordinates: place.coordinates,
          },
          favoriteLocations,
          user?.id
        );
        setFavoriteLocations(next);
      }
    },
    [favoriteLocations, user?.id]
  );

  const removeLoc = useCallback(
    async (id: string) => {
      const next = await removeFavoriteLocation(id, favoriteLocations, user?.id);
      setFavoriteLocations(next);
    },
    [favoriteLocations, user?.id]
  );

  return {
    favorites,
    setFavorites,
    favoriteLocations,
    setFavoriteLocations,
    toggleFavorite,
    toggleLocationFavorite,
    removeFavoriteLocation: removeLoc,
  };
}
