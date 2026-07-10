'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { GeoJSONSource, Map as MapLibreMap, Marker } from 'maplibre-gl';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart,
  User,
  MapPin,
  Navigation,
  Plus,
  Minus,
  X,
  Loader2,
  LocateFixed,
  Bus,
  ArrowRightLeft,
  Footprints,
  Search,
  ChevronDown,
  ChevronUp,
  Eraser,
  ArrowUpDown,
  Route as RouteIcon,
  List,
  Share2,
  Home,
  Briefcase,
  Clock,
  Focus,
} from 'lucide-react';
import { mockSupabaseClient, mockDb, type Route } from '@/lib/supabase/client';
import { planTrip, type Coordinate, type TripPlan } from '@/lib/routing/planner';
import {
  loadShapesForRouteIds,
  loadShapesNearTrip,
  prefetchAllShapesInBackground,
  prefetchFrequentRoutes,
  prefetchShapesNearCoordinate,
  type PublishedShape,
} from '@/lib/routing/load-published-shapes';
import { ROUTES_SOURCE_ID, setTripStopsData } from '@/lib/map/route-layers';
import { toast } from '@/lib/ui/toast';
import {
  normalizeTransportType,
  transportBadgeClass,
  type TransportFilter,
} from '@/lib/transport/classify';
import {
  searchLocalPlaces,
  type PlaceHit,
} from '@/lib/search/morelia-places';
import { mergeAndRankPlaces } from '@/lib/search/rank-places';
import {
  toSingleCorridorDisplay,
  type RouteFeatureCollection,
} from '@/lib/gis/direction-mode';
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
import { fuzzySearchRoutes } from '@/lib/search/fuzzy';
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
import {
  availabilityLabel,
  parseRouteDisplay,
} from '@/lib/routes/route-display';
import type { RouteDirection } from '@/lib/gis/direction-mode';
import {
  getSessionUser,
  onAuthChange,
  signInWithGoogle,
  signInWithMagicLink,
  signOut,
  signOutEverywhere,
  type SessionUser,
} from '@/features/auth';
import {
  buildTripShareUrl,
  clearTripShareParamsFromLocation,
  copyTextToClipboard,
  readTripUrlState,
  shareOrCopyTripUrl,
  sortTripPlans,
} from '@/features/planner';
import { useTripUiStore } from '@/lib/trip/store';
import { usePublishedRoutes } from '@/features/routes/use-published-routes';
import { MapCanvas } from '@/features/map/map-canvas';
import { AuthPanel } from '@/components/home/auth-panel';
import { AdminGateBanner } from '@/components/home/admin-gate-banner';
import { TripResultsPanel } from '@/components/home/trip-results-panel';
import { SearchBar } from '@/components/home/search-bar';
import { BottomDock } from '@/components/home/bottom-dock';
import { createOrbElement } from '@/components/home/map-markers';
import { SkipLink } from '@/components/ui/skip-link';
import { ResultsSheet } from '@/components/home/results-sheet';

type PanelMode = 'search' | 'results' | 'favorites' | 'routes';

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

