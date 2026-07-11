/* eslint-disable react-hooks/set-state-in-effect */
'use client';

/** Favoritos solo local (sin cuenta). Reexporta la API de useUserAccount. */
export { useUserAccount as useUserFavorites } from '@/hooks/use-user-account';
