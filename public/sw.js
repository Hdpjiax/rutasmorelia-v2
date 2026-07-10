/* ViaMorelia — SW ligero: caché del índice de rutas + assets estáticos de marca */
const CACHE = 'viamorelia-v1';
const PRECACHE = [
  '/',
  '/manifest.webmanifest',
  '/brand/icono.png',
  '/brand/icono-64.png',
  '/brand/nombre.png',
  '/routes/index.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Índice de rutas: network-first, fallback cache (offline parcial)
  if (url.pathname === '/routes/index.json') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((c) => c || new Response('{"routes":[]}', {
          headers: { 'Content-Type': 'application/json' },
        })))
    );
    return;
  }

  // GeoJSON de rutas: cache-first (inmutables en la práctica entre deploys)
  if (url.pathname.startsWith('/routes/') && url.pathname.endsWith('.geojson')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const net = fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        });
        return cached || net;
      })
    );
    return;
  }

  // Brand assets: cache-first
  if (url.pathname.startsWith('/brand/')) {
    event.respondWith(
      caches.match(req).then((c) => c || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(req, copy));
        return res;
      }))
    );
  }
});
