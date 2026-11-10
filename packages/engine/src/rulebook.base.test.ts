/**
 * Worked examples from the base rulebook, reconstructed from its diagrams, plus one test per base
 * rule (docs/RULES_SPEC.md). Lane 0 is the rightmost lane (bottom row of the rulebook pictures).
 * Teams: seat-0 red, seat-1 blue, seat-2 green, seat-3 black.
 */
import { describe, expect, it } from 'vitest';
import { runEnd, runMovement, runRound, scenario } from './testing';

describe('base rulebook p.3 examples', () => {
  it('B-MOV-4 (p.3 movement): a rider ending on a full square drops back to the first free lane', () => {
    const s = scenario(`
      terrain  .  .  .  .  .  .  .  .
      lane 1   0R .  .  .  2R .  .  .
      lane 0   1S .  .  .  3S 3R .  .
    `);
    const events = runMovement(s.state, { '1S': 5, '0R': 5 });
    // Blue sprinteur goes first (same square, rightmost lane), ending beside black rouleur.
    expect(s.at('1S')).toEqual([5, 1]);
    // Red rouleur would land on the full square 5, then the full square 4, so stops on 3.
    expect(s.at('0R')).toEqual([3, 0]);
    const moved = events.filter((e) => e.type === 'riderMoved');
    expect(moved.map((e) => e.rider)).toEqual(['seat-1:S', 'seat-0:R']);
    expect(moved[1]).toMatchObject({ blocked: true, effectiveValue: 5 });
  });

  it('B-END-2 (p.3 slipstream): packs move rear first and chain', () => {
    const s = scenario(`
      terrain  .  .  .  .  .  .  .  .  .  .
      lane 1   3R .  .  0R .  .  1S .  .  .
      lane 0   2S .  .  0S .  1R 2R .  3S .
    `);
    const events = runEnd(s.state);
    // Pack 1 is two squares back: no move.
    expect(s.at('3R')).toEqual([0, 1]);
    expect(s.at('2S')).toEqual([0, 0]);
    // Pack 2 moves twice (into pack 3, then with merged pack A), keeping lanes.
    expect(s.at('0R')).toEqual([5, 1]);
    expect(s.at('0S')).toEqual([5, 0]);
    // Pack 3 moves once.
    expect(s.at('1R')).toEqual([6, 0]);
    expect(s.at('2R')).toEqual([7, 0]);
    expect(s.at('1S')).toEqual([7, 1]);
    expect(s.at('3S')).toEqual([8, 0]);
    expect(events.filter((e) => e.type === 'slipstream')).toHaveLength(2);
  });

  it('B-END-3 (p.3 exhaustion): an empty square ahead exhausts; an empty lane does not', () => {
    const s = scenario(`
      terrain  .  .  .  .  .  .  .  .  .  .
      lane 1   3R .  .  .  .  0R .  1S .  .
      lane 0   2S .  .  .  .  0S 1R 2R 3S .
    `);
    const exhausted = runEnd(s.state)
      .filter((e) => e.type === 'exhaustionTaken')
      .map((e) => e.rider);
    expect(exhausted.sort()).toEqual(['seat-2:S', 'seat-3:R', 'seat-3:S']);
    expect(s.state.riders['seat-3:S']!.recycled.map((c) => c.kind)).toEqual(['exhaustion']);
  });
});

describe('base rulebook p.4 mountains example', () => {
  it('B-TER-3: riders on an ascent neither give nor receive; descent slipstream is normal', () => {
    const s = scenario(`
      terrain  .  .  ^  ^  ^  v  v  v  .
      lane 0   0S .  1R .  3R 3S .  1S .
    `);
    const events = runEnd(s.state);
    expect(s.at('0S')).toEqual([0, 0]); // blue rouleur on the ascent does not give
    expect(s.at('1R')).toEqual([2, 0]); // on the ascent, cannot receive
    expect(s.at('3R')).toEqual([4, 0]); // on the ascent, cannot receive
    expect(s.at('3S')).toEqual([6, 0]); // on the descent: moves up behind blue sprinteur
    expect(s.at('1S')).toEqual([7, 0]);
    const exhausted = events.filter((e) => e.type === 'exhaustionTaken').map((e) => e.rider);
    expect(exhausted.sort()).toEqual(['seat-0:S', 'seat-1:R', 'seat-1:S', 'seat-3:R']);
  });
});

