import { describe, expect, it } from 'vitest';
import {
  isViaMoreliaHost,
  normalizeDeepLinkToPath,
  parseDeepLink,
} from '@/lib/trip/deep-link';

describe('deep-link', () => {
  it('reconoce hosts de ViaMorelia', () => {
    expect(isViaMoreliaHost('viamorelia.org')).toBe(true);
    expect(isViaMoreliaHost('www.viamorelia.org')).toBe(true);
    expect(isViaMoreliaHost('evil.com')).toBe(false);
  });

  it('normaliza https con viaje compartido', () => {
    const path = normalizeDeepLinkToPath(
      'https://viamorelia.org/?from=-101.194,19.702&to=-101.18,19.71&fromLabel=Centro'
    );
    expect(path).toContain('from=-101.194');
    expect(path).toContain('to=-101.18');
  });

  it('normaliza esquema custom viamorelia://open', () => {
    const path = normalizeDeepLinkToPath(
      'viamorelia://open?from=-101.194,19.702&to=-101.18,19.71'
    );
    expect(path?.startsWith('/')).toBe(true);
    expect(path).toContain('from=');
    expect(path).toContain('to=');
  });

  it('parsea trip desde deep link', () => {
    const detail = parseDeepLink(
      'https://viamorelia.org/?from=-101.194,19.702&to=-101.185,19.69'
    );
    expect(detail?.hasTrip).toBe(true);
    expect(detail?.trip.origin?.[0]).toBeCloseTo(-101.194, 3);
    expect(detail?.trip.destination?.[0]).toBeCloseTo(-101.185, 3);
  });

  it('ignora hosts externos', () => {
    expect(normalizeDeepLinkToPath('https://maps.google.com/?q=morelia')).toBeNull();
  });
});
