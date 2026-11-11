import { describe, expect, it } from 'vitest';
import {
  FIXTURE_STAGE,
  FIXTURE_TILES,
  ORIGINAL_STAGES,
  TILE_CATALOG,
  compileStage,
  layoutStage,
  validateStage,
  withWideFinish,
} from './index';

describe('layoutStage', () => {
  it('gives every compiled square a polygon and one point per lane', () => {
    const track = compileStage(FIXTURE_STAGE, FIXTURE_TILES);
    const layout = layoutStage(FIXTURE_STAGE, FIXTURE_TILES);
    for (const sq of Object.values(track.squares)) {
      const g = layout.squares[sq.id];
      expect(g, sq.id).toBeDefined();
      expect(g!.lanes).toHaveLength(sq.lanes);
      expect(g!.polygon.length).toBeGreaterThan(3);
    }
  });

  it('places lane 0 on the right of the direction of travel', () => {
    const layout = layoutStage(FIXTURE_STAGE, FIXTURE_TILES);
    const g = layout.squares['t1.s0.q0']!; // first straight, heading along +x on screen
    expect(Math.cos(g.heading)).toBeCloseTo(1);
    // On screen (y down), the right of travel along +x is larger y.
    expect(g.lanes[0]![1]).toBeGreaterThan(g.lanes[1]![1]);
  });

  it('turns a tight curve by 90 degrees', () => {
    const stage = { ...FIXTURE_STAGE, id: 'turn', tiles: ['a_w', 'e_w', 'u_w'] };
    delete (stage as { expectedLength?: number }).expectedLength;
    const l = layoutStage(stage, TILE_CATALOG);
    const before = l.squares['t0.s0.q5']!.heading;
    const after = l.squares['t2.s0.q0']!.heading;
    expect(Math.abs(Math.abs(after - before) - Math.PI / 2)).toBeLessThan(1e-6);
  });
});

describe('original stages (C-002)', () => {
  it.each(ORIGINAL_STAGES.map((s) => [s.name, s] as const))(
    '%s is valid and does not cross itself',
    (_n, stage) => {
      expect(validateStage(stage, TILE_CATALOG)).toEqual([]);
      expect(layoutStage(stage, TILE_CATALOG).overlaps).toEqual([]);
      // Tours swap in the wide finish, which must fit as well.
      expect(layoutStage(withWideFinish(stage), TILE_CATALOG).overlaps).toEqual([]);
    },
  );
});
