'use client';

import { useEffect } from 'react';
import { subscribeNativeDeepLinks } from '@/lib/trip/deep-link';

/**
 * Bridge de App Links / deep links (Capacitor + web).
 * La lógica de hidratar origen/destino vive en useTripPlannerWorkflow
 * (evento `vm-deep-link` + lectura inicial de URL).
 */
export function DeepLinkBridge() {
  useEffect(() => {
    return subscribeNativeDeepLinks(() => {
      // El workflow escucha DEEP_LINK_EVENT y aplica el viaje.
      // Aquí solo aseguramos que el bridge nativo esté activo.
    });
  }, []);

  return null;
}
