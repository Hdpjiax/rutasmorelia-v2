import { describe, expect, it, beforeAll, beforeEach } from 'vitest';

describe('ui telemetry + offline store', () => {
  beforeAll(() => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, String(v));
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
      clear: () => map.clear(),
      key: (i: number) => Array.from(map.keys())[i] ?? null,
      get length() {
        return map.size;
      },
    };
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: globalThis,
      configurable: true,
    });
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('registra panel open/close', async () => {
    const { uiTelemetry } = await import('@/lib/telemetry/ui-events');
    uiTelemetry.panelOpen('routes');
    uiTelemetry.panelClose('routes');
    const recent = uiTelemetry.recent(10);
    expect(recent.some((e) => e.type === 'panel_open')).toBe(true);
    expect(recent.some((e) => e.type === 'panel_close')).toBe(true);
  });

  it('guarda y lee última búsqueda y meta de rutas', async () => {
    const {
      cacheRouteMetaList,
      loadCachedRouteMetaList,
      saveLastTripSearch,
      loadLastTripSearch,
    } = await import('@/lib/offline/store');

    saveLastTripSearch({
      originLabel: 'Centro',
      destinationLabel: 'Camelinas',
      origin: [-101.19, 19.7],
      destination: [-101.2, 19.68],
    });
    const trip = loadLastTripSearch();
    expect(trip?.originLabel).toBe('Centro');

    cacheRouteMetaList([{ id: 'r1', name: 'Morada 1', color: '#600' }]);
    expect(loadCachedRouteMetaList()[0]?.id).toBe('r1');
  });
});
