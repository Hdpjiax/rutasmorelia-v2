import type { Coordinate } from './planner';
import type { PublishedShape } from './load-published-shapes';

export type BBox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

/** Expande OD a un bbox con margen (grados ≈ km). */
export function bboxFromOriginDest(
  origin: Coordinate,
  destination: Coordinate,
  padKm = 2.2
): BBox {
  const padDeg = padKm / 111; // ~1° lat ≈ 111 km
  const minLng = Math.min(origin[0], destination[0]) - padDeg;
  const maxLng = Math.max(origin[0], destination[0]) + padDeg;
  const minLat = Math.min(origin[1], destination[1]) - padDeg;
  const maxLat = Math.max(origin[1], destination[1]) + padDeg;
  return { minLng, minLat, maxLng, maxLat };
}

export function expandBBox(b: BBox, padKm: number): BBox {
  const padDeg = padKm / 111;
  return {
    minLng: b.minLng - padDeg,
    minLat: b.minLat - padDeg,
    maxLng: b.maxLng + padDeg,
    maxLat: b.maxLat + padDeg,
  };
}

/** True si algún punto de la shape cae en el bbox (muestreo). */
export function shapeIntersectsBBox(shape: PublishedShape, bbox: BBox): boolean {
  const coords = shape.coordinates;
  if (!coords.length) return false;
  const step = Math.max(1, Math.floor(coords.length / 40));
  for (let i = 0; i < coords.length; i += step) {
    const [lng, lat] = coords[i];
    if (
      lng >= bbox.minLng &&
      lng <= bbox.maxLng &&
      lat >= bbox.minLat &&
      lat <= bbox.maxLat
    ) {
      return true;
    }
  }
  // extremos
  for (const c of [coords[0], coords[coords.length - 1]]) {
    const [lng, lat] = c;
    if (
      lng >= bbox.minLng &&
      lng <= bbox.maxLng &&
      lat >= bbox.minLat &&
      lat <= bbox.maxLat
    ) {
      return true;
    }
  }
  return false;
}

export function filterShapesByBBox(
  shapes: PublishedShape[],
  bbox: BBox
): PublishedShape[] {
  return shapes.filter((s) => shapeIntersectsBBox(s, bbox));
}
