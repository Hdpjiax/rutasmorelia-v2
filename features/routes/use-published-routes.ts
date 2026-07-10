'use client';

import { useQuery } from '@tanstack/react-query';
import {
  loadPublishedRoutes,
  loadShapesNearTrip,
  type PublishedRouteMeta,
  type PublishedShape,
} from '@/lib/routing/load-published-shapes';
import type { Coordinate } from '@/lib/routing/planner';

export function usePublishedRoutes() {
  return useQuery<PublishedRouteMeta[]>({
    queryKey: ['published-routes'],
    queryFn: () => loadPublishedRoutes(),
    staleTime: 10 * 60 * 1000,
  });
}

export function useShapesNearTrip(
  origin: Coordinate | null,
  destination: Coordinate | null,
  enabled = true
) {
  return useQuery<{ shapes: PublishedShape[] }>({
    queryKey: [
      'shapes-near',
      origin?.[0],
      origin?.[1],
      destination?.[0],
      destination?.[1],
    ],
    queryFn: async () => {
      if (!origin || !destination) return { shapes: [] };
      const { shapes } = await loadShapesNearTrip(origin, destination);
      return { shapes };
    },
    enabled: Boolean(enabled && origin && destination),
    staleTime: 15 * 60 * 1000,
  });
}