describe('ascent and descent movement (B-TER-1, B-TER-2, B-TER-4, B-VAL-1)', () => {
  const at = (diagram: string, value: number) => {
    const s = scenario(diagram);
    const [ev] = runMovement(s.state, { '0R': value }).filter((e) => e.type === 'riderMoved');
    return { pos: s.at('0R'), ev };
  };

  it('a rider starting on an ascent moves at most 5', () => {
    const { pos, ev } = at(
      `
      terrain  ^  ^  .  .  .  .  .  .  .  .  .
      lane 0   0R .  .  .  .  .  .  .  .  .  .
    `,
      9,
    );
    expect(pos).toEqual([5, 0]);
    expect(ev).toMatchObject({ cardValue: 9, effectiveValue: 5 });
  });

  it('a rider crossing an ascent within its first five steps moves at most 5', () => {
    const { pos } = at(
      `
      terrain  .  .  .  ^  .  .  .  .  .  .  .
      lane 0   0R .  .  .  .  .  .  .  .  .  .
    `,
      7,
    );
    expect(pos).toEqual([5, 0]);
  });

  it('a rider whose 6th step would enter the ascent moves 5', () => {
    const { pos } = at(
      `
      terrain  .  .  .  .  .  .  ^  ^  .  .  .
      lane 0   0R .  .  .  .  .  .  .  .  .  .
    `,
      9,
    );
    expect(pos).toEqual([5, 0]);
  });

  it('a rider whose 7th step would enter the ascent stops just before it (B-TER-2)', () => {
    const { pos, ev } = at(
      `
      terrain  .  .  .  .  .  .  .  ^  ^  .  .
      lane 0   0R .  .  .  .  .  .  .  .  .  .
    `,
      9,
    );
    expect(pos).toEqual([6, 0]);
    expect(ev).toMatchObject({ effectiveValue: 6, ascentEdge: true });
  });

  it('a rider starting on a descent moves at least 5', () => {
    const { pos, ev } = at(
      `
      terrain  v  v  v  .  .  .  .  .  .  .  .
      lane 0   0R .  .  .  .  .  .  .  .  .  .
    `,
      2,
    );
    expect(pos).toEqual([5, 0]);
    expect(ev).toMatchObject({
      cardValue: 2,
      effectiveValue: 5,
      modifiers: [{ source: 'descent', result: 5 }],
    });
  });

  it('the descent minimum applies before the ascent cap', () => {
    const { pos } = at(
      `
      terrain  v  .  ^  .  .  .  .  .  .  .  .
      lane 0   0R .  .  .  .  .  .  .  .  .  .
    `,
      3,
    );
    expect(pos).toEqual([5, 0]);
  });
});

describe('movement and finish rules', () => {
  it('B-MOV-5: a rider arriving on a part-filled square takes the free lane', () => {
    const s = scenario(`
      terrain  .  .  .  .  .  .
      lane 1   .  .  .  .  .  .
      lane 0   0R .  .  1R .  .
    `);
    runMovement(s.state, { '0R': 3 });
    expect(s.at('0R')).toEqual([3, 1]);
  });

  it('B-MOV-3: riders pass through occupied squares', () => {
    const s = scenario(`
      terrain  .  .  .  .  .  .  .
      lane 1   .  1S .  .  .  .  .
      lane 0   0R 1R .  .  .  .  .
    `);
    runMovement(s.state, { '0R': 4 });
    expect(s.at('0R')).toEqual([4, 0]);
  });

  it('B-MOV-2: movement order is decided before anyone moves', () => {
    const s = scenario(`
      terrain  .  .  .  .  .  .  .  .  .  .
      lane 0   0R .  1R .  .  .  .  .  .  .
    `);
    const order = runMovement(s.state, { '0R': 9, '1R': 2 })
      .filter((e) => e.type === 'riderMoved')
      .map((e) => e.rider);
    expect(order).toEqual(['seat-1:R', 'seat-0:R']);
  });

  it('B-FIN-2: the rider furthest past the line wins; same square goes to the rightmost lane', () => {
    const s = scenario(`
      terrain  .  .  .  F  .  .  .  .
      lane 1   .  1R .  .  .  .  .  .
      lane 0   0R 2R .  .  .  .  .  .
    `);
    const events = runRound(s.state, { '0R': 5, '1R': 4, '2R': 4 });
    const finished = events.filter((e) => e.type === 'riderFinished');
    // 2R (lane 0) moves first to square 5, then 1R beside it; 0R finds square 5 full and stops on 4.
    expect(finished.map((e) => e.rider)).toEqual(['seat-2:R', 'seat-1:R', 'seat-0:R']);
    expect(s.state.phase).toBe('stageEnd');
    expect(s.state.result?.[0]).toBe('seat-2:R');
  });
});
