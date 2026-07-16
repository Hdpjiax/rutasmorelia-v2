'use client';

import { useEffect } from 'react';

/**
 * Evita zoom de página (pinch / Ctrl+rueda) en tablet y Chrome.
 * El zoom del mapa sigue en MapLibre (capa con pinch-zoom).
 */
function isMapTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      '.maplibregl-map, .maplibregl-canvas-container, .maplibregl-canvas, .rm-map-canvas'
    )
  );
}

/** En páginas legales permitimos scroll libre del documento (sin interferir). */
function isLegalContext(target: EventTarget | null): boolean {
  if (typeof document === 'undefined') return false;
  if (document.querySelector('[data-legal-page], [data-legal-scroll]')) return true;
  if (target instanceof Element && target.closest('[data-legal-sheet], .vm-legal-sheet-scroll')) {
    return true;
  }
  return false;
}

export function PreventPageZoom() {
  useEffect(() => {
    const blockBrowserZoomWheel = (e: WheelEvent) => {
      // Ctrl/Cmd + rueda = zoom de página en Chrome/Edge
      if (!(e.ctrlKey || e.metaKey)) return;
      // En legal: permitir zoom de accesibilidad del browser
      if (isLegalContext(e.target)) return;
      e.preventDefault();
    };

    // iOS Safari / algunos WebViews: gestures de pellizco a nivel documento
    const blockGesture = (e: Event) => {
      if (isLegalContext(e.target)) return;
      e.preventDefault();
    };

    // Multi-touch fuera del mapa → no zoom de UI (salvo legal)
    const blockPagePinch = (e: TouchEvent) => {
      if (e.touches.length <= 1) return;
      if (isMapTarget(e.target) || isLegalContext(e.target)) return;
      e.preventDefault();
    };

    const opts: AddEventListenerOptions = { passive: false, capture: true };

    document.addEventListener('wheel', blockBrowserZoomWheel, opts);
    document.addEventListener('gesturestart', blockGesture, opts);
    document.addEventListener('gesturechange', blockGesture, opts);
    document.addEventListener('gestureend', blockGesture, opts);
    document.addEventListener('touchmove', blockPagePinch, opts);

    return () => {
      document.removeEventListener('wheel', blockBrowserZoomWheel, opts);
      document.removeEventListener('gesturestart', blockGesture, opts);
      document.removeEventListener('gesturechange', blockGesture, opts);
      document.removeEventListener('gestureend', blockGesture, opts);
      document.removeEventListener('touchmove', blockPagePinch, opts);
    };
  }, []);

  return null;
}
