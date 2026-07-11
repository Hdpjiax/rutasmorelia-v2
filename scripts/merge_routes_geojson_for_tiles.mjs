/**
 * Une public/routes/*.geojson en un FeatureCollection tippecanoe-ready.
 * Conserva properties: routeId, routeName, color, direction.
 */
import fs from 'node:fs';
import path from 'node:path';

const routesDir = process.argv[2] || path.join(process.cwd(), 'public', 'routes');
const outFile =
  process.argv[3] ||
  path.join(process.cwd(), 'data', 'processed', 'routes-all-for-tiles.geojson');

const files = fs
  .readdirSync(routesDir)
  .filter((f) => f.endsWith('.geojson') && f !== 'index.json');

const features = [];
for (const file of files) {
  const id = file.replace(/\.geojson$/i, '');
  let gj;
  try {
    gj = JSON.parse(fs.readFileSync(path.join(routesDir, file), 'utf8'));
  } catch {
    console.warn('[merge] skip', file);
    continue;
  }
  for (const f of gj.features || []) {
    if (!f?.geometry || f.geometry.type !== 'LineString') continue;
    const p = f.properties || {};
    if (p.type === 'sense-label' || p.type === 'walk') continue;
    features.push({
      type: 'Feature',
      properties: {
        routeId: String(p.routeId || p.route_id || id),
        routeName: String(p.routeName || p.name || id),
        color: String(p.color || '#3b82f6'),
        direction: String(p.direction || p.name || ''),
      },
      geometry: f.geometry,
    });
  }
}

const fc = {
  type: 'FeatureCollection',
  features,
  properties: { generated: new Date().toISOString(), count: features.length },
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(fc));
console.log(`[merge] ${features.length} features → ${outFile}`);
