/**
 * Peloton rulebook rules and its worked example (docs/RULES_SPEC.md P-*). Lane 0 is the rightmost
 * lane. Terrain: `#` cobblestone, `=` supply zone; the `lanes` row gives lane counts.
 */
import { describe, expect, it } from 'vitest';
import { previewMove } from './api';
import { runEnd, runMovement, scenario } from './testing';

const card = (value: number) => ({ id: 'x', kind: 'energy' as const, value, powers: [] });

describe('Peloton rulebook p.1', () => {
  it('P-SUP-2 (p.1 note): three abreast in a supply zone slipstream into two lanes', () => {
    const s = scenario(`
      terrain  =  =  =  .  .  .
      lanes    3  3  3  2  2  2
      lane 2   .  .  2R .  .  .
      lane 1   .  .  1R .  .  .
      lane 0   .  3R 0R .  2S .
    `);
    const events = runEnd(s.state);
    // The two riders in the rightmost lanes move up; the third stays and shifts to lane 0.
    expect(s.at('0R')).toEqual([3, 0]);
    expect(s.at('1R')).toEqual([3, 1]);
    expect(s.at('2R')).toEqual([2, 0]);
    // The rider behind stays put: there is still a rider in the square in front of it.
    expect(s.at('3R')).toEqual([1, 0]);
    expect(events.some((e) => e.type === 'riderShifted')).toBe(true);
  });

  it('P-COB-1: no slipstream from a rider on cobblestones', () => {
    const s = scenario(`
      terrain  .  .  #  #  .
      lanes    2  2  1  1  2
      lane 0   0R .  1R .  .
    `);
    runEnd(s.state);
    expect(s.at('0R')).toEqual([0, 0]);
  });

  it('P-COB-1: no slipstream to a rider on cobblestones', () => {
    const s = scenario(`
      terrain  #  #  .  .  .
      lanes    1  1  2  2  2
      lane 0   0R .  1R .  .
    `);
    runEnd(s.state);
    expect(s.at('0R')).toEqual([0, 0]);
  });

  it('P-SUP-1: starting in a supply zone, a card counts as at least 4; slipstream is normal', () => {
    const s = scenario(`
      terrain  =  =  =  =  =  .  .  .
      lanes    3  3  3  3  3  2  2  2
      lane 0   0S .  .  .  .  .  .  .
    `);
    const p = previewMove(s.state, 'seat-0:S', card(2));
    expect(p.effectiveValue).toBe(4);
    runMovement(s.state, { '0S': 2 });
    expect(s.at('0S')).toEqual([4, 0]);

    const t = scenario(`
      terrain  =  =  =  =  .
      lanes    3  3  3  3  2
      lane 0   0R .  1R .  .
    `);
    runEnd(t.state);
    expect(t.at('0R')).toEqual([1, 0]);
  });

  it('P-GEN-1: a full single-lane square sends a rider back; a third lane takes a third rider', () => {
    const s = scenario(`
      terrain  .  .  #  #  .  .  .
      lanes    2  2  1  1  3  3  3
      lane 2   .  .  .  .  .  .  .
      lane 1   .  .  .  .  .  2R .
      lane 0   0R .  .  1R .  2S .
    `);
    runMovement(s.state, { '0R': 3, '1R': 2 });
    // seat-1 moves first (front): 3 → 5, taking the third lane beside seat-2's riders.
    expect(s.at('1R')).toEqual([5, 2]);
    // seat-0 aims at square 3 (single lane, now empty after seat-1 left): it fits.
    expect(s.at('0R')).toEqual([3, 0]);

    const t = scenario(`
      terrain  .  .  #  #  .
      lanes    2  2  1  1  2
      lane 0   0R .  .  1R .
    `);
    runMovement(t.state, { '0R': 3 });
    // Square 3 is a full single lane: the rider stops on square 2.
    expect(t.at('0R')).toEqual([2, 0]);
  });
});
