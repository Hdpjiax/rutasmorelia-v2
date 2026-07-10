import { describe, expect, it } from 'vitest';
import { mergeAndRankPlaces, scoreHitForQuery } from '@/lib/search/rank-places';
import type { PlaceHit } from '@/lib/search/morelia-places';

function hit(
  name: string,
  source: PlaceHit['source'] = 'catalog',
  coords: [number, number] = [-101.19, 19.7]
): PlaceHit {
  return {
    id: name,
    name,
    description: 'x',
    category: 'place',
    coordinates: coords,
    source,
  };
}

describe('rank places', () => {
  it('pone coincidencia exacta primero', () => {
    const ranked = mergeAndRankPlaces(
      [
        [
          hit('Centro Comercial Las Américas'),
          hit('Centro'),
          hit('Centro Histórico'),
          hit('Plaza del Centro Sur'),
        ],
      ],
      'Centro'
    );
    expect(ranked[0].name).toBe('Centro');
  });

  it('exacto gana a favorito parcial', () => {
    const ranked = mergeAndRankPlaces(
      [
        [hit('Metrópolis', 'catalog')],
        [{ ...hit('Casa cerca de Metrópolis', 'favorite'), isFavorite: true }],
      ],
      'Metrópolis'
    );
    expect(ranked[0].name).toBe('Metrópolis');
  });

  it('score exacto es el más alto', () => {
    const exact = scoreHitForQuery(hit('Catedral'), 'Catedral');
    const partial = scoreHitForQuery(hit('Catedral de Morelia'), 'Catedral');
    expect(exact).toBeGreaterThan(partial);
  });
});
