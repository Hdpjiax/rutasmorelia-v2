import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createThrottleGate } from '@/lib/geo/throttle';

describe('createThrottleGate (GPS)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rechaza actualizaciones más frecuentes que el intervalo', () => {
    const gate = createThrottleGate(1750, 0);
    expect(gate.shouldAccept([-101.19, 19.7])).toBe(true);
    expect(gate.shouldAccept([-101.191, 19.701])).toBe(false);
    vi.advanceTimersByTime(1800);
    expect(gate.shouldAccept([-101.192, 19.702])).toBe(true);
  });

  it('ignora micro-movimientos aunque pase el tiempo', () => {
    const gate = createThrottleGate(100, 50);
    expect(gate.shouldAccept([-101.19, 19.7])).toBe(true);
    vi.advanceTimersByTime(200);
    // ~1 m de desplazamiento ≈ no acepta
    expect(gate.shouldAccept([-101.190001, 19.700001])).toBe(false);
  });
});
