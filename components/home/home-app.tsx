/* eslint-disable react-hooks/refs */
/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'motion/react';
import {
  Heart,
  MapPin,
  Navigation,
  Plus,
  Minus,
  X,
  List,
  Info,
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Hooks customizados extraídos
import { useUserAccount } from '@/hooks/use-user-account';
import { useTripPlannerWorkflow } from '@/hooks/use-trip-planner-workflow';
import { useMaplibreSetup } from '@/hooks/use-maplibre-setup';

import { toast } from '@/lib/ui/toast';
import { fuzzySearchRoutesAsync } from '@/lib/search/search-client';
import { createThrottleGate } from '@/lib/geo/throttle';
import { getLivePositionOnce, watchLivePosition } from '@/lib/geo/watch-live-position';
import { searchLocalPlaces, type PlaceHit } from '@/lib/search/morelia-places';
import { mergeAndRankPlaces } from '@/lib/search/rank-places';
import { type Route } from '@/lib/supabase/client';

// Componentes del layout
import { MapCanvas } from '@/features/map/map-canvas';
import { AdminGateBanner } from '@/components/home/admin-gate-banner';
import { placeFavoriteKey, SearchBar } from '@/components/home/search-bar';
import { BottomDock } from '@/components/home/bottom-dock';
import { ResultsSheet } from '@/components/home/results-sheet';
import { SelectedRouteCard } from '@/components/home/selected-route-card';
import { OfflineBanner } from '@/components/home/offline-banner';
import { LegalLinks } from '@/components/home/legal-links';
import {
  LegalInfoSheet,
  type LegalTab,
} from '@/components/home/legal-info-sheet';
import { RouteExplorerList } from '@/components/home/route-explorer-list';
import { SkipLink } from '@/components/ui/skip-link';
import {
  buildTripShareUrl,
  shareOrCopyTripUrl,
  copyTextToClipboard,
  sortTripPlans,
  readTripUrlState,
  fingerprintForPlan,
  primaryRouteIdFromPlan,
} from '@/features/planner';
import { TripResultsPanel } from '@/components/home/trip-results-panel';
import { type Coordinate, type TripPlan } from '@/lib/routing/planner';
import type { RouteDirection } from '@/lib/gis/direction-mode';

const ReportRouteDialog = dynamic(() => import('@/components/home/report-route-dialog').then((m) => m.ReportRouteDialog), {
  ssr: false,
});

type PanelMode = 'search' | 'results' | 'favorites' | 'routes';

export default function HomeApp() {
  // 1. Favoritos / recientes solo en este dispositivo (sin cuentas)
  const userAccount = useUserAccount();
  const {
    favorites,
    favoriteLocations,
    recentPlaces,
    recentRoutes,
    homePlace,
    workPlace,
    toggleFavorite,
    toggleLocationFavorite,
    addRecentPlace,
    addRecentRoute,
  } = userAccount;

  // 2. Lógica del Planificador de Viajes y TanStack Query
  const planner = useTripPlannerWorkflow(favorites);
  const {
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
    routes,
    shapesLoading,
    planning,
    tripPlans,
    setTripPlans,
    selectedPlanIndex,
    setSelectedPlanIndex,
    planningError,
    setPlanningError,
    planTypeFilter,
    setPlanTypeFilter,
    planSort,
    setPlanSort,
    geometriesLoading,
    geocodeDegraded,
    shapesRef,
    swapOriginDestination,
  } = planner;

  // 3. Estados de UI locales
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [routeQuery, setRouteQuery] = useState('');
  const [routeDirection, setRouteDirection] = useState<'both' | RouteDirection>('both');
  const [transportFilter, setTransportFilter] = useState<'all' | 'autobus' | 'combi'>('all');

  const [panel, setPanel] = useState<PanelMode>('results');
  const [resultsOpen, setResultsOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<LegalTab>('privacidad');
  const [showWelcome, setShowWelcome] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [locating, setLocating] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Modo Pin Drop (Selección Manual en el Mapa)
  const [pinDropMode, setPinDropMode] = useState<'origin' | 'destination' | null>(null);

  // GPS en vivo + "Seguir mi viaje"
  const [activeTrackingIndex, setActiveTrackingIndex] = useState<number | null>(null);
  const [liveUserCoords, setLiveUserCoords] = useState<Coordinate | null>(null);
  /** true = watch continuo activo (botón GPS o seguimiento de viaje) */
  const [gpsLiveActive, setGpsLiveActive] = useState(false);
  const stopLiveWatchRef = useRef<(() => void) | null>(null);
  const trackingPlanIdxRef = useRef<number | null>(null);
  const tripPlansRef = useRef(tripPlans);
  tripPlansRef.current = tripPlans;
  const followCameraRef = useRef(false);
  const syncOriginFromGpsRef = useRef(false);
  /** Marker / estado: aceptar casi todos los ticks */
  const markerThrottleRef = useRef(createThrottleGate(400, 2));
  /** Cámara: menos frecuente para no marear */
  const cameraThrottleRef = useRef(createThrottleGate(1200, 8));
  const alertedNearAlightRef = useRef(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Claves de direcciones favoritas (localStorage → UI corazón). */
  const favoriteLocationKeys = useMemo(() => {
    const set = new Set<string>();
    for (const loc of favoriteLocations) {
      set.add(placeFavoriteKey(loc.name, loc.coordinates));
    }
    return set;
  }, [favoriteLocations]);

  // 4. Hook para la configuración y control de MapLibre
  const mapSetup = useMaplibreSetup({
    originCoords,
    destinationCoords,
    liveUserCoords,
    selectedRouteId,
    setSelectedRouteId,
    tripPlans,
    selectedPlanIndex,
    routes,
    routeDirection,
    setRouteDirection,
    activeSearchField,
    pinDropMode,
    shapesRef,
    onMapClick: useCallback((coords) => {
      if (activeSearchField === 'origin') {
        setOriginCoords(coords);
        setOriginInput(`${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`);
        toast('Origen fijado en el mapa', 'success');
        setActiveSearchField(null);
        setSuggestions([]);
        setSearchExpanded(false);
      } else if (activeSearchField === 'destination') {
        setDestinationCoords(coords);
        setDestinationInput(`${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`);
        toast('Destino fijado en el mapa', 'success');
        setActiveSearchField(null);
        setSuggestions([]);
        setSearchExpanded(false);
      } else {
        setResultsOpen(false);
        setSearchExpanded(false);
      }
    }, [activeSearchField, setOriginCoords, setDestinationCoords, setOriginInput, setDestinationInput, setActiveSearchField, setSuggestions, setSearchExpanded]),
  });

  const { mapRef, styleLoaded, zoomBy, clearMap, handleMapReady } = mapSetup;

  // Montaje e hidratación
  useEffect(() => {
    setHasMounted(true);
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => {
      setIsDesktop(mq.matches);
      if (!mq.matches) setSearchExpanded(false);
    };
    apply();
    mq.addEventListener('change', apply);

    try {
      if (!sessionStorage.getItem('vm-welcome-seen')) {
        setShowWelcome(true);
      }
    } catch {
      setShowWelcome(true);
    }
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Geolocalización automática al cargar el mapa
  useEffect(() => {
    if (!styleLoaded) return;
    
    // Si el usuario abrió un enlace compartido (tiene origen, destino o ruta), no autolocalizar
    try {
      const trip = readTripUrlState();
      if (trip.origin || trip.destination || trip.routeId) {
        return;
      }
    } catch {
      // Ignorar errores de parseo
    }

    if (planner.sharedTripOpenRef.current) return;

    setLocating(true);
    void getLivePositionOnce({ enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 })
      .then((pos) => {
        if (planner.sharedTripOpenRef.current) {
          setLocating(false);
          return;
        }
        setLiveUserCoords(pos.coords);
        setOriginCoords(pos.coords);
        setOriginInput('Mi ubicación');
        setLocating(false);
        mapRef.current?.flyTo({ center: pos.coords, zoom: 15, essential: true });
        toast('Ubicación obtenida', 'success', 'ViaMorelia');
      })
      .catch(() => {
        setLocating(false);
      });
  }, [styleLoaded, setOriginCoords, setOriginInput]);

  // Autocompletado y catalogación de búsqueda
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
        recentPlaces.slice(0, 4).forEach((p) => {
          if (!quick.some((x) => x.id === p.id)) {
            quick.push({
              id: p.id,
              name: p.name,
              description: p.description || 'Reciente',
              category: 'recent',
              coordinates: p.coordinates,
              source: 'favorite',
            });
          }
        });
        favoriteLocations.slice(0, 4).forEach((f) => {
          if (!quick.some((x) => x.id === f.id)) {
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
        });
        setSuggestions(quick);
        setSearchLoading(false);
        return;
      }

      setSearchLoading(true);
      const local = searchLocalPlaces(q, 15);
      const favHits = favoriteLocations
        .filter((f) => f.name.toLowerCase().includes(q.toLowerCase()))
        .map((f) => ({
          id: f.id,
          name: f.name,
          description: f.description || 'Favorito',
          category: 'favorite' as const,
          coordinates: f.coordinates,
          source: 'favorite' as const,
          isFavorite: true,
        }));

      setSuggestions(mergeAndRankPlaces([favHits, local], q, 15));

      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          const remote = (data.results ?? []).map((r: PlaceHit) => ({
            ...r,
            source: 'geocode' as const,
          }));
          setSuggestions(mergeAndRankPlaces([favHits, local, remote], q, 18));
        }
      } catch {
        /* ignore degraded geocoding */
      } finally {
        setSearchLoading(false);
      }
    },
    [favoriteLocations, homePlace, workPlace, recentPlaces]
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
    searchTimerRef.current = setTimeout(() => void runSearch(val), 200);
  };

  const selectSuggestion = (place: PlaceHit) => {
    if (activeSearchField === 'origin') {
      setOriginInput(place.name);
      setOriginCoords(place.coordinates);
    } else if (activeSearchField === 'destination') {
      setDestinationInput(place.name);
      setDestinationCoords(place.coordinates);
    }
    addRecentPlace(place);
    setSuggestions([]);
    setActiveSearchField(null);
    setSearchExpanded(false);
    
    // Blur teclado
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    requestAnimationFrame(() => {
      mapRef.current?.flyTo({ center: place.coordinates, zoom: 15, essential: true });
    });
  };

  const stopLiveGpsWatch = useCallback((opts?: { clearMarker?: boolean }) => {
    stopLiveWatchRef.current?.();
    stopLiveWatchRef.current = null;
    trackingPlanIdxRef.current = null;
    followCameraRef.current = false;
    syncOriginFromGpsRef.current = false;
    setGpsLiveActive(false);
    setActiveTrackingIndex(null);
    if (opts?.clearMarker) setLiveUserCoords(null);
  }, []);

  /**
   * Watch continuo: actualiza punto azul sin recargar.
   * - followCamera: centra el mapa al moverse
   * - syncOrigin: rellena origen = mi ubicación
   * - planIdx: alertas de bajada ("Seguir mi viaje")
   */
  const startLiveGpsWatch = useCallback(
    (opts: {
      followCamera?: boolean;
      syncOrigin?: boolean;
      planIdx?: number | null;
      toastOnStart?: string;
    }) => {
      stopLiveWatchRef.current?.();
      stopLiveWatchRef.current = null;

      followCameraRef.current = opts.followCamera ?? true;
      syncOriginFromGpsRef.current = opts.syncOrigin ?? false;
      trackingPlanIdxRef.current = opts.planIdx ?? null;
      markerThrottleRef.current.reset();
      cameraThrottleRef.current.reset();
      alertedNearAlightRef.current = false;

      if (opts.planIdx != null) setActiveTrackingIndex(opts.planIdx);
      setGpsLiveActive(true);

      if (opts.toastOnStart) toast(opts.toastOnStart, 'success', 'ViaMorelia');

      stopLiveWatchRef.current = watchLivePosition(
        (pos) => {
          const userCoords = pos.coords;

          // Marcador en vivo: casi cada tick útil
          if (markerThrottleRef.current.shouldAccept(userCoords)) {
            setLiveUserCoords(userCoords);
            if (syncOriginFromGpsRef.current) {
              setOriginCoords(userCoords);
              setOriginInput('Mi ubicación');
            }
          } else {
            // Aun con throttle de distancia, mueve el punto si hay lectura nueva (suaviza UI)
            setLiveUserCoords(userCoords);
          }

          if (followCameraRef.current && cameraThrottleRef.current.shouldAccept(userCoords)) {
            const map = mapRef.current;
            if (map) {
              map.easeTo({
                center: userCoords,
                duration: 500,
                essential: true,
              });
            }
          }

          const planIdx = trackingPlanIdxRef.current;
          if (planIdx == null || alertedNearAlightRef.current) return;
          const plan = tripPlansRef.current[planIdx];
          const destCoords = plan?.alightingPoint;
          if (!destCoords) return;

          const dLng =
            (userCoords[0] - destCoords[0]) *
            111320 *
            Math.cos((destCoords[1] * Math.PI) / 180);
          const dLat = (userCoords[1] - destCoords[1]) * 110540;
          const distanceMeters = Math.hypot(dLng, dLat);

          if (distanceMeters < 150) {
            alertedNearAlightRef.current = true;
            toast(
              '¡Llegando! Estás a menos de 150m del punto de bajada. ¡Prepárate para bajar!',
              'warning',
              'ViaMorelia'
            );
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate([200, 100, 200, 100, 200]);
            }
            // Mantener GPS en vivo; solo termina el “seguir viaje”
            trackingPlanIdxRef.current = null;
            setActiveTrackingIndex(null);
            toast('Seguimiento de bajada completado. El GPS en vivo sigue activo.', 'info');
          }
        },
        (message, code) => {
          console.warn('[gps] watch error:', message, code);
          if (code === 1) {
            toast('Permiso de ubicación denegado. Actívalo en Ajustes.', 'error');
            stopLiveGpsWatch();
          } else if (code === 2) {
            toast('Ubicación no disponible. Revisa el GPS del dispositivo.', 'warning');
          }
          // code 3 timeout: el watch sigue intentando
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 }
      );
    },
    [setOriginCoords, setOriginInput, stopLiveGpsWatch, mapRef]
  );

  // Geolocalización a petición: primer fix + watch continuo (sin recargar)
  const requestLocation = useCallback(() => {
    setLocating(true);
    void getLivePositionOnce({ enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 })
      .then((pos) => {
        setLiveUserCoords(pos.coords);
        setOriginCoords(pos.coords);
        setOriginInput('Mi ubicación');
        setLocating(false);
        mapRef.current?.flyTo({ center: pos.coords, zoom: 16, essential: true });
        toast('Ubicación actualizada — seguimiento en vivo activo', 'success');
        startLiveGpsWatch({
          followCamera: true,
          syncOrigin: true,
          planIdx: trackingPlanIdxRef.current,
        });
      })
      .catch((err: Error) => {
        setLocating(false);
        toast(err.message || 'No se pudo obtener ubicación precisa', 'error');
      });
  }, [mapRef, setOriginCoords, setOriginInput, startLiveGpsWatch]);

  const startTracking = (idx: number) => {
    const plan = tripPlans[idx];
    if (!plan || !plan.alightingPoint) {
      toast('No hay punto de bajada en este plan', 'warning');
      return;
    }
    startLiveGpsWatch({
      followCamera: true,
      syncOrigin: false,
      planIdx: idx,
      toastOnStart: 'Seguimiento GPS activado. Te avisaremos antes de bajar.',
    });
  };

  const stopTracking = () => {
    // Si solo era seguimiento de viaje, apagar todo el watch
    stopLiveGpsWatch({ clearMarker: false });
    toast('Seguimiento GPS desactivado.', 'info');
  };

  const toggleTracking = (idx: number) => {
    if (activeTrackingIndex === idx) stopTracking();
    else startTracking(idx);
  };

  useEffect(() => {
    return () => {
      stopLiveWatchRef.current?.();
      stopLiveWatchRef.current = null;
    };
  }, []);

  const buildCurrentTripSharePath = () => {
    const plan = tripPlans[selectedPlanIndex];
    const fp = plan ? fingerprintForPlan(plan) : null;
    const rid = plan ? primaryRouteIdFromPlan(plan) : null;
    return buildTripShareUrl({
      origin: originCoords,
      destination: destinationCoords,
      originLabel: originInput || null,
      destinationLabel: destinationInput || null,
      planIndex: selectedPlanIndex,
      routeId: rid,
      routesFingerprint: fp,
    });
  };

  const handleShareTrip = async () => {
    if (!originCoords || !destinationCoords) {
      toast('Elige origen y destino para compartir', 'warning');
      return;
    }
    const path = buildCurrentTripSharePath();
    const result = await shareOrCopyTripUrl(path);
    if (result === 'shared') toast('Listo para compartir', 'success');
    else if (result === 'copied') toast('Enlace copiado', 'success');
  };

  const handleCopyTripLink = async () => {
    if (!originCoords || !destinationCoords) {
      toast('Elige origen y destino para copiar', 'warning');
      return;
    }
    const path = buildCurrentTripSharePath();
    const absolute = `${window.location.origin}${path}`;
    const ok = await copyTextToClipboard(absolute);
    toast(ok ? 'Enlace del viaje copiado' : 'No se pudo copiar', ok ? 'success' : 'error');
  };

  const clearFullMap = () => {
    setOriginInput('');
    setDestinationInput('');
    setOriginCoords(null);
    setDestinationCoords(null);
    setActiveSearchField(null);
    setSuggestions([]);
    setTripPlans([]);
    setSelectedPlanIndex(0);
    setPlanningError(null);
    setRouteQuery('');
    stopLiveGpsWatch({ clearMarker: true });
    clearMap();
    toast('Mapa limpio. Comienza de nuevo.', 'info');
  };

  const dismissWelcome = useCallback(() => {
    setShowWelcome(false);
    try {
      sessionStorage.setItem('vm-welcome-seen', '1');
    } catch {}
  }, []);

  const viewRouteOnMap = useCallback(
    (route: Route) => {
      setSelectedRouteId(route.id);
      setTripPlans([]);
      setRouteDirection('both');
      addRecentRoute({ id: route.id, name: route.name, color: route.color });
      setRouteQuery('');
      setResultsOpen(false);
      setSearchExpanded(false);
      toast(`Ruta en el mapa: ${route.name}`, 'info');
    },
    [addRecentRoute]
  );

  const closeResultsPanel = useCallback(() => {
    setResultsOpen(false);
    setSearchExpanded(false);
  }, []);

  const openResultsPanel = useCallback(
    (p?: PanelMode) => {
      if (p) setPanel(p);
      setResultsOpen(true);
    },
    []
  );

  const [filteredRoutes, setFilteredRoutes] = useState<Route[]>([]);

  // Búsqueda de rutas en Web Worker (no bloquea el hilo al escribir)
  useEffect(() => {
    let cancelled = false;
    const byTransport = routes.filter((r) => {
      if (transportFilter === 'all') return true;
      return (r.transport_type === 'combi' ? 'combi' : 'autobus') === transportFilter;
    });
    if (!routeQuery.trim()) {
      setFilteredRoutes(byTransport);
      return;
    }
    void fuzzySearchRoutesAsync(byTransport, routeQuery).then((hits) => {
      if (!cancelled) setFilteredRoutes(hits);
    });
    return () => {
      cancelled = true;
    };
  }, [routes, routeQuery, transportFilter]);

  const favRoutes = routes.filter((r) => favorites.includes(r.id));
  const hasMapContent = Boolean(
    selectedRouteId || tripPlans.length > 0 || originCoords || destinationCoords
  );

  // Escape para cerrar paneles
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (reportOpen) setReportOpen(false);
      else if (resultsOpen) closeResultsPanel();
      else if (searchExpanded) setSearchExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resultsOpen, searchExpanded, reportOpen, closeResultsPanel]);

  const renderResultsList = () => {
    const filteredPlans = sortTripPlans(tripPlans, planSort)
      .map((plan: TripPlan) => ({ plan, idx: tripPlans.indexOf(plan) }))
      .filter(({ plan, idx }: { plan: TripPlan; idx: number }) => {
        if (idx < 0) return false;
        if (planTypeFilter === 'all') return true;
        return plan.type === planTypeFilter;
      });

    const directCount = tripPlans.filter((p) => p.type === 'direct').length;
    const transferCountPlans = tripPlans.filter((p) => p.type === 'transfer').length;

    return (
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
        activeTrackingIndex={activeTrackingIndex}
        onToggleTracking={toggleTracking}
        onSelectPlan={(idx) => {
          setSelectedPlanIndex(idx);
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
        onShare={handleShareTrip}
        onCopyLink={handleCopyTripLink}
      />
    );
  };

  const renderFavorites = () => (
    <div className="flex flex-col gap-2.5 p-3 md:gap-2.5 md:p-3">
      <p className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] leading-snug text-slate-600">
        Tus favoritos se guardan <strong>solo en este dispositivo</strong> (sin cuenta).
      </p>
      <div>
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Ubicaciones favoritas
        </p>
        {favoriteLocations.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-2.5 text-center text-[11px] text-slate-400">
            Marca el corazón al buscar una dirección.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {favoriteLocations.map((loc) => (
              <div key={loc.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-2">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left cursor-pointer"
                  onClick={() => {
                    setDestinationInput(loc.name);
                    setDestinationCoords(loc.coordinates);
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
                  onClick={() => void toggleLocationFavorite(loc)}
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
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-2.5 text-center text-[11px] text-slate-400">
            Explora rutas y marca el corazón.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {favRoutes.map((route) => (
              <button
                key={route.id}
                type="button"
                onClick={() => viewRouteOnMap(route)}
                className="flex min-h-10 items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2 text-left transition hover:bg-slate-50 cursor-pointer"
              >
                <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-white shadow" style={{ backgroundColor: route.color }} />
                <span className="flex-1 text-sm font-semibold text-slate-800">{route.name}</span>
                <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
              </button>
            ))}
          </div>
        )}
      </div>
      <LegalLinks
        className="mt-2 border-t border-slate-100 pt-3"
        onOpenPrivacidad={() => {
          setLegalTab('privacidad');
          setLegalOpen(true);
        }}
        onOpenTerminos={() => {
          setLegalTab('terminos');
          setLegalOpen(true);
        }}
      />
    </div>
  );

  return (
    <div className="vm-app-shell bg-[var(--background)] font-sans relative">
      <SkipLink href="#search-panel" label="Saltar a búsqueda" />
      
      {/* Mapa Base */}
      <MapCanvas
        onReady={handleMapReady}
        onMapClick={() => {}}
        onLoadState={() => {}}
      />

      {/* Mira central flotante de Pin Drop */}
      {pinDropMode && (
        <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center">
          <div className="relative flex flex-col items-center justify-center">
            {/* Marcador superior rebotante */}
            <div
              className={`h-7 w-7 rounded-full border-2 border-white shadow-xl animate-bounce flex items-center justify-center ${
                pinDropMode === 'origin' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{ transform: 'translateY(-14px)' }}
            >
              <MapPin className="h-4 w-4 text-white" />
            </div>
            {/* Mira física en pantalla */}
            <div className="h-0.5 w-8 bg-slate-800/80 rounded" />
            <div className="h-8 w-0.5 bg-slate-800/80 rounded absolute" />
          </div>
        </div>
      )}

      {/* Banner / Diálogo inferior de confirmación de Pin Drop */}
      {pinDropMode && (
        <div className="absolute bottom-[5.5rem] left-1/2 -translate-x-1/2 pointer-events-auto z-40 w-[min(90vw,340px)] rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl flex flex-col gap-2.5">
          <p className="text-xs font-bold text-slate-800 text-center leading-snug">
            Arrastra el mapa para alinear el {pinDropMode === 'origin' ? 'origen' : 'destino'} en el centro
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPinDropMode(null)}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                const map = mapRef.current;
                if (map) {
                  const center = map.getCenter();
                  const coords: Coordinate = [center.lng, center.lat];
                  if (pinDropMode === 'origin') {
                    setOriginCoords(coords);
                    setOriginInput(`${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`);
                    toast('Origen establecido en el mapa', 'success');
                  } else {
                    setDestinationCoords(coords);
                    setDestinationInput(`${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`);
                    toast('Destino establecido en el mapa', 'success');
                  }
                }
                setPinDropMode(null);
              }}
              className="flex-1 rounded-xl bg-slate-900 py-2 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer"
            >
              Confirmar ubicación
            </button>
          </div>
        </div>
      )}

      <main id="main-content" className="pointer-events-none absolute inset-0 z-10">
        <AdminGateBanner />
        <OfflineBanner />

        {/* Barra superior: Logo y Nombre */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-none absolute z-50 flex items-center"
          style={{
            top: 'var(--vm-safe-top)',
            left: 'max(0.5rem, var(--vm-safe-left))',
            height: 'var(--vm-top-bar-h)',
            maxWidth: 'calc(100% - 6.75rem - var(--vm-safe-right))',
          }}
        >
          <Image
            src="/brand/icono_v2.png"
            alt=""
            width={64}
            height={64}
            className="relative z-10 block h-9 w-9 shrink-0 object-contain drop-shadow-md sm:h-9 sm:w-9 md:h-10 md:w-10"
            priority
          />
          <Image
            src="/brand/nombre_v2.png"
            alt="ViaMorelia"
            width={480}
            height={100}
            className="relative z-0 ml-0.5 block h-8 w-auto max-w-[min(42vw,9rem)] object-contain object-left drop-shadow-md sm:h-8 sm:max-w-[11rem] md:h-9 md:max-w-[13rem]"
            priority
          />
        </motion.div>

        {/* Buscador */}
        <SearchBar
          searchExpanded={searchExpanded}
          originInput={originInput}
          destinationInput={destinationInput}
          originReady={Boolean(originCoords)}
          destinationReady={Boolean(destinationCoords)}
          originCoords={originCoords}
          destinationCoords={destinationCoords}
          activeSearchField={activeSearchField}
          planning={planning}
          locating={locating}
          shapesLoading={shapesLoading}
          tripPlanCount={tripPlans.length}
          suggestions={suggestions}
          searchLoading={searchLoading}
          favoriteLocationKeys={favoriteLocationKeys}
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
            setActiveSearchField(null);
            setSuggestions([]);
            if (originCoords && destinationCoords) {
              setPanel('results');
              setResultsOpen(true);
            }
          }}
          onSelectSuggestion={selectSuggestion}
          onToggleLocationFavorite={(place) => {
            void toggleLocationFavorite({
              name: place.name,
              description: place.description,
              coordinates: place.coordinates,
            });
          }}
        />

        {/* Favoritos (este dispositivo) — arriba a la derecha */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="pointer-events-auto absolute z-50 flex items-center gap-1.5"
          style={{
            top: 'calc(var(--vm-safe-top) + 0.35rem)',
            right: 'max(0.5rem, var(--vm-safe-right))',
          }}
        >
          <button
            type="button"
            onClick={() => {
              setLegalTab('privacidad');
              setLegalOpen(true);
            }}
            className="vm-btn-icon md:!h-11 md:!w-11 md:!rounded-xl pointer-events-auto"
            title="Privacidad y términos"
            aria-label="Privacidad y términos"
          >
            <Info className="h-5 w-5 text-slate-600 md:h-5 md:w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => {
              setPanel('favorites');
              setResultsOpen(true);
            }}
            className="vm-btn-icon md:!h-11 md:!w-11 md:!rounded-xl"
            title="Favoritos en este dispositivo"
            aria-label="Favoritos"
          >
            <Heart
              className={`h-5 w-5 md:h-5 md:w-5 ${
                hasMounted && (favorites.length || favoriteLocations.length)
                  ? 'fill-rose-500 text-rose-500'
                  : 'text-slate-600'
              }`}
            />
          </button>
        </motion.div>

        {/* Controles del Mapa (Zoom y Pin Drop - Lateral Izquierdo) */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="pointer-events-auto absolute z-20 flex flex-col gap-1.5"
          style={{
            left: 'max(0.5rem, var(--vm-safe-left))',
            top: 'min(42vh, 22rem)',
          }}
        >
        
          <button
            type="button"
            onClick={() => zoomBy(1)}
            className="vm-btn-icon !h-10 !w-10 !rounded-xl md:!h-11 md:!w-11 md:!rounded-xl"
            title="Acercar"
          >
            <Plus className="h-5 w-5 md:h-5 md:w-5 text-slate-700" />
          </button>
          <button
            type="button"
            onClick={() => zoomBy(-1)}
            className="vm-btn-icon !h-10 !w-10 !rounded-xl md:!h-11 md:!w-11 md:!rounded-xl"
            title="Alejar"
          >
            <Minus className="h-5 w-5 md:h-5 md:w-5 text-slate-700" />
          </button>
          
          {/* Botones de Pin Drop Origen y Destino */}
          <button
            type="button"
            onClick={() => setPinDropMode(pinDropMode === 'origin' ? null : 'origin')}
            className={`vm-btn-icon !h-10 !w-10 !rounded-xl border-2 md:!h-11 md:!w-11 md:!rounded-xl ${
              pinDropMode === 'origin' ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'
            }`}
            title="Fijar origen en el centro del mapa"
          >
            <MapPin className={`h-5 w-5 md:h-5 md:w-5 ${pinDropMode === 'origin' ? 'text-emerald-600' : 'text-emerald-700'}`} />
          </button>
          <button
            type="button"
            onClick={() => setPinDropMode(pinDropMode === 'destination' ? null : 'destination')}
            className={`vm-btn-icon !h-10 !w-10 !rounded-xl border-2 md:!h-11 md:!w-11 md:!rounded-xl ${
              pinDropMode === 'destination' ? 'border-rose-600 bg-rose-50' : 'border-slate-200'
            }`}
            title="Fijar destino en el centro del mapa"
          >
            <Navigation className={`h-5 w-5 md:h-5 md:w-5 ${pinDropMode === 'destination' ? 'text-rose-600' : 'text-rose-700'}`} />
          </button>
        </motion.div>

        {/* Tarjeta Flotante de Ruta Seleccionada */}
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
                bottom: 'calc(var(--vm-dock-clearance, 4.75rem) + var(--vm-safe-bottom))',
              }}
            >
              {(() => {
                const r = routes.find((x) => x.id === selectedRouteId);
                if (!r) return null;
                return (
                  <SelectedRouteCard
                    route={r}
                    routeDirection={routeDirection}
                    onDirectionChange={setRouteDirection}
                    onRemove={() => {
                      setSelectedRouteId(null);
                      setRouteDirection('both');
                      clearMap();
                    }}
                    onShare={() => {
                      void (async () => {
                        const title = `ViaMorelia — ${r.name}`;
                        if (originCoords && destinationCoords) {
                          await handleShareTrip();
                          return;
                        }
                        const path = buildTripShareUrl({ routeId: selectedRouteId });
                        const result = await shareOrCopyTripUrl(path, title);
                        if (result === 'shared') toast('Listo para compartir', 'success');
                        else if (result === 'copied') toast('Enlace copiado', 'success');
                      })();
                    }}
                    onDetails={() => openResultsPanel('routes')}
                    onReport={() => setReportOpen(true)}
                  />
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Panel de Resultados y Listas (Bottom Sheet en Móvil, Panel en Desktop) */}
        <ResultsSheet
          open={resultsOpen}
          isDesktop={isDesktop}
          panel={panel === 'search' ? 'results' : panel}
          onPanelChange={(p) => {
            setPanel(p);
          }}
          onClose={closeResultsPanel}
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
                    closeResultsPanel();
                  },
                }
              : {
                  label: 'Ver en el mapa',
                  testId: panel === 'results' ? 'view-trip-on-map' : 'view-favorites-on-map',
                  onClick: closeResultsPanel,
                }
          }
        >
          {panel === 'results' && renderResultsList()}
          {panel === 'favorites' && renderFavorites()}
          {panel === 'routes' && (
            <RouteExplorerList
              routes={routes}
              filteredRoutes={filteredRoutes}
              shapesLoading={shapesLoading}
              routeQuery={routeQuery}
              onRouteQueryChange={setRouteQuery}
              transportFilter={transportFilter}
              onTransportFilter={setTransportFilter}
              selectedRouteId={selectedRouteId}
              favorites={favorites}
              recentRoutes={recentRoutes}
              favRoutes={favRoutes}
              homePlace={homePlace}
              workPlace={workPlace}
              onToggleFavorite={toggleFavorite}
              onViewRoute={viewRouteOnMap}
              onPickHome={() => {
                if (homePlace) {
                  setDestinationInput(homePlace.name);
                  setDestinationCoords(homePlace.coordinates);
                  setPanel('results');
                }
              }}
              onPickWork={() => {
                if (workPlace) {
                  setDestinationInput(workPlace.name);
                  setDestinationCoords(workPlace.coordinates);
                  setPanel('results');
                }
              }}
            />
          )}
        </ResultsSheet>

        {/* Diálogo de Reportes */}
        <ReportRouteDialog
          open={reportOpen && Boolean(selectedRouteId)}
          routeId={selectedRouteId || ''}
          routeName={routes.find((r) => r.id === selectedRouteId)?.name || 'Ruta'}
          onClose={() => setReportOpen(false)}
        />

        {/* Legal in-app (evita página cortada en Android WebView / Browser) */}
        <LegalInfoSheet
          open={legalOpen}
          tab={legalTab}
          onTabChange={setLegalTab}
          onClose={() => setLegalOpen(false)}
        />

        {/* Dock Inferior */}
        {!resultsOpen && (
          <BottomDock
            locating={locating}
            gpsLive={gpsLiveActive}
            hasMapContent={hasMapContent}
            routeCount={routes.length}
            onPlan={() => {
              setSearchExpanded(true);
              setActiveSearchField(originCoords ? 'destination' : 'origin');
              openResultsPanel('results');
              dismissWelcome();
            }}
            onRoutes={() => {
              openResultsPanel('routes');
              dismissWelcome();
            }}
            onLocation={requestLocation}
            onClear={clearFullMap}
          />
        )}
      </main>

      {/*
        Bienvenida FUERA de #main-content, fixed al viewport.
        En tablet/WebView el absolute interno se iba a la izquierda.
      */}
      <AnimatePresence>
        {hasMounted && showWelcome && !resultsOpen && !searchExpanded && (
          <motion.div
            key="vm-welcome"
            id="vm-welcome-banner"
            role="dialog"
            aria-label="Bienvenida a ViaMorelia"
            initial={{ opacity: 0, x: '-50%', y: 20 }}
            animate={{ opacity: 1, x: '-50%', y: 0 }}
            exit={{ opacity: 0, x: '-50%', y: 12 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="vm-welcome-banner"
            style={{
              position: 'fixed',
              left: '50%',
              right: 'auto',
              marginLeft: 0,
              marginRight: 0,
              width: 'min(26rem, calc(100vw - 1.5rem))',
              maxWidth: 'calc(100vw - 1.5rem)',
              bottom:
                'calc(var(--vm-dock-clearance, 5rem) + env(safe-area-inset-bottom, 0px) + 0.5rem)',
              zIndex: 45,
            }}
          >
            <div className="vm-panel w-full rounded-2xl border p-3.5 shadow-2xl md:p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-bold text-slate-900 md:text-base">
                    Bienvenido a ViaMorelia
                  </p>
                  <p className="mt-0.5 text-[12px] font-medium leading-snug text-slate-600 md:text-sm">
                    Consulta rutas y planifica viajes. Elige cómo empezar:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={dismissWelcome}
                  className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer"
                  aria-label="Cerrar bienvenida"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearchExpanded(true);
                    setActiveSearchField(originCoords ? 'destination' : 'origin');
                    openResultsPanel('results');
                    dismissWelcome();
                  }}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-left text-xs font-bold text-white cursor-pointer hover:bg-emerald-700 md:px-3.5 md:py-3 md:text-sm"
                >
                  <Navigation className="h-4 w-4 shrink-0 animate-pulse md:h-5 md:w-5" />
                  <span>
                    Planear un viaje
                    <span className="mt-0.5 block text-[10px] font-medium text-emerald-100 md:text-[11px]">
                      Ingresa origen → destino para saber qué combi tomar
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openResultsPanel('routes');
                    dismissWelcome();
                  }}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-bold text-slate-800 cursor-pointer hover:bg-slate-50 md:px-3.5 md:py-3 md:text-sm"
                >
                  <List className="h-4 w-4 shrink-0 text-slate-600 md:h-5 md:w-5" />
                  <span>
                    Explorar rutas
                    <span className="mt-0.5 block text-[10px] font-medium text-slate-500 md:text-[11px]">
                      Ver el recorrido completo de cualquier ruta
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
