'use client';

import React, { useEffect, useState, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { motion, AnimatePresence } from 'motion/react';
import { mockSupabaseClient, mockDb, Route, Place } from '../lib/supabase/client';
import { planTrip, Coordinate, TripPlan } from '../lib/routing/planner';
import { initMoreliaMap, destroyMoreliaMap } from '@/lib/map/init-map';
import { ROUTES_SOURCE_ID } from '@/lib/map/route-layers';
import { toast } from '@/lib/ui/toast';
import {
  normalizeTransportType,
  transportBadgeClass,
  type TransportFilter,
} from '@/lib/transport/classify';

export default function Home() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Record<string, maplibregl.Marker>>({});

  // Auth State
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Search State
  const [originInput, setOriginInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [originCoords, setOriginCoords] = useState<Coordinate | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<Coordinate | null>(null);
  const [activeSearchField, setActiveSearchField] = useState<'origin' | 'destination' | null>(null);
  const [suggestions, setSuggestions] = useState<Place[]>([]);

  // Routes & Directions State
  const [routes, setRoutes] = useState<Route[]>([]);
  const [routeDirections, setRouteDirections] = useState<Record<string, 'ida' | 'vuelta'>>({});
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [transportFilter, setTransportFilter] = useState<TransportFilter>('all');

  // Responsive mobile state
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [styleLoaded, setStyleLoaded] = useState(false);

  // Favorites State
  const [favorites, setFavorites] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('favorite_routes');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          console.error('Failed to parse favorites from localStorage', e);
        }
      }
    }
    return [];
  });

  // Trip Planner State
  const [tripPlans, setTripPlans] = useState<TripPlan[]>([]);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState<number>(0);
  const [planningError, setPlanningError] = useState<string | null>(null);

  // Keep track of activeSearchField inside ref for map clicks
  const activeSearchFieldRef = useRef<'origin' | 'destination' | null>(null);
  useEffect(() => {
    activeSearchFieldRef.current = activeSearchField;
  }, [activeSearchField]);

  // Sync session and initial data
  useEffect(() => {
    // Check initial session
    mockSupabaseClient.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({ id: data.user.id, email: data.user.email || '' });
      }
    });

    const { data: { subscription } } = mockSupabaseClient.auth.onAuthStateChange((event, session) => {
      const sess = session as { user?: { id: string; email: string } } | null;
      if (sess?.user) {
        setUser({ id: sess.user.id, email: sess.user.email || '' });
      } else {
        setUser(null);
      }
    });

    // Catálogo público: rutas aprobadas/publicadas en /routes/index.json
    const loadPublishedRoutes = async () => {
      try {
        const res = await fetch(`/routes/index.json?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          const published: Route[] = (data.routes ?? []).map(
            (r: {
              id: string;
              name: string;
              color?: string;
              transportType?: string;
            }) => {
              const kind = normalizeTransportType(r.transportType, r.id, r.name);
              return {
                id: r.id,
                name: r.name,
                description: '',
                color: r.color || '#3b82f6',
                casing_color: '#222222',
                // Canónico en UI: combi | foraneo (autobus se muestra vía normalize)
                transport_type: kind === 'autobus' ? 'foraneo' : 'combi',
                status: 'approved' as const,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
            }
          );
          if (published.length > 0) {
            setRoutes(published);
            const dirs: Record<string, 'ida' | 'vuelta'> = {};
            published.forEach((r) => {
              dirs[r.id] = 'ida';
            });
            setRouteDirections(dirs);
            return;
          }
        }
      } catch (e) {
        console.warn('No se pudo cargar /routes/index.json, usando mock', e);
      }

      // Fallback: mock Supabase
      const { data } = await mockSupabaseClient.from('routes').select();
      if (data) {
        const approved = (data as Route[]).filter((r) => r.status === 'approved');
        setRoutes(approved.length > 0 ? approved : (data as Route[]));
        const dirs: Record<string, 'ida' | 'vuelta'> = {};
        (data as Route[]).forEach((r) => {
          dirs[r.id] = 'ida';
        });
        setRouteDirections(dirs);
      }
    };

    loadPublishedRoutes();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sync favorites back to localStorage and DB (if logged in)
  const toggleFavorite = async (routeId: string) => {
    let newFavs: string[] = [];
    if (favorites.includes(routeId)) {
      newFavs = favorites.filter((id) => id !== routeId);
      if (user) {
        await mockSupabaseClient
          .from('favorite_routes')
          .delete()
          .eq('user_id', user.id)
          .eq('route_id', routeId);
      }
    } else {
      newFavs = [...favorites, routeId];
      if (user) {
        await mockSupabaseClient
          .from('favorite_routes')
          .insert({ user_id: user.id, route_id: routeId });
      }
    }
    setFavorites(newFavs);
    localStorage.setItem('favorite_routes', JSON.stringify(newFavs));
    const route = routes.find((r) => r.id === routeId);
    if (newFavs.includes(routeId)) {
      toast(`"${route?.name ?? 'Ruta'}" agregada a favoritos`, 'success');
    } else {
      toast(`"${route?.name ?? 'Ruta'}" quitada de favoritos`, 'info');
    }
  };

  // Toggle route direction
  const toggleDirection = (routeId: string) => {
    setRouteDirections((prev) => ({
      ...prev,
      [routeId]: prev[routeId] === 'ida' ? 'vuelta' : 'ida',
    }));
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    const { data, error } = await mockSupabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setAuthError(error.message);
      toast(error.message, 'error', 'Inicio de sesión');
    } else if (data?.user) {
      setUser({ id: data.user.id, email: data.user.email || '' });
      toast('Sesión iniciada correctamente', 'success');
      // Fetch favorites from database for this user
      const { data: dbFavs } = await mockSupabaseClient
        .from('favorite_routes')
        .select('*')
        .eq('user_id', data.user.id);
      if (dbFavs) {
        const favIds = (dbFavs as { route_id: string }[]).map((f) => f.route_id);
        const combined = Array.from(new Set([...favorites, ...favIds]));
        setFavorites(combined);
        localStorage.setItem('favorite_routes', JSON.stringify(combined));
      }
    }
  };

  // Handle Google Login
  const handleGoogleLogin = async () => {
    setAuthError(null);
    const { error } = await mockSupabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
      },
    });
    if (error) {
      setAuthError(error.message);
      toast(error.message, 'error', 'Google');
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    await mockSupabaseClient.auth.signOut();
    setUser(null);
    setEmail('');
    setPassword('');
    toast('Sesión cerrada', 'info');
  };

  // Handle Search Input Change
  const handleSearchChange = (field: 'origin' | 'destination', val: string) => {
    if (field === 'origin') {
      setOriginInput(val);
      if (!val.trim()) setOriginCoords(null);
    } else {
      setDestinationInput(val);
      if (!val.trim()) setDestinationCoords(null);
    }
    setActiveSearchField(field);

    if (!val.trim()) {
      setSuggestions([]);
      return;
    }

    // Filter places using fuzzy search logic (case-insensitive substring)
    const matchingPlaces = mockDb.places.filter(
      (p) =>
        p.name.toLowerCase().includes(val.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(val.toLowerCase())
    );
    setSuggestions(matchingPlaces);
  };

  // Select Suggestion
  const selectSuggestion = (place: Place) => {
    if (activeSearchField === 'origin') {
      setOriginInput(place.name);
      setOriginCoords(place.geom.coordinates);
    } else if (activeSearchField === 'destination') {
      setDestinationInput(place.name);
      setDestinationCoords(place.geom.coordinates);
    }
    setSuggestions([]);
    setActiveSearchField(null);
    toast(`Ubicación: ${place.name}`, 'info');
  };

  // Run Planner
  useEffect(() => {
    if (originCoords && destinationCoords) {
      Promise.resolve().then(() => setPlanningError(null));
      planTrip(originCoords, destinationCoords)
        .then((plans) => {
          setTripPlans(plans);
          setSelectedPlanIndex(0);
          setSelectedRouteId(null); // Clear selected route exploration when plans are ready
          if (plans.length === 0) {
            const msg = 'No se encontraron rutas para esta combinación de origen y destino.';
            setPlanningError(msg);
            toast(msg, 'warning', 'Sin resultados');
          } else {
            toast(
              `${plans.length} plan${plans.length > 1 ? 'es' : ''} encontrado${plans.length > 1 ? 's' : ''}`,
              'success',
              'Plan de viaje'
            );
          }
        })
        .catch((err) => {
          const msg = 'Error al calcular el plan de viaje.';
          setPlanningError(msg);
          toast(msg, 'error');
          console.error(err);
        });
    } else {
      Promise.resolve().then(() => {
        setTripPlans([]);
        setSelectedPlanIndex(0);
      });
    }
  }, [originCoords, destinationCoords]);

  // Initialize MapLibre (basemap mejorado + capas compartidas)
  useEffect(() => {
    if (!mapContainerRef.current) return;

    let map: maplibregl.Map | null = null;

    try {
      map = initMoreliaMap({
        container: mapContainerRef.current,
        includeWalkLayers: true,
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
          setOriginInput(`${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`);
          toast('Origen ubicado en el mapa', 'success');
        } else if (field === 'destination') {
          setDestinationCoords(coords);
          setDestinationInput(`${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`);
          toast('Destino ubicado en el mapa', 'success');
        }
        setActiveSearchField(null);
      });
    } catch (e) {
      console.warn('MapLibre GL JS not fully supported in this environment.', e);
    }

    return () => {
      destroyMoreliaMap(map);
      mapRef.current = null;
      setStyleLoaded(false);
    };
  }, []);

  // helper to find index of closest coord
  const findClosestCoordinateIndex = (coords: Coordinate[], target: Coordinate): number => {
    let minDistance = Infinity;
    let index = -1;
    coords.forEach((coord, idx) => {
      const dist = Math.hypot(coord[0] - target[0], coord[1] - target[1]);
      if (dist < minDistance) {
        minDistance = dist;
        index = idx;
      }
    });
    return index;
  };

  // Render Explored Route GeoJSON
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    if (selectedRouteId) {
      fetch(`/routes/${selectedRouteId}.geojson`)
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load geojson');
          return res.json();
        })
        .then((data) => {
          const source = map.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource;
          if (source) {
            source.setData(data);
          }

          // Fit bounds to the route shape
          const allCoords: Coordinate[] = [];
          data.features.forEach((f: { geometry: { type: string; coordinates: Coordinate[] } }) => {
            if (f.geometry.type === 'LineString') {
              allCoords.push(...f.geometry.coordinates);
            }
          });

          if (allCoords.length > 0) {
            const bounds = allCoords.reduce(
              (acc, coord) => acc.extend(coord),
              new maplibregl.LngLatBounds(allCoords[0], allCoords[0])
            );
            map.fitBounds(bounds, { padding: 40, maxZoom: 15 });
          }
        })
        .catch((err) => {
          console.error('Error fetching route geojson:', err);
          toast('No se pudo cargar la ruta en el mapa', 'error');
        });
    } else if (tripPlans.length === 0) {
      // Clear route source if nothing is selected or planned
      const source = map.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource;
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: []
        });
      }
    }
  }, [selectedRouteId, styleLoaded, tripPlans]);

  // Render Selected Trip Plan Geometry
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;

    if (tripPlans.length > 0) {
      const plan = tripPlans[selectedPlanIndex];
      if (!plan) return;

      const features: { type: string; properties: Record<string, unknown>; geometry: { type: string; coordinates: Coordinate[] } }[] = [];
      
      plan.segments.forEach((seg, idx) => {
        if (seg.type === 'walk') {
          let start: Coordinate | null = null;
          let end: Coordinate | null = null;

          if (idx === 0) {
            start = originCoords;
            end = plan.boardingPoint;
          } else if (idx === plan.segments.length - 1) {
            start = plan.alightingPoint;
            end = destinationCoords;
          } else {
            // Transfer walk
            const prevSeg = plan.segments[idx - 1];
            const nextSeg = plan.segments[idx + 1];
            if (prevSeg && prevSeg.type === 'ride') {
              start = prevSeg.alightingPoint || null;
            }
            if (nextSeg && nextSeg.type === 'ride') {
              end = nextSeg.boardingPoint || null;
            }
          }

          if (start && end) {
            features.push({
              type: 'Feature',
              properties: {
                type: 'walk',
                color: '#94a3b8',
                casingColor: '#ffffff',
                name: 'Caminar'
              },
              geometry: {
                type: 'LineString',
                coordinates: [start, end]
              }
            });
          }
        } else if (seg.type === 'ride') {
          // Find shape coordinates
          const shape = mockDb.route_shapes.find(
            (s) => s.route_id === seg.routeId && s.direction === seg.direction
          );

          let coordinates = shape?.geom.coordinates || [];
          if (seg.boardingPoint && seg.alightingPoint && coordinates.length > 0) {
            const startIdx = findClosestCoordinateIndex(coordinates, seg.boardingPoint);
            const endIdx = findClosestCoordinateIndex(coordinates, seg.alightingPoint);
            
            if (startIdx !== -1 && endIdx !== -1) {
              const sliced = startIdx <= endIdx
                ? coordinates.slice(startIdx, endIdx + 1)
                : coordinates.slice(endIdx, startIdx + 1).reverse();
              
              if (sliced.length > 0) {
                coordinates = sliced;
              }
            }
          }

          if (coordinates.length > 0) {
            features.push({
              type: 'Feature',
              properties: {
                type: 'ride',
                color: seg.color || '#3b82f6',
                casingColor: '#222222',
                name: seg.direction === 'ida' ? 'Ida' : 'Vuelta'
              },
              geometry: {
                type: 'LineString',
                coordinates
              }
            });
          }
        }
      });

      const source = map.getSource(ROUTES_SOURCE_ID) as maplibregl.GeoJSONSource;
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features
        });
      }

      // Zoom to fit the entire route plan bounds
      const allCoords: Coordinate[] = [];
      features.forEach((f) => {
        allCoords.push(...f.geometry.coordinates);
      });

      if (allCoords.length > 0) {
        const bounds = allCoords.reduce(
          (acc, coord) => acc.extend(coord),
          new maplibregl.LngLatBounds(allCoords[0], allCoords[0])
        );
        map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
      }
    }
  }, [tripPlans, selectedPlanIndex, styleLoaded, originCoords, destinationCoords]);

  // Update Markers (Origin, Destination, Boarding, Alighting, Transfers)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleLoaded) return;
    
    const activePlan = tripPlans[selectedPlanIndex];
    
    // Remove existing markers
    Object.values(markersRef.current).forEach((marker) => marker.remove());
    markersRef.current = {};

    // 1. Origin Marker
    if (originCoords) {
      const el = document.createElement('div');
      el.className = 'w-8 h-8 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg font-bold text-white text-xs cursor-pointer hover:scale-110 transition-transform';
      el.innerHTML = '🟢';
      el.title = 'Origen';
      
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(originCoords)
        .addTo(map);
      markersRef.current['origin'] = marker;
    }

    // 2. Destination Marker
    if (destinationCoords) {
      const el = document.createElement('div');
      el.className = 'w-8 h-8 bg-rose-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg font-bold text-white text-xs cursor-pointer hover:scale-110 transition-transform';
      el.innerHTML = '🏁';
      el.title = 'Destino';

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(destinationCoords)
        .addTo(map);
      markersRef.current['destination'] = marker;
    }

    if (activePlan) {
      // 3. Virtual Boarding Point (suggested)
      if (activePlan.boardingPoint) {
        const el = document.createElement('div');
        el.className = 'w-8 h-8 bg-blue-600 rounded-full border-2 border-white flex items-center justify-center shadow-lg text-white text-xs cursor-pointer animate-pulse hover:scale-110 transition-transform';
        el.innerHTML = '🚶‍♂️';
        el.title = 'Punto de abordaje sugerido, no parada oficial';

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(activePlan.boardingPoint)
          .addTo(map);
        markersRef.current['boarding'] = marker;
      }

      // 4. Virtual Alighting Point (suggested)
      if (activePlan.alightingPoint) {
        const el = document.createElement('div');
        el.className = 'w-8 h-8 bg-purple-600 rounded-full border-2 border-white flex items-center justify-center shadow-lg text-white text-xs cursor-pointer animate-pulse hover:scale-110 transition-transform';
        el.innerHTML = '👋';
        el.title = 'Punto de descenso sugerido, no parada oficial';

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat(activePlan.alightingPoint)
          .addTo(map);
        markersRef.current['alighting'] = marker;
      }

      // 5. Transfer Point(s) (suggested)
      activePlan.segments.forEach((seg, idx) => {
        if (seg.type === 'walk' && idx > 0 && idx < activePlan.segments.length - 1) {
          const prevSeg = activePlan.segments[idx - 1];
          if (prevSeg.type === 'ride' && prevSeg.alightingPoint) {
            const el = document.createElement('div');
            el.className = 'w-8 h-8 bg-amber-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg text-white text-xs cursor-pointer hover:scale-110 transition-transform';
            el.innerHTML = '🔄';
            el.title = 'Punto de transbordo sugerido, no parada oficial';

            const marker = new maplibregl.Marker({ element: el })
              .setLngLat(prevSeg.alightingPoint)
              .addTo(map);
            markersRef.current[`transfer-${idx}`] = marker;
          }
        }
      });
    }
  }, [originCoords, destinationCoords, tripPlans, selectedPlanIndex, styleLoaded]);

  // Shared sidebar/content panel renderer
  const renderControlContent = () => {
    return (
      <div className="flex flex-col h-full bg-white text-slate-800">
        {/* Auth / Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          {user ? (
            <div className="flex items-center justify-between">
              <span data-testid="user-profile-header" className="font-semibold text-xs truncate">
                👤 {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-[11px] text-red-500 hover:text-red-700 font-bold transition-colors cursor-pointer"
              >
                Cerrar Sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Iniciar Sesión</span>
              <div className="flex gap-2">
                <input
                  data-testid="login-email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 rounded border border-slate-200 p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
                <input
                  data-testid="login-password"
                  type="password"
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="flex-1 rounded border border-slate-200 p-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              </div>
              <button
                data-testid="login-submit"
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded p-1.5 text-xs font-bold transition cursor-pointer"
              >
                Ingresar
              </button>
              <button
                data-testid="login-google"
                type="button"
                onClick={handleGoogleLogin}
                className="w-full border border-slate-200 hover:bg-slate-50 text-slate-700 rounded p-1.5 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 mt-1"
              >
                <svg className="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Iniciar con Google
              </button>
              {authError && <p className="text-[10px] text-red-500 mt-0.5">{authError}</p>}
            </form>
          )}
        </div>

        {/* Search Panel */}
        <div className="p-4 border-b border-slate-100 flex flex-col gap-3 relative flex-shrink-0">
          <div className="relative">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Origen</label>
              {activeSearchField === 'origin' && (
                <span className="text-[10px] text-blue-600 font-semibold animate-pulse">
                  Haz click en el mapa para ubicar...
                </span>
              )}
            </div>
            <div className="relative">
              <input
                data-testid="search-origin"
                type="text"
                placeholder="Ej: Catedral de Morelia o click en mapa"
                value={originInput}
                onChange={(e) => handleSearchChange('origin', e.target.value)}
                onFocus={() => {
                  setActiveSearchField('origin');
                  setIsMobileExpanded(true);
                }}
                className={`w-full rounded border p-2 text-sm focus:outline-none focus:ring-1 transition-all ${
                  activeSearchField === 'origin'
                    ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/20'
                    : 'border-slate-200'
                }`}
              />
              {originInput && (
                <button
                  onClick={() => {
                    setOriginInput('');
                    setOriginCoords(null);
                  }}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="relative">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Destino</label>
              {activeSearchField === 'destination' && (
                <span className="text-[10px] text-blue-600 font-semibold animate-pulse">
                  Haz click en el mapa para ubicar...
                </span>
              )}
            </div>
            <div className="relative">
              <input
                data-testid="search-destination"
                type="text"
                placeholder="Ej: Zoológico de Morelia o click en mapa"
                value={destinationInput}
                onChange={(e) => handleSearchChange('destination', e.target.value)}
                onFocus={() => {
                  setActiveSearchField('destination');
                  setIsMobileExpanded(true);
                }}
                className={`w-full rounded border p-2 text-sm focus:outline-none focus:ring-1 transition-all ${
                  activeSearchField === 'destination'
                    ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/20'
                    : 'border-slate-200'
                }`}
              />
              {destinationInput && (
                <button
                  onClick={() => {
                    setDestinationInput('');
                    setDestinationCoords(null);
                  }}
                  className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Autocomplete Dropdown */}
          {suggestions.length > 0 && activeSearchField && (
            <div
              data-testid="search-autocomplete"
              className="absolute left-4 right-4 top-[calc(100%-4px)] z-[60] mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-2xl"
            >
              {suggestions.map((place) => (
                <button
                  key={place.id}
                  onClick={() => selectSuggestion(place)}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors flex flex-col cursor-pointer border-b border-slate-50 last:border-b-0"
                >
                  <span className="font-semibold text-slate-700">{place.name}</span>
                  {place.description && <span className="text-xs text-slate-400">{place.description}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main Content Area (Plans & Routes) */}
        <div className="flex-1 overflow-y-auto min-h-0 divide-y divide-slate-100">
          {/* Trip Planner Results */}
          <div className="p-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-3">Planes de Viaje</span>
            
            <div data-testid="trip-planner-results" className="flex flex-col gap-3">
              {planningError && <p className="text-xs text-rose-500 font-medium bg-rose-50 p-2.5 rounded-lg">{planningError}</p>}
              
              {tripPlans.length > 0 ? (
                tripPlans.map((plan, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedPlanIndex(idx)}
                    className={`border rounded-xl p-3 cursor-pointer transition-all ${
                      selectedPlanIndex === idx
                        ? 'border-blue-500 bg-blue-50/40 shadow-sm ring-1 ring-blue-500/20'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1">
                        {plan.type === 'direct' ? '🚌 Directo' : '🔄 Con Transbordo'}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {Math.round(plan.totalDuration / 60)} min | {(plan.totalDistance / 1000).toFixed(1)} km
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-2 relative pl-1">
                      {plan.segments.map((seg, sIdx) => (
                        <div key={sIdx} className="flex gap-2 text-xs">
                          <div className="flex flex-col items-center shrink-0">
                            <div className={`w-2.5 h-2.5 rounded-full border border-white flex-shrink-0 ${
                              seg.type === 'walk' ? 'bg-slate-400' : 'bg-blue-600'
                            }`}></div>
                            {sIdx < plan.segments.length - 1 && <div className="w-0.5 h-full min-h-[16px] bg-slate-200 my-0.5"></div>}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-slate-700 leading-tight">{seg.instruction}</p>
                            {seg.type === 'ride' && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span
                                  className="w-3 h-3 rounded-full inline-block border border-white shadow-sm shrink-0"
                                  style={{ backgroundColor: seg.color }}
                                ></span>
                                <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">{seg.routeName}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="text-[9px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2 mt-3 font-medium leading-relaxed">
                      ⚠️ Nota: Los puntos de abordaje y descenso son sugeridos de manera virtual. No corresponden a paradas oficiales.
                    </p>
                  </div>
                ))
              ) : (
                !planningError && (
                  <div className="text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center">
                    Selecciona un origen y destino para calcular la mejor combinación de rutas.
                  </div>
                )
              )}
            </div>
          </div>

          {/* Route Explorer */}
          <div className="p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Explorar Rutas
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {
                  routes.filter((r) => {
                    if (transportFilter === 'all') return true;
                    return (
                      normalizeTransportType(r.transport_type, r.id, r.name) === transportFilter
                    );
                  }).length
                }{' '}
                rutas
              </span>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
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
                  className={`rounded-full px-3 py-1 text-[11px] font-bold transition border cursor-pointer ${
                    transportFilter === t.id
                      ? t.id === 'combi'
                        ? 'bg-violet-600 text-white border-violet-600'
                        : t.id === 'autobus'
                          ? 'bg-sky-600 text-white border-sky-600'
                          : 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {routes
                .filter((r) => {
                  if (transportFilter === 'all') return true;
                  return normalizeTransportType(r.transport_type, r.id, r.name) === transportFilter;
                })
                .map((route) => {
                const isFav = favorites.includes(route.id);
                const isSelected = selectedRouteId === route.id;
                const dir = routeDirections[route.id] || 'ida';
                const kind = normalizeTransportType(route.transport_type, route.id, route.name);
                return (
                  <div
                    key={route.id}
                    data-testid={`route-item-${route.id}`}
                    onClick={() => {
                      const next = isSelected ? null : route.id;
                      setSelectedRouteId(next);
                      if (next) {
                        toast(`Mostrando ${route.name}`, 'info', 'Explorar rutas');
                      }
                    }}
                    className={`flex items-center justify-between p-3 border rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/30 ring-1 ring-amber-500/20 shadow-sm'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0 border border-white shadow-sm"
                        style={{ backgroundColor: route.color }}
                      ></span>
                      <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-semibold text-slate-800 truncate">{route.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`rounded-full border px-1.5 py-0 text-[9px] font-bold uppercase ${transportBadgeClass(kind)}`}
                          >
                            {kind === 'combi' ? 'Combi' : 'Autobús'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            · {dir === 'ida' ? 'Ida' : 'Vuelta'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        data-testid={`toggle-direction-${route.id}`}
                        onClick={() => toggleDirection(route.id)}
                        className="text-[10px] bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg px-2.5 py-1 font-bold text-slate-700 transition cursor-pointer"
                      >
                        Sentido
                      </button>
                      <button
                        data-testid={`favorite-button-${route.id}`}
                        onClick={() => toggleFavorite(route.id)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                        title={isFav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill={isFav ? '#e11d48' : 'none'}
                          stroke={isFav ? '#e11d48' : '#64748b'}
                          strokeWidth="2"
                          className="w-4 h-4"
                        >
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
              {routes.filter((r) => {
                if (transportFilter === 'all') return true;
                return normalizeTransportType(r.transport_type, r.id, r.name) === transportFilter;
              }).length === 0 && (
                <div className="text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded-xl p-4 text-center">
                  No hay rutas de este tipo publicadas.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden font-sans bg-slate-100 select-none">
      
      {/* Map Canvas - Canvas layer under all UI panels */}
      <div
        data-testid="map-container"
        ref={mapContainerRef}
        className="rm-map-canvas absolute inset-0 z-0 h-full w-full"
      />

      {/* DESKTOP VIEW: Floating Search Panel (md and up) */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="absolute top-4 left-4 z-10 hidden max-h-[calc(100vh-2rem)] w-96 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur-sm md:flex"
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white flex-shrink-0">
          <h1 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
            <span>🚍</span> Rutas Morelia
          </h1>
          <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-bold uppercase">
            Beta
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {renderControlContent()}
        </div>
      </motion.div>

      {/* MOBILE VIEW: Bottom Slide Sheet (md and below) */}
      <motion.div
        layout
        animate={{ height: isMobileExpanded ? '75vh' : '120px' }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        className="rm-mobile-sheet fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-2xl border-t border-slate-200 bg-white shadow-2xl md:hidden"
      >
        {/* Handle bar to drag/click to toggle height */}
        <div
          className="h-6 flex items-center justify-center cursor-pointer border-b border-slate-50 flex-shrink-0"
          onClick={() => setIsMobileExpanded(!isMobileExpanded)}
        >
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {!isMobileExpanded ? (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-1 cursor-pointer items-center justify-between p-4"
              onClick={() => setIsMobileExpanded(true)}
            >
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span>🔍</span>
                <span className="font-medium">Planifica tu viaje o explora rutas...</span>
              </div>
              <button
                type="button"
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700"
              >
                Ver opciones
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className="flex min-h-0 flex-1 flex-col overflow-y-auto"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white p-4">
                <h1 className="flex items-center gap-1.5 text-base font-bold text-slate-900">
                  <span>🚍</span> Rutas Morelia
                </h1>
                <button
                  type="button"
                  onClick={() => setIsMobileExpanded(false)}
                  className="cursor-pointer rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
                >
                  Minimizar
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">{renderControlContent()}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

    </div>
  );
}
