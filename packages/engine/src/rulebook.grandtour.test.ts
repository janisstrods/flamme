/**
 * Grand Tour rulebook rules and worked examples (docs/RULES_SPEC.md G-TIL-*, G-RND-*, G-SPC-*,
 * G-TTT-1, G-ITT-1, G-EXT-1). Lane 0 is the rightmost lane. Terrain `z` is a sharp-corner crash
 * square.
 */
import { TILE_CATALOG, compileStage } from '@velo/content';
import type { GameConfig } from '@velo/protocol';
import { describe, expect, it } from 'vitest';
import { createGame } from './api';
import type { GameState } from './state';
import { runEnd, runMovement, scenario } from './testing';

describe('Grand Tour p.9: sharp corners (G-TIL-2)', () => {
  it('example 1: a blocked rider stopping on a crash square crashes; the next one is held up', () => {
    const s = scenario(`
      terrain  .  .  .  .  z  z  z  .  .  .  .  .
      lanes    2  2  2  2  1  1  1  2  2  2  2  2
      lane 1   .  .  1S .  .  .  .  .  .  .  .  .
      lane 0   .  2S 0R .  .  3R .  .  .  .  .  .
    `);
    const events = runMovement(s.state, { '0R': 5, '1S': 3, '2S': 9 });
    // 0R moves first and passes through the riders as usual.
    expect(s.at('0R')).toEqual([7, 0]);
    // 1S would end on the full square 5: it stops on 4, a crash square, and crashes.
    expect(s.at('1S')).toEqual([4, 0]);
    expect(s.state.riders['seat-1:S']!.crashed).toBe(true);
    // 2S cannot pass the fully crashed single-lane square: it moves only 2, and is safe there.
    expect(s.at('2S')).toEqual([3, 0]);
    expect(s.state.riders['seat-2:S']!.crashed).toBe(false);
    expect(events.filter((e) => e.type === 'riderCrashed')).toEqual([
      { type: 'riderCrashed', riders: ['seat-1:S'], at: 'q4', cause: 'sharpCorner' },
    ]);
  });

  it('ending on a crash square without being blocked is safe; crashed riders give no slipstream', () => {
    const s = scenario(`
      terrain  .  .  .  z  z  z  .  .
      lanes    2  2  2  1  1  1  2  2
      lane 0   0R .  .  .  .  .  .  .
    `);
    runMovement(s.state, { '0R': 4 });
    expect(s.state.riders['seat-0:R']!.crashed).toBe(false);
    const t = scenario(`
      terrain  .  .  z  z  z  .
      lanes    2  2  1  1  1  2
      lane 0   0R .  1Sx .  .  .
    `);
    runEnd(t.state);
    expect(t.at('0R')).toEqual([0, 0]);
  });
});

