'use client';

import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { isBrowserOnline } from '@/lib/offline/store';
import { uiTelemetry } from '@/lib/telemetry/ui-events';

/**
 * Aviso claro cuando se opera con datos almacenados / sin red.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const apply = () => {
      const on = isBrowserOnline();
      setOnline(on);
      uiTelemetry.offlineMode(on);
    };
    apply();
    window.addEventListener('online', apply);
    window.addEventListener('offline', apply);
    return () => {
      window.removeEventListener('online', apply);
      window.removeEventListener('offline', apply);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      className="pointer-events-auto absolute inset-x-0 z-[45] flex justify-center px-3"
      style={{ top: 'calc(var(--vm-safe-top) + 3.25rem)' }}
    >
      <div className="flex max-w-md items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-950 shadow-lg">
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          Sin conexión. Mapa y rutas guardadas / favoritas pueden seguir disponibles. La
          información es <strong>almacenada en este dispositivo</strong>.
        </span>
      </div>
    </div>
  );
}
