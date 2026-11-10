import { describe, expect, it } from 'vitest';
import { TILE_CATALOG, compileStage, generateStage, layoutStage, validateStage } from './index';

describe('generateStage', () => {
  it('is reproducible for a seed', () => {
    expect(generateStage('x', TILE_CATALOG).tiles).toEqual(generateStage('x', TILE_CATALOG).tiles);
  });

  it.each([
    ['base', {}],
    ['Peloton', { peloton: true }],
    ['breakaway', { breakaway: true }],
    ['six teams', { teams: 6 }],
    ['six teams with breakaway', { teams: 6, breakaway: true }],
  ] as const)('%s stages are legal, do not cross and follow the design advice', (_n, opts) => {
    for (let i = 0; i < 10; i++) {
      const stage = generateStage(`t${i}`, TILE_CATALOG, opts);
      expect(validateStage(stage, TILE_CATALOG)).toEqual([]);
      expect(layoutStage(stage, TILE_CATALOG).overlaps).toEqual([]);
      const big = 'teams' in opts;
      expect(stage.tiles[0]![0]).toBe(big ? '1' : 'a');
      if ('breakaway' in opts) expect(stage.tiles[1]).toBe(big ? '2_w' : '2_s');
      if (big) {
        expect(stage.tiles).toEqual(expect.arrayContaining(['3_w', '4_w']));
        expect(stage.tiles.some((t) => t.startsWith('9_'))).toBe(true);
        const track = compileStage(stage, TILE_CATALOG);
        const grid = track.startGrid.reduce((n, id) => n + track.squares[id]!.lanes, 0);
        expect(grid).toBeGreaterThanOrEqual(12);
      }
      expect(['3_w', '4_w']).not.toContain(stage.tiles.at(-2));
    }
  });
});