describe('Grand Tour pp.10–11: roundabouts (G-RND-*)', () => {
  // Start, a straight, the roundabout (tile 2), two straights, the finish.
  const stage = {
    id: 'rb',
    name: 'Roundabout',
    source: 'generated' as const,
    playerVariant: 'any' as const,
    type: 'normal' as const,
    tiles: ['a_w', 'b_w', 'x_w', 'c_w', 'd_w', 'u_w'],
  };
  const shared = (q: number) => `t2.s0.q${q}`;
  const inner = (q: number) => `t2.s1.b0.q${q}`;
  const outer = (q: number) => `t2.s1.b1.q${q}`;
  const after = (q: number) => `t3.s0.q${q}`;

  function game(places: Record<string, [string, number]>) {
    const config: GameConfig = {
      modules: {},
      mode: { kind: 'single', stage },
      seats: [0, 1, 2, 3].map((i) => ({
        seat: `seat-${i}`,
        controller: { kind: 'human' as const, playerId: `p${i}` },
      })),
      options: { showRemainingValues: true, allowSpectators: true, turnTimer: 'off' },
    };
    const s = createGame(config, 'rb', compileStage(stage, TILE_CATALOG));
    for (const r of Object.values(s.riders)) {
      const code = `${r.id.split(':')[0]!.slice(5)}${r.id.split(':')[1]}`;
      const p = places[code];
      r.position = p ? { square: p[0], lane: p[1] } : null;
      if (!p) r.finished = true;
    }
    s.placementOrder = [];
    s.phase = 'energy';
    s.round = 1;
    return s;
  }
  const pos = (s: GameState, code: string) =>
    s.riders[`seat-${code.slice(0, -1)}:${code.slice(-1)}`]!.position;

  it('p.10: exact moves take the inner lane if they can, else the outer one', () => {
    const s = game({ '0S': [shared(2), 0], '1R': [shared(2), 1], '2S': [shared(0), 0] });
    runMovement(s, { '0S': 3, '1R': 3, '2S': 4 });
    expect(pos(s, '0S')).toEqual({ square: inner(2), lane: 0 });
    // The inner lane's third square is taken: a 3 still fits exactly on the outer lane.
    expect(pos(s, '1R')).toEqual({ square: outer(2), lane: 0 });
    // A 4 from the start of the tile still fits on the inner lane.
    expect(pos(s, '2S')).toEqual({ square: inner(1), lane: 0 });
  });

  it('a move that cannot fit either lane takes the one where it moves furthest', () => {
    const s = game({ '0R': [inner(1), 0], '1R': [outer(1), 0], '2R': [shared(2), 0] });
    runMovement(s, { '0R': 1, '1R': 1, '2R': 3 });
    // The riders ahead move on to the third squares of their lanes first; a 3 is then blocked on
    // both lanes after 2 squares: the tie goes to the inner lane.
    expect(pos(s, '0R')).toEqual({ square: inner(2), lane: 0 });
    expect(pos(s, '1R')).toEqual({ square: outer(2), lane: 0 });
    expect(pos(s, '2R')).toEqual({ square: inner(1), lane: 0 });
  });

  it('p.10: split-lane riders move first, nearest the exit first, inner before outer', () => {
    const s = game({
      '0R': [inner(2), 0], // 1 from the exit
      '1R': [outer(4), 0], // 1 from the exit
      '2R': [outer(2), 0], // 3 from the exit
      '3R': [shared(2), 0],
      '0S': [after(0), 0], // already past the roundabout
    });
    const events = runMovement(s, { '0R': 2, '1R': 2, '2R': 2, '3R': 2, '0S': 2 });
    const order = events.flatMap((e) => (e.type === 'riderMoved' ? [e.rider] : []));
    expect(order).toEqual(['seat-0:S', 'seat-0:R', 'seat-1:R', 'seat-2:R', 'seat-3:R']);
  });

  it('p.11: no slipstream or exhaustion relationship between the split lanes', () => {
    // 0R on the inner lane with a rider two squares ahead on the outer lane: no slipstream.
    const s = game({ '0R': [inner(0), 0], '1R': [outer(2), 0] });
    const events = runEnd(s);
    expect(pos(s, '0R')).toEqual({ square: inner(0), lane: 0 });
    const tired = events.flatMap((e) => (e.type === 'exhaustionTaken' ? [e.rider] : []));
    expect(tired.sort()).toEqual(['seat-0:R', 'seat-1:R']);
  });

  it('p.11: riders on the last shared square slipstream onto either lane and are behind both', () => {
    // A rider on each lane two squares into the split; a pack on the last shared square.
    const s = game({
      '0R': [inner(1), 0],
      '1R': [outer(1), 0],
      '2R': [shared(2), 0],
      '2S': [shared(2), 1],
      '3R': [shared(1), 0],
    });
    runEnd(s);
    // Inner first: the frontmost shared rider goes onto the inner lane; the other continues onto
    // the outer lane; the rider behind follows onto the shared square.
    expect(pos(s, '2R')).toEqual({ square: inner(0), lane: 0 });
    expect(pos(s, '2S')).toEqual({ square: outer(0), lane: 0 });
    expect(pos(s, '3R')).toEqual({ square: shared(2), lane: 0 });
  });

  it('a rider on the last shared square is not exhausted while either lane ahead is taken', () => {
    const s = game({ '0R': [shared(2), 0], '1R': [outer(0), 0] });
    const events = runEnd(s);
    expect(events.some((e) => e.type === 'exhaustionTaken' && e.rider === 'seat-0:R')).toBe(false);
  });
});
