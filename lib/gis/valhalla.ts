import fs from 'fs/promises';
import path from 'path';
import { execFile, execSync } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

let cachedValhallaUrl: string | null = null;
let lastReadyAt = 0;
/** Promise compartida: un solo arranque aunque lleguen varios request a la vez. */
let ensureReadyPromise: Promise<string> | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** D:\rutasmorelia → /mnt/d/rutasmorelia */
export function windowsToWslPath(winPath: string): string {
  const normalized = path.resolve(winPath);
  const m = normalized.match(/^([a-zA-Z]):[\\/](.*)$/);
  if (!m) return normalized.replace(/\\/g, '/');
  return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`;
}

/**
 * Candidatos de URL de Valhalla (env + WSL + localhost).
 * En Windows el fetch a 127.0.0.1 a veces no llega al servicio en WSL2.
 */
async function getValhallaUrlCandidates(): Promise<string[]> {
  let envUrl = 'http://127.0.0.1:8002';
  try {
    // turbopackIgnore: no trazar todo el proyecto en Vercel
    const envPath = path.join(/* turbopackIgnore: true */ process.cwd(), '.env-valhalla');
    const raw = await fs.readFile(envPath, 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('VALHALLA_URL=')) {
        envUrl = trimmed.split('VALHALLA_URL=')[1].trim().replace(/^["']|["']$/g, '');
        break;
      }
    }
  } catch {
    // sin .env-valhalla
  }

  const candidates: string[] = [];
  const push = (u: string) => {
    const clean = u.replace(/\/$/, '');
    if (clean && !candidates.includes(clean)) candidates.push(clean);
  };

  if (cachedValhallaUrl) push(cachedValhallaUrl);
  push(envUrl);

  if (process.platform === 'win32') {
    try {
      const wslIp = execSync('wsl hostname -I', {
        encoding: 'utf-8',
        timeout: 4000,
      })
        .trim()
        .split(/\s+/)[0];
      if (wslIp && /^\d+\.\d+\.\d+\.\d+$/.test(wslIp)) {
        try {
          const parsed = new URL(envUrl);
          parsed.hostname = wslIp;
          push(parsed.toString().replace(/\/$/, ''));
        } catch {
          push(`http://${wslIp}:8002`);
        }
      }
    } catch {
      // WSL no disponible
    }
  }

  push('http://127.0.0.1:8002');
  push('http://localhost:8002');

  return candidates;
}

/**
 * Resuelve la URL de Valhalla a partir de .env-valhalla / WSL / localhost.
 */
export async function getValhallaUrl(): Promise<string> {
  if (cachedValhallaUrl) return cachedValhallaUrl;
  const candidates = await getValhallaUrlCandidates();
  cachedValhallaUrl = candidates[0];
  return cachedValhallaUrl;
}

/** Invalida caché de URL (p. ej. tras fallo de red). */
export function clearValhallaUrlCache() {
  cachedValhallaUrl = null;
  lastReadyAt = 0;
}

