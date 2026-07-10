'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { uiTelemetry } from '@/lib/telemetry/ui-events';

export type PanelMode = 'search' | 'results' | 'favorites' | 'routes';

/**
 * Estado de paneles (sheet / modal) + telemetría open/close + foco al cerrar.
 */
export function useMobilePanels(initial: PanelMode = 'results') {
  const [panel, setPanelState] = useState<PanelMode>(initial);
  const [resultsOpen, setResultsOpenState] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  const setPanel = useCallback((p: PanelMode) => {
    setPanelState(p);
  }, []);

  const openResults = useCallback((p?: PanelMode) => {
    if (typeof document !== 'undefined') {
      const ae = document.activeElement;
      if (ae instanceof HTMLElement) restoreFocusRef.current = ae;
    }
    if (p) setPanelState(p);
    setResultsOpenState(true);
    uiTelemetry.panelOpen(p ?? panel);
  }, [panel]);

  const closeResults = useCallback(() => {
    uiTelemetry.panelClose(panel);
    setResultsOpenState(false);
    setSearchExpanded(false);
    // Restaurar foco (accesibilidad: no perder el contexto al cerrar)
    requestAnimationFrame(() => {
      const el = restoreFocusRef.current;
      if (el && typeof el.focus === 'function') {
        try {
          el.focus({ preventScroll: true });
        } catch {
          /* ignore */
        }
      }
      restoreFocusRef.current = null;
    });
  }, [panel]);

  // Escape global cierra sheet / búsqueda expandida
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (authOpen) {
        setAuthOpen(false);
        e.preventDefault();
        return;
      }
      if (resultsOpen) {
        closeResults();
        e.preventDefault();
        return;
      }
      if (searchExpanded) {
        setSearchExpanded(false);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authOpen, resultsOpen, searchExpanded, closeResults]);

  return {
    panel,
    setPanel,
    resultsOpen,
    setResultsOpen: setResultsOpenState,
    openResults,
    closeResults,
    searchExpanded,
    setSearchExpanded,
    authOpen,
    setAuthOpen,
  };
}
