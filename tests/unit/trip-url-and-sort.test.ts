import { describe, expect, it } from 'vitest';
import {
  buildTripShareUrl,
  parseCoordParam,
  readTripUrlState,
} from '@/lib/trip/url-state';
import { sortTripPlans, transferCount, type PlanSortMode } from '@/lib/trip/format';
import type { TripPlan } from '@/lib/routing/planner';
import { bboxFromOriginDest, shapeIntersectsBBox } from '@/lib/routing/bbox';
import type { PublishedShape } from '@/lib/routing/load-published-shapes';

function fakePlan(
  partial: Partial<TripPlan> & { type: TripPlan['type'] }
): TripPlan {
  return {
    segments: partial.segments ?? [],
    boardingPoint: [0, 0],
    alightingPoint: [0, 0],
    totalDistance: partial.totalDistance ?? 1000,
    totalDuration: partial.totalDuration ?? 600,
    walkDistanceTotal: partial.walkDistanceTotal ?? 200,
    type: partial.type,
  };
}

describe('trip URL state', () => {
  it('parsea from/to Morelia', () => {
    const c = parseCoordParam('-101.1945,19.7025');
    expect(c?.[0]).toBeCloseTo(-101.1945, 3);
    expect(c?.[1]).toBeCloseTo(19.7025, 3);
  });

  it('lee query string de viaje', () => {
    const s = readTripUrlState(
      '?from=-101.19,19.70&to=-101.17,19.68&fromLabel=Centro&plan=1'
    );
    expect(s.origin).not.toBeNull();
    expect(s.destination).not.toBeNull();
    expect(s.originLabel).toBe('Centro');
    expect(s.planIndex).toBe(1);
  });

  it('construye URL compartible', () => {
    const url = buildTripShareUrl({
      base: 'https://viamorelia.org/',
      origin: [-101.19, 19.7],
      destination: [-101.17, 19.68],
      originLabel: 'Catedral',
      planIndex: 0,
    });
    expect(url).toContain('from=');
    expect(url).toContain('to=');
    expect(url).toContain('fromLabel=Catedral');
  });
});

describe('sortTripPlans', () => {
  const plans: TripPlan[] = [
    fakePlan({
      type: 'transfer',
      totalDuration: 900,
      walkDistanceTotal: 100,
      segments: [
        { type: 'ride', instruction: 'a', distance: 1, duration: 1 },
        { type: 'ride', instruction: 'b', distance: 1, duration: 1 },
      ],
    }),
    fakePlan({
      type: 'direct',
      totalDuration: 1200,
      walkDistanceTotal: 50,
      segments: [{ type: 'ride', instruction: 'c', distance: 1, duration: 1 }],
    }),
    fakePlan({
      type: 'direct',
      totalDuration: 500,
      walkDistanceTotal: 400,
      segments: [{ type: 'ride', instruction: 'd', distance: 1, duration: 1 }],
    }),
  ];

  it('ordena por tiempo', () => {
    const sorted = sortTripPlans(plans, 'time' satisfies PlanSortMode);
    expect(sorted[0].totalDuration).toBe(500);
  });

  it('ordena por caminata', () => {
    const sorted = sortTripPlans(plans, 'walk');
    expect(sorted[0].walkDistanceTotal).toBe(50);
  });

  it('ordena por transbordos', () => {
    const sorted = sortTripPlans(plans, 'transfers');
    expect(transferCount(sorted[0])).toBe(0);
    expect(transferCount(sorted[sorted.length - 1])).toBe(1);
  });
});

describe('bbox filter', () => {
  it('bbox OD y shape cercana', () => {
    const origin: [number, number] = [-101.2, 19.7];
    const dest: [number, number] = [-101.18, 19.69];
    const bbox = bboxFromOriginDest(origin, dest, 1);
    const shape: PublishedShape = {
      id: 'x-ida',
      route_id: 'x',
      route_name: 'X',
      color: '#000',
      direction: 'ida',
      coordinates: [
        [-101.195, 19.695],
        [-101.185, 19.692],
      ],
      qa_status: 'approved',
    };
    expect(shapeIntersectsBBox(shape, bbox)).toBe(true);
  });
});