async function pingValhallaStatus(baseUrl: string, timeoutMs = 2500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/status`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/** Devuelve la primera URL de Valhalla que responde /status, o null. */
export async function findLiveValhallaUrl(): Promise<string | null> {
  const candidates = await getValhallaUrlCandidates();
  for (const base of candidates) {
    if (await pingValhallaStatus(base)) {
      cachedValhallaUrl = base;
      lastReadyAt = Date.now();
      return base;
    }
  }
  return null;
}

function isTestEnv(): boolean {
  return process.env.VITEST === 'true' || process.env.NODE_ENV === 'test';
}

/**
 * Arranca Valhalla vía scripts/start_valhalla_wsl.sh (WSL en Windows, bash en Linux).
 * En Windows usa `wsl -e bash <script>` (no -lc) para no matar el proceso al salir.
 */
async function startValhallaService(): Promise<void> {
  if (isTestEnv()) {
    throw new Error('Arranque automático de Valhalla desactivado en tests.');
  }

  const projectRoot = /* turbopackIgnore: true */ process.cwd();
  console.log('[Valhalla] Arrancando servicio automáticamente…');

  if (process.platform === 'win32') {
    const wslPath = windowsToWslPath(projectRoot);
    const scriptWsl = `${wslPath}/scripts/start_valhalla_wsl.sh`;
    try {
      // -e bash script: sesión limpia; el script usa setsid/nohup para persistir
      const { stdout, stderr } = await execFileAsync(
        'wsl',
        ['-e', 'bash', scriptWsl],
        {
          timeout: 130_000,
          maxBuffer: 4 * 1024 * 1024,
          windowsHide: true,
        }
      );
      if (stdout) console.log('[Valhalla start]', stdout.trim().slice(-1000));
      if (stderr) console.warn('[Valhalla start stderr]', stderr.trim().slice(-400));
    } catch (e: unknown) {
      const err = e as { message?: string; stdout?: string; stderr?: string; code?: number };
      console.error('[Valhalla] Fallo al arrancar:', err.message);
      if (err.stdout) console.error(String(err.stdout).slice(-800));
      if (err.stderr) console.error(String(err.stderr).slice(-800));
      throw new Error(
        `No se pudo arrancar Valhalla automáticamente. ` +
          `Prueba en terminal: wsl -e bash ${scriptWsl}  |  Detalle: ${err.message ?? e}`
      );
    }
  } else {
    try {
      const { stdout, stderr } = await execFileAsync(
        'bash',
        [path.join(projectRoot, 'scripts/start_valhalla_wsl.sh')],
        {
          cwd: projectRoot,
          timeout: 130_000,
          maxBuffer: 4 * 1024 * 1024,
        }
      );
      if (stdout) console.log('[Valhalla start]', stdout.trim().slice(-1000));
      if (stderr) console.warn('[Valhalla start stderr]', stderr.trim().slice(-400));
    } catch (e: unknown) {
      const err = e as { message?: string };
      throw new Error(
        `No se pudo arrancar Valhalla automáticamente (bash scripts/start_valhalla_wsl.sh). ` +
          `Detalle: ${err.message ?? e}`
      );
    }
  }
}

/**
 * Garantiza que Valhalla esté arriba.
 * Si /status falla, arranca el servicio (una sola vez en paralelo) y espera a que responda.
 * Usar antes de alinear y de guardar/publicar.
 */
export async function ensureValhallaReady(options?: {
  /** Si true, no reutiliza el “listo hace poco” y re-pingea siempre. */
  forceCheck?: boolean;
}): Promise<string> {
  const forceCheck = options?.forceCheck ?? false;

  // Atajo: listo hace <45s y tenemos URL cacheada
  if (
    !forceCheck &&
    cachedValhallaUrl &&
    Date.now() - lastReadyAt < 45_000 &&
    (await pingValhallaStatus(cachedValhallaUrl, 1500))
  ) {
    lastReadyAt = Date.now();
    return cachedValhallaUrl;
  }

  if (ensureReadyPromise) {
    return ensureReadyPromise;
  }

  ensureReadyPromise = (async () => {
    try {
      const live = await findLiveValhallaUrl();
      if (live) {
        console.log(`[Valhalla] Ya está arriba en ${live}`);
        return live;
      }

      if (isTestEnv()) {
        // En tests no arrancamos el binario; devolvemos URL por defecto
        const fallback = (await getValhallaUrlCandidates())[0] ?? 'http://127.0.0.1:8002';
        cachedValhallaUrl = fallback;
        return fallback;
      }

      console.log('[Valhalla] No responde — arranque automático…');
      await startValhallaService();
      clearValhallaUrlCache();

      // Tras el script (ya espera a /status en WSL), re-ping desde Windows
      // (localhost o IP de WSL). Dar un margen extra por mirror de red.
      for (let i = 0; i < 25; i++) {
        const up = await findLiveValhallaUrl();
        if (up) {
          console.log(`[Valhalla] Listo tras arranque en ${up} (${i + 1}s post-script)`);
          return up;
        }
        await sleep(800);
      }

      // Último intento: status vía wsl (el servicio puede estar solo visible en WSL)
      try {
        const wslPath = windowsToWslPath(/* turbopackIgnore: true */ process.cwd());
        await execFileAsync(
          'wsl',
          ['-e', 'bash', `${wslPath}/scripts/valhalla_status_wsl.sh`],
          { timeout: 8000, windowsHide: true }
        );
        // Si WSL dice UP, forzar candidatos otra vez
        const up2 = await findLiveValhallaUrl();
        if (up2) return up2;
      } catch {
        /* sigue al error final */
      }

      throw new Error(
        'Valhalla no respondió tras el arranque automático. ' +
          'Ejecuta: wsl -e bash scripts/start_valhalla_wsl.sh  y revisa log-valhalla.log'
      );
    } finally {
      ensureReadyPromise = null;
    }
  })();

  return ensureReadyPromise;
}

/**
 * POST a Valhalla con reintento en varias URLs (WSL / localhost).
 * Si no hay conexión, intenta arrancar Valhalla y reintenta una vez.
 */
async function valhallaFetch(endpoint: string, body: unknown): Promise<Response> {
  // Asegurar servicio (arranque automático si hace falta)
  try {
    await ensureValhallaReady();
  } catch (e) {
    console.warn('[Valhalla] ensureValhallaReady previo al fetch falló:', e);
  }

  const tryAll = async (): Promise<Response> => {
    const candidates = await getValhallaUrlCandidates();
    const errors: string[] = [];

    for (const base of candidates) {
      const url = `${base.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 45000);
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        clearTimeout(timer);

        cachedValhallaUrl = base.replace(/\/$/, '');
        lastReadyAt = Date.now();
        console.log(`[Valhalla] ${endpoint} → ${base} (${response.status})`);
        return response;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`${base}: ${msg}`);
        console.warn(`[Valhalla] Fallo en ${url}: ${msg}`);
      }
    }

    throw new Error(errors.join(' | ') || 'sin candidatos');
  };

  try {
    return await tryAll();
  } catch (firstErr) {
    if (isTestEnv()) {
      const detail = firstErr instanceof Error ? firstErr.message : String(firstErr);
      throw new Error(`fetch failed: ${detail}`);
    }
    // Segunda oportunidad: forzar arranque y reintentar
    console.warn('[Valhalla] Fetch falló, reintentando con arranque forzado…', firstErr);
    clearValhallaUrlCache();
    await ensureValhallaReady({ forceCheck: true });
    try {
      return await tryAll();
    } catch (secondErr) {
      const detail = secondErr instanceof Error ? secondErr.message : String(secondErr);
      throw new Error(
        `fetch failed: no se pudo conectar a Valhalla tras arranque automático. ${detail}`
      );
    }
  }
}

