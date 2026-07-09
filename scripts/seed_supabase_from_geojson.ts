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
  
  const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.geojson') && f !== 'test-route-1.geojson');
  
  for (const file of files) {
    console.log(`Processing file: ${file}`);
    const filePath = path.join(routesDir, file);
    const geojsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    const features = geojsonData.features || [];
    if (features.length === 0) continue;
    
    // Extract route metadata from first feature
    const firstFeatureProps = features[0].properties || {};
    const routeId = firstFeatureProps.routeId;
    const routeName = firstFeatureProps.routeName || routeId.replace('-', ' ').toUpperCase();
    const color = firstFeatureProps.color || '#3b82f6';
    const casingColor = firstFeatureProps.casingColor || '#222222';
    const transportType = firstFeatureProps.transportType || 'combi';
    const status = firstFeatureProps.qa_status === 'approved' ? 'approved' : 'needs_review';
    
    console.log(` -> Seeding route: ${routeId} (${routeName})`);
    
    // Upsert Route metadata
    const { error: routeError } = await supabase.from('routes').upsert({
      id: routeId,
      name: routeName,
      color: color,
      casing_color: casingColor,
      transport_type: transportType,
      status: status,
      updated_at: new Date().toISOString()
    });
    
    if (routeError) {
      console.error(`❌ Error inserting route ${routeId}:`, routeError.message);
      continue;
    }
    
    // Process shapes
    for (const feature of features) {
      const props = feature.properties || {};
      const direction = props.direction;
      const geom = feature.geometry;
      const matchedToOsm = props.matched_to_osm || false;
      const qaStatus = props.qa_status || 'needs_review';
      
      if (!direction || !geom || geom.type !== 'LineString') {
        console.warn(`⚠️ Invalid feature in ${file}, skipping shape.`);
        continue;
      }
      
      console.log(`   -> Upserting shape for direction: ${direction}`);
      
      // Delete existing shape for same route & direction to avoid duplicates
      await supabase.from('route_shapes')
        .delete()
        .eq('route_id', routeId)
        .eq('direction', direction);
        
      // Insert new shape
      const { error: shapeError } = await supabase.from('route_shapes').insert({
        route_id: routeId,
        direction: direction,
        geom: geom,
        matched_to_osm: matchedToOsm,
        qa_status: qaStatus
      });
      
      if (shapeError) {
        console.error(`❌ Error inserting shape for route ${routeId} ${direction}:`, shapeError.message);
      } else {
        console.log(`   ✅ Successfully inserted shape.`);
      }
    }
  }
  
  console.log('--- Seeding Finished ---');
}

seed().catch(err => {
  console.error('Fatal Seeding Error:', err);
});
