import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  decodePolyline6,
  getValhallaUrl,
  callValhallaRoute,
  callValhallaTraceRoute,
  windowsToWslPath,
  clearValhallaUrlCache,
} from '@/lib/gis/valhalla';

function lastPostBody(mockFetch: ReturnType<typeof vi.fn>): Record<string, unknown> {
  const postCalls = mockFetch.mock.calls.filter(
    (c) => c[1] && typeof c[1] === 'object' && 'body' in (c[1] as object) && (c[1] as { body?: string }).body
  );
  expect(postCalls.length).toBeGreaterThan(0);
  const last = postCalls[postCalls.length - 1];
  return JSON.parse((last[1] as { body: string }).body);
}

describe('Valhalla GIS helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearValhallaUrlCache();
  });

  describe('decodePolyline6', () => {
    it('decodes a simple polyline6 string', () => {
      const coords = decodePolyline6('`~o~zD_j|iC');
      expect(coords.length).toBeGreaterThanOrEqual(1);
      expect(coords[0][0]).toBeCloseTo(2.276, 3);
      expect(coords[0][1]).toBeCloseTo(-98.558, 3);
    });

    it('returns empty array for empty string', () => {
      expect(decodePolyline6('')).toEqual([]);
    });
  });

  describe('getValhallaUrl', () => {
    it('returns a valid URL string', async () => {
      const url = await getValhallaUrl();
      expect(url).toBeTypeOf('string');
      expect(url).toMatch(/^https?:\/\//);
    });
  });

  describe('windowsToWslPath', () => {
    it('converts Windows drive paths to /mnt/<drive>', () => {
      expect(windowsToWslPath('D:\\rutasmorelia')).toMatch(/^\/mnt\/d\//i);
      expect(windowsToWslPath('D:\\rutasmorelia\\scripts')).toContain('scripts');
    });
  });

  describe('callValhallaRoute', () => {
    it('calls fetch and returns decoded coordinates', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (String(url).includes('/status')) {
          return { ok: true, json: async () => ({ version: 'test' }) };
        }
        return {
          ok: true,
          json: async () => ({
            trip: {
              legs: [{ shape: '`~o~zD_j|iC' }],
            },
          }),
        };
      });
      global.fetch = mockFetch;

      const coords = await callValhallaRoute([
        [-101.194, 19.702],
        [-101.195, 19.703],
      ]);
      const body = lastPostBody(mockFetch);
      expect(body.costing_options).toMatchObject({
        auto: { ignore_oneways: true, ignore_restrictions: true },
      });
      expect(coords.length).toBeGreaterThan(0);
      expect(coords[0][0]).toBeCloseTo(2.276, 3);
    });

    it('throws error when fetch fails', async () => {
      global.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (String(url).includes('/status')) {
          return { ok: true, json: async () => ({ version: 'test' }) };
        }
        return {
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        };
      });

      await expect(callValhallaRoute([[-101.194, 19.702]])).rejects.toThrow('Valhalla route error');
    });
  });

  describe('callValhallaTraceRoute', () => {
    it('calls fetch with correct shape match options and returns matched coords', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (String(url).includes('/status')) {
          return { ok: true, json: async () => ({ version: 'test' }) };
        }
        return {
          ok: true,
          json: async () => ({
            trip: {
              confidence: 0.95,
              legs: [{ shape: '`~o~zD_j|iC' }],
            },
          }),
        };
      });
      global.fetch = mockFetch;

      const result = await callValhallaTraceRoute(
        [
          [-101.194, 19.702],
          [-101.195, 19.703],
        ],
        40
      );
      const body = lastPostBody(mockFetch);
      expect(body.costing_options).toMatchObject({
        auto: { ignore_oneways: true, ignore_restrictions: true },
      });
      expect(body.shape_match).toBe('map_snap');
      expect(result.confidence).toBe(0.95);
      expect(result.coordinates.length).toBeGreaterThan(0);
    });
  });
});
