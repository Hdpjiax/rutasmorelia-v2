/**
 * Seguimiento GPS continuo (web + WebView Capacitor).
 * Prefiere Capacitor Geolocation en nativo si el bridge está disponible;
 * si no, usa navigator.geolocation.watchPosition.
 */

export type LivePosition = {
  coords: [number, number];
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number;
};

export type WatchLiveOptions = {
  /** Alta precisión (GPS real). Default true. */
  enableHighAccuracy?: boolean;
  /** No reutilizar lecturas viejas. Default 0. */
  maximumAge?: number;
  /** Timeout por lectura. Default 20000. */
  timeout?: number;
};

type CapGeolocationPlugin = {
  requestPermissions?: () => Promise<{ location?: string; coarseLocation?: string }>;
  watchPosition: (
    options: {
      enableHighAccuracy?: boolean;
      maximumAge?: number;
      timeout?: number;
    },
    callback: (
      position: {
        coords: {
          latitude: number;
          longitude: number;
          accuracy?: number;
          heading?: number | null;
          speed?: number | null;
        };
        timestamp: number;
      } | null,
      err?: { message?: string }
    ) => void
  ) => Promise<string>;
  clearWatch: (opts: { id: string }) => Promise<void>;
};

function getCapacitorGeolocation(): CapGeolocationPlugin | null {
  if (typeof window === 'undefined') return null;
  const Cap = (window as unknown as {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      Plugins?: { Geolocation?: CapGeolocationPlugin };
    };
  }).Capacitor;
  if (!Cap?.isNativePlatform?.()) return null;
  return Cap.Plugins?.Geolocation ?? null;
}

function toLive(
  latitude: number,
  longitude: number,
  accuracy?: number | null,
  heading?: number | null,
  speed?: number | null,
  timestamp?: number
): LivePosition | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(longitude) < 0.01 && Math.abs(latitude) < 0.01) return null;
  return {
    coords: [longitude, latitude],
    accuracy: accuracy ?? null,
    heading: heading ?? null,
    speed: speed ?? null,
    timestamp: timestamp ?? Date.now(),
  };
}

/**
 * Inicia watch. Devuelve función para detener.
 */
export function watchLivePosition(
  onPosition: (pos: LivePosition) => void,
  onError?: (message: string, code?: number) => void,
  options: WatchLiveOptions = {}
): () => void {
  const enableHighAccuracy = options.enableHighAccuracy ?? true;
  const maximumAge = options.maximumAge ?? 0;
  const timeout = options.timeout ?? 20_000;

  let stopped = false;
  let browserWatchId: number | null = null;
  let capWatchId: string | null = null;

  const stop = () => {
    stopped = true;
    if (browserWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(browserWatchId);
      browserWatchId = null;
    }
    if (capWatchId !== null) {
      const geo = getCapacitorGeolocation();
      const id = capWatchId;
      capWatchId = null;
      void geo?.clearWatch({ id }).catch(() => undefined);
    }
  };

  const handleCoords = (
    latitude: number,
    longitude: number,
    accuracy?: number | null,
    heading?: number | null,
    speed?: number | null,
    timestamp?: number
  ) => {
    if (stopped) return;
    const live = toLive(latitude, longitude, accuracy, heading, speed, timestamp);
    if (live) onPosition(live);
  };

  const startBrowser = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onError?.('Geolocalización no disponible en este dispositivo');
      return;
    }
    browserWatchId = navigator.geolocation.watchPosition(
      (pos) => {
        handleCoords(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy,
          pos.coords.heading,
          pos.coords.speed,
          pos.timestamp
        );
      },
      (err) => {
        if (stopped) return;
        onError?.(err.message || 'Error de GPS', err.code);
      },
      { enableHighAccuracy, maximumAge, timeout }
    );
  };

  const geo = getCapacitorGeolocation();
  if (geo) {
    void (async () => {
      try {
        if (geo.requestPermissions) {
          await geo.requestPermissions();
        }
        if (stopped) return;
        capWatchId = await geo.watchPosition(
          { enableHighAccuracy, maximumAge, timeout },
          (position, err) => {
            if (stopped) return;
            if (err || !position) {
              onError?.(err?.message || 'Error de GPS nativo');
              // Fallback al API del navegador si el plugin falla a mitad
              if (!browserWatchId) startBrowser();
              return;
            }
            handleCoords(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.accuracy,
              position.coords.heading,
              position.coords.speed,
              position.timestamp
            );
          }
        );
      } catch (e) {
        if (stopped) return;
        console.warn('[gps] Capacitor Geolocation falló, usando navigator', e);
        startBrowser();
      }
    })();
  } else {
    startBrowser();
  }

  return stop;
}

/** Una sola lectura (botón GPS / primer fix). */
export function getLivePositionOnce(
  options: WatchLiveOptions = {}
): Promise<LivePosition> {
  const enableHighAccuracy = options.enableHighAccuracy ?? true;
  const maximumAge = options.maximumAge ?? 0;
  const timeout = options.timeout ?? 15_000;

  const geo = getCapacitorGeolocation();
  if (geo) {
    return (async () => {
      try {
        if (geo.requestPermissions) await geo.requestPermissions();
      } catch {
        /* continuar */
      }
      // Capacitor no siempre expone getCurrentPosition en el tipado del bridge;
      // usamos un watch corto.
      return new Promise<LivePosition>((resolve, reject) => {
        const stop = watchLivePosition(
          (pos) => {
            stop();
            resolve(pos);
          },
          (msg) => {
            stop();
            reject(new Error(msg));
          },
          { enableHighAccuracy, maximumAge, timeout }
        );
        setTimeout(() => {
          stop();
          reject(new Error('Tiempo de espera de GPS agotado'));
        }, timeout + 2000);
      });
    })();
  }

  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocalización no disponible'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const live = toLive(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.accuracy,
          pos.coords.heading,
          pos.coords.speed,
          pos.timestamp
        );
        if (!live) reject(new Error('Coordenadas GPS inválidas'));
        else resolve(live);
      },
      (err) => reject(new Error(err.message || 'No se pudo obtener ubicación')),
      { enableHighAccuracy, maximumAge, timeout }
    );
  });
}
