/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from '@/lib/ui/toast';
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
  const [user, setUser] = useState<SessionUser | null>(null);
  const [email, setEmail] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authSending, setAuthSending] = useState(false);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoriteLocations, setFavoriteLocations] = useState<FavoriteLocation[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<RecentPlace[]>([]);
  const [recentRoutes, setRecentRoutes] = useState<RecentRoute[]>([]);
  const [homePlace, setHomePlace] = useState<SavedPlaceSlot>(null);
  const [workPlace, setWorkPlace] = useState<SavedPlaceSlot>(null);

  // Inicializar almacenamiento local tras hidratación
  useEffect(() => {
    setFavorites(loadLocalFavoriteRoutes());
    setFavoriteLocations(loadLocalFavoriteLocations());
    setRecentPlaces(loadRecentPlaces());
    setRecentRoutes(loadRecentRoutes());
    setHomePlace(loadHomePlace());
    setWorkPlace(loadWorkPlace());
  }, []);

  // Auth unificado + favoritos remotos
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

  const handleMagicLink = useCallback(async (e: React.FormEvent) => {
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
      
      const userPayload = (data as { user?: { id: string; email?: string } } | null)?.user;
      if (userPayload && process.env.NEXT_PUBLIC_USE_REAL_SUPABASE !== 'true') {
        setUser({ id: userPayload.id, email: userPayload.email || clean });
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
  }, [email]);

  const handleGoogleLogin = useCallback(async () => {
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
  }, []);

  const handleLogout = useCallback(async (everywhere = false) => {
    if (everywhere) await signOutEverywhere();
    else await signOut();
    setUser(null);
    setFavorites(loadLocalFavoriteRoutes());
    setFavoriteLocations(loadLocalFavoriteLocations());
    toast(everywhere ? 'Sesión cerrada en todos los dispositivos' : 'Sesión cerrada', 'info');
  }, []);

  const toggleFavorite = useCallback(async (routeId: string) => {
    const next = await toggleFavoriteRoute(routeId, favorites, user?.id);
    setFavorites(next);
    toast(
      next.includes(routeId) ? 'Ruta en favoritos' : 'Ruta quitada de favoritos',
      next.includes(routeId) ? 'success' : 'info'
    );
  }, [favorites, user?.id]);

  const toggleLocationFavorite = useCallback(async (hit: {
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
  }, [favoriteLocations, user?.id]);

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
    user,
    setUser,
    email,
    setEmail,
    authError,
    setAuthError,
    authMessage,
    setAuthMessage,
    authSending,
    setAuthSending,
    favorites,
    setFavorites,
    favoriteLocations,
    setFavoriteLocations,
    recentPlaces,
    recentRoutes,
    homePlace,
    workPlace,
    handleMagicLink,
    handleGoogleLogin,
    handleLogout,
    toggleFavorite,
    toggleLocationFavorite,
    addRecentPlace,
    addRecentRoute,
  };
}
