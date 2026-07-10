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
  // No empaquetar maplibre en el servidor (es cliente)
  serverExternalPackages: [],
  // Evitar que el build falle por tipos en tests o scripts
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
