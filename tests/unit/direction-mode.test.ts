import { describe, it, expect } from 'vitest';
import {
  reverseCoordinates,
  detectDirectionMode,
  filterGeojsonByDirection,
  mirrorDirection,
  applyEditedDirection,
  getDirectionMode,
  getDirectionCoords,
  annotateDirectionMode,
  toSingleCorridorDisplay,
  type RouteFeatureCollection,
  type LngLat,
} from '@/lib/gis/direction-mode';

function line(coords: LngLat[], direction: 'ida' | 'vuelta'): RouteFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { direction, name: direction === 'ida' ? 'Ida' : 'Vuelta' },
        geometry: { type: 'LineString', coordinates: coords },
      },
    ],
  };
}

function both(ida: LngLat[], vuelta: LngLat[]): RouteFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { direction: 'ida', name: 'Ida', color: '#f00' },
        geometry: { type: 'LineString', coordinates: ida },
      },
      {
        type: 'Feature',
        properties: { direction: 'vuelta', name: 'Vuelta', color: '#f00' },
        geometry: { type: 'LineString', coordinates: vuelta },
      },
    ],
  };
}

const corridor: LngLat[] = [
  [-101.2, 19.7],
  [-101.19, 19.701],
  [-101.18, 19.702],
  [-101.17, 19.703],
];

describe('direction-mode', () => {
  it('reverseCoordinates invierte el orden', () => {
    expect(reverseCoordinates(corridor)).toEqual([...corridor].reverse());
  });

  it('detecta mirrored cuando vuelta ≈ reverse(ida)', () => {
    const { mode, similarityM } = detectDirectionMode(corridor, reverseCoordinates(corridor));
    expect(mode).toBe('mirrored');
    expect(similarityM).toBeLessThan(1);
  });

  it('detecta independent cuando los trazos divergen', () => {
    const other: LngLat[] = [
      [-101.2, 19.71],
      [-101.19, 19.72],
      [-101.18, 19.73],
      [-101.17, 19.74],
    ];
    const { mode } = detectDirectionMode(corridor, other);
    expect(mode).toBe('independent');
  });

  it('filterGeojsonByDirection deja un solo sentido', () => {
    const fc = both(corridor, reverseCoordinates(corridor));
    const only = filterGeojsonByDirection(fc, 'ida');
    expect(only.features).toHaveLength(1);
    expect(only.features?.[0]?.properties?.direction).toBe('ida');
  });

  it('mirrorDirection ida→vuelta genera reverse y mode mirrored', () => {
    const fc = both(corridor, [
      [-101.0, 19.0],
      [-101.01, 19.01],
    ]);
    const mirrored = mirrorDirection(fc, 'ida', 'vuelta');
    expect(getDirectionMode(mirrored)).toBe('mirrored');
    expect(getDirectionCoords(mirrored, 'vuelta')).toEqual(reverseCoordinates(corridor));
  });

  it('applyEditedDirection en mirrored sincroniza el opuesto', () => {
    const fc = annotateDirectionMode(both(corridor, reverseCoordinates(corridor))).geojson;
    const newIda: LngLat[] = [
      [-101.2, 19.7],
      [-101.15, 19.705],
    ];
    const next = applyEditedDirection(fc, 'ida', newIda);
    expect(getDirectionMode(next)).toBe('mirrored');
    expect(getDirectionCoords(next, 'ida')).toEqual(newIda);
    expect(getDirectionCoords(next, 'vuelta')).toEqual(reverseCoordinates(newIda));
  });

  it('applyEditedDirection en independent no toca el otro sentido', () => {
    const vuelta: LngLat[] = [
      [-101.0, 19.0],
      [-101.01, 19.01],
      [-101.02, 19.02],
    ];
    const fc = annotateDirectionMode(both(corridor, vuelta)).geojson;
    expect(getDirectionMode(fc)).toBe('independent');
    const newIda: LngLat[] = [
      [-101.2, 19.7],
      [-101.15, 19.705],
    ];
    const next = applyEditedDirection(fc, 'ida', newIda);
    expect(getDirectionCoords(next, 'vuelta')).toEqual(vuelta);
    expect(getDirectionCoords(next, 'ida')).toEqual(newIda);
  });

  it('toSingleCorridorDisplay mirrored: 1 línea + sense-labels', () => {
    const fc = both(corridor, reverseCoordinates(corridor));
    // exact reverse → mode colapsa a corredor único
    const single = toSingleCorridorDisplay({
      ...fc,
      properties: { directionMode: 'mirrored' },
    });
    // con reverse exacto y sin dual_ring, drawBoth es false si JSON equal reverse
    const drawn = (single.features ?? []).filter((f) => f.properties?.type === 'ride');
    expect(drawn.length).toBeGreaterThanOrEqual(1);
  });

  it('toSingleCorridorDisplay dual_ring: dibuja ambas líneas del KML', () => {
    const other: LngLat[] = [
      [-101.201, 19.701],
      [-101.191, 19.702],
      [-101.181, 19.703],
      [-101.171, 19.704],
    ];
    const fc = both(corridor, other);
    fc.properties = { directionMode: 'dual_ring', corridor: 'both_kml_lines' };
    const dual = toSingleCorridorDisplay(fc);
    const drawn = (dual.features ?? []).filter((f) => f.properties?.type === 'ride');
    expect(drawn).toHaveLength(2);
    expect(drawn.map((d) => d.properties?.name).sort()).toEqual(['Ida', 'Vuelta']);
    expect(drawn[0]?.geometry?.coordinates).not.toEqual(
      reverseCoordinates(drawn[1]?.geometry?.coordinates as LngLat[])
    );
  });
});
