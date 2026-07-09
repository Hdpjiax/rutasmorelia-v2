import { along, length, lineString } from '@turf/turf';

/**
 * Alineación rápida local entre hitos del usuario.
 * No usa Valhalla: densifica el trazo entre puntos ya puestos (cada ~stepMeters).
 * Ideal cuando Valhalla está frío o se quiere respuesta inmediata.
 */
export function densifyWaypoints(
  points: [number, number][],
  stepMeters = 18
): [number, number][] {
  if (points.length < 2) return points;

  // Quitar duplicados consecutivos
  const clean: [number, number][] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = clean[clean.length - 1];
    const cur = points[i];
    if (prev[0] !== cur[0] || prev[1] !== cur[1]) clean.push(cur);
  }
  if (clean.length < 2) return clean;

  const line = lineString(clean);
  const totalM = length(line, { units: 'meters' });
  if (!Number.isFinite(totalM) || totalM < 1) return clean;

  const out: [number, number][] = [];
  const step = Math.max(5, stepMeters);

  for (let d = 0; d <= totalM; d += step) {
    const pt = along(line, Math.min(d, totalM), { units: 'meters' });
    const c = pt.geometry.coordinates as [number, number];
    const last = out[out.length - 1];
    if (!last || last[0] !== c[0] || last[1] !== c[1]) out.push(c);
  }

  // Garantizar último hito exacto
  const end = clean[clean.length - 1];
  const last = out[out.length - 1];
  if (!last || last[0] !== end[0] || last[1] !== end[1]) out.push(end);

  return out;
}

/**
 * Reduce hitos si hay demasiados (para Valhalla route rápido):
 * conserva extremos + puntos cada maxKeep o con cambio de dirección.
 */
export function thinWaypoints(
  points: [number, number][],
  maxPoints = 24
): [number, number][] {
  if (points.length <= maxPoints) return points;
  const out: [number, number][] = [points[0]];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i++) {
    out.push(points[Math.round(i * step)]);
  }
  out.push(points[points.length - 1]);
  return out;
}