/**
 * Opciones de costing para alineación de trazos de transporte.
 * ignore_oneways: no desviar por sentido contrario — solo pegar al eje vial.
 * Útil porque ida/vuelta o calles de doble sentido no deben forzar desvíos.
 */
export const ALIGNMENT_COSTING_OPTIONS = {
  auto: {
    ignore_oneways: true,
    ignore_restrictions: true,
    shortest: true,
  },
} as const;

/**
 * Decodifica una cadena polyline6 (codificada por Valhalla) en coordenadas [longitude, latitude].
 */
export function decodePolyline6(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  const len = encoded.length;
  let lat = 0;
  let lng = 0;

  while (index < len) {
    let b;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coords.push([lng / 1e6, lat / 1e6]);
  }
  return coords;
}

/**
 * Llama al endpoint /route de Valhalla para un grupo pequeño de coordenadas.
 * Por defecto ignora sentidos únicos: alinea a la red vial sin desviar por oneway.
 */
async function callValhallaRouteDirect(points: [number, number][]): Promise<[number, number][]> {
  const locations = points.map(([lon, lat]) => ({ lon, lat, type: 'break' }));

  const response = await valhallaFetch('route', {
    locations,
    costing: 'auto',
    costing_options: ALIGNMENT_COSTING_OPTIONS,
    directions_options: { units: 'kilometers' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Valhalla route error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const coords: [number, number][] = [];
  const legs = data.trip?.legs ?? [];
  for (const leg of legs) {
    if (leg.shape) {
      coords.push(...decodePolyline6(leg.shape));
    }
  }
  return coords;
}

/**
 * Llama al endpoint /route de Valhalla para ruteo secuencial por hitos obligatorios.
 * Si excede los 20 puntos (límite por defecto de Valhalla), divide la petición en chunks solapados.
 */
export async function callValhallaRoute(points: [number, number][]): Promise<[number, number][]> {
  if (points.length <= 20) {
    const coords = await callValhallaRouteDirect(points);
    return coords.filter((c, i) => i === 0 || c[0] !== coords[i - 1][0] || c[1] !== coords[i - 1][1]);
  }

  const allCoords: [number, number][] = [];
  const chunkSize = 20;

  for (let i = 0; i < points.length; i += chunkSize - 1) {
    const chunk = points.slice(i, i + chunkSize);
    if (chunk.length < 2) break;

    const chunkCoords = await callValhallaRouteDirect(chunk);
    allCoords.push(...chunkCoords);
  }

  return allCoords.filter(
    (c, i) => i === 0 || c[0] !== allCoords[i - 1][0] || c[1] !== allCoords[i - 1][1]
  );
}

/**
 * Llama al endpoint /trace_route de Valhalla para map-matching de trazas densas.
 * Ignora sentidos únicos: alinea al eje vial de los puntos, sin desvíos por oneway.
 */
export async function callValhallaTraceRoute(
  points: [number, number][],
  searchRadius = 40
): Promise<{ coordinates: [number, number][]; confidence: number }> {
  const shape = points.map(([lon, lat], i) => ({
    lon,
    lat,
    type: i === 0 || i === points.length - 1 ? 'break' : 'through',
  }));

  const response = await valhallaFetch('trace_route', {
    shape,
    costing: 'auto',
    costing_options: ALIGNMENT_COSTING_OPTIONS,
    shape_match: 'map_snap',
    trace_options: {
      search_radius: searchRadius,
      gps_accuracy: 15,
    },
    directions_options: { units: 'kilometers' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Valhalla trace_route error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const coords: [number, number][] = [];
  const legs = data.trip?.legs ?? [];
  for (const leg of legs) {
    if (leg.shape) {
      coords.push(...decodePolyline6(leg.shape));
    }
  }

  const confidence = data.trip?.confidence ?? 1.0;
  const filtered = coords.filter(
    (c, i) => i === 0 || c[0] !== coords[i - 1][0] || c[1] !== coords[i - 1][1]
  );

  return { coordinates: filtered, confidence };
}
