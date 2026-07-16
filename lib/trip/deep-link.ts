/**
 * Deep links / App Links para ViaMorelia (web + app Flutter `viamoreliaapp`).
 *
 * Soporta:
 * - https://viamorelia.org/?from=lng,lat&to=lng,lat&plan=&route=&routes=…
 * - https://www.viamorelia.org/…
 * - viamorelia://open?from=…&to=…&routes=id:ida|…
 * - viamorelia://trip?from=…&to=…
 *
 * `routes` = huella del plan elegido (`id:ida|id2:vuelta`) para abrir la misma opción
 * en web y en Android (no solo el índice `plan`).
 */

import {
  clearTripShareParamsFromLocation,
  hasTripShareParams,
  readTripUrlState,
  type TripUrlState,
} from '@/lib/trip/url-state';

export const DEEP_LINK_EVENT = 'vm-deep-link';

export type DeepLinkDetail = {
  /** URL absoluta o relativa que se abrió */
  url: string;
  /** Estado de viaje parseado (si hay params) */
  trip: TripUrlState;
  /** true si traía params de viaje/ruta compartida */
  hasTrip: boolean;
};

/** Dominios que trata la app como propios. */
export function isViaMoreliaHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  return (
    h === 'viamorelia.org' ||
    h === 'www.viamorelia.org' ||
    h === 'localhost' ||
    h.endsWith('.vercel.app')
  );
}

/**
 * Normaliza cualquier deep link a path+search+hash usable en la SPA
 * (p. ej. `/?from=…&to=…`).
 */
export function normalizeDeepLinkToPath(rawUrl: string): string | null {
  if (!rawUrl?.trim()) return null;
  try {
    // Esquema custom: viamorelia://open?from=…  ó  viamorelia://trip/?from=…
    if (/^viamorelia:/i.test(rawUrl)) {
      const asHttp = rawUrl
        .replace(/^viamorelia:\/\//i, 'https://viamorelia.org/')
        .replace(/^viamorelia:/i, 'https://viamorelia.org/');
      const u = new URL(asHttp);
      // host open/trip → raíz
      if (u.hostname === 'open' || u.hostname === 'trip') {
        return `/${u.search}${u.hash}`;
      }
      const path = u.pathname === '/' || !u.pathname ? '/' : u.pathname;
      return `${path}${u.search}${u.hash}`;
    }

    const u = new URL(
      rawUrl,
      typeof window !== 'undefined' ? window.location.origin : 'https://viamorelia.org'
    );
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      if (!isViaMoreliaHost(u.hostname) && u.hostname !== '127.0.0.1') {
        // Enlace externo: no lo secuestramos
        return null;
      }
      return `${u.pathname}${u.search}${u.hash}` || '/';
    }
  } catch {
    return null;
  }
  return null;
}

export function parseDeepLink(rawUrl: string): DeepLinkDetail | null {
  const path = normalizeDeepLinkToPath(rawUrl);
  if (path == null) return null;
  const qIndex = path.indexOf('?');
  const search = qIndex >= 0 ? path.slice(qIndex) : '';
  const trip = readTripUrlState(search);
  return {
    url: rawUrl,
    trip,
    hasTrip: hasTripShareParams(search),
  };
}

/**
 * Aplica el deep link en la barra (replaceState) y notifica a la app.
 * No recarga la página completa si ya estamos en el mismo origen.
 */
export function applyDeepLink(rawUrl: string): DeepLinkDetail | null {
  if (typeof window === 'undefined') return null;
  const detail = parseDeepLink(rawUrl);
  if (!detail) return null;

  const path = normalizeDeepLinkToPath(rawUrl);
  if (!path) return null;

  try {
    const next = new URL(path, window.location.origin);
    const cur = window.location.pathname + window.location.search + window.location.hash;
    const target = next.pathname + next.search + next.hash;
    if (cur !== target) {
      window.history.replaceState({}, '', target);
    }
  } catch {
    /* ignore */
  }

  // Tras hidratar, limpia params de la barra (mismo criterio que el flujo web actual)
  if (detail.hasTrip) {
    // Dejamos un tick para que listeners lean search actual
    Promise.resolve().then(() => {
      clearTripShareParamsFromLocation();
    });
  }

  window.dispatchEvent(new CustomEvent(DEEP_LINK_EVENT, { detail }));
  return detail;
}

type CapAppPlugin = {
  addListener: (
    event: 'appUrlOpen',
    cb: (data: { url: string }) => void
  ) => Promise<{ remove: () => void | Promise<void> }> | { remove: () => void | Promise<void> };
  getLaunchUrl?: () => Promise<{ url?: string } | undefined>;
};

function getCapacitorApp(): CapAppPlugin | null {
  if (typeof window === 'undefined') return null;
  const Cap = (
    window as unknown as {
      Capacitor?: {
        isNativePlatform?: () => boolean;
        Plugins?: { App?: CapAppPlugin };
      };
    }
  ).Capacitor;
  if (!Cap?.isNativePlatform?.()) return null;
  return Cap.Plugins?.App ?? null;
}

/**
 * Suscribe deep links nativos (Capacitor) + re-dispara si la URL actual ya trae viaje.
 * Devuelve cleanup.
 */
export function subscribeNativeDeepLinks(
  onLink: (detail: DeepLinkDetail) => void
): () => void {
  const cleanups: Array<() => void> = [];

  const handle = (raw: string) => {
    const detail = applyDeepLink(raw);
    if (detail) onLink(detail);
  };

  // URL actual (web o WebView que abrió con query)
  if (typeof window !== 'undefined' && hasTripShareParams()) {
    const detail = parseDeepLink(window.location.href);
    if (detail?.hasTrip) {
      onLink(detail);
    }
  }

  const App = getCapacitorApp();
  if (App) {
    void (async () => {
      try {
        if (App.getLaunchUrl) {
          const launch = await App.getLaunchUrl();
          if (launch?.url) handle(launch.url);
        }
      } catch {
        /* ignore */
      }
    })();

    const sub = App.addListener('appUrlOpen', (data) => {
      if (data?.url) handle(data.url);
    });

    cleanups.push(() => {
      void Promise.resolve(sub).then((s) => {
        void s?.remove?.();
      });
    });
  }

  const onCustom = (ev: Event) => {
    const detail = (ev as CustomEvent<DeepLinkDetail>).detail;
    if (detail) onLink(detail);
  };
  window.addEventListener(DEEP_LINK_EVENT, onCustom);
  cleanups.push(() => window.removeEventListener(DEEP_LINK_EVENT, onCustom));

  return () => cleanups.forEach((fn) => fn());
}
