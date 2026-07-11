/**
 * Caché IndexedDB de GeoJSON de rutas.
 * Primer fetch → red; siguientes → lectura local (~0 ms) + offline.
 */

const DB_NAME = 'viamorelia-routes';
const DB_VERSION = 1;
const STORE = 'geojson';
/** TTL local (7 días); el HTTP cache de CDN puede ser más corto. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Entry = {
  id: string;
  geojson: unknown;
  at: number;
  url: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('no_idb'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error('idb_open'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
  });
}

export async function idbGetRouteGeojson(routeId: string): Promise<unknown | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(routeId);
      req.onsuccess = () => {
        const row = req.result as Entry | undefined;
        if (!row?.geojson) {
          resolve(null);
          return;
        }
        if (Date.now() - row.at > TTL_MS) {
          resolve(null);
          return;
        }
        resolve(row.geojson);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function idbPutRouteGeojson(
  routeId: string,
  url: string,
  geojson: unknown
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const entry: Entry = { id: routeId, url, geojson, at: Date.now() };
      const req = tx.objectStore(STORE).put(entry);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    /* ignore quota / private mode */
  }
}

export async function idbClearRouteGeojson(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    /* ignore */
  }
}

/**
 * Fetch GeoJSON con capa IndexedDB (read-through).
 */
export async function fetchRouteGeojsonCached(
  routeId: string,
  url: string,
  init?: RequestInit
): Promise<unknown | null> {
  const cached = await idbGetRouteGeojson(routeId);
  if (cached) return cached;

  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    const gj = await res.json();
    void idbPutRouteGeojson(routeId, url, gj);
    return gj;
  } catch {
    // Offline: reintentar IDB aunque esté “caducado”
    try {
      const db = await openDb();
      return await new Promise((resolve) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get(routeId);
        req.onsuccess = () => {
          const row = req.result as Entry | undefined;
          resolve(row?.geojson ?? null);
        };
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }
}
