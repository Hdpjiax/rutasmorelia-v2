/* ViaMorelia — Service Worker v2
 * - Índice / catálogo: network-first → cache (lista de rutas offline)
 * - GeoJSON de rutas: cache-first (trazos ya vistos sin red)
 * - Marca / manifest: cache-first
 * - Navegación SPA: network-first → shell cacheada
 */
const CACHE_SHELL = 'vm-shell-v2';
const CACHE_ROUTES = 'vm-routes-v2';
const CACHE_BRAND = 'vm-brand-v2';

const PRECACHE_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/brand/icono.png',
  '/brand/icono-192.png',
  '/brand/icono-512.png',
  '/brand/icono-64.png',
  '/brand/nombre.png',
  '/routes/index.json',
];

const ALL_CACHES = [CACHE_SHELL, CACHE_ROUTES, CACHE_BRAND];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_SHELL);
      await Promise.all(
        PRECACHE_SHELL.map(async (url) => {
          try {
            await cache.add(url);
          } catch (e) {
            console.warn('[sw] precache skip', url, e);
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (k) =>
              !ALL_CACHES.includes(k) &&
              (k.startsWith('viamorelia-') || k.startsWith('vm-'))
          )
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

/** Network-first con fallback a cache (y respuesta vacía opcional). */
async function networkFirst(req, cacheName, fallbackFactory) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      await cache.put(req, res.clone());
    }
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    if (fallbackFactory) return fallbackFactory();
    throw new Error('offline');
  }
}

/** Cache-first; revalida en background. */
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then(async (res) => {
      if (res && res.ok) {
        await cache.put(req, res.clone());
      }
      return res;
    })
    .catch(() => null);
  if (cached) {
    void network;
    return cached;
  }
  const res = await network;
  if (res) return res;
  return new Response('Offline', { status: 503, statusText: 'Offline' });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Catálogo API + índice estático
  if (
    url.pathname === '/api/routes/catalog' ||
    url.pathname === '/routes/index.json'
  ) {
    event.respondWith(
      networkFirst(req, CACHE_SHELL, () =>
        caches.match('/routes/index.json').then(
          (c) =>
            c ||
            new Response(JSON.stringify({ routes: [], generatedAt: null, offline: true }), {
              headers: { 'Content-Type': 'application/json; charset=utf-8' },
            })
        )
      )
    );
    return;
  }

  // GeoJSON de rutas publicadas
  if (url.pathname.startsWith('/routes/') && url.pathname.endsWith('.geojson')) {
    event.respondWith(cacheFirst(req, CACHE_ROUTES));
    return;
  }

  // Marca / iconos PWA
  if (url.pathname.startsWith('/brand/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(cacheFirst(req, CACHE_BRAND));
    return;
  }

  // Navegación documento (SPA): network-first → shell /
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      networkFirst(req, CACHE_SHELL, () =>
        caches.match('/').then(
          (c) =>
            c ||
            new Response(
              '<!doctype html><title>ViaMorelia</title><p>Sin conexión. Abre la app de nuevo cuando haya red para cachear rutas.</p>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            )
        )
      )
    );
  }
});

/** Mensajes desde la página: precache de rutas frecuentes, skipWaiting */
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }
  if (data.type === 'PRECACHE_ROUTES' && Array.isArray(data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_ROUTES);
        const urls = data.urls.slice(0, 40);
        for (const u of urls) {
          try {
            const res = await fetch(u, { credentials: 'same-origin' });
            if (res.ok) await cache.put(u, res.clone());
          } catch {
            /* offline mid-precache */
          }
        }
        const clients = await self.clients.matchAll({ type: 'window' });
        for (const client of clients) {
          client.postMessage({ type: 'PRECACHE_DONE', count: urls.length });
        }
      })()
    );
  }
});
