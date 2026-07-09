import { getHaversineDistance } from '../supabase/client';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  boundsValid: boolean;
  hasDuplicates: boolean;
  gaps: { index: number; distance: number; from: [number, number]; to: [number, number] }[];
}

export interface ValidationOptions {
  maxGapMeters?: number; // threshold to define a straight-line gap (default 500m)
}

const MORELIA_BOUNDS = {
  minLat: 19.5,
  maxLat: 20.0,
  minLng: -101.4,
  maxLng: -101.0,
};

/**
 * Performs spatial validation on route shapes (coordinates as [longitude, latitude]).
 * Checks:
 * 1. Coordinates are within Morelia bounds (19.5 to 20.0 Lat, -101.4 to -101.0 Lng).
 * 2. Duplicate or consecutive identical points.
 * 3. Straight-line gaps between consecutive points exceeding a threshold (default 500m).
 */
export function validateRouteShape(
  coordinates: [number, number][],
  options: ValidationOptions = {}
): ValidationResult {
  const maxGapMeters = options.maxGapMeters ?? 500;
  const errors: string[] = [];
  const warnings: string[] = [];
  const gaps: { index: number; distance: number; from: [number, number]; to: [number, number] }[] = [];
  let boundsValid = true;
  let hasDuplicates = false;

  if (!coordinates || coordinates.length < 2) {
    return {
      isValid: false,
      errors: ['Route shape must have at least 2 points.'],
      warnings: [],
      boundsValid: false,
      hasDuplicates: false,
      gaps: [],
    };
  }

  for (let i = 0; i < coordinates.length; i++) {
    const [lng, lat] = coordinates[i];

    // Check bounds
    if (
      lat < MORELIA_BOUNDS.minLat ||
      lat > MORELIA_BOUNDS.maxLat ||
      lng < MORELIA_BOUNDS.minLng ||
      lng > MORELIA_BOUNDS.maxLng
    ) {
      boundsValid = false;
      errors.push(`Point at index ${i} (${lng}, ${lat}) is outside Morelia bounds.`);
    }

    if (i > 0) {
      const prev = coordinates[i - 1];
      const curr = coordinates[i];

      // Check duplicates (consecutive points with identical coordinates)
      if (prev[0] === curr[0] && prev[1] === curr[1]) {
        hasDuplicates = true;
        errors.push(`Duplicate/consecutive point detected at index ${i}.`);
      } else {
        // Check gaps
        const dist = getHaversineDistance(prev, curr);
        if (dist > maxGapMeters) {
          gaps.push({
            index: i,
            distance: dist,
            from: prev,
            to: curr,
          });
          warnings.push(`Large straight-line gap of ${dist.toFixed(1)}m detected between point ${i - 1} and ${i}.`);
        }
      }
    }
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    boundsValid,
    hasDuplicates,
    gaps,
  };
}
