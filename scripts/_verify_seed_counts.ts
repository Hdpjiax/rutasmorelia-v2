import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

function loadEnv() {
  const env: Record<string, string> = {};
  const raw = fs.readFileSync('.env.local', 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

async function main() {
  const env = loadEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const r = await sb.from('routes').select('*', { count: 'exact', head: true });
  const s = await sb.from('route_shapes').select('*', { count: 'exact', head: true });
  const sample = await sb.from('routes').select('id,name,status').eq('status', 'approved').limit(5);
  console.log({
    routes: r.count,
    shapes: s.count,
    routeErr: r.error?.message,
    shapeErr: s.error?.message,
    sample: sample.data,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