export default function HomeApp() {
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Record<string, Marker>>({});
  const mlRef = useRef<typeof import('maplibre-gl') | null>(null);
  const shapesRef = useRef<PublishedShape[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const publishedQuery = usePublishedRoutes();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [email, setEmail] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authSending, setAuthSending] = useState(false);

  const [originInput, setOriginInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [originCoords, setOriginCoords] = useState<Coordinate | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<Coordinate | null>(null);
  const [activeSearchField, setActiveSearchField] = useState<'origin' | 'destination' | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [transportFilter, setTransportFilter] = useState<TransportFilter>('all');
  /** Buscador de rutas en el explorador */
  const [routeQuery, setRouteQuery] = useState('');
  /** Sentido al explorar una ruta: ambos | ida | vuelta */
  const [routeDirection, setRouteDirection] = useState<'both' | RouteDirection>('both');
  /** Tip de bienvenida (una vez por sesión) */
  const [showWelcome, setShowWelcome] = useState(false);
  /** Recientes (solo cliente) */
  const [recentPlaces, setRecentPlaces] = useState<RecentPlace[]>([]);
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([]);
  const [homePlace, setHomePlace] = useState<SavedPlaceSlot>(null);
  const [workPlace, setWorkPlace] = useState<SavedPlaceSlot>(null);
  /** Usuario movió el mapa lejos del encuadre de la ruta/viaje */
  const [mapNeedsReframe, setMapNeedsReframe] = useState(false);
  const lastFitBoundsRef = useRef<[[number, number], [number, number]] | null>(null);
  const suppressMoveRef = useRef(false);
  const selectedRouteIdRef = useRef<string | null>(null);
  const tripPlansLenRef = useRef(0);

  const [styleLoaded, setStyleLoaded] = useState(false);
  const [locating, setLocating] = useState(false);
  const [shapesLoading, setShapesLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [panel, setPanel] = useState<PanelMode>('results');
  /** Modal de resultados / rutas (escritorio centrado, móvil bottom) */
  const [resultsOpen, setResultsOpen] = useState(false);
  /** Campos origen/destino retraíbles — en móvil colapsados por defecto */
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  /** false hasta montar en cliente (evita mismatch SSR/hidratación) */
  const [hasMounted, setHasMounted] = useState(false);
  /** Arranca igual en server y client; se corrige en useEffect */
  const [isDesktop, setIsDesktop] = useState(true);

  // NUNCA leer localStorage en el estado inicial (rompe hidratación)
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);

  const [tripPlans, setTripPlans] = useState<TripPlan[]>([]);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [planningError, setPlanningError] = useState<string | null>(null);
  /** Filtro de resultados: todos | solo directos | solo transbordos */
  const [planTypeFilter, setPlanTypeFilter] = useState<'all' | 'direct' | 'transfer'>('all');
  const planSort = useTripUiStore((s) => s.planSort);
  const setPlanSort = useTripUiStore((s) => s.setPlanSort);
  const geometriesLoading = useTripUiStore((s) => s.geometriesLoading);
  const setGeometriesLoading = useTripUiStore((s) => s.setGeometriesLoading);
  const geocodeDegraded = useTripUiStore((s) => s.geocodeDegraded);
  const setGeocodeDegraded = useTripUiStore((s) => s.setGeocodeDegraded);
  /** Viaje abierto desde enlace compartido: no sobreescribir con GPS del receptor. */
  const sharedTripOpenRef = useRef(false);
  /** Índice de plan del enlace compartido (se aplica cuando llegan los planes). */
  const pendingSharePlanIndexRef = useRef<number | null>(null);

  const activeSearchFieldRef = useRef(activeSearchField);
  useEffect(() => {
    activeSearchFieldRef.current = activeSearchField;
  }, [activeSearchField]);

  // Montaje cliente: layout + favoritos locales (mismas props server/client en 1er paint)
  useEffect(() => {
    setHasMounted(true);

    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => {
      setIsDesktop(mq.matches);
      // En móvil priorizar mapa: buscador colapsado
      if (!mq.matches) setSearchExpanded(false);
    };
    apply();
    mq.addEventListener('change', apply);

    // Favoritos + historial local solo después de hidratar
    setFavorites(loadLocalFavoriteRoutes());
    setFavoriteLocations(loadLocalFavoriteLocations());
    setRecentPlaces(loadRecentPlaces());
    setRecentRoutes(loadRecentRoutes());
    setHomePlace(loadHomePlace());
    setWorkPlace(loadWorkPlace());

    try {
      if (!sessionStorage.getItem('vm-welcome-seen')) {
        setShowWelcome(true);
      }
    } catch {
      setShowWelcome(true);
    }

    return () => mq.removeEventListener('change', apply);
  }, []);

  // Auth unificado (Supabase real o mock) + favoritos remotos
  useEffect(() => {
    let cancelled = false;

    const applyUser = async (u: SessionUser | null) => {
      if (cancelled) return;
      setUser(u);
      if (u) {
        const [fr, fl] = await Promise.all([
          loadFavoriteRoutes(u.id),
          loadFavoriteLocations(u.id),
        ]);
        if (!cancelled) {
          setFavorites(fr);
          setFavoriteLocations(fl);
        }
      } else {
        setFavorites(loadLocalFavoriteRoutes());
        setFavoriteLocations(loadLocalFavoriteLocations());
      }
    };

    void getSessionUser().then(applyUser);
    const unsub = onAuthChange((u) => {
      void applyUser(u);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  // Rutas vía TanStack Query (index.json)
  useEffect(() => {
    if (publishedQuery.data?.length) {
      setRoutes(publishedQuery.data.map(metaToRoute));
      setShapesLoading(false);
      prefetchAllShapesInBackground();
      prefetchFrequentRoutes(loadLocalFavoriteRoutes());
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
  }, [publishedQuery.data, publishedQuery.isError, publishedQuery.isLoading]);

  // Enlace compartido: ?from=&to= (solo se lee una vez; no se reescribe en la barra)
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
          trip.originLabel ||
            `${trip.origin[1].toFixed(5)}, ${trip.origin[0].toFixed(5)}`
        );
        prefetchShapesNearCoordinate(trip.origin);
      }
      if (trip.destination) {
        setDestinationCoords(trip.destination);
        setDestinationInput(
          trip.destinationLabel ||
            `${trip.destination[1].toFixed(5)}, ${trip.destination[0].toFixed(5)}`
        );
      }
      if (isSharedTrip) {
        // Receptor: solo el viaje/ruta, sin buscador ni GPS del dispositivo
        setShowWelcome(false);
        setPanel('results');
        setResultsOpen(true);
        setSearchExpanded(false);
        setActiveSearchField(null);
        setSuggestions([]);
      }
      if (trip.routeId && !isSharedTrip) {
        setSelectedRouteId(trip.routeId);
        setPanel('routes');
        setResultsOpen(true);
        setShowWelcome(false);
      }

      // Limpia la barra de direcciones: los params solo viven en el enlace copiado/compartido
      if (trip.origin || trip.destination || trip.routeId || trip.planIndex != null) {
        clearTripShareParamsFromLocation();
      }
    } catch {
      /* ignore hydrate errors */
    }
  }, []);

  // Geolocalización al entrar — NO si abrieron un viaje compartido (no sustituir origen/destino)
  useEffect(() => {
    if (!styleLoaded) return;
    if (sharedTripOpenRef.current) return;
    if (!navigator.geolocation) return;

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Por si el deep link terminó de hidratar después de pedir GPS
        if (sharedTripOpenRef.current) {
          setLocating(false);
          return;
        }
        const coords: Coordinate = [pos.coords.longitude, pos.coords.latitude];
        setOriginCoords(coords);
        setOriginInput('Mi ubicación');
        setLocating(false);
        prefetchShapesNearCoordinate(coords);
        const map = mapRef.current;
        if (map) {
          map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 15), essential: true });
        }
        toast('Ubicación obtenida', 'success', 'ViaMorelia');
      },
      (err) => {
        setLocating(false);
        if (sharedTripOpenRef.current) return;
        console.warn('Geolocation', err);
        toast(
          err.code === 1
            ? 'Permiso de ubicación denegado. Elige origen en el buscador o toca el mapa.'
            : 'Sin GPS disponible. Elige origen manualmente o toca el mapa.',
          'warning',
          'Ubicación'
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  }, [styleLoaded]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast('Tu navegador no soporta geolocalización', 'error');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: Coordinate = [pos.coords.longitude, pos.coords.latitude];
        setOriginCoords(coords);
        setOriginInput('Mi ubicación');
        setLocating(false);
        mapRef.current?.flyTo({ center: coords, zoom: 16, essential: true });
        toast('Ubicación actualizada', 'success');
      },
      () => {
        setLocating(false);
        toast('No se pudo obtener ubicación precisa', 'error');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  }, []);

  const toggleFavorite = async (routeId: string) => {
    const next = await toggleFavoriteRoute(routeId, favorites, user?.id);
    setFavorites(next);
    toast(
      next.includes(routeId) ? 'Ruta en favoritos' : 'Ruta quitada de favoritos',
      next.includes(routeId) ? 'success' : 'info'
    );
  };

  const toggleLocationFavorite = async (hit: {
    name: string;
    description?: string;
    coordinates: [number, number];
  }) => {
    const existing = favoriteLocations.find(
      (l) =>
        l.name.toLowerCase() === hit.name.toLowerCase() &&
        Math.abs(l.coordinates[0] - hit.coordinates[0]) < 1e-4 &&
        Math.abs(l.coordinates[1] - hit.coordinates[1]) < 1e-4
    );
    if (existing) {
      const next = await removeFavoriteLocation(existing.id, favoriteLocations, user?.id);
      setFavoriteLocations(next);
      toast('Ubicación quitada de favoritos', 'info');
    } else {
      const next = await addFavoriteLocation(
        {
          name: hit.name,
          description: hit.description,
          coordinates: hit.coordinates,
        },
        favoriteLocations,
        user?.id
      );
      setFavoriteLocations(next);
      toast('Ubicación guardada en favoritos', 'success');
    }
  };

  /** Enlace mágico (sin contraseña): registra o inicia sesión */
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthMessage(null);
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      setAuthError('Escribe un correo válido');
      return;
    }
    setAuthSending(true);
    try {
      const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/` : `${process.env.NEXT_PUBLIC_SITE_URL || ''}/`;
      const { data, error } = await signInWithMagicLink(clean, redirectTo);
      if (error) {
        setAuthError(error.message);
        toast(error.message, 'error', 'Enlace mágico');
        return;
      }
      // Mock: sesión inmediata; Supabase real espera el correo
      const userPayload = (data as { user?: { id: string; email?: string } } | null)?.user;
      if (userPayload && process.env.NEXT_PUBLIC_USE_REAL_SUPABASE !== 'true') {
        setUser({ id: userPayload.id, email: userPayload.email || clean });
        setAuthOpen(false);
        const [fr, fl] = await Promise.all([
          loadFavoriteRoutes(userPayload.id),
          loadFavoriteLocations(userPayload.id),
        ]);
        setFavorites(fr);
        setFavoriteLocations(fl);
        toast('Sesión lista (modo desarrollo)', 'success');
      } else {
        setAuthMessage(
          `Te enviamos un enlace a ${clean}. Ábrelo para entrar o registrarte — sin contraseña.`
        );
        toast('Revisa tu correo', 'success', 'Enlace mágico');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo enviar el enlace';
      setAuthError(msg);
      toast(msg, 'error');
    } finally {
      setAuthSending(false);
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setAuthMessage(null);
    setAuthSending(true);
    try {
      const redirectTo =
        typeof window !== 'undefined' ? `${window.location.origin}/` : `${process.env.NEXT_PUBLIC_SITE_URL || ''}/`;
      const { error } = await signInWithGoogle(redirectTo);
      if (error) {
        setAuthError(error.message);
        toast(error.message, 'error', 'Google');
      } else if (process.env.NEXT_PUBLIC_USE_REAL_SUPABASE !== 'true') {
        const u = await getSessionUser();
        if (u) {
          setUser(u);
          setAuthOpen(false);
          const [fr, fl] = await Promise.all([
            loadFavoriteRoutes(u.id),
            loadFavoriteLocations(u.id),
          ]);
          setFavorites(fr);
          setFavoriteLocations(fl);
          toast('Sesión con Google (dev)', 'success');
        }
      }
    } finally {
      setAuthSending(false);
    }
  };

  const handleLogout = async (everywhere = false) => {
    if (everywhere) await signOutEverywhere();
    else await signOut();
    setUser(null);
    setFavorites(loadLocalFavoriteRoutes());
    setFavoriteLocations(loadLocalFavoriteLocations());
    toast(everywhere ? 'Sesión cerrada en todos los dispositivos' : 'Sesión cerrada', 'info');
  };

  const tripSharePath = () =>
    buildTripShareUrl({
      origin: originCoords,
      destination: destinationCoords,
      originLabel: originInput || null,
      destinationLabel: destinationInput || null,
      planIndex: selectedPlanIndex,
    });

  const handleShareTrip = async () => {
    if (!originCoords || !destinationCoords) {
      toast('Elige origen y destino para compartir', 'warning');
      return;
    }
    const result = await shareOrCopyTripUrl(tripSharePath());
    if (result === 'shared') toast('Listo para compartir', 'success');
    else if (result === 'copied') toast('Enlace copiado', 'success');
    else toast('No se pudo compartir', 'error');
  };

  const handleCopyTripLink = async () => {
    if (!originCoords || !destinationCoords) {
      toast('Elige origen y destino para copiar el enlace', 'warning');
      return;
    }
    const absolute = `${window.location.origin}${tripSharePath()}`;
    const ok = await copyTextToClipboard(absolute);
    toast(ok ? 'Enlace del viaje copiado' : 'No se pudo copiar', ok ? 'success' : 'error');
  };

  // Autocompletado: exactos primero, luego catálogo + Nominatim + favoritos
  const runSearch = useCallback(
    async (val: string) => {
      const q = val.trim();
      if (!q) {
        // Antes de escribir: casa, trabajo, recientes y favoritos
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

      // Respuesta inmediata con catálogo (exactos ya rankeados)
      setSuggestions(mergeAndRankPlaces([favHits, local], q, 20));

      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, {
          cache: 'no-store',
        });
        if (res.status === 429) {
          setGeocodeDegraded(true);
          toast('Demasiadas búsquedas de lugares. Usa catálogo o el mapa.', 'warning');
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

  const handleSearchChange = (field: 'origin' | 'destination', val: string) => {
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
  };

  const selectSuggestion = (place: PlaceHit) => {
    if (activeSearchField === 'origin') {
      setOriginInput(place.name);
      setOriginCoords(place.coordinates);
    } else if (activeSearchField === 'destination') {
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
    // Cerrar teclado y limpiar búsqueda activa ANTES de mover el mapa (iPhone)
    setSuggestions([]);
    setActiveSearchField(null);
    setSearchExpanded(false);
    dismissKeyboard();
    requestAnimationFrame(() => {
      mapRef.current?.flyTo({ center: place.coordinates, zoom: 15, essential: true });
    });
  };

  const fitMapToBounds = useCallback(
    (bounds: [[number, number], [number, number]], padding = 56) => {
      const map = mapRef.current;
      if (!map) return;
      lastFitBoundsRef.current = bounds;
      suppressMoveRef.current = true;
      setMapNeedsReframe(false);
      map.fitBounds(bounds, { padding, maxZoom: 15, essential: true });
      window.setTimeout(() => {
        suppressMoveRef.current = false;
      }, 600);
    },
    []
  );

  const reframeActiveContent = useCallback(() => {
    if (lastFitBoundsRef.current) {
      fitMapToBounds(lastFitBoundsRef.current);
      return;
    }
    // Fallback: GPS o centro Morelia
    if (originCoords) {
      mapRef.current?.flyTo({ center: originCoords, zoom: 15, essential: true });
    }
  }, [fitMapToBounds, originCoords]);

  // Planificador: asegura shapes (caché / lazy) antes de calcular
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
    setSelectedRouteId(null);

    const run = async () => {
      try {
        setGeometriesLoading(true);
        // Solo geometrías cercanas al OD (bbox) — más rápido y preciso
        const { shapes } = await loadShapesNearTrip(originCoords, destinationCoords);
        if (cancelled) return;
        shapesRef.current = shapes;
        setGeometriesLoading(false);
        const plans = await planTrip(originCoords, destinationCoords, {
          shapes,
          // Siempre mostrar directos Y posibles transbordos
          transferOnlyIfNecessary: false,
          allowTransfers: true,
          maxWalkDistanceMeters: 950,
          maxDirectWalkTotalM: 1400,
          maxDirectPlans: 6,
          maxTransferPlans: 6,
          walkSpeedMeterPerSec: 1.2,
          transitSpeedMeterPerSec: 6.1,
        });
        if (cancelled) return;
        const sorted = sortTripPlans(plans, useTripUiStore.getState().planSort);
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
          toast('Sin rutas directas ni transbordos cercanos', 'warning');
          // En viaje compartido no forzar el buscador: el receptor solo ve el resultado
          if (!sharedTripOpenRef.current) setSearchExpanded(true);
          setResultsOpen(true);
          setPanel('results');
        } else {
          setPanel('results');
          setResultsOpen(true);
          setSearchExpanded(false);
          setActiveSearchField(null);
          setSuggestions([]);
          toast(
            sharedTripOpenRef.current
              ? 'Viaje compartido'
              : `${sorted.length} opción${sorted.length > 1 ? 'es' : ''} · ${
                  sorted[0].type === 'direct' ? 'directas' : 'con transbordo'
                }`,
            'success',
            'Viaje'
          );
        }
      } catch (err) {
        if (cancelled) return;
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
    };
  }, [originCoords, destinationCoords, setGeometriesLoading]);

  useEffect(() => {
    selectedRouteIdRef.current = selectedRouteId;
  }, [selectedRouteId]);
  useEffect(() => {
    tripPlansLenRef.current = tripPlans.length;
  }, [tripPlans.length]);

  const handleMapReady = useCallback((m: MapLibreMap) => {
    mapRef.current = m;
    setStyleLoaded(true);
    m.resize();
    void import('maplibre-gl').then((mod) => {
      mlRef.current = mod;
    });
    const onMoveEnd = () => {
      if (suppressMoveRef.current) return;
      if (!lastFitBoundsRef.current) return;
      if (!selectedRouteIdRef.current && tripPlansLenRef.current === 0) return;
      setMapNeedsReframe(true);
    };
    m.on('dragend', onMoveEnd);
    m.on('zoomend', onMoveEnd);
  }, []);

  /** Cierra teclado iOS/Android antes de animar mapa o panel. */
  const dismissKeyboard = useCallback(() => {
    if (typeof document === 'undefined') return;
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
  }, []);

  const handleMapClick = useCallback(
    (coords: Coordinate) => {
      const field = activeSearchFieldRef.current;
      if (field) {
        if (field === 'origin') {
          setOriginCoords(coords);
          setOriginInput(`${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`);
          toast('Origen en el mapa', 'success');
        } else {
          setDestinationCoords(coords);
          setDestinationInput(`${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`);
          toast('Destino en el mapa', 'success');
        }
        setActiveSearchField(null);
        setSuggestions([]);
        setSearchExpanded(false);
        dismissKeyboard();
        return;
      }
      // Sin campo activo: tocar el mapa cierra panel/buscador (mapa siempre usable en móvil)
      setResultsOpen(false);
      setSearchExpanded(false);
      dismissKeyboard();
    },
    [dismissKeyboard]
  );

  const findClosestCoordinateIndex = (coords: Coordinate[], target: Coordinate) => {
    let min = Infinity;
    let index = -1;
    coords.forEach((c, i) => {
      const d = Math.hypot(c[0] - target[0], c[1] - target[1]);
      if (d < min) {
        min = d;
        index = i;
      }
    });
    return index;
  };

  // Explorar ruta: corredor + etiquetas; filtro de sentido opcional
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    if (tripPlans.length > 0) return;

    if (selectedRouteId) {
      void loadShapesForRouteIds([selectedRouteId])
        .then(async (shapes) => {
          shapes.forEach((s) => {
            const idx = shapesRef.current.findIndex(
              (x) => x.route_id === s.route_id && x.direction === s.direction
            );
            if (idx >= 0) shapesRef.current[idx] = s;
            else shapesRef.current.push(s);
          });
          const meta = routes.find((r) => r.id === selectedRouteId);
          const file = `/routes/${selectedRouteId}.geojson`;
          const res = await fetch(file);
          if (!res.ok) throw new Error('Error al cargar rutas');
          const data = (await res.json()) as RouteFeatureCollection;
          const source = map.getSource(ROUTES_SOURCE_ID) as GeoJSONSource;
          const prefer =
            routeDirection === 'both' ? undefined : routeDirection;
          const single = toSingleCorridorDisplay(data, {
            role: 'full',
            preferDirection: prefer,
            color: meta?.color,
          });
          // Filtrar features al sentido elegido si no es both
          let display = single;
          if (routeDirection !== 'both' && single.features) {
            display = {
              ...single,
              features: single.features.filter((f) => {
                const d = String(f.properties?.direction ?? f.properties?.name ?? '').toLowerCase();
                if (f.properties?.type === 'sense-label') {
                  return d.includes(routeDirection);
                }
                return d === routeDirection || d.includes(routeDirection);
              }),
            };
            if (!display.features?.length) display = single;
          }
          source?.setData(display as unknown as GeoJSON.FeatureCollection);

          // Terminales aproximadas: inicio/fin del trazo
          const lineFeat = (display.features ?? []).find(
            (f) => f.geometry?.type === 'LineString' && Array.isArray(f.geometry.coordinates)
          );
          const lineCoords = (lineFeat?.geometry?.coordinates ?? []) as Coordinate[];
          const info = meta ? parseRouteDisplay(meta) : null;
          if (lineCoords.length >= 2) {
            setTripStopsData(map, [
              {
                type: 'Feature',
                properties: {
                  label: (info?.terminalIda || 'Inicio').slice(0, 28),
                  kind: 'sube',
                  stack: 'center',
                },
                geometry: { type: 'Point', coordinates: lineCoords[0] },
              },
              {
                type: 'Feature',
                properties: {
                  label: (info?.terminalVuelta || 'Final').slice(0, 28),
                  kind: 'baja',
                  stack: 'center',
                },
                geometry: {
                  type: 'Point',
                  coordinates: lineCoords[lineCoords.length - 1],
                },
              },
            ]);
          } else {
            setTripStopsData(map, []);
          }

          const all: Coordinate[] = [];
          for (const f of display.features ?? []) {
            if (
              f.properties?.type !== 'sense-label' &&
              f.geometry?.type === 'LineString' &&
              Array.isArray(f.geometry.coordinates)
            ) {
              all.push(...(f.geometry.coordinates as Coordinate[]));
            }
          }
          if (all.length) {
            const lngs = all.map((c) => c[0]);
            const lats = all.map((c) => c[1]);
            fitMapToBounds(
              [
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)],
              ],
              56
            );
          }
        })
        .catch((err) => {
          const offline = typeof navigator !== 'undefined' && !navigator.onLine;
          toast(
            offline
              ? 'Sin conexión al cargar la ruta'
              : err instanceof Error && err.message.includes('cargar')
                ? 'Error al cargar rutas'
                : 'No se pudo cargar la ruta',
            'error'
          );
        });
    } else {
      const source = map.getSource(ROUTES_SOURCE_ID) as GeoJSONSource;
      source?.setData({ type: 'FeatureCollection', features: [] });
      setTripStopsData(map, []);
      lastFitBoundsRef.current = null;
      setMapNeedsReframe(false);
    }
  }, [selectedRouteId, styleLoaded, tripPlans.length, routes, routeDirection, fitMapToBounds]);

  // Dibujo del plan: 1 corredor por ruta + tramo viaje + caminata
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    if (tripPlans.length === 0) {
      setTripStopsData(map, []);
      return;
    }

    const plan = tripPlans[selectedPlanIndex];
    if (!plan) return;

    const features: Array<{
      type: string;
      properties: Record<string, unknown>;
      geometry: { type: string; coordinates: Coordinate[] };
    }> = [];

    const resolveShapeCoords = (
      routeId: string,
      direction: 'ida' | 'vuelta'
    ): Coordinate[] => {
      const pub = shapesRef.current.find(
        (s) => s.route_id === routeId && s.direction === direction
      );
      if (pub?.coordinates?.length) return pub.coordinates;
      const mock = mockDb.route_shapes.find(
        (s) => s.route_id === routeId && s.direction === direction
      );
      return (mock?.geom.coordinates as Coordinate[]) ?? [];
    };

    // 1) Una sola línea completa por routeId + etiquetas Ida/Vuelta
    const routeMeta = new Map<string, { color: string; prefer: 'ida' | 'vuelta' }>();
    for (const seg of plan.segments) {
      if (seg.type === 'ride' && seg.routeId) {
        routeMeta.set(seg.routeId, {
          color: seg.color || '#3b82f6',
          prefer: seg.direction || 'ida',
        });
      }
    }

    for (const [routeId, meta] of routeMeta) {
      const ida = resolveShapeCoords(routeId, 'ida');
      const vuelta = resolveShapeCoords(routeId, 'vuelta');
      const fc: RouteFeatureCollection = {
        type: 'FeatureCollection',
        features: [
          ...(ida.length >= 2
            ? [
                {
                  type: 'Feature' as const,
                  properties: { direction: 'ida', name: 'Ida', color: meta.color },
                  geometry: { type: 'LineString' as const, coordinates: ida },
                },
              ]
            : []),
          ...(vuelta.length >= 2
            ? [
                {
                  type: 'Feature' as const,
                  properties: { direction: 'vuelta', name: 'Vuelta', color: meta.color },
                  geometry: { type: 'LineString' as const, coordinates: vuelta },
                },
              ]
            : []),
        ],
      };
      const single = toSingleCorridorDisplay(fc, {
        color: meta.color,
        preferDirection: meta.prefer,
        role: 'full',
      });
      for (const f of single.features ?? []) {
        features.push({
          type: 'Feature',
          properties: { ...(f.properties ?? {}), routeId },
          geometry: f.geometry as { type: string; coordinates: Coordinate[] },
        });
      }
    }

    // 2) Tramo del viaje (sube→baja) resaltado + caminatas
    plan.segments.forEach((seg) => {
      if (seg.type === 'walk' && seg.walkFrom && seg.walkTo) {
        features.push({
          type: 'Feature',
          properties: {
            type: 'walk',
            walkKind: seg.walkKind || 'to_board',
            name: '',
            color: '#64748b',
          },
          geometry: { type: 'LineString', coordinates: [seg.walkFrom, seg.walkTo] },
        });
      } else if (seg.type === 'ride' && seg.routeId && seg.direction) {
        let coordinates = resolveShapeCoords(seg.routeId, seg.direction);

        if (seg.boardingPoint && seg.alightingPoint && coordinates.length > 0) {
          const startIdx = findClosestCoordinateIndex(coordinates, seg.boardingPoint);
          const endIdx = findClosestCoordinateIndex(coordinates, seg.alightingPoint);
          if (startIdx >= 0 && endIdx >= 0) {
            coordinates =
              startIdx <= endIdx
                ? coordinates.slice(startIdx, endIdx + 1)
                : coordinates.slice(endIdx, startIdx + 1).reverse();
          }
        }

        if (coordinates.length >= 2) {
          features.push({
            type: 'Feature',
            properties: {
              type: 'ride',
              role: 'segment',
              color: seg.color || '#3b82f6',
              casingColor: '#111111',
              name: '',
            },
            geometry: { type: 'LineString', coordinates },
          });
        }
      }
    });

    const source = map.getSource(ROUTES_SOURCE_ID) as GeoJSONSource;
    source?.setData({
      type: 'FeatureCollection',
      features,
    } as unknown as GeoJSON.FeatureCollection);

    // Letreros Sube/Baja (sin “punto virtual”). Si transbordo es el mismo sitio → 1 marcador.
    const isMapCoord = (c?: Coordinate | null): c is Coordinate => {
      if (!c || c.length < 2) return false;
      const [lng, lat] = c;
      return (
        Number.isFinite(lng) &&
        Number.isFinite(lat) &&
        lng >= -101.55 &&
        lng <= -100.75 &&
        lat >= 19.4 &&
        lat <= 20.05
      );
    };

    /** ~35 m en Morelia (grados) */
    const sameSpot = (a: Coordinate, b: Coordinate, maxM = 35) => {
      const dLng = (a[0] - b[0]) * 111320 * Math.cos((a[1] * Math.PI) / 180);
      const dLat = (a[1] - b[1]) * 110540;
      return Math.hypot(dLng, dLat) <= maxM;
    };

    type StopFeat = {
      type: 'Feature';
      properties: {
        label: string;
        kind: 'sube' | 'baja' | 'transbordo';
        stack: 'up' | 'down' | 'center';
      };
      geometry: { type: 'Point'; coordinates: [number, number] };
    };
    const stopFeatures: StopFeat[] = [];

    const pushStop = (
      coords: Coordinate,
      label: string,
      kind: StopFeat['properties']['kind'],
      stack: StopFeat['properties']['stack'] = 'center'
    ) => {
      // Offset leve en el mapa si hay dos etiquetas cercanas (arriba / abajo)
      let [lng, lat] = coords;
      if (stack === 'up') lat += 0.00012;
      if (stack === 'down') lat -= 0.00012;
      stopFeatures.push({
        type: 'Feature',
        properties: { label, kind, stack },
        geometry: { type: 'Point', coordinates: [lng, lat] },
      });
    };

    plan.segments.forEach((seg, idx) => {
      if (seg.type === 'walk' && seg.walkKind === 'transfer') {
        const from = isMapCoord(seg.walkFrom) ? seg.walkFrom : null;
        const to = isMapCoord(seg.walkTo) ? seg.walkTo : null;
        if (from && to && sameSpot(from, to)) {
          // Mismo lugar: un solo letrero (no se tapan Baja + Sube)
          const mid: Coordinate = [
            (from[0] + to[0]) / 2,
            (from[1] + to[1]) / 2,
          ];
          pushStop(mid, 'Baja y sube aquí', 'transbordo', 'center');
        } else {
          if (from) pushStop(from, 'Baja aquí', 'baja', 'up');
          if (to) pushStop(to, 'Sube aquí', 'sube', 'down');
        }
        return;
      }
      if (seg.type !== 'ride') return;
      if (isMapCoord(seg.boardingPoint)) {
        const prev = plan.segments[idx - 1];
        const afterTransfer = prev?.type === 'walk' && prev.walkKind === 'transfer';
        // Si el transbordo ya marcó Sube en el mismo sitio, no duplicar
        if (!afterTransfer) {
          pushStop(seg.boardingPoint, 'Sube aquí', 'sube', 'center');
        }
      }
      if (isMapCoord(seg.alightingPoint)) {
        const next = plan.segments[idx + 1];
        const isTransfer = next?.type === 'walk' && next.walkKind === 'transfer';
        if (!isTransfer) {
          pushStop(seg.alightingPoint, 'Baja aquí', 'baja', 'center');
        }
      }
    });

    // Último paso: fusionar cualquier par sube+baja que aún coincida en el mismo sitio
    const merged: StopFeat[] = [];
    const used = new Set<number>();
    for (let i = 0; i < stopFeatures.length; i++) {
      if (used.has(i)) continue;
      const a = stopFeatures[i];
      let fused = false;
      for (let j = i + 1; j < stopFeatures.length; j++) {
        if (used.has(j)) continue;
        const b = stopFeatures[j];
        if (
          sameSpot(a.geometry.coordinates as Coordinate, b.geometry.coordinates as Coordinate) &&
          a.properties.kind !== b.properties.kind
        ) {
          const mid: Coordinate = [
            (a.geometry.coordinates[0] + b.geometry.coordinates[0]) / 2,
            (a.geometry.coordinates[1] + b.geometry.coordinates[1]) / 2,
          ];
          const hasSube =
            a.properties.kind === 'sube' ||
            b.properties.kind === 'sube' ||
            a.properties.label.includes('Sube') ||
            b.properties.label.includes('Sube');
          const hasBaja =
            a.properties.kind === 'baja' ||
            b.properties.kind === 'baja' ||
            a.properties.label.includes('Baja') ||
            b.properties.label.includes('Baja');
          const label =
            hasSube && hasBaja
              ? 'Baja y sube aquí'
              : hasSube
                ? 'Sube aquí'
                : 'Baja aquí';
          merged.push({
            type: 'Feature',
            properties: { label, kind: 'transbordo', stack: 'center' },
            geometry: { type: 'Point', coordinates: mid },
          });
          used.add(i);
          used.add(j);
          fused = true;
          break;
        }
      }
      if (!fused) merged.push(a);
    }

    setTripStopsData(map, merged);

    // Bounds: ruta completa + origen/destino
    const allCoords: Coordinate[] = [];
    features.forEach((f) => {
      if (f.properties.role === 'full' || f.properties.type === 'walk') {
        allCoords.push(...f.geometry.coordinates);
      }
    });
    if (allCoords.length === 0) {
      features.forEach((f) => allCoords.push(...f.geometry.coordinates));
    }
    if (originCoords) allCoords.push(originCoords);
    if (destinationCoords) allCoords.push(destinationCoords);
    if (allCoords.length) {
      const lngs = allCoords.map((c) => c[0]);
      const lats = allCoords.map((c) => c[1]);
      fitMapToBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        64
      );
    }
  }, [
    tripPlans,
    selectedPlanIndex,
    styleLoaded,
    originCoords,
    destinationCoords,
    fitMapToBounds,
  ]);

  // Markers: solo orbes origen/destino (letreros van en capas MapLibre, no en esquina)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    let cancelled = false;

    const run = async () => {
      if (!mlRef.current) {
        mlRef.current = await import('maplibre-gl');
      }
      if (cancelled || !mapRef.current) return;
      const { Marker } = mlRef.current;

      Object.values(markersRef.current).forEach((m) => m.remove());
      markersRef.current = {};

      const ok = (c: Coordinate | null) =>
        !!c &&
        Number.isFinite(c[0]) &&
        Number.isFinite(c[1]) &&
        Math.abs(c[0]) > 0.01 &&
        Math.abs(c[1]) > 0.01;

      if (ok(originCoords)) {
        markersRef.current.origin = new Marker({
          element: createOrbElement('origin'),
          anchor: 'center',
        })
          .setLngLat(originCoords!)
          .addTo(map);
      }
      if (ok(destinationCoords)) {
        markersRef.current.destination = new Marker({
          element: createOrbElement('dest'),
          anchor: 'center',
        })
          .setLngLat(destinationCoords!)
          .addTo(map);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [originCoords, destinationCoords, styleLoaded]);

  const zoomBy = (delta: number) => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ zoom: map.getZoom() + delta, duration: 280 });
  };

  /** Limpia viaje, ruta seleccionada y trazos del mapa (sin borrar la red cargada). */
  const clearMap = useCallback(() => {
    setOriginInput('');
    setDestinationInput('');
    setOriginCoords(null);
    setDestinationCoords(null);
    setActiveSearchField(null);
    setSuggestions([]);
    setSelectedRouteId(null);
    setTripPlans([]);
    setSelectedPlanIndex(0);
    setPlanningError(null);
    setPlanTypeFilter('all');
    setRouteQuery('');

    const map = mapRef.current;
    if (map) {
      const source = map.getSource(ROUTES_SOURCE_ID) as GeoJSONSource | undefined;
      source?.setData({ type: 'FeatureCollection', features: [] });
      setTripStopsData(map, []);
    }

    // Quitar orbes origen/destino
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    toast('Mapa limpio. Puedes planear un viaje o explorar rutas.', 'info', 'ViaMorelia');
  }, []);

  const swapOriginDestination = useCallback(() => {
    setOriginInput(destinationInput);
    setDestinationInput(originInput);
    setOriginCoords(destinationCoords);
    setDestinationCoords(originCoords);
    setSuggestions([]);
    setActiveSearchField(null);
  }, [originInput, destinationInput, originCoords, destinationCoords]);

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    try {
      sessionStorage.setItem('vm-welcome-seen', '1');
    } catch {
      /* ignore */
    }
  }, []);

  const openPlanTrip = useCallback(() => {
    setPanel('results');
    setResultsOpen(true);
    setAuthOpen(false);
    setSearchExpanded(true);
    dismissWelcome();
  }, [dismissWelcome]);

  const openBrowseRoutes = useCallback(() => {
    setPanel('routes');
    setResultsOpen(true);
    setAuthOpen(false);
    dismissWelcome();
  }, [dismissWelcome]);

  const hasMapContent = Boolean(
    selectedRouteId || tripPlans.length > 0 || originCoords || destinationCoords
  );

  const favRoutes = routes.filter((r) => favorites.includes(r.id));
  const filteredRoutes = (() => {
    const byTransport = routes.filter((r) => {
      if (transportFilter === 'all') return true;
      return normalizeTransportType(r.transport_type, r.id, r.name) === transportFilter;
    });
    const q = routeQuery.trim();
    if (!q) return byTransport;
    return fuzzySearchRoutes(byTransport, q);
  })();

  const viewRouteOnMap = useCallback(
    (route: Route) => {
      setSelectedRouteId(route.id);
      setTripPlans([]);
      setRouteDirection('both');
      setRecentRoutes(
        pushRecentRoute({ id: route.id, name: route.name, color: route.color })
      );
      dismissKeyboard();
      setRouteQuery('');
      setResultsOpen(false);
      setSearchExpanded(false);
      toast(`Ruta en el mapa: ${route.name}`, 'info');
    },
    [dismissKeyboard]
  );

  const renderSuggestions = () =>
    activeSearchField && (suggestions.length > 0 || searchLoading) ? (
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        data-testid="search-autocomplete"
        className="absolute left-0 right-0 top-full z-[80] mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-slate-200/80 bg-white py-1 shadow-2xl"
      >
        {searchLoading && (
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500">
            <span className="vm-spinner" /> Buscando en Morelia…
          </div>
        )}
        {suggestions.map((place) => {
          const isLocFav =
            place.source === 'favorite' ||
            favoriteLocations.some(
              (l) =>
                l.name.toLowerCase() === place.name.toLowerCase() &&
                Math.abs(l.coordinates[0] - place.coordinates[0]) < 1e-4
            );
          return (
            <div
              key={place.id}
              className="flex items-stretch border-b border-slate-50 last:border-0"
            >
              <button
                type="button"
                onClick={() => selectSuggestion(place)}
                className="flex min-w-0 flex-1 flex-col px-3.5 py-2.5 text-left transition hover:bg-emerald-50/60 cursor-pointer"
              >
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  {isLocFav && <Heart className="h-3 w-3 shrink-0 fill-rose-500 text-rose-500" />}
                  {place.name}
                </span>
                <span className="text-[11px] text-slate-500">
                  {isLocFav ? 'Favorito · ' : ''}
                  {place.description || place.category}
                  {place.source === 'geocode' ? ' · mapa' : place.source === 'favorite' ? '' : ' · Morelia'}
                </span>
              </button>
              <button
                type="button"
                title={isLocFav ? 'Quitar favorito' : 'Guardar ubicación'}
                onClick={(e) => {
                  e.stopPropagation();
                  void toggleLocationFavorite(place);
                }}
                className="flex items-center px-3 text-slate-400 hover:text-rose-500 cursor-pointer"
              >
                <Heart className={`h-4 w-4 ${isLocFav ? 'fill-rose-500 text-rose-500' : ''}`} />
              </button>
            </div>
          );
        })}
      </motion.div>
    ) : null;

  // Ordenar en render (Zustand planSort) sin mutar el array base en effects
  const filteredPlans = sortTripPlans(tripPlans, planSort)
    .map((plan) => ({ plan, idx: tripPlans.indexOf(plan) }))
    .filter(({ plan, idx }) => {
      if (idx < 0) return false;
      if (planTypeFilter === 'all') return true;
      return plan.type === planTypeFilter;
    });

  const directCount = tripPlans.filter((p) => p.type === 'direct').length;
  const transferCountPlans = tripPlans.filter((p) => p.type === 'transfer').length;

  const renderResultsList = () => (
    <TripResultsPanel
      planning={planning}
      geometriesLoading={geometriesLoading}
      planningError={planningError}
      tripPlans={tripPlans}
      sortedPlans={filteredPlans}
      selectedPlanIndex={selectedPlanIndex}
      planTypeFilter={planTypeFilter}
      planSort={planSort}
      directCount={directCount}
      transferCountPlans={transferCountPlans}
      originCoords={Boolean(originCoords)}
      geocodeDegraded={geocodeDegraded}
      onSelectPlan={(idx) => {
        setSelectedPlanIndex(idx);
        dismissKeyboard();
        setResultsOpen(false);
        setSearchExpanded(false);
      }}
      onPlanTypeFilter={(f) => {
        setPlanTypeFilter(f);
        const first = tripPlans.findIndex((p) => (f === 'all' ? true : p.type === f));
        if (first >= 0) setSelectedPlanIndex(first);
      }}
      onPlanSort={setPlanSort}
      onStartSearch={() => {
        setResultsOpen(false);
        setSearchExpanded(true);
        setActiveSearchField(originCoords ? 'destination' : 'origin');
      }}
      onBrowseRoutes={() => setPanel('routes')}
      onShare={() => void handleShareTrip()}
      onCopyLink={() => void handleCopyTripLink()}
    />
  );

  /** Cierra panel y muestra selección en el mapa (acción principal del sheet). */
  const viewSelectionOnMap = useCallback(() => {
    dismissKeyboard();
    setSuggestions([]);
    setActiveSearchField(null);
    setRouteQuery('');
    setSearchExpanded(false);
    setResultsOpen(false);

    const map = mapRef.current;
    if (!map) return;

    // Si hay plan de viaje, el effect de dibujo ya encuadra; si hay ruta explorada, fitBounds del effect.
    // Forzar un micro-resize para iOS tras cerrar teclado/panel.
    requestAnimationFrame(() => {
      map.resize();
    });
  }, [dismissKeyboard]);

  const renderFavorites = () => (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Ubicaciones favoritas
        </p>
        {favoriteLocations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-[11px] text-slate-400">
            Marca el coraz??n en una direcci??n al buscar.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {favoriteLocations.map((loc) => (
              <div
                key={loc.id}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left cursor-pointer"
                  onClick={() => {
                    setDestinationInput(loc.name);
                    setDestinationCoords(loc.coordinates);
                    dismissKeyboard();
                    setResultsOpen(false);
                    setSearchExpanded(false);
                    requestAnimationFrame(() => {
                      mapRef.current?.flyTo({ center: loc.coordinates, zoom: 15 });
                    });
                  }}
                >
                  <p className="truncate text-sm font-semibold text-slate-800">{loc.name}</p>
                  <p className="text-[10px] text-slate-400">{loc.description || 'Ubicación'}</p>
                </button>
                <button
                  type="button"
                  onClick={() => void removeFavoriteLocation(loc.id, favoriteLocations, user?.id).then(setFavoriteLocations)}
                  className="p-1 cursor-pointer"
                >
                  <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Rutas favoritas
        </p>
        {favRoutes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-[11px] text-slate-400">
            Explora rutas y toca el coraz??n.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {favRoutes.map((route) => (
              <button
                key={route.id}
                type="button"
                onClick={() => viewRouteOnMap(route)}
                className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 text-left transition hover:bg-slate-50 cursor-pointer touch-manipulation"
              >
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full border border-white shadow"
                  style={{ backgroundColor: route.color }}
                />
                <span className="flex-1 text-sm font-semibold text-slate-800">{route.name}</span>
                <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderAuthForm = () => (
    <AuthPanel
      user={user}
      email={email}
      authError={authError}
      authMessage={authMessage}
      authSending={authSending}
      onEmailChange={(v) => {
        setEmail(v);
        setAuthError(null);
        setAuthMessage(null);
      }}
      onMagicLink={handleMagicLink}
      onGoogle={() => void handleGoogleLogin()}
      onLogout={(everywhere) => void handleLogout(Boolean(everywhere))}
      onClose={() => setAuthOpen(false)}
    />
  );

  const renderRouteExplorer = () => (
    <div className="flex flex-col gap-2 p-3">
      <p className="text-[11px] leading-snug text-slate-500">
        Busca por color, colonia o número. Usa <strong>Ver ruta</strong> para dibujarla en el mapa.
        {shapesLoading ? ' Cargando listado…' : ` ${routes.length} rutas.`}
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="search"
          data-testid="search-routes"
          inputMode="search"
          enterKeyHint="search"
          placeholder="Morada, cam, centro, naranja 2…"
          value={routeQuery}
          onChange={(e) => setRouteQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        />
        {routeQuery && (
          <button
            type="button"
            onClick={() => setRouteQuery('')}
            className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            aria-label="Limpiar búsqueda"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        {(
          [
            { id: 'all' as const, label: 'Todos' },
            { id: 'combi' as const, label: 'Combis' },
            { id: 'autobus' as const, label: 'Autobuses' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            data-testid={`filter-transport-${t.id}`}
            onClick={() => {
              setTransportFilter(t.id);
            }}
            className={`min-h-9 rounded-full border px-2.5 py-1 text-[11px] font-bold cursor-pointer touch-manipulation ${
              transportFilter === t.id
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] font-semibold text-slate-400">
          {filteredRoutes.length}/{routes.length}
        </span>
      </div>

      {/* Sin query: recientes + favoritos (menos escritura en móvil) */}
      {!routeQuery.trim() && (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
          {(homePlace || workPlace) && (
            <div className="flex flex-wrap gap-1.5">
              {homePlace && (
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-800 touch-manipulation"
                  onClick={() => {
                    setDestinationInput(homePlace.name);
                    setDestinationCoords(homePlace.coordinates);
                    setPanel('results');
                    dismissKeyboard();
                  }}
                >
                  <Home className="h-3.5 w-3.5 text-emerald-700" /> Casa
                </button>
              )}
              {workPlace && (
                <button
                  type="button"
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-800 touch-manipulation"
                  onClick={() => {
                    setDestinationInput(workPlace.name);
                    setDestinationCoords(workPlace.coordinates);
                    setPanel('results');
                    dismissKeyboard();
                  }}
                >
                  <Briefcase className="h-3.5 w-3.5 text-sky-700" /> Trabajo
                </button>
              )}
            </div>
          )}
          {recentRoutes.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <Clock className="h-3 w-3" /> Rutas recientes
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recentRoutes.slice(0, 5).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 touch-manipulation"
                    onClick={() => {
                      const full = routes.find((x) => x.id === r.id);
                      if (full) viewRouteOnMap(full);
                      else {
                        setSelectedRouteId(r.id);
                        setResultsOpen(false);
                      }
                    }}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: r.color || '#94a3b8' }}
                    />
                    <span className="truncate">{r.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {favRoutes.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                <Heart className="h-3 w-3" /> Favoritas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {favRoutes.slice(0, 5).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-rose-100 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-800 touch-manipulation"
                    onClick={() => viewRouteOnMap(r)}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: r.color }}
                    />
                    <span className="truncate">{r.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {shapesLoading && (
        <div className="flex items-center gap-2 py-2 text-xs text-slate-500">
          <span className="vm-spinner" /> Cargando red de rutas…
        </div>
      )}
      {!shapesLoading && filteredRoutes.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400">
          {routes.length === 0
            ? 'No hay rutas publicadas disponibles.'
            : 'Ninguna ruta coincide. Prueba sin acentos o con el color (ej. morada, cam).'}
        </div>
      )}
      {filteredRoutes.map((route) => {
        const isFav = favorites.includes(route.id);
        const isSelected = selectedRouteId === route.id;
        const kind = normalizeTransportType(route.transport_type, route.id, route.name);
        const info = parseRouteDisplay(route);
        const avail = availabilityLabel(route.status);
        return (
          <article
            key={route.id}
            data-testid={`route-item-${route.id}`}
            className={`vm-card rounded-2xl border p-3 ${
              isSelected ? 'ring-1 ring-emerald-500/30' : ''
            }`}
            style={
              isSelected
                ? {
                    borderColor: 'var(--vm-selected-border)',
                    background: 'var(--vm-selected-bg)',
                  }
                : undefined
            }
          >
            <div className="flex items-start gap-2.5">
              <span
                className="mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: route.color }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-snug text-slate-900">{route.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span
                    className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase ${transportBadgeClass(kind)}`}
                  >
                    {kind === 'combi' ? 'Combi' : 'Autobús'}
                  </span>
                  <span
                    className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${
                      avail.tone === 'ok'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : avail.tone === 'warn'
                          ? 'border-amber-200 bg-amber-50 text-amber-900'
                          : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                  >
                    {avail.label}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-600">
                  <span className="font-semibold text-slate-700">Corredor: </span>
                  {info.corridorLabel}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-500">
                  Ida ≈ {info.terminalIda} · Vuelta ≈ {info.terminalVuelta}
                </p>
              </div>
              <button
                type="button"
                data-testid={`favorite-button-${route.id}`}
                aria-label={isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                onClick={() => void toggleFavorite(route.id)}
                className="flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                <Heart
                  className={`h-5 w-5 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`}
                />
              </button>
            </div>
            <button
              type="button"
              data-testid={`view-route-${route.id}`}
              onClick={() => viewRouteOnMap(route)}
              className="mt-2.5 flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white cursor-pointer hover:bg-emerald-700 active:scale-[0.99]"
            >
              <Navigation className="h-4 w-4" aria-hidden />
              Ver ruta
            </button>
          </article>
        );
      })}
    </div>
  );

  return (
    <div className="vm-app-shell bg-[var(--background)] font-sans">
      <SkipLink href="#search-panel" label="Saltar a búsqueda" />
      <MapCanvas onReady={handleMapReady} onMapClick={handleMapClick} />
      <main id="main-content" className="pointer-events-none absolute inset-0 z-10">
      <AdminGateBanner />

      {/* Top bar: logo + nombre (izq) — no se solapa con favoritos/cuenta */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="pointer-events-none absolute z-50 flex items-center"
        style={{
          top: 'var(--vm-safe-top)',
          left: 'max(0.5rem, var(--vm-safe-left))',
          height: 'var(--vm-top-bar-h)',
          maxWidth: 'calc(100% - 6.75rem - var(--vm-safe-right))',
        }}
      >
        <Image
          src="/brand/icono.png"
          alt=""
          width={64}
          height={64}
          className="relative z-10 block h-9 w-9 shrink-0 object-contain drop-shadow-md sm:h-10 sm:w-10"
          priority
        />
        <Image
          src="/brand/nombre.png"
          alt="ViaMorelia"
          width={480}
          height={100}
          className="relative z-0 ml-0.5 block h-8 w-auto max-w-[min(42vw,9rem)] object-contain object-left drop-shadow-md sm:h-9 sm:max-w-[12rem]"
          priority
        />
      </motion.div>

      {/* Buscador principal — siempre una pastilla clara */}
            <SearchBar
        searchExpanded={searchExpanded}
        originInput={originInput}
        destinationInput={destinationInput}
        originReady={Boolean(originCoords)}
        destinationReady={Boolean(destinationCoords)}
        activeSearchField={activeSearchField}
        planning={planning}
        locating={locating}
        shapesLoading={shapesLoading}
        tripPlanCount={tripPlans.length}
        suggestions={suggestions}
        searchLoading={searchLoading}
        onExpand={() => {
          setSearchExpanded(true);
          setActiveSearchField(originCoords ? 'destination' : 'origin');
          dismissWelcome();
        }}
        onCollapse={() => {
          dismissKeyboard();
          setSearchExpanded(false);
          setActiveSearchField(null);
          setSuggestions([]);
        }}
        onOriginChange={(v) => handleSearchChange('origin', v)}
        onDestinationChange={(v) => handleSearchChange('destination', v)}
        onOriginFocus={() => {
          setActiveSearchField('origin');
          void runSearch(originInput);
        }}
        onDestinationFocus={() => {
          setActiveSearchField('destination');
          void runSearch(destinationInput);
        }}
        onClearOrigin={() => {
          setOriginInput('');
          setOriginCoords(null);
        }}
        onClearDestination={() => {
          setDestinationInput('');
          setDestinationCoords(null);
        }}
        onSwap={swapOriginDestination}
        onRequestLocation={requestLocation}
        onSeeOptions={() => {
          dismissKeyboard();
          setSearchExpanded(false);
          setActiveSearchField(null);
          setSuggestions([]);
          if (originCoords && destinationCoords) {
            setPanel('results');
            setResultsOpen(true);
          }
        }}
        onSelectSuggestion={selectSuggestion}
      />

{/* Top-right: favoritos + usuario (dentro del safe area) */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="pointer-events-auto absolute z-50 flex items-center gap-1.5"
        style={{
          top: 'calc(var(--vm-safe-top) + 0.35rem)',
          right: 'max(0.5rem, var(--vm-safe-right))',
        }}
      >
        <button
          type="button"
          onClick={() => {
            setPanel('favorites');
            setResultsOpen(true);
            setAuthOpen(false);
          }}
          className="vm-btn-icon"
          title="Favoritos"
          aria-label={
            hasMounted && (favorites.length || favoriteLocations.length)
              ? `Favoritos (${favorites.length + favoriteLocations.length})`
              : 'Favoritos'
          }
        >
          <Heart
            className={`h-5 w-5 ${
              hasMounted && (favorites.length || favoriteLocations.length)
                ? 'fill-rose-500 text-rose-500'
                : 'text-[var(--vm-text-secondary)]'
            }`}
          />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setAuthOpen((v) => !v);
              setResultsOpen(false);
            }}
            className="vm-btn-icon"
            title={user ? `Cuenta: ${user.email}` : 'Entrar o registrarte'}
            aria-label={user ? `Cuenta: ${user.email}` : 'Entrar o registrarte'}
            aria-expanded={authOpen}
            aria-haspopup="dialog"
          >
            <User
              className={`h-5 w-5 ${user ? 'text-emerald-500' : 'text-[var(--vm-text-secondary)]'}`}
            />
          </button>
          <AnimatePresence>
            {authOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                className="vm-panel absolute right-0 top-[2.85rem] z-50 w-80 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border"
              >
                {renderAuthForm()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Left: zoom — a media altura, sin invadir dock */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28, delay: 0.08 }}
        className="pointer-events-auto absolute z-20 flex flex-col gap-1.5"
        style={{
          left: 'max(0.5rem, var(--vm-safe-left))',
          top: 'min(42vh, 22rem)',
        }}
      >
        <button
          type="button"
          onClick={() => zoomBy(1)}
          className="vm-btn-icon !h-10 !w-10 !rounded-xl"
          title="Acercar"
          aria-label="Acercar"
        >
          <Plus className="h-5 w-5 text-slate-700" />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(-1)}
          className="vm-btn-icon !h-10 !w-10 !rounded-xl"
          title="Alejar"
          aria-label="Alejar"
        >
          <Minus className="h-5 w-5 text-slate-700" />
        </button>
      </motion.div>

      {/* Ficha flotante tras seleccionar ruta */}
      <AnimatePresence>
        {selectedRouteId && !resultsOpen && tripPlans.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-auto absolute z-30 flex justify-center sm:left-auto sm:justify-end"
            style={{
              left: 'max(0.75rem, var(--vm-safe-left))',
              right: 'max(0.75rem, var(--vm-safe-right))',
              bottom: 'calc(4.75rem + var(--vm-safe-bottom))',
            }}
          >
            {(() => {
              const r = routes.find((x) => x.id === selectedRouteId);
              const kind = r
                ? normalizeTransportType(r.transport_type, r.id, r.name)
                : 'combi';
              const info = r ? parseRouteDisplay(r) : null;
              return (
                <div className="vm-panel w-full max-w-md rounded-2xl border px-3 py-2.5 shadow-xl">
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-white shadow"
                      style={{ backgroundColor: r?.color || '#10b981' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {r?.name || 'Ruta'}
                      </p>
                      <p className="text-[11px] text-slate-600">
                        {kind === 'combi' ? 'Combi' : 'Autobús'} · Ruta completa
                        {info?.corridorLabel ? ` · ${info.corridorLabel}` : ''}
                      </p>
                    </div>
                  </div>
                  {/* Selector de sentido */}
                  <div className="mt-2 flex gap-1">
                    {(
                      [
                        { id: 'both' as const, label: 'Ambos' },
                        { id: 'ida' as const, label: 'Ida' },
                        { id: 'vuelta' as const, label: 'Vuelta' },
                      ] as const
                    ).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setRouteDirection(d.id)}
                        className={`min-h-9 flex-1 touch-manipulation rounded-lg border px-2 py-1.5 text-[10px] font-bold cursor-pointer ${
                          routeDirection === d.id
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRouteId(null);
                        setRouteDirection('both');
                        const map = mapRef.current;
                        if (map) {
                          const source = map.getSource(ROUTES_SOURCE_ID) as
                            | GeoJSONSource
                            | undefined;
                          source?.setData({ type: 'FeatureCollection', features: [] });
                          setTripStopsData(map, []);
                        }
                      }}
                      className="min-h-10 flex-1 touch-manipulation rounded-xl bg-slate-100 px-2 py-2 text-[11px] font-bold text-slate-700 cursor-pointer hover:bg-slate-200"
                    >
                      Quitar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void (async () => {
                          const title = `ViaMorelia — ${r?.name || 'ruta'}`;
                          if (originCoords && destinationCoords) {
                            await handleShareTrip();
                            return;
                          }
                          // Solo ruta: enlace limpio al explorar (sin ensuciar la barra actual)
                          const path = buildTripShareUrl({ routeId: selectedRouteId });
                          const result = await shareOrCopyTripUrl(path, title);
                          if (result === 'shared') toast('Listo para compartir', 'success');
                          else if (result === 'copied') toast('Enlace copiado', 'success');
                          else toast('No se pudo compartir', 'error');
                        })();
                      }}
                      className="min-h-10 flex-1 touch-manipulation rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-bold text-slate-800 cursor-pointer hover:bg-slate-50"
                    >
                      <span className="inline-flex items-center justify-center gap-1">
                        <Share2 className="h-3.5 w-3.5" /> Compartir
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPanel('routes');
                        setResultsOpen(true);
                      }}
                      className="min-h-10 flex-1 touch-manipulation rounded-xl bg-emerald-600 px-2 py-2 text-[11px] font-bold text-white cursor-pointer hover:bg-emerald-700"
                    >
                      Detalles
                    </button>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reencuadre: volver a ver ruta / viaje / GPS */}
      <AnimatePresence>
        {!resultsOpen && (selectedRouteId || tripPlans.length > 0) && (
          <motion.div
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            className="pointer-events-auto absolute z-30 flex flex-col gap-1.5"
            style={{
              right: 'max(0.5rem, var(--vm-safe-right))',
              bottom: selectedRouteId
                ? 'calc(11.5rem + var(--vm-safe-bottom))'
                : 'calc(5.5rem + var(--vm-safe-bottom))',
            }}
          >
            {mapNeedsReframe && (
              <button
                type="button"
                onClick={reframeActiveContent}
                className="vm-panel flex min-h-11 max-w-[11rem] touch-manipulation items-center gap-1.5 rounded-2xl border px-3 py-2 text-left text-[11px] font-bold text-slate-800 shadow-lg cursor-pointer"
              >
                <Focus className="h-4 w-4 shrink-0 text-emerald-700" />
                {selectedRouteId ? 'Volver a ver ruta completa' : 'Centrar viaje completo'}
              </button>
            )}
            {selectedRouteId && (
              <button
                type="button"
                onClick={reframeActiveContent}
                className="vm-btn-icon !h-11 !w-11 !rounded-xl"
                title="Centrar ruta seleccionada"
                aria-label="Centrar ruta seleccionada"
              >
                <RouteIcon className="h-5 w-5 text-slate-700" />
              </button>
            )}
            {tripPlans.length > 0 && (
              <button
                type="button"
                onClick={reframeActiveContent}
                className="vm-btn-icon !h-11 !w-11 !rounded-xl"
                title="Centrar viaje completo"
                aria-label="Centrar viaje completo"
              >
                <Navigation className="h-5 w-5 text-slate-700" />
              </button>
            )}
            <button
              type="button"
              onClick={requestLocation}
              disabled={locating}
              className="vm-btn-icon !h-11 !w-11 !rounded-xl"
              title="Centrar mi ubicación"
              aria-label="Centrar mi ubicación"
            >
              {locating ? (
                <Loader2 className="h-5 w-5 animate-spin text-emerald-700" />
              ) : (
                <LocateFixed className="h-5 w-5 text-emerald-700" />
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bienvenida primera visita */}
      <AnimatePresence>
        {hasMounted && showWelcome && !resultsOpen && !searchExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="pointer-events-auto absolute z-30 sm:left-1/2 sm:right-auto sm:w-[min(92vw,380px)] sm:-translate-x-1/2"
            style={{
              left: 'max(0.75rem, var(--vm-safe-left))',
              right: 'max(0.75rem, var(--vm-safe-right))',
              bottom: 'calc(4.75rem + var(--vm-safe-bottom))',
            }}
          >
            <div className="vm-panel rounded-2xl border p-3.5 shadow-2xl">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-900">Bienvenido a ViaMorelia</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-slate-600">
                    Combis y autobuses de Morelia. Elige cómo quieres empezar:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismissWelcome}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={openPlanTrip}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-left text-xs font-bold text-white cursor-pointer hover:bg-emerald-700"
                >
                  <Navigation className="h-4 w-4 shrink-0" />
                  <span>
                    Planear un viaje
                    <span className="mt-0.5 block text-[10px] font-medium text-emerald-100">
                      Origen → destino y te decimos qué combi tomar
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={openBrowseRoutes}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-bold text-slate-800 cursor-pointer hover:bg-slate-50"
                >
                  <List className="h-4 w-4 shrink-0 text-slate-600" />
                  <span>
                    Explorar rutas
                    <span className="mt-0.5 block text-[10px] font-medium text-slate-500">
                      Ver el trazo completo de cualquier combi
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop: modal. Móvil: sheet a ~60% sin overlay (mapa usable). */}
      <ResultsSheet
        open={resultsOpen}
        isDesktop={isDesktop}
        panel={panel === 'search' ? 'results' : panel}
        onPanelChange={(p) => {
          dismissKeyboard();
          setPanel(p);
        }}
        onClose={() => {
          dismissKeyboard();
          setResultsOpen(false);
          setSearchExpanded(false);
        }}
        footerAction={
          panel === 'routes'
            ? {
                label: 'Ver ruta en el mapa',
                testId: 'view-route-on-map',
                onClick: () => {
                  if (!selectedRouteId) {
                    toast('Elige una ruta de la lista', 'warning');
                    return;
                  }
                  viewSelectionOnMap();
                },
              }
            : {
                label: 'Ver en el mapa',
                testId: panel === 'results' ? 'view-trip-on-map' : 'view-favorites-on-map',
                onClick: () => viewSelectionOnMap(),
              }
        }
      >
        {panel === 'results' && renderResultsList()}
        {panel === 'favorites' && renderFavorites()}
        {panel === 'routes' && renderRouteExplorer()}
      </ResultsSheet>

      {/* Dock inferior: acciones con texto (más intuitivo) */}
      {!resultsOpen && (
        <BottomDock
          locating={locating}
          hasMapContent={hasMapContent}
          routeCount={routes.length}
          onPlan={openPlanTrip}
          onRoutes={openBrowseRoutes}
          onLocation={requestLocation}
          onClear={clearMap}
        />
      )}

      </main>
    </div>
  );
}
