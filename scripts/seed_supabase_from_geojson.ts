import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local manually
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env.local file not found');
    process.exit(1);
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env: Record<string, string> = {};
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const index = trimmed.indexOf('=');
    if (index === -1) return;
    const key = trimmed.substring(0, index).trim();
    const val = trimmed.substring(index + 1).trim();
    env[key] = val.replace(/^["']|["']$/g, '');
  });
  
  return env;
}

async function seed() {
  console.log('--- Seeding Supabase Cloud Database from GeoJSON files ---');
  const env = loadEnv();
  
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
  
  const routesDir = path.join(process.cwd(), 'public', 'routes');
  if (!fs.existsSync(routesDir)) {
    console.error(`Routes directory not found: ${routesDir}`);
    process.exit(1);
  }
  
  // Preferir index.json (fuente de verdad de rutas publicadas al usuario)
  const indexPath = path.join(routesDir, 'index.json');
  let indexRoutes: Array<{ id: string; name?: string; color?: string; transportType?: string; casingColor?: string }> = [];
  if (fs.existsSync(indexPath)) {
    try {
      const idx = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      indexRoutes = idx.routes || [];
    } catch {
      /* ignore */
    }
  }

  const files = fs
    .readdirSync(routesDir)
    .filter((f) => f.endsWith('.geojson') && f !== 'test-route-1.geojson');

  // Si hay índice, solo esas rutas (orden del índice)
  const fileList =
    indexRoutes.length > 0
      ? indexRoutes.map((r) => `${r.id}.geojson`).filter((f) => files.includes(f))
      : files;

  const indexById = new Map(indexRoutes.map((r) => [r.id, r]));

  let okRoutes = 0;
  let okShapes = 0;
  let failRoutes = 0;

  for (const file of fileList) {
    console.log(`Processing file: ${file}`);
    const filePath = path.join(routesDir, file);
    const geojsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    const features = (geojsonData.features || []).filter(
      (f: { geometry?: { type?: string; coordinates?: unknown[] }; properties?: Record<string, unknown> }) => {
        const t = f.properties?.type;
        if (t === 'sense-label' || t === 'walk') return false;
        return f.geometry?.type === 'LineString' && Array.isArray(f.geometry?.coordinates) && f.geometry.coordinates.length >= 2;
      }
    );
    if (features.length === 0) {
      console.warn(`⚠️ Sin LineString ida/vuelta en ${file}`);
      continue;
    }

    const firstFeatureProps = features[0].properties || {};
    const routeId =
      String(firstFeatureProps.routeId || path.basename(file, '.geojson')).trim();
    const meta = indexById.get(routeId);
    const routeName =
      meta?.name ||
      firstFeatureProps.routeName ||
      routeId.replace(/^ruta-/, '').replace(/-/g, ' ');
    const color = meta?.color || firstFeatureProps.color || '#3b82f6';
    const casingColor =
      meta?.casingColor || firstFeatureProps.casingColor || '#222222';
    const transportType =
      meta?.transportType || firstFeatureProps.transportType || 'combi';
    // Todo lo publicado en /public/routes es visible → approved
    const status = 'approved';

    console.log(` -> Seeding route: ${routeId} (${routeName})`);

    const { error: routeError } = await supabase.from('routes').upsert({
      id: routeId,
      name: routeName,
      color: color,
      casing_color: casingColor,
      transport_type: transportType,
      status: status,
      updated_at: new Date().toISOString(),
    });

    if (routeError) {
      console.error(`❌ Error inserting route ${routeId}:`, routeError.message);
      failRoutes++;
      continue;
    }
    okRoutes++;

    for (const feature of features) {
      const props = feature.properties || {};
      let direction = String(props.direction || props.name || '').toLowerCase();
      if (direction !== 'ida' && direction !== 'vuelta') {
        if (direction.includes('ida')) direction = 'ida';
        else if (direction.includes('vuelta')) direction = 'vuelta';
        else {
          console.warn(`⚠️ Dirección inválida en ${file}, skip`);
          continue;
        }
      }
      const geom = feature.geometry;
      const matchedToOsm = Boolean(props.matched_to_osm);
      const qaStatus = 'approved';

      console.log(`   -> Upserting shape for direction: ${direction}`);

      await supabase
        .from('route_shapes')
        .delete()
        .eq('route_id', routeId)
        .eq('direction', direction);

      // PostGIS via Supabase: GeoJSON geometry object
      const { error: shapeError } = await supabase.from('route_shapes').insert({
        route_id: routeId,
        direction: direction,
        geom: geom,
        matched_to_osm: matchedToOsm,
        qa_status: qaStatus,
      });

      if (shapeError) {
        console.error(
          `❌ Error inserting shape for route ${routeId} ${direction}:`,
          shapeError.message
        );
      } else {
        okShapes++;
        console.log(`   ✅ Successfully inserted shape.`);
      }
    }
  }

  console.log(
    `--- Seeding Finished --- routes_ok=${okRoutes} routes_fail=${failRoutes} shapes_ok=${okShapes}`
  );
}

seed().catch(err => {
  console.error('Fatal Seeding Error:', err);
});
