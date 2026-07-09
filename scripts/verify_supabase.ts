import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local manually to be zero-dependency
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
    // remove quotes if any
    env[key] = val.replace(/^["']|["']$/g, '');
  });
  
  return env;
}

async function verify() {
  console.log('--- Starting Supabase Cloud Database Verification ---');
  const env = loadEnv();
  
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error('Error: Missing required environment variables in .env.local');
    process.exit(1);
  }
  
  console.log(`Supabase URL: ${supabaseUrl}`);
  
  // Initialize clients
  const clientAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
  
  const clientAnon = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false }
  });
  
  const tables = [
    'profiles',
    'routes',
    'route_variants',
    'route_shapes',
    'route_segments',
    'route_transfer_points',
    'places',
    'favorite_places',
    'favorite_routes',
    'recent_searches',
    'dataset_versions',
    'gis_quality_reports'
  ];
  
  console.log('\n1. Checking table existence...');
  const tableStatus: Record<string, boolean> = {};
  
  for (const table of tables) {
    // Try to query 1 row from the table with the admin client
    const { error } = await clientAdmin.from(table).select('*').limit(1);
    if (error) {
      if (error.code === '42P01') {
        console.log(`❌ Table "${table}" does NOT exist.`);
        tableStatus[table] = false;
      } else {
        console.log(`⚠️ Table "${table}" returned error code: ${error.code} - ${error.message}`);
        tableStatus[table] = false;
      }
    } else {
      console.log(`✅ Table "${table}" exists.`);
      tableStatus[table] = true;
    }
  }
  
  const allExist = Object.values(tableStatus).every(v => v);
  if (!allExist) {
    console.log('\n❌ Verification failed: Not all tables exist in the database.');
    return;
  }
  
  console.log('\n2. Verifying Row Level Security (RLS) policies...');
  
  // Test 2a: Read from a public table (e.g., routes) using Anon Client
  console.log('Testing public read on "routes" via Anon...');
  const { data: publicRoutes, error: publicReadError } = await clientAnon.from('routes').select('*').limit(5);
  if (publicReadError) {
    console.log(`❌ Public read failed: ${publicReadError.message}`);
  } else {
    console.log(`✅ Public read succeeded, retrieved ${publicRoutes?.length || 0} routes.`);
  }
  
  // Test 2b: Write to a public table (e.g., routes) using Anon Client (should fail due to RLS/write restrictions)
  console.log('Testing unauthorized write on "routes" via Anon...');
  const { error: publicWriteError } = await clientAnon.from('routes').insert([
    { id: 'test-temp-route', name: 'Test Temp Route', color: '#FFFFFF', transport_type: 'combi' }
  ]);
  if (publicWriteError) {
    console.log(`✅ Unauthorized write failed as expected: ${publicWriteError.message}`);
  } else {
    console.log(`❌ Unauthorized write SUCCEEDED! Security vulnerability: Public write is enabled on public tables.`);
  }
  
  // Test 2c: Read from user-specific table (e.g., favorite_routes) using Anon Client without auth (should return empty or fail)
  console.log('Testing read on "favorite_routes" via Anon...');
  const { data: anonFavs, error: anonFavsError } = await clientAnon.from('favorite_routes').select('*');
  if (anonFavsError) {
    console.log(`✅ Read failed or restricted as expected: ${anonFavsError.message}`);
  } else {
    console.log(`✅ Read returned ${anonFavs?.length || 0} rows. (Must be 0 unless authenticated or public).`);
  }
  
  // Test 2d: Insert to user-specific table (e.g., favorite_routes) using Anon Client without auth (should fail)
  console.log('Testing insert on "favorite_routes" via Anon...');
  const { error: anonFavsInsertError } = await clientAnon.from('favorite_routes').insert([
    { user_id: '00000000-0000-0000-0000-000000000000', route_id: 'test-temp-route' }
  ]);
  if (anonFavsInsertError) {
    console.log(`✅ Insert failed as expected: ${anonFavsInsertError.message}`);
  } else {
    console.log(`❌ Insert SUCCEEDED! Security vulnerability: Unauthenticated user can insert into favorite_routes.`);
  }
  
  // Test 2e: Admin client bypasses RLS and can write/read freely
  console.log('Testing write/delete on "routes" via Service Role (Admin)...');
  const tempRouteId = 'temp-verify-route-' + Math.random().toString(36).substring(7);
  const { error: adminInsertError } = await clientAdmin.from('routes').insert([
    { id: tempRouteId, name: 'Verify Route', color: '#123456', transport_type: 'combi', status: 'approved' }
  ]);
  if (adminInsertError) {
    console.log(`❌ Admin insert failed: ${adminInsertError.message}`);
  } else {
    console.log('✅ Admin insert succeeded.');
    // Clean it up
    const { error: adminDeleteError } = await clientAdmin.from('routes').delete().eq('id', tempRouteId);
    if (adminDeleteError) {
      console.log(`⚠️ Admin clean up failed: ${adminDeleteError.message}`);
    } else {
      console.log('✅ Admin clean up succeeded.');
    }
  }
  
  console.log('\n3. Verifying Spatial RPC SQL Functions...');
  
  // Test 3a: find_routes_near_point
  console.log('Calling find_routes_near_point...');
  const { data: rpc1Result, error: rpc1Error } = await clientAdmin.rpc('find_routes_near_point', {
    point_lon: -101.194,
    point_lat: 19.702,
    distance_meters: 1000
  });
  if (rpc1Error) {
    console.log(`❌ find_routes_near_point RPC failed: ${rpc1Error.message}`);
  } else {
    console.log(`✅ find_routes_near_point RPC executed successfully. Returned ${rpc1Result?.length || 0} results.`);
  }
  
  // Test 3b: project_point_onto_route
  console.log('Calling project_point_onto_route...');
  // We need a shape ID to test projection. Let's create a temporary route shape first.
  const verifyRouteId = 'temp-rpc-route-' + Math.random().toString(36).substring(7);
  const shapeId = '00000000-0000-0000-0000-000000000001'; // Can try to insert/delete
  
  // Let's insert a temp route and shape
  const { error: setupRouteError } = await clientAdmin.from('routes').insert([
    { id: verifyRouteId, name: 'Temp RPC Route', color: '#111111', transport_type: 'combi', status: 'approved' }
  ]);
  
  if (!setupRouteError) {
    const { error: setupShapeError } = await clientAdmin.from('route_shapes').insert([
      {
        id: shapeId,
        route_id: verifyRouteId,
        direction: 'ida',
        geom: {
          type: 'LineString',
          coordinates: [
            [-101.200, 19.700],
            [-101.190, 19.710]
          ]
        },
        matched_to_osm: true,
        qa_status: 'approved'
      }
    ]);
    
    if (!setupShapeError) {
      const { data: rpc2Result, error: rpc2Error } = await clientAdmin.rpc('project_point_onto_route', {
        shape_id: shapeId,
        point_lon: -101.195,
        point_lat: 19.705
      });
      
      if (rpc2Error) {
        console.log(`❌ project_point_onto_route RPC failed: ${rpc2Error.message}`);
      } else {
        console.log(`✅ project_point_onto_route RPC executed successfully. Output:`, rpc2Result);
      }
      
      // Clean up shape
      await clientAdmin.from('route_shapes').delete().eq('id', shapeId);
    } else {
      console.log(`⚠️ Setup shape failed: ${setupShapeError.message}`);
    }
    
    // Clean up route
    await clientAdmin.from('routes').delete().eq('id', verifyRouteId);
  } else {
    console.log(`⚠️ Setup route failed: ${setupRouteError.message}`);
  }
  
  console.log('\n--- Verification Finished ---');
}

verify().catch(err => {
  console.error('Fatal Verification Error:', err);
});
