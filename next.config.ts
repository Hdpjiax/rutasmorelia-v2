import type { NextConfig } from 'next';

/**
 * Evita que el file-tracing de Vercel meta en las Server Functions
 * carpetas GIS enormes (rutastransporte ~300MB, OSM, tiles, etc.).
 * El admin QA y Valhalla son locales; en producción solo hacen falta
 * public/routes + APIs ligeras.
 */
const heavyIgnores = [
  './rutastransporte/**/*',
  './data/osm/**/*',
  './data/osrm/**/*',
  './data/valhalla/**/*',
  './data/raw-routes/**/*',
  './external/**/*',
  './scripts/**/*',
  './.venv*/**/*',
  './.agents/**/*',
  './antigravity-rules/**/*',
  './codebase-memory-mcp-ui-windows-amd64/**/*',
  './mcps/**/*',
  './terminals/**/*',
  './test-results/**/*',
  './.next/cache/**/*',
  '**/*.osm.pbf',
  '**/*.osrm*',
  '**/*.tar',
  '**/*.pdf',
  '**/*.rar',
  '**/*.zip',
];

const nextConfig: NextConfig = {
  // Next 15+/16: excluir del bundle de cada función serverless
  outputFileTracingExcludes: {
    '*': heavyIgnores,
  },
  serverExternalPackages: [],
  // Oculta el badge "N" de desarrollo (capturas / mockups de tienda)
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  async headers() {
    return [
      {
        // Micrófono (voz) y geolocalización permitidos en la app; no bloqueados por policy.
        source: '/:path*',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'microphone=(self), geolocation=(self), camera=()',
          },
        ],
      },
      {
        // Digital Asset Links (Android App Links)
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/routes/index.json',
        headers: [
          {
            key: 'Cache-Control',
            // ISR-like: 5 min en CDN, stale-while-revalidate
            value: 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
          },
        ],
      },
      {
        source: '/api/routes/catalog',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=30, s-maxage=300, stale-while-revalidate=600',
          },
        ],
      },
      {
        source: '/routes/:path*.geojson',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=1800, stale-while-revalidate=3600',
          },
          { key: 'Content-Type', value: 'application/geo+json; charset=utf-8' },
        ],
      },
      {
        source: '/tiles/:path*.pmtiles',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
          },
          { key: 'Accept-Ranges', value: 'bytes' },
        ],
      },
      {
        source: '/brand/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=604800, immutable',
          },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
