/**
 * Metadatos de presentación de rutas a partir del nombre/descripción.
 * Extrae corredores, terminales aproximadas y pistas de búsqueda.
 */

export type RouteDisplayInfo = {
  baseName: string;
  /** Colonias / avenidas / zonas mencionadas en el nombre */
  corridors: string[];
  corridorLabel: string;
  terminalIda: string;
  terminalVuelta: string;
  /** Texto de búsqueda ampliado (alias, color, número) */
  searchBlob: string;
};

const BRACKET_RE = /\[([^\]]+)\]|\(([^)]+)\)/g;

export function parseRouteDisplay(route: {
  id: string;
  name: string;
  description?: string | null;
  color?: string;
  transport_type?: string;
}): RouteDisplayInfo {
  const name = route.name || route.id;
  const corridors: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(BRACKET_RE.source, 'g');
  while ((m = re.exec(name)) !== null) {
    const raw = (m[1] || m[2] || '').trim();
    if (!raw) continue;
    for (const part of raw.split(/[-–—\/,|]+/)) {
      const t = part.trim();
      if (t && t.length > 1) corridors.push(t);
    }
  }

  const baseName = name.replace(/\s*[\[(][^)\]]*[)\]]\s*/g, ' ').replace(/\s+/g, ' ').trim() || name;
  const uniqueCorridors = Array.from(new Set(corridors)).slice(0, 5);

  const terminalIda =
    uniqueCorridors[0] ||
    (uniqueCorridors.length ? uniqueCorridors.join(' · ') : 'Salida / sentido ida');
  const terminalVuelta =
    uniqueCorridors.length >= 2
      ? uniqueCorridors[uniqueCorridors.length - 1]
      : uniqueCorridors[0]
        ? `Regreso · ${uniqueCorridors[0]}`
        : 'Regreso / sentido vuelta';

  const corridorLabel =
    uniqueCorridors.length > 0
      ? uniqueCorridors.join(' · ')
      : (route.description || '').trim() || 'Recorrido en Morelia';

  const searchBlob = [
    name,
    baseName,
    route.id,
    route.description || '',
    uniqueCorridors.join(' '),
    route.transport_type || '',
    // color words often in name (Morada, Roja…)
    baseName.replace(/\d+/g, ' '),
  ]
    .join(' ')
    .toLowerCase();

  return {
    baseName,
    corridors: uniqueCorridors,
    corridorLabel,
    terminalIda,
    terminalVuelta,
    searchBlob,
  };
}

/** Disponibilidad legible a partir de status. */
export function availabilityLabel(status?: string | null): {
  label: string;
  tone: 'ok' | 'warn' | 'bad';
} {
  const s = (status || 'approved').toLowerCase();
  if (s === 'approved' || s === 'published') return { label: 'Disponible', tone: 'ok' };
  if (s === 'needs_review') return { label: 'En revisión', tone: 'warn' };
  if (s === 'rejected') return { label: 'No disponible', tone: 'bad' };
  return { label: 'Publicada', tone: 'ok' };
}
