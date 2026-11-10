/**
 * Fixture tiles: invented, test-only pieces used by the contract fixtures and early engine tests.
 * They do not describe any published tile. The real catalog is built from the owner's photos.
 */
import type { SquareSpec, TileCatalog } from '../schema';

const flat = (n: number, extra: Partial<SquareSpec> = {}): SquareSpec[] =>
  Array.from({ length: n }, () => ({
    lanes: 2,
    terrain: 'flat',
    flags: [],
    verified: true,
    ...extra,
  }));

export const FIXTURE_TILES: TileCatalog = {
  version: 1,
  tiles: [
    {
      id: 'fx-start',
      source: 'fixture',
      shape: { kind: 'start' },
      segments: [
        {
          type: 'linear',
          squares: [
            ...flat(4, { flags: ['startGrid'] }),
            { lanes: 2, terrain: 'flat', flags: ['startLine'], verified: true },
            ...flat(1),
          ],
        },
      ],
    },
    {
      id: 'fx-straight',
      source: 'fixture',
      shape: { kind: 'straight' },
      segments: [{ type: 'linear', squares: flat(6) }],
    },
    {
      id: 'fx-curve',
      source: 'fixture',
      shape: { kind: 'curve', severity: 'gentle', direction: 'left' },
      segments: [{ type: 'linear', squares: flat(2) }],
    },
    {
      id: 'fx-climb',
      source: 'fixture',
      shape: { kind: 'straight' },
      segments: [
        {
          type: 'linear',
          squares: [...flat(3, { terrain: 'ascent' }), ...flat(3, { terrain: 'descent' })],
        },
      ],
    },
    {
      id: 'fx-narrow',
      source: 'fixture',
      shape: { kind: 'straight' },
      segments: [{ type: 'linear', squares: flat(6, { lanes: 1, terrain: 'cobblestone' }) }],
    },
    {
      id: 'fx-finish',
      source: 'fixture',
      shape: { kind: 'finish' },
      segments: [
        {
          type: 'linear',
          squares: [
            ...flat(1),
            { lanes: 2, terrain: 'flat', flags: ['finishLine'], verified: true },
            ...flat(4),
          ],
        },
      ],
    },
  ],
};
