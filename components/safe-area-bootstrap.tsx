'use client';

import { useEffect } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';

type StatusBarPlugin = {
  setOverlaysWebView(options: { overlay: boolean }): Promise<void>;
  setBackgroundColor(options: { color: string }): Promise<void>;
};

/** Plugin nativo (empaquetado en mobile/); no depende de @capacitor/status-bar en el web. */
const StatusBar = registerPlugin<StatusBarPlugin>('StatusBar');

/**
 * Android (sobre todo API 35 / edge-to-edge): env(safe-area-inset-*) suele ser 0
 * aunque el WebView pinte debajo de la status bar y la barra de gestos.
 *
 * - En nativo: no solapar WebView con status bar (contenido empieza debajo).
 * - Fallback CSS: relleno mínimo arriba/abajo si el entorno reporta 0.
 */
export function SafeAreaBootstrap() {
  useEffect(() => {
    const root = document.documentElement;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isAndroid =
      Capacitor.getPlatform() === 'android' || /Android/i.test(ua);
    const isMobileWeb =
      isAndroid ||
      /iPhone|iPad|iPod|Mobile|Tablet/i.test(ua) ||
      (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);

    if (isAndroid) root.classList.add('vm-android');

    // Altura real visible (barra del browser en móvil/tablet)
    const applyVisualViewport = () => {
      const vv = window.visualViewport;
      const h = vv?.height ?? window.innerHeight;
      root.style.setProperty('--vm-vvh', `${Math.round(h)}px`);
    };

    // Fallback si safe-area real es 0 (muy común en WebView / Chrome móvil)
    const applyFallback = () => {
      if (!isMobileWeb) return;
      const probe = document.createElement('div');
      probe.style.cssText =
        'position:fixed;visibility:hidden;pointer-events:none;' +
        'padding-top:env(safe-area-inset-top,0px);' +
        'padding-bottom:env(safe-area-inset-bottom,0px);';
      document.body.appendChild(probe);
      const cs = getComputedStyle(probe);
      const top = parseFloat(cs.paddingTop) || 0;
      const bottom = parseFloat(cs.paddingBottom) || 0;
      probe.remove();

      // Status bar / notch aprox.; home indicator / gestos
      // En Android env() suele ser 0 aunque el contenido se dibuje bajo la status bar
      // (PWA, edge-to-edge, Custom Tabs). 48–56px evita que se corte solo la parte de arriba.
      if (top < 8) {
        root.style.setProperty('--vm-safe-top', isAndroid ? '48px' : '16px');
      }
      if (bottom < 1) {
        root.style.setProperty('--vm-safe-bottom', isAndroid ? '20px' : '16px');
      }
      // Variable solo para legal (no mueve el mapa si overlay ya dejó de solapar)
      if (isAndroid || isMobileWeb) {
        root.style.setProperty(
          '--vm-legal-top-min',
          isAndroid ? '56px' : '48px'
        );
      }
    };

    applyVisualViewport();
    applyFallback();

    const vv = window.visualViewport;
    vv?.addEventListener('resize', applyVisualViewport);
    vv?.addEventListener('scroll', applyVisualViewport);
    window.addEventListener('resize', applyVisualViewport);

    let cancelled = false;
    if (Capacitor.isNativePlatform() && isAndroid) {
      void (async () => {
        try {
          // Intentar WebView debajo de la status bar
          await StatusBar.setOverlaysWebView({ overlay: false });
          await StatusBar.setBackgroundColor({ color: '#f8fafc' });
          // NO quitar --vm-safe-top: en API 35 overlaysWebView a veces se ignora
          // y sin fallback se vuelve a cortar solo la parte de arriba.
          if (!cancelled) applyFallback();
        } catch {
          // Plugin no disponible: nos quedamos con fallbacks CSS
        }
      })();
    }

    return () => {
      cancelled = true;
      vv?.removeEventListener('resize', applyVisualViewport);
      vv?.removeEventListener('scroll', applyVisualViewport);
      window.removeEventListener('resize', applyVisualViewport);
    };
  }, []);

  return null;
}
