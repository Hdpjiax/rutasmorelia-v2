/**
 * Revisa peso de public/routes y sugiere límites para Vercel.
 * Uso: node scripts/report_bundle_routes.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'public', 'routes');
if (!fs.existsSync(root)) {
  console.error('No public/routes');
  process.exit(1);
}

const files = fs.readdirSync(root).filter((f) => f.endsWith('.geojson') || f === 'index.json');
let total = 0;
const rows = [];
for (const f of files) {
  const st = fs.statSync(path.join(root, f));
  total += st.size;
  rows.push({ f, kb: +(st.size / 1024).toFixed(1) });
}
rows.sort((a, b) => b.kb - a.kb);

console.log('=== public/routes weight ===');
console.log(`files: ${files.length}`);
console.log(`total: ${(total / 1024 / 1024).toFixed(2)} MB`);
console.log('top 10:');
for (const r of rows.slice(0, 10)) {
  console.log(`  ${r.kb.toString().padStart(8)} KB  ${r.f}`);
}
console.log('');
console.log('Notas Vercel:');
console.log('- Serverless limit ~250MB (funciones); geojson estáticos van en CDN, no en lambda.');
console.log('- outputFileTracingExcludes ya omite GIS pesado (rutastransporte, OSM, etc.).');
console.log('- Preferir lazy load de shapes (index + bbox) frente a empaquetar todo en JS.');
if (total > 15 * 1024 * 1024) {
  console.log('WARN: catálogo >15MB — vigilar tiempo de primer plan y caché CDN.');
}
