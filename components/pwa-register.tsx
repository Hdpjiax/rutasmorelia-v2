'use client';

import { useEffect } from 'react';

/** Registra Service Worker (prod + localhost) y escucha actualizaciones. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const isLocal =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1';
    if (process.env.NODE_ENV === 'development' && !isLocal) return;

    let reg: ServiceWorkerRegistration | null = null;

    const onLoad = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((r) => {
          reg = r;
          // Nueva versión en espera → activar en el próximo load
          if (r.waiting) {
            r.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          r.addEventListener('updatefound', () => {
            const sw = r.installing;
            if (!sw) return;
            sw.addEventListener('statechange', () => {
              if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                // Hay update; se aplica en la siguiente visita
                console.info('[sw] Nueva versión lista (se usa al recargar)');
              }
            });
          });
        })
        .catch((err) => {
          console.warn('[sw]', err);
        });
    };

    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad);

    const onControllerChange = () => {
      // Evitar reloads en bucle; el usuario refresca si quiere
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      window.removeEventListener('load', onLoad);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      void reg;
    };
  }, []);

  return null;
}
