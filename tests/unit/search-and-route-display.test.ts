import { describe, expect, it } from 'vitest';
import { fuzzySearchRoutes } from '@/lib/search/fuzzy';
import { parseRouteDisplay, availabilityLabel } from '@/lib/routes/route-display';
import type { Route } from '@/lib/supabase/client';

const sample: Route[] = [
  {
    id: 'ruta-morada-1-aldea',
    name: 'Morada 1 [Aldea]',
    description: '',
    color: '#6A1B9A',
    casing_color: '#222',
    transport_type: 'combi',
    status: 'approved',
    created_at: '',
    updated_at: '',
  },
  {
    id: 'ruta-naranja-camelinas',
    name: 'Naranja Camelinas',
    description: 'Av. Camelinas',
    color: '#FF9800',
    casing_color: '#222',
    transport_type: 'combi',
    status: 'approved',
    created_at: '',
    updated_at: '',
  },
  {
    id: 'ruta-amarilla-centro',
    name: 'Amarilla 1 Centro',
    description: 'Centro Histórico',
    color: '#FFD000',
    casing_color: '#222',
    transport_type: 'combi',
    status: 'approved',
    created_at: '',
    updated_at: '',
  },
];

describe('fuzzy route search', () => {
  it('encuentra Morada con typo morda', () => {
    const hits = fuzzySearchRoutes(sample, 'morda');
    expect(hits.some((r) => r.id.includes('morada'))).toBe(true);
  });

  it('encuentra Camelinas con cam', () => {
    const hits = fuzzySearchRoutes(sample, 'cam');
    expect(hits.some((r) => /camelinas/i.test(r.name))).toBe(true);
  });

  it('encuentra rutas de centro', () => {
    const hits = fuzzySearchRoutes(sample, 'centro salida');
    expect(hits.some((r) => /centro/i.test(r.name))).toBe(true);
  });
});

describe('route display', () => {
  it('extrae corredor y terminales de corchetes', () => {
    const d = parseRouteDisplay({
      id: 'x',
      name: 'Naranja 3 [Centro - Puerta Del Sol]',
    });
    expect(d.corridors).toContain('Centro');
    expect(d.terminalIda).toMatch(/Centro/i);
    expect(d.terminalVuelta).toMatch(/Sol/i);
  });

  it('availability labels', () => {
    expect(availabilityLabel('approved').label).toBe('Disponible');
    expect(availabilityLabel('needs_review').tone).toBe('warn');
  });
});
