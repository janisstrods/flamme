import { describe, expect, it } from 'vitest';
import { ORIGINAL_STAGES, TILE_CATALOG, layoutStage } from '@velo/content';
import { trialPoint, trialPose } from './trialSpread';

/** Ray-casting point-in-polygon test. */
function inside(x: number, y: number, poly: readonly (readonly [number, number])[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

describe('trialPoint', () => {
  const layouts = ORIGINAL_STAGES.map((s) => layoutStage(s, TILE_CATALOG));

  it('keeps every team on its own square, straight or curved, up to 8 teams', () => {
    for (const layout of layouts) {
      for (const g of Object.values(layout.squares)) {
        for (const teams of [1, 2, 4, 6, 8]) {
          for (let team = 0; team < teams; team++) {
            for (let lane = 0; lane < g.lanes.length; lane++) {
              const [x, y] = trialPoint(g, lane, team, teams);
              expect(inside(x, y, g.polygon), `${g.id} lane ${lane} team ${team}/${teams}`).toBe(
                true,
              );
            }
          }
        }
      }
    }
  });

  it('stays in its lane: the middle team sits on the lane centre', () => {
    const g = Object.values(layouts[0]!.squares)[0]!;
    const [x, y] = trialPoint(g, 0, 1, 3);
    expect(x).toBeCloseTo(g.lanes[0]![0]);
    expect(y).toBeCloseTo(g.lanes[0]![1]);
  });

  it('puts earlier teams ahead of later ones', () => {
    const g = Object.values(layouts[0]!.squares)[0]!;
    const ahead = (p: [number, number]) =>
      (p[0] - g.center[0]) * Math.cos(g.heading) + (p[1] - g.center[1]) * Math.sin(g.heading);
    expect(ahead(trialPoint(g, 0, 0, 4))).toBeGreaterThan(ahead(trialPoint(g, 0, 3, 4)));
  });

  const turn = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

  it('faces along the road: the square heading in the middle, turned with the curve elsewhere', () => {
    let bent = 0;
    for (const layout of layouts) {
      for (const g of Object.values(layout.squares)) {
        expect(turn(trialPose(g, 0, 1, 3).heading, g.heading)).toBeCloseTo(0);
        const front = turn(trialPose(g, 0, 0, 8).heading, g.heading);
        const back = turn(trialPose(g, 0, 7, 8).heading, g.heading);
        // Front and back riders lean opposite ways by the same amount, never past the square's turn.
        expect(front + back).toBeCloseTo(0);
        expect(Math.abs(front)).toBeLessThan(Math.PI / 4);
        if (Math.abs(front) > 0.05) bent++;
      }
    }
    expect(bent).toBeGreaterThan(0);
  });
});
