import { describe, expect, it } from 'vitest';
import {
  TILE_CATALOG,
  compileStage,
  generateStage,
  generateTour,
  layoutStage,
  validateStage,
} from './index';

describe('generateStage', () => {
  it('is reproducible for a seed', () => {
    expect(generateStage('x', TILE_CATALOG).tiles).toEqual(generateStage('x', TILE_CATALOG).tiles);
  });

  it.each([
    ['plain', {}],
    ['Peloton', { peloton: true }],
    ['six teams', { teams: 6 }],
    ['new tiles', { newTiles: true }],
    ['everything', { teams: 6, newTiles: true, breakaway: true, wideFinish: true }],
  ] as const)('long %s stages always generate and are 24 squares longer', (_n, opts) => {
    for (let i = 0; i < 12; i++) {
      const normal = generateStage(`e${i}`, TILE_CATALOG, opts);
      const long = generateStage(`e${i}`, TILE_CATALOG, { ...opts, extended: true });
      expect(long.type).toBe('extended');
      expect(validateStage(long, TILE_CATALOG)).toEqual([]);
      expect(layoutStage(long, TILE_CATALOG).overlaps).toEqual([]);
      expect(long.tiles).toHaveLength(normal.tiles.length + 4);
      const length = (st: typeof long) => compileStage(st, TILE_CATALOG).finishIndex;
      expect(length(long)).toBeGreaterThanOrEqual(length(normal) + 20);
    }
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

describe('generateTour', () => {
  it('is reproducible, names every stage and ends on a normal stage', () => {
    const a = generateTour('abc', TILE_CATALOG, { stages: 7, special: true });
    const b = generateTour('abc', TILE_CATALOG, { stages: 7, special: true });
    expect(a).toEqual(b);
    expect(a.stages.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7].map((n) => `gen-abc-${n}`));
    expect(new Set(a.stages.map((s) => s.name)).size).toBe(7);
    expect(a.stages.map((s) => s.type)).toEqual([
      'teamTimeTrial',
      'normal',
      'normal',
      'extended',
      'normal',
      'individualTimeTrial',
      'normal',
    ]);
    expect(a.stages[1]!.tiles.some((t) => /^[xyz]_/.test(t))).toBe(true);
    expect(a.restAfter).toEqual([4]);
  });

  it('plain tours have only normal stages on base and Peloton tiles', () => {
    const t = generateTour('plain', TILE_CATALOG, { stages: 5 });
    expect(t.stages.every((s) => s.type === 'normal')).toBe(true);
    expect(t.stages.some((s) => s.tiles.some((x) => /^[xyz]_/.test(x)))).toBe(false);
  });

  it('a 21-stage tour has two rest days, two individual time trials and three long stages', () => {
    const t = generateTour('big', TILE_CATALOG, { stages: 21, special: true });
    const count = (type: string) => t.stages.filter((s) => s.type === type).length;
    expect(t.restAfter).toEqual([9, 15]);
    expect(count('teamTimeTrial')).toBe(1);
    expect(count('individualTimeTrial')).toBe(2);
    expect(count('extended')).toBe(3);
    expect(t.stages.at(-1)!.type).toBe('normal');
  });

  it.each([
    ['small field', {}],
    ['breakaway', { breakaway: true }],
    ['six teams with breakaway', { teams: 6, breakaway: true }],
    ['twelve single riders', { teams: 12 }],
  ] as const)('%s: every stage is legal, wide-finished and does not cross', (_n, opts) => {
    for (const seed of ['s1', 's2', 's3']) {
      const t = generateTour(seed, TILE_CATALOG, { stages: 10, special: true, ...opts });
      for (const stage of t.stages) {
        expect(validateStage(stage, TILE_CATALOG)).toEqual([]);
        expect(layoutStage(stage, TILE_CATALOG).overlaps).toEqual([]);
        expect(stage.tiles.at(-1)![0]).toBe('v');
        const trial = stage.type === 'teamTimeTrial' || stage.type === 'individualTimeTrial';
        expect(stage.tiles[1]!.startsWith('2_')).toBe('breakaway' in opts && !trial);
      }
    }
  });
});
