/**
 * Throttle temporal + filtro de proximidad (GPS / cámara).
 */

export type ThrottleGate = {
  /** true si debe procesarse esta actualización */
  shouldAccept: (coords?: [number, number]) => boolean;
  reset: () => void;
};

/**
 * @param minIntervalMs lapso mínimo entre aceptaciones (default 1500–2000 ms GPS)
 * @param minMoveMeters ignorar micro-movimientos del sensor (default 8 m)
 */
export function createThrottleGate(
  minIntervalMs = 1750,
  minMoveMeters = 8
): ThrottleGate {
  let lastAt = 0;
  let lastCoords: [number, number] | null = null;

  return {
    shouldAccept(coords) {
      const now = Date.now();
      if (now - lastAt < minIntervalMs) return false;

      if (coords && lastCoords) {
        const dLng =
          (coords[0] - lastCoords[0]) *
          111320 *
          Math.cos((coords[1] * Math.PI) / 180);
        const dLat = (coords[1] - lastCoords[1]) * 110540;
        const meters = Math.hypot(dLng, dLat);
        if (meters < minMoveMeters) {
          // Actualiza tiempo para no spamear, pero no “acepta” movimiento de cámara
          lastAt = now;
          return false;
        }
      }

      lastAt = now;
      if (coords) lastCoords = coords;
      return true;
    },
    reset() {
      lastAt = 0;
      lastCoords = null;
    },
  };
}
