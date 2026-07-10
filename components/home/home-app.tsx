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
  /** Tip de bienvenida (una vez por sesión) */
  const [showWelcome, setShowWelcome] = useState(false);

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
  const urlHydratedRef = useRef(false);

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

    // Favoritos de localStorage solo después de hidratar
    setFavorites(loadLocalFavoriteRoutes());
    setFavoriteLocations(loadLocalFavoriteLocations());

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

  // Deep links: ?from=&to= y/o ?route=
  useEffect(() => {
    try {
      const trip = readTripUrlState();
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
      if (trip.origin && trip.destination) {
        setShowWelcome(false);
        setPanel('results');
        setResultsOpen(true);
        if (trip.planIndex != null) setSelectedPlanIndex(trip.planIndex);
      }
      if (trip.routeId) {
        setSelectedRouteId(trip.routeId);
        setPanel('routes');
        setResultsOpen(true);
        setShowWelcome(false);
      }
      urlHydratedRef.current = true;
    } catch {
      urlHydratedRef.current = true;
    }
  }, []);

  // Sincroniza URL del viaje (compartible) sin recargar
  useEffect(() => {
    if (!urlHydratedRef.current || typeof window === 'undefined') return;
    const path = buildTripShareUrl({
      origin: originCoords,
      destination: destinationCoords,
      originLabel:
        originInput && originInput !== 'Mi ubicación' ? originInput : null,
      destinationLabel: destinationInput || null,
      routeId: selectedRouteId,
      planIndex: tripPlans.length ? selectedPlanIndex : null,
    });
    const next = path.startsWith('http') ? path : `${window.location.origin}${path}`;
    if (next !== window.location.href) {
      window.history.replaceState({}, '', path);
    }
  }, [
    originCoords,
    destinationCoords,
    originInput,
    destinationInput,
    selectedRouteId,
    selectedPlanIndex,
    tripPlans.length,
  ]);

  // Geolocalización al entrar (alta precisión)
  useEffect(() => {
    if (!styleLoaded) return;
    if (!navigator.geolocation) return;

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
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
        const favs: PlaceHit[] = favoriteLocations.map((f) => ({
          id: f.id,
          name: f.name,
          description: f.description || 'Favorito',
          category: 'favorite',
          coordinates: f.coordinates,
          source: 'favorite' as const,
          isFavorite: true,
        }));
        setSuggestions(favs.slice(0, 8));
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
    [favoriteLocations, setGeocodeDegraded]
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
    setSuggestions([]);
    setActiveSearchField(null);
    // Tras elegir dirección, retraer buscador para ver el mapa
    setSearchExpanded(false);
    mapRef.current?.flyTo({ center: place.coordinates, zoom: 15, essential: true });
  };

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
        setSelectedPlanIndex(0);
        setPlanTypeFilter('all');
        setPlanning(false);
        if (sorted.length === 0) {
          setPlanningError(
            'No encontramos combis útiles cerca de esos puntos. Prueba mover origen o destino unos cientos de metros, o toca el mapa.'
          );
          toast('Sin rutas directas ni transbordos cercanos', 'warning');
          setSearchExpanded(true);
          setResultsOpen(true);
          setPanel('results');
        } else {
          setPanel('results');
          setResultsOpen(true);
          setSearchExpanded(false);
          setActiveSearchField(null);
          setSuggestions([]);
          toast(
            `${sorted.length} opción${sorted.length > 1 ? 'es' : ''} · ${
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

  const handleMapReady = useCallback((m: MapLibreMap) => {
    mapRef.current = m;
    setStyleLoaded(true);
    m.resize();
    void import('maplibre-gl').then((mod) => {
      mlRef.current = mod;
    });
  }, []);

  const handleMapClick = useCallback((coords: Coordinate) => {
    const field = activeSearchFieldRef.current;
    if (!field) return;
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
  }, []);

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

  // Explorar ruta: UNA sola línea (corredor) + etiquetas Ida/Vuelta
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    if (tripPlans.length > 0) return;

    if (selectedRouteId) {
      // Caché HTTP + loader compartido (sin ?t= cache-bust)
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
          if (!res.ok) throw new Error('geojson');
          const data = (await res.json()) as RouteFeatureCollection;
          const source = map.getSource(ROUTES_SOURCE_ID) as GeoJSONSource;
          const single = toSingleCorridorDisplay(data, { role: 'full' });
          source?.setData(single as unknown as GeoJSON.FeatureCollection);
          const all: Coordinate[] = [];
          for (const f of single.features ?? []) {
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
            map.fitBounds(
              [
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)],
              ],
              { padding: 56, maxZoom: 15 }
            );
          }
          // Deep link estable
          if (meta && typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('route', selectedRouteId);
            window.history.replaceState({}, '', url.toString());
          }
        })
        .catch(() => toast('No se pudo cargar la ruta', 'error'));
    } else {
      const source = map.getSource(ROUTES_SOURCE_ID) as GeoJSONSource;
      source?.setData({ type: 'FeatureCollection', features: [] });
      setTripStopsData(map, []);
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('route')) {
          url.searchParams.delete('route');
          window.history.replaceState({}, '', url.toString());
        }
      } catch {
        /* ignore */
      }
    }
  }, [selectedRouteId, styleLoaded, tripPlans.length, routes]);

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
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 64, maxZoom: 14.5, duration: 800 }
      );
    }
  }, [tripPlans, selectedPlanIndex, styleLoaded, originCoords, destinationCoords]);

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
  const filteredRoutes = routes.filter((r) => {
    if (transportFilter !== 'all') {
      if (normalizeTransportType(r.transport_type, r.id, r.name) !== transportFilter) {
        return false;
      }
    }
    const q = routeQuery.trim().toLowerCase();
    if (!q) return true;
    const hay = `${r.name} ${r.id} ${r.description || ''}`.toLowerCase();
    return hay.includes(q) || q.split(/\s+/).every((tok) => hay.includes(tok));
  });

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
        setResultsOpen(false);
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
                    setResultsOpen(false);
                    setSearchExpanded(false);
                    mapRef.current?.flyTo({ center: loc.coordinates, zoom: 15 });
                  }}
                >
                  <p className="truncate text-sm font-semibold text-slate-800">{loc.name}</p>
                  <p className="text-[10px] text-slate-400">{loc.description || 'Ubicaci??n'}</p>
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
                onClick={() => {
                  setSelectedRouteId(route.id);
                  setTripPlans([]);
                  setResultsOpen(false);
                }}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 text-left transition hover:bg-slate-50 cursor-pointer"
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
        Toca una ruta para dibujarla completa en el mapa (ida y vuelta).
        {shapesLoading ? ' Cargando listado…' : ` ${routes.length} rutas.`}
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
        <input
          type="search"
          data-testid="search-routes"
          placeholder="Buscar por nombre… Morada, Roja, Gris…"
          value={routeQuery}
          onChange={(e) => setRouteQuery(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          autoFocus={panel === 'routes'}
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
              setSelectedRouteId(null);
            }}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
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
      {shapesLoading && (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <span className="vm-spinner" /> Cargando red de rutas…
        </div>
      )}
      {!shapesLoading && filteredRoutes.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400">
          {routes.length === 0
            ? 'No hay rutas publicadas disponibles.'
            : 'Ninguna ruta coincide con la búsqueda.'}
        </div>
      )}
      {filteredRoutes.map((route) => {
        const isFav = favorites.includes(route.id);
        const isSelected = selectedRouteId === route.id;
        const kind = normalizeTransportType(route.transport_type, route.id, route.name);
        return (
          <div
            key={route.id}
            data-testid={`route-item-${route.id}`}
            onClick={() => {
              const next = isSelected ? null : route.id;
              setSelectedRouteId(next);
              setTripPlans([]);
              if (next) {
                toast(`Ruta completa: ${route.name}`, 'info');
                // Al seleccionar ruta, retraer panel de resultados
                setResultsOpen(false);
              }
            }}
            className={`vm-card vm-press flex cursor-pointer items-center justify-between rounded-xl border p-3 ${
              isSelected ? 'ring-1 ring-emerald-500/25' : ''
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
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full border border-white shadow"
                style={{ backgroundColor: route.color }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--vm-text)]">{route.name}</p>
                <span
                  className={`mt-0.5 inline-block rounded-full border px-1.5 text-[9px] font-bold uppercase ${transportBadgeClass(kind)}`}
                >
                  {kind === 'combi' ? 'Combi' : 'Autobús'}
                </span>
              </div>
            </div>
            <button
              type="button"
              data-testid={`favorite-button-${route.id}`}
              onClick={(e) => {
                e.stopPropagation();
                void toggleFavorite(route.id);
              }}
              className="rounded-lg p-1.5 hover:bg-slate-100 cursor-pointer"
            >
              <Heart
                className={`h-4 w-4 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`}
              />
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[var(--background)] font-sans">
      <SkipLink href="#search-panel" label="Saltar a búsqueda" />
      <MapCanvas onReady={handleMapReady} onMapClick={handleMapClick} />
      <main id="main-content" className="contents">
      <AdminGateBanner />

      {/* Branding: fila superior izquierda; deja hueco a la derecha para favoritos/cuenta */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="pointer-events-none absolute left-1 top-1 z-50 flex max-w-[calc(100%-6.5rem)] flex-row items-center leading-none sm:left-2 sm:top-1.5 sm:max-w-[min(55vw,20rem)]"
        style={{ gap: 0, margin: 0, padding: 0, columnGap: 0 }}
      >
        <Image
          src="/brand/icono.png"
          alt=""
          width={80}
          height={80}
          className="relative z-10 block h-8 w-8 shrink-0 object-contain object-center drop-shadow-md sm:h-10 sm:w-10 md:h-11 md:w-11"
          style={{ margin: 0, padding: 0 }}
          priority
        />
        <Image
          src="/brand/nombre.png"
          alt="ViaMorelia"
          width={640}
          height={140}
          className="relative z-0 ml-0.5 block h-8 w-auto max-w-[min(48vw,8.5rem)] object-contain object-left drop-shadow-md sm:h-10 sm:max-w-[12rem] md:h-11 md:max-w-[14rem]"
          style={{ marginTop: 0, marginBottom: 0, padding: 0 }}
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
          setSearchExpanded(false);
          if (originCoords && destinationCoords) {
            setPanel('results');
            setResultsOpen(true);
          }
        }}
        onSelectSuggestion={selectSuggestion}
      />

{/* Top-right: favoritos + usuario */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 28 }}
        className="absolute right-3 top-3 z-40 flex flex-col items-end gap-2 sm:right-4 sm:top-4"
      >
        <div className="flex gap-2">
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
                  className="vm-panel absolute right-0 top-[3.1rem] z-50 overflow-hidden rounded-2xl border"
                >
                  {renderAuthForm()}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      {/* Left: zoom compacto */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28, delay: 0.08 }}
        className="absolute left-3 top-[min(48vh,26rem)] z-20 flex flex-col gap-1.5 sm:left-4"
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

      {/* Chip de ruta seleccionada */}
      <AnimatePresence>
        {selectedRouteId && !resultsOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="absolute bottom-[5.5rem] left-3 right-3 z-30 flex justify-center sm:bottom-24 sm:left-auto sm:right-4 sm:justify-end"
          >
            <div className="vm-panel flex max-w-full items-center gap-2 rounded-2xl border px-3 py-2 shadow-xl">
              <span
                className="h-3 w-3 shrink-0 rounded-full border border-white shadow"
                style={{
                  backgroundColor:
                    routes.find((r) => r.id === selectedRouteId)?.color || '#10b981',
                }}
              />
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-900">
                  {routes.find((r) => r.id === selectedRouteId)?.name || 'Ruta'}
                </p>
                <p className="text-[10px] text-slate-500">Ruta completa en el mapa</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedRouteId(null);
                  const map = mapRef.current;
                  if (map && tripPlans.length === 0) {
                    const source = map.getSource(ROUTES_SOURCE_ID) as
                      | GeoJSONSource
                      | undefined;
                    source?.setData({ type: 'FeatureCollection', features: [] });
                  }
                }}
                className="ml-1 shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600 cursor-pointer hover:bg-slate-200"
              >
                Quitar
              </button>
            </div>
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
            className="absolute bottom-[5.75rem] left-3 right-3 z-30 sm:bottom-24 sm:left-1/2 sm:right-auto sm:w-[min(92vw,380px)] sm:-translate-x-1/2"
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

      {/* Modal desktop / bottom sheet móvil deslizable */}
      <ResultsSheet
        open={resultsOpen}
        isDesktop={isDesktop}
        panel={panel === 'search' ? 'results' : panel}
        onPanelChange={(p) => setPanel(p)}
        onClose={() => setResultsOpen(false)}
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
