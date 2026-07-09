import { describe, it, expect } from 'vitest';
import {
  normalizeTransportType,
  toStoredTransportType,
  transportLabel,
} from '@/lib/transport/classify';

describe('transport classify', () => {
  it('maps combi and foraneo correctly', () => {
    expect(normalizeTransportType('combi')).toBe('combi');
    expect(normalizeTransportType('foraneo')).toBe('autobus');
    expect(normalizeTransportType('autobus')).toBe('autobus');
    expect(normalizeTransportType('bus')).toBe('autobus');
  });

  it('infers foraneo from route id', () => {
    expect(normalizeTransportType(undefined, 'ruta-charo')).toBe('autobus');
    expect(normalizeTransportType(undefined, 'ruta-arco-san-pedro')).toBe('autobus');
    expect(normalizeTransportType(undefined, 'ruta-amarilla-centro')).toBe('combi');
  });

  it('stores canonical types', () => {
    expect(toStoredTransportType('combi')).toBe('combi');
    expect(toStoredTransportType('autobus')).toBe('foraneo');
  });

  it('labels for UI', () => {
    expect(transportLabel('combi')).toBe('Combis');
    expect(transportLabel('autobus')).toBe('Autobuses');
    expect(transportLabel('all')).toBe('Todos');
  });
});
