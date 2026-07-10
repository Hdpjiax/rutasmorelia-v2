'use client';

import { useQuery } from '@tanstack/react-query';
import {
  loadPublishedRoutes,
  type PublishedRouteMeta,
} from '@/lib/routing/load-published-shapes';

export function usePublishedRoutes() {
  return useQuery<PublishedRouteMeta[]>({
    queryKey: ['published-routes'],
    queryFn: () => loadPublishedRoutes(),
    staleTime: 10 * 60 * 1000,
  });
}
