'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
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
import { mockSupabaseClient, mockDb, type Route } from '../lib/supabase/client';
import { planTrip, type Coordinate, type TripPlan } from '../lib/routing/planner';
import { loadPublishedShapes, type PublishedShape } from '../lib/routing/load-published-shapes';
import { initMoreliaMap, destroyMoreliaMap } from '@/lib/map/init-map';
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
  prioritizeFavoriteLocations,
  removeFavoriteLocation,
  toggleFavoriteRoute,
  type FavoriteLocation,
} from '@/lib/favorites/store';

type PanelMode = 'search' | 'results' | 'favorites' | 'routes';

function createOrbElement(kind: 'origin' | 'dest') {
  const wrap = document.createElement('div');
  wrap.className = `vm-orb-wrap ${kind === 'origin' ? 'vm-orb-origin' : 'vm-orb-dest'}`;
  wrap.innerHTML = `
    <span class="vm-orb-ring"></span>
    <span class="vm-orb-ring delay"></span>
    <span class="vm-orb-core"></span>
  `;
  return wrap;
}

export default function Home() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});
  const shapesRef = useRef<PublishedShape[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
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

  // Auth + routes + shapes + favoritos remotos
  useEffect(() => {
    mockSupabaseClient.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const u = { id: data.user.id, email: data.user.email || '' };
        setUser(u);
        const [fr, fl] = await Promise.all([
          loadFavoriteRoutes(u.id),
          loadFavoriteLocations(u.id),
        ]);
        setFavorites(fr);
        setFavoriteLocations(fl);
      } else {
        // Sin sesión: ya cargamos local en el effect de montaje
      }
    });
    const {
      data: { subscription },
    } = mockSupabaseClient.auth.onAuthStateChange(async (_e, session) => {
      const sess = session as { user?: { id: string; email: string } } | null;
      if (sess?.user) {
        const u = { id: sess.user.id, email: sess.user.email || '' };
        setUser(u);
        const [fr, fl] = await Promise.all([
          loadFavoriteRoutes(u.id),
          loadFavoriteLocations(u.id),
        ]);
        setFavorites(fr);
        setFavoriteLocations(fl);
      } else {
        setUser(null);
        setFavorites(loadLocalFavoriteRoutes());
        setFavoriteLocations(loadLocalFavoriteLocations());
      }
    });

    const boot = async () => {
      setShapesLoading(true);
      try {
        const { shapes, routes: published } = await loadPublishedShapes();
        shapesRef.current = shapes;
        if (published.length > 0) {
          setRoutes(
            published.map((r) => {
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
            })
          );
        } else {
          // Fallback mock solo si el índice público no está disponible
          const { data } = await mockSupabaseClient.from('routes').select();
          if (data) setRoutes(data as Route[]);
          toast('No se cargó el índice de rutas publicadas', 'warning');
        }
      } catch (e) {
        console.warn(e);
        const { data } = await mockSupabaseClient.from('routes').select();
        if (data) setRoutes(data as Route[]);
      } finally {
        setShapesLoading(false);
      }
    };
    void boot();

    return () => subscription.unsubscribe();
  }, []);

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
        const map = mapRef.current;
        if (map) {
          map.flyTo({ center: coords, zoom: Math.max(map.getZoom(), 15), essential: true });
        }
        toast('Ubicación obtenida', 'success', 'ViaMorelia');
      },
      (err) => {
        setLocating(false);
        console.warn('Geolocation', err);
        toast('No se pudo obtener tu ubicación. Elige un origen.', 'warning');
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
        typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
      const { data, error } = await mockSupabaseClient.auth.signInWithOtp({
        email: clean,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
        },
      });
      if (error) {
        setAuthError(error.message);
        toast(error.message, 'error', 'Enlace mágico');
        return;
      }
      // Real Supabase: no hay sesión hasta abrir el correo
      if (data?.user && process.env.NEXT_PUBLIC_USE_REAL_SUPABASE !== 'true') {
        setUser({ id: data.user.id, email: data.user.email || clean });
        setAuthOpen(false);
        const [fr, fl] = await Promise.all([
          loadFavoriteRoutes(data.user.id),
          loadFavoriteLocations(data.user.id),
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
      const { error } = await mockSupabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
        },
      });
      if (error) {
        setAuthError(error.message);
        toast(error.message, 'error', 'Google');
      } else if (process.env.NEXT_PUBLIC_USE_REAL_SUPABASE !== 'true') {
        // Mock: sesión inmediata
        const { data } = await mockSupabaseClient.auth.getUser();
        if (data.user) {
          setUser({ id: data.user.id, email: data.user.email || '' });
          setAuthOpen(false);
          const [fr, fl] = await Promise.all([
            loadFavoriteRoutes(data.user.id),
            loadFavoriteLocations(data.user.id),
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

  const handleLogout = async () => {
    await mockSupabaseClient.auth.signOut();
    setUser(null);
    toast('Sesión cerrada', 'info');
  };

  // Autocompletado: favoritos primero + catálogo + Nominatim
  const runSearch = useCallback(
    async (val: string) => {
      const q = val.trim();
      if (!q) {
        // Sin query: mostrar favoritos de ubicación
        setSuggestions(
          prioritizeFavoriteLocations([], favoriteLocations, '') as PlaceHit[]
        );
        setSearchLoading(false);
        return;
      }
      setSearchLoading(true);
      const local = searchLocalPlaces(q, 10);
      let merged: PlaceHit[] = prioritizeFavoriteLocations(
        local,
        favoriteLocations,
        q
      ) as PlaceHit[];
      setSuggestions(merged);

      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const remote: PlaceHit[] = data.results ?? [];
          merged = prioritizeFavoriteLocations(
            [...local, ...remote],
            favoriteLocations,
            q
          ).slice(0, 16) as PlaceHit[];
          setSuggestions(merged);
        }
      } catch {
        /* keep local+favs */
      } finally {
        setSearchLoading(false);
      }
    },
    [favoriteLocations]
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

  // Planificador
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

    planTrip(originCoords, destinationCoords, {
      shapes: shapesRef.current,
      transferOnlyIfNecessary: true,
      allowTransfers: true,
      maxWalkDistanceMeters: 950,
      maxDirectWalkTotalM: 1400,
    })
      .then((plans) => {
        if (cancelled) return;
        setTripPlans(plans);
        setSelectedPlanIndex(0);
        setPlanTypeFilter('all');
        setPlanning(false);
        if (plans.length === 0) {
          setPlanningError('No hay rutas útiles entre estos puntos. Prueba ajustar origen o destino.');
          toast('Sin rutas directas ni transbordos cercanos', 'warning');
          setSearchExpanded(true);
        } else {
          setPanel('results');
          setResultsOpen(true);
          // Retraer buscador; resultados en modal
          setSearchExpanded(false);
          setActiveSearchField(null);
          setSuggestions([]);
          toast(
            `${plans.length} opción${plans.length > 1 ? 'es' : ''} · ${
              plans[0].type === 'direct' ? 'directas' : 'con transbordo'
            }`,
            'success',
            'Viaje'
          );
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setPlanning(false);
        setPlanningError('Error al calcular el viaje.');
        toast('Error al planificar', 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [originCoords, destinationCoords]);

  // Mapa: siempre Carto Positron (gris claro). El tema UI oscuro no cambia el basemap.
  useEffect(() => {
    if (!mapContainerRef.current) return;
    let map: maplibregl.Map | null = null;
    try {
      map = initMoreliaMap({
        container: mapContainerRef.current,
        includeWalkLayers: true,
        basemapTheme: 'light',
        onReady: (m) => {
          setStyleLoaded(true);
          m.resize();
        },
      });
      mapRef.current = map;

      map.on('click', (e) => {
        const field = activeSearchFieldRef.current;
        if (!field) return;
        const coords: Coordinate = [e.lngLat.lng, e.lngLat.lat];
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
      });
    } catch (e) {
      console.warn(e);
    }
    return () => {
      destroyMoreliaMap(map);
      mapRef.current = null;
      setStyleLoaded(false);
    };
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
      fetch(`/routes/${selectedRouteId}.geojson?t=${Date.now()}`)
        .then((r) => {
          if (!r.ok) throw new Error('geojson');
          return r.json();
        })
        .then((data: RouteFeatureCollection) => {
          const source = map.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource;
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
            const b = all.reduce(
              (acc, c) => acc.extend(c),
              new maplibregl.LngLatBounds(all[0], all[0])
            );
            map.fitBounds(b, { padding: 56, maxZoom: 15 });
          }
        })
        .catch(() => toast('No se pudo cargar la ruta', 'error'));
    } else {
      const source = map.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource;
      source?.setData({ type: 'FeatureCollection', features: [] });
      setTripStopsData(map, []);
    }
  }, [selectedRouteId, styleLoaded, tripPlans.length]);

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

    const source = map.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource;
    source?.setData({
      type: 'FeatureCollection',
      features,
    } as unknown as GeoJSON.FeatureCollection);

    // Letreros solo con coordenadas válidas (evita “Baja aquí” en la esquina)
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

    const stopFeatures: Array<{
      type: 'Feature';
      properties: { label: string; kind: 'sube' | 'baja' | 'transbordo' };
      geometry: { type: 'Point'; coordinates: [number, number] };
    }> = [];

    plan.segments.forEach((seg, idx) => {
      if (seg.type !== 'ride') return;
      if (isMapCoord(seg.boardingPoint)) {
        stopFeatures.push({
          type: 'Feature',
          properties: { label: '⬆ Sube aquí', kind: 'sube' },
          geometry: {
            type: 'Point',
            coordinates: [seg.boardingPoint[0], seg.boardingPoint[1]],
          },
        });
      }
      if (isMapCoord(seg.alightingPoint)) {
        const next = plan.segments[idx + 1];
        const isTransfer = next?.type === 'walk' && next.walkKind === 'transfer';
        stopFeatures.push({
          type: 'Feature',
          properties: {
            label: isTransfer ? '🔄 Baja · transbordo' : '⬇ Baja aquí',
            kind: isTransfer ? 'transbordo' : 'baja',
          },
          geometry: {
            type: 'Point',
            coordinates: [seg.alightingPoint[0], seg.alightingPoint[1]],
          },
        });
      }
    });
    setTripStopsData(map, stopFeatures);

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
      const b = allCoords.reduce(
        (acc, c) => acc.extend(c),
        new maplibregl.LngLatBounds(allCoords[0], allCoords[0])
      );
      map.fitBounds(b, { padding: 64, maxZoom: 14.5, duration: 800 });
    }
  }, [tripPlans, selectedPlanIndex, styleLoaded, originCoords, destinationCoords]);

  // Markers: solo orbes origen/destino (letreros van en capas MapLibre, no en esquina)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};

    const ok = (c: Coordinate | null) =>
      !!c &&
      Number.isFinite(c[0]) &&
      Number.isFinite(c[1]) &&
      Math.abs(c[0]) > 0.01 &&
      Math.abs(c[1]) > 0.01;

    if (ok(originCoords)) {
      markersRef.current.origin = new maplibregl.Marker({
        element: createOrbElement('origin'),
        anchor: 'center',
      })
        .setLngLat(originCoords!)
        .addTo(map);
    }
    if (ok(destinationCoords)) {
      markersRef.current.destination = new maplibregl.Marker({
        element: createOrbElement('dest'),
        anchor: 'center',
      })
        .setLngLat(destinationCoords!)
        .addTo(map);
    }
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
      const source = map.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
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

  const filteredPlans = tripPlans
    .map((plan, idx) => ({ plan, idx }))
    .filter(({ plan }) => {
      if (planTypeFilter === 'all') return true;
      return plan.type === planTypeFilter;
    });

  const directCount = tripPlans.filter((p) => p.type === 'direct').length;
  const transferCount = tripPlans.filter((p) => p.type === 'transfer').length;

  const renderResultsList = () => (
    <div data-testid="trip-planner-results" className="flex flex-col gap-2.5 p-3">
      {!planning && tripPlans.length === 0 && !planningError && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3.5 text-sm text-slate-700">
          <p className="font-bold text-emerald-900">¿Cómo llegar?</p>
          <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[12px] leading-snug text-slate-600">
            <li>Elige <strong>origen</strong> y <strong>destino</strong> arriba (o toca el mapa).</li>
            <li>Te mostramos combis y opciones aquí.</li>
            <li>Elige un viaje para verlo en el mapa.</li>
          </ol>
          <button
            type="button"
            onClick={() => {
              setResultsOpen(false);
              setSearchExpanded(true);
              setActiveSearchField(originCoords ? 'destination' : 'origin');
            }}
            className="mt-3 w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow cursor-pointer hover:bg-emerald-700"
          >
            {originCoords ? 'Elegir destino' : 'Empezar: ¿desde dónde sales?'}
          </button>
          <button
            type="button"
            onClick={() => setPanel('routes')}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-50"
          >
            O ver todas las rutas del mapa
          </button>
        </div>
      )}

      {planning && (
        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
          Calculando mejores rutas…
        </div>
      )}
      {planningError && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600">
          {planningError}
        </p>
      )}

      {!planning && tripPlans.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'all' as const, label: `Todos (${tripPlans.length})` },
              { id: 'direct' as const, label: `Directo (${directCount})` },
              { id: 'transfer' as const, label: `Transbordo (${transferCount})` },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setPlanTypeFilter(f.id);
                const first = tripPlans.findIndex((p) =>
                  f.id === 'all' ? true : p.type === f.id
                );
                if (first >= 0) setSelectedPlanIndex(first);
              }}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-bold cursor-pointer transition ${
                planTypeFilter === f.id
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {!planning &&
        filteredPlans.map(({ plan, idx }, listIdx) => {
          const walkSegs = plan.segments.filter((s) => s.type === 'walk');
          const firstWalk = walkSegs[0];
          const rideSegs = plan.segments.filter((s) => s.type === 'ride');
          return (
            <motion.button
              key={idx}
              type="button"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: listIdx * 0.05 }}
              onClick={() => {
                setSelectedPlanIndex(idx);
                // Al elegir un plan de viaje, retraer modal para ver el mapa
                setResultsOpen(false);
              }}
              className={`vm-card vm-press w-full rounded-2xl border p-3 text-left cursor-pointer ${
                selectedPlanIndex === idx
                  ? 'ring-1 ring-emerald-500/30 shadow-md'
                  : ''
              }`}
              style={
                selectedPlanIndex === idx
                  ? {
                      borderColor: 'var(--vm-selected-border)',
                      background: 'var(--vm-selected-bg)',
                    }
                  : undefined
              }
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-emerald-700">
                  {plan.type === 'direct' ? (
                    <>
                      <Bus className="h-3.5 w-3.5" /> Directo
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="h-3.5 w-3.5" /> Transbordo · {rideSegs.length} rutas
                    </>
                  )}
                </span>
                <span className="text-xs font-bold text-slate-600">
                  {Math.round(plan.totalDuration / 60)} min · {(plan.totalDistance / 1000).toFixed(1)} km
                </span>
              </div>

              {/* Colores de todas las rutas del plan (1 directo o 2+ en transbordo) */}
              {rideSegs.length > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  {rideSegs.map((r, ri) => (
                    <span
                      key={`${r.routeId}-${ri}`}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: r.color || '#3b82f6' }}
                      />
                      {ri + 1}. {r.routeName}
                    </span>
                  ))}
                </div>
              )}

              {firstWalk && firstWalk.distance > 0 && (
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-sky-700">
                  <Footprints className="h-3.5 w-3.5" />
                  Caminar {Math.round(firstWalk.distance)} m para tomar la ruta
                </p>
              )}
              <div className="flex flex-col gap-1.5">
                {plan.segments.map((seg, sIdx) => (
                  <div key={sIdx} className="flex gap-2 text-[11px]">
                    <div
                      className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                        seg.type === 'walk' ? 'bg-slate-400' : 'bg-emerald-600'
                      }`}
                      style={seg.type === 'ride' ? { backgroundColor: seg.color } : undefined}
                    />
                    <p className="leading-snug text-slate-700">
                      <span className="font-semibold">{seg.instruction}</span>
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5 text-[9px] font-medium leading-relaxed text-amber-800">
                Puntos de subida y bajada son sugeridos (no paradas oficiales).
                {plan.type === 'transfer'
                  ? ' En el mapa se dibujan todas las rutas del viaje a la vez.'
                  : ''}
              </p>
            </motion.button>
          );
        })}
      {!planning && tripPlans.length === 0 && !planningError && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400">
          Elige origen y destino para ver rutas.
        </div>
      )}
      {!planning && tripPlans.length > 0 && filteredPlans.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400">
          No hay opciones de este tipo. Prueba “Todos” o “Directo”.
        </div>
      )}
    </div>
  );

  const renderFavorites = () => (
    <div className="flex flex-col gap-3 p-3">
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Ubicaciones favoritas
        </p>
        {favoriteLocations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-[11px] text-slate-400">
            Marca el corazón en una dirección al buscar.
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
            Explora rutas y toca el corazón.
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
    <div className="flex w-80 flex-col gap-2.5 p-3.5">
      {user ? (
        <>
          <p className="text-sm font-semibold text-slate-800" data-testid="user-profile-header">
            {user.email}
          </p>
          <p className="text-[10px] text-slate-400">
            Favoritos sincronizados con tu cuenta
          </p>
          <button
            type="button"
            onClick={async () => {
              await handleLogout();
              setAuthOpen(false);
            }}
            className="rounded-xl bg-slate-900 py-2 text-xs font-bold text-white cursor-pointer"
          >
            Cerrar sesión
          </button>
        </>
      ) : (
        <form onSubmit={handleMagicLink} className="flex flex-col gap-2.5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Entrar o registrarte
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
              Sin contraseña: te enviamos un enlace mágico al correo, o usa Google.
            </p>
          </div>
          <input
            data-testid="login-email"
            type="email"
            placeholder="tu@correo.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setAuthError(null);
              setAuthMessage(null);
            }}
            autoComplete="email"
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            required
          />
          <button
            data-testid="login-magic-link"
            type="submit"
            disabled={authSending}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60 cursor-pointer"
          >
            {authSending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enviando…
              </>
            ) : (
              'Enviar enlace mágico'
            )}
          </button>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            o
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          <button
            data-testid="login-google"
            type="button"
            disabled={authSending}
            onClick={handleGoogleLogin}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar con Google
          </button>
          {authMessage && (
            <p
              data-testid="login-magic-sent"
              className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-2 text-[11px] font-medium leading-snug text-emerald-800"
            >
              {authMessage}
            </p>
          )}
          {authError && (
            <p className="text-[11px] font-medium text-rose-500">{authError}</p>
          )}
        </form>
      )}
    </div>
  );

  const renderRouteExplorer = () => (
    <div className="flex flex-col gap-2 p-3">
      <p className="text-[11px] leading-snug text-slate-500">
        Toca una ruta para dibujarla completa en el mapa (ida y vuelta).
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
      <div
        data-testid="map-container"
        ref={mapContainerRef}
        className="rm-map-canvas absolute inset-0 z-0 h-full w-full"
      />

      {/* Branding: icono + nombre juntos, arriba del todo */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="pointer-events-none absolute left-0 top-0 z-30 flex flex-row items-center leading-none"
        style={{ gap: 0, margin: 0, padding: 0, columnGap: 0 }}
      >
        <Image
          src="/brand/icono.png"
          alt=""
          width={80}
          height={80}
          className="relative z-10 block h-9 w-9 shrink-0 object-contain object-center drop-shadow-md sm:h-12 sm:w-12 md:h-[4.25rem] md:w-[4.25rem]"
          style={{ margin: 0, padding: 0 }}
          priority
        />
        <Image
          src="/brand/nombre.png"
          alt="ViaMorelia"
          width={640}
          height={140}
          className="relative z-0 ml-0.5 block h-9 w-auto max-w-[min(52vw,9.5rem)] object-contain object-left drop-shadow-md sm:ml-0 sm:h-12 sm:max-w-[14rem] md:h-[4.25rem] md:max-w-[18rem] lg:h-[4.75rem] lg:max-w-[22rem]"
          style={{ marginTop: 0, marginBottom: 0, padding: 0 }}
          priority
        />
      </motion.div>

      {/* Buscador principal — siempre una pastilla clara */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28, delay: 0.05 }}
        className={`absolute z-20 ${
          isDesktop
            ? 'left-3 top-[6.5rem] w-[min(100%-1.5rem,22rem)] sm:left-4 sm:top-[7.25rem] md:top-[7.75rem]'
            : 'left-3 right-3 top-[3.4rem]'
        }`}
      >
        {!searchExpanded && (
          <button
            type="button"
            onClick={() => {
              setSearchExpanded(true);
              setActiveSearchField(originCoords ? 'destination' : 'origin');
              dismissWelcome();
            }}
            className="vm-panel vm-press flex w-full items-center gap-2.5 rounded-2xl border px-3.5 py-3 text-left cursor-pointer shadow-xl"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
              <Search className="h-4 w-4 text-emerald-600" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-900">
                {originInput || destinationInput
                  ? `${originInput || 'Origen'} → ${destinationInput || 'Destino'}`
                  : '¿A dónde vas?'}
              </p>
              <p className="text-[11px] font-medium text-slate-500">
                {originCoords && destinationCoords
                  ? planning
                    ? 'Calculando viaje…'
                    : tripPlans.length
                      ? `${tripPlans.length} opción(es) · toca para editar`
                      : 'Toca para editar origen o destino'
                  : 'Escribe un lugar o toca el mapa'}
              </p>
            </div>
            {(planning || locating) && (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" />
            )}
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
        )}

        {searchExpanded && (
          <div className="vm-panel w-full rounded-2xl border p-3 shadow-xl">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">Planear viaje</p>
                <p className="text-[10px] text-slate-500">
                  Escribe o toca el mapa para marcar punto
                </p>
              </div>
              <div className="flex items-center gap-1">
                {(planning || shapesLoading || locating) && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSearchExpanded(false);
                    setActiveSearchField(null);
                    setSuggestions([]);
                  }}
                  className="flex items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-bold text-slate-500 transition hover:bg-slate-100 cursor-pointer"
                >
                  Listo
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="relative mb-2">
              <label className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                1. Origen (sale de)
              </label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-emerald-500" />
                <input
                  data-testid="search-origin"
                  type="text"
                  placeholder="Ej: Centro, mi ubicación…"
                  value={originInput}
                  onChange={(e) => handleSearchChange('origin', e.target.value)}
                  onFocus={() => {
                    setActiveSearchField('origin');
                    void runSearch(originInput);
                  }}
                  className={`w-full rounded-xl border bg-white py-2.5 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
                    activeSearchField === 'origin' ? 'border-emerald-400 ring-2 ring-emerald-500/20' : 'border-slate-200'
                  }`}
                />
                {originInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setOriginInput('');
                      setOriginCoords(null);
                    }}
                    className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {activeSearchField === 'origin' && renderSuggestions()}
            </div>

            <div className="mb-2 flex justify-center">
              <button
                type="button"
                onClick={swapOriginDestination}
                className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold text-slate-600 shadow-sm cursor-pointer hover:bg-slate-50"
                title="Intercambiar origen y destino"
              >
                <ArrowUpDown className="h-3.5 w-3.5" />
                Intercambiar
              </button>
            </div>

            <div className="relative mb-3">
              <label className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
                2. Destino (vas a)
              </label>
              <div className="relative">
                <Navigation className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-rose-500" />
                <input
                  data-testid="search-destination"
                  type="text"
                  placeholder="Ej: Metrópolis, Aldea…"
                  value={destinationInput}
                  onChange={(e) => handleSearchChange('destination', e.target.value)}
                  onFocus={() => {
                    setActiveSearchField('destination');
                    void runSearch(destinationInput);
                  }}
                  className={`w-full rounded-xl border bg-white py-2.5 pl-9 pr-8 text-sm text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-rose-500/30 ${
                    activeSearchField === 'destination' ? 'border-rose-400 ring-2 ring-rose-500/20' : 'border-slate-200'
                  }`}
                />
                {destinationInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setDestinationInput('');
                      setDestinationCoords(null);
                    }}
                    className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {activeSearchField === 'destination' && renderSuggestions()}
            </div>

            {activeSearchField && (
              <p className="mb-2 rounded-lg bg-sky-50 px-2.5 py-1.5 text-[11px] font-medium text-sky-800">
                💡 También puedes <strong>tocar el mapa</strong> para fijar el{' '}
                {activeSearchField === 'origin' ? 'origen' : 'destino'}.
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={requestLocation}
                disabled={locating}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 py-2.5 text-[11px] font-bold text-emerald-800 cursor-pointer disabled:opacity-60"
              >
                {locating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <LocateFixed className="h-3.5 w-3.5" />
                )}
                Usar mi ubicación
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchExpanded(false);
                  if (originCoords && destinationCoords) {
                    setPanel('results');
                    setResultsOpen(true);
                  }
                }}
                disabled={!originCoords || !destinationCoords}
                className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-slate-900 py-2.5 text-[11px] font-bold text-white cursor-pointer disabled:opacity-40"
              >
                {planning ? 'Buscando…' : 'Ver opciones'}
              </button>
            </div>
          </div>
        )}
      </motion.div>

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
              title="Cuenta"
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
                      | maplibregl.GeoJSONSource
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

      {/* Modal resultados: centrado en desktop, bottom sheet en móvil */}
      <AnimatePresence>
        {resultsOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Cerrar panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 cursor-pointer backdrop-blur-[1px]"
              style={{ background: 'var(--vm-overlay)' }}
              onClick={() => setResultsOpen(false)}
            />
            <motion.div
              key="results-modal"
              initial={
                isDesktop
                  ? { opacity: 0, scale: 0.94, y: 12 }
                  : { opacity: 0, y: '100%' }
              }
              animate={
                isDesktop ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 }
              }
              exit={
                isDesktop
                  ? { opacity: 0, scale: 0.96, y: 8 }
                  : { opacity: 0, y: '100%' }
              }
              transition={{ type: 'spring', stiffness: 380, damping: 34 }}
              className={
                isDesktop
                  ? 'vm-panel fixed left-1/2 top-1/2 z-50 flex max-h-[min(78vh,640px)] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-3xl border'
                  : 'vm-panel fixed inset-x-0 bottom-0 z-50 flex max-h-[62vh] flex-col overflow-hidden rounded-t-3xl border-t pb-[env(safe-area-inset-bottom)]'
              }
            >
              {!isDesktop && (
                <div className="flex justify-center pt-2 pb-1">
                  <span className="h-1 w-10 rounded-full bg-slate-300" />
                </div>
              )}
              <div
                className="flex items-center justify-between gap-2 px-3 py-2"
                style={{ borderBottom: '1px solid var(--vm-card-border)' }}
              >
                <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
                  {(
                    [
                      { id: 'results' as const, label: 'Mi viaje', icon: Navigation },
                      { id: 'routes' as const, label: 'Rutas', icon: RouteIcon },
                      { id: 'favorites' as const, label: 'Favoritos', icon: Heart },
                    ] as const
                  ).map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setPanel(t.id)}
                        className={`vm-press flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-bold cursor-pointer ${
                          panel === t.id ? 'vm-chip-active' : 'vm-chip'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setResultsOpen(false)}
                  className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-600 cursor-pointer hover:bg-slate-200"
                >
                  Ver mapa
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {panel === 'results' && renderResultsList()}
                {panel === 'favorites' && renderFavorites()}
                {panel === 'routes' && renderRouteExplorer()}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Dock inferior: acciones con texto (más intuitivo) */}
      {!resultsOpen && (
        <motion.nav
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 pointer-events-none"
        >
          <div className="pointer-events-auto vm-panel flex w-full max-w-md items-stretch gap-1 rounded-2xl border p-1.5 shadow-2xl">
            <button
              type="button"
              onClick={openPlanTrip}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-slate-700 transition hover:bg-emerald-50 cursor-pointer"
            >
              <Navigation className="h-5 w-5 text-emerald-600" />
              <span className="text-[10px] font-bold">Viaje</span>
            </button>
            <button
              type="button"
              onClick={openBrowseRoutes}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-slate-700 transition hover:bg-sky-50 cursor-pointer"
              data-testid="open-routes"
            >
              <List className="h-5 w-5 text-sky-600" />
              <span className="text-[10px] font-bold">
                Rutas{routes.length ? ` (${routes.length})` : ''}
              </span>
            </button>
            <button
              type="button"
              onClick={requestLocation}
              disabled={locating}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-slate-700 transition hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              {locating ? (
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              ) : (
                <LocateFixed className="h-5 w-5 text-emerald-600" />
              )}
              <span className="text-[10px] font-bold">Ubicación</span>
            </button>
            <button
              type="button"
              onClick={clearMap}
              disabled={!hasMapContent}
              data-testid="clear-map"
              className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2 text-slate-700 transition hover:bg-rose-50 cursor-pointer disabled:opacity-40"
            >
              <Eraser className="h-5 w-5 text-rose-500" />
              <span className="text-[10px] font-bold">Limpiar</span>
            </button>
          </div>
        </motion.nav>
      )}
    </div>
  );
}
