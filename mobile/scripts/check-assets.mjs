import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'capacitor.config.ts',
  'www/index.html',
  'package.json',
];

let ok = true;
for (const rel of required) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    console.error('Falta:', rel);
    ok = false;
  }
}

const android = join(root, 'android');
if (!existsSync(android)) {
  console.warn(
    'Aviso: aún no existe mobile/android. Ejecuta: pnpm install && npx cap add android'
  );
} else {
  console.log('OK: plataforma android presente');
}

if (!ok) process.exit(1);
console.log('OK: assets base de mobile/');
