/**
 * Meteo rulebook rules and its worked example (docs/RULES_SPEC.md M-*, C-*). Lane 0 is the
 * rightmost lane. Teams: seat-0 red, seat-1 blue, seat-2 green, seat-3 black.
 * Weather row: `c` crosswind, `t` tailwind, `h` headwind, `w` wet. A trailing `x` = crashed.
 */
import { describe, expect, it } from 'vitest';
import { createGame, legalActions, apply, previewMove } from './api';
import { Hooks } from './core/compose';
import { TILE_CATALOG, compileStage, weatherTiles } from '@velo/content';
import type { GameConfig } from '@velo/protocol';
import { runEnd, runMovement, scenario } from './testing';

const card = (value: number) => ({ id: 'x', kind: 'energy' as const, value, powers: [] });

describe('Meteo rulebook p.2 example (wet tile)', () => {
  const diagram = (redSprinteur: string) => `
    terrain  .  .  .  .  .  .  .  .  .  .  .  .  .  .
    weather  .  .  .  .  .  w  w  w  w  w  w  .  .  .
    lane 1   .  .  2S 1S .  .  3S .  .  .  .  .  .  .
    lane 0   .  .  0R 2R .  ${redSprinteur} 3R .  .  .  .  .  .  .
  `;

  it('a blocked rider stopping on the wet tile crashes; one stopping off it does not', () => {
    const s = scenario(diagram('0S'));
    const events = runMovement(s.state, { '2R': 5, '1S': 3, '0R': 3, '2S': 9 });
    // Green rouleur moves through the riders as normal.
    expect(s.at('2R')).toEqual([8, 0]);
    // Blue sprinteur would end on the full square 6: it stops on square 5 (wet) and crashes.
    expect(s.at('1S')).toEqual([5, 1]);
    expect(s.state.riders['seat-1:S']!.crashed).toBe(true);
    // Red rouleur would end on the now full square 5: it stops on square 4 (dry), no crash.
    expect(s.at('0R')).toEqual([4, 0]);
    expect(s.state.riders['seat-0:R']!.crashed).toBe(false);
    // Green sprinteur moves the full 9: square 5 is full but not every lane has crashed.
    expect(s.at('2S')).toEqual([11, 0]);
    const crashes = events.filter((e) => e.type === 'riderCrashed');
    expect(crashes).toEqual([
      { type: 'riderCrashed', riders: ['seat-1:S'], at: 'q5', cause: 'wet' },
    ]);
  });

  it('variant: with the red sprinteur crashed, square 5 is blocked and green stops after 2', () => {
    const s = scenario(diagram('0Sx'));
    runMovement(s.state, { '2R': 5, '1S': 3, '0R': 3, '2S': 9 });
    expect(s.at('1S')).toEqual([5, 1]);
    expect(s.at('0R')).toEqual([4, 0]);
    // Green sprinteur cannot pass the fully crashed square: it ends beside the red rouleur.
    expect(s.at('2S')).toEqual([4, 1]);
    expect(s.state.riders['seat-2:S']!.crashed).toBe(false);
  });
});

describe('Meteo weather (M-*)', () => {
  it('M-CRS-1: no slipstream to or from a rider on a crosswind tile', () => {
    const give = scenario(`
      terrain  .  .  .  .  .
      weather  .  .  c  c  .
      lane 0   0R .  1R .  .
    `);
    runEnd(give.state);
    expect(give.at('0R')).toEqual([0, 0]);
    const receive = scenario(`
      terrain  .  .  .  .  .
      weather  c  .  .  .  .
      lane 0   0R .  1R .  .
    `);
    runEnd(receive.state);
    expect(receive.at('0R')).toEqual([0, 0]);
  });

  it('M-TAI-1 / M-HEA-1: tailwind draws 5, headwind draws 3, elsewhere 4', () => {
    const s = scenario(`
      terrain  .  .  .  .  .  .
      weather  t  .  h  .  .  .
      lane 0   0R .  0S .  1R .
    `);
    const hooks = new Hooks(s.state);
    expect(hooks.handSize('seat-0:R')).toBe(5);
    expect(hooks.handSize('seat-0:S')).toBe(3);
    expect(hooks.handSize('seat-1:R')).toBe(4);
  });

  it('M-WET-1: ending on the wet tile without being blocked is safe', () => {
    const s = scenario(`
      terrain  .  .  .  .  .  .
      weather  .  .  w  w  w  .
      lane 0   0R .  .  .  .  .
    `);
    runMovement(s.state, { '0R': 3 });
    expect(s.at('0R')).toEqual([3, 0]);
    expect(s.state.riders['seat-0:R']!.crashed).toBe(false);
  });
});

describe('Crashes (C-*)', () => {
  it('C-2: no slipstream to or from a square holding a crashed rider', () => {
    const s = scenario(`
      terrain  .  .  .  .  .
      lane 1   .  .  1S .  .
      lane 0   0R .  1Rx .  .
    `);
    runEnd(s.state);
    expect(s.at('0R')).toEqual([0, 0]);
  });

  it('C-4: standing up costs 2; a 2 only stands up, moving to the rightmost free lane', () => {
    const s = scenario(`
      terrain  .  .  .  .  .  .  .  .
      lane 1   0Rx .  .  .  .  .  .  .
      lane 0   .  .  .  0S .  .  .  .
    `);
    expect(previewMove(s.state, 'seat-0:R', card(5)).effectiveValue).toBe(3);
    runMovement(s.state, { '0R': 2 });
    expect(s.at('0R')).toEqual([0, 0]);
    expect(s.state.riders['seat-0:R']!.crashed).toBe(false);
  });

  it('C-4: the penalty applies after a descent minimum and before the ascent cap', () => {
    const s = scenario(`
      terrain  v  v  .  .  .  .  .  ^  ^  ^  ^  ^  ^  ^  ^
      lane 0   0Rx .  .  .  .  .  .  1Rx .  .  .  .  .  .  .
    `);
    // Descent: a 2 counts as 5, then standing up costs 2: moves 3.
    expect(previewMove(s.state, 'seat-0:R', card(2)).effectiveValue).toBe(3);
    // Ascent: a 9 becomes 7, then the climb caps it at 5; a 7 just reaches 5.
    expect(previewMove(s.state, 'seat-1:R', card(9)).effectiveValue).toBe(5);
    expect(previewMove(s.state, 'seat-1:R', card(6)).effectiveValue).toBe(4);
  });
});

describe('Meteo setup (M-SET-1, D-013)', () => {
  it('deals the 13 tokens to the straight tiles except start and finish, from the seed', () => {
    const stage = {
      id: 'm',
      name: 'Meteo',
      source: 'generated' as const,
      playerVariant: '2-4' as const,
      type: 'normal' as const,
      tiles: ['a_w', 'b_w', 'c_w', 'e_w', 'd_w', 'f_w', 'l_w', 'm_w', 'n_w', 'u_w'],
    };
    const config: GameConfig = {
      modules: { meteo: {} },
      mode: { kind: 'single', stage },
      seats: [0, 1].map((i) => ({
        seat: `seat-${i}`,
        controller: { kind: 'human' as const, playerId: `p${i}` },
      })),
      options: { showRemainingValues: true, allowSpectators: true, turnTimer: 'off' },
    };
    const track = compileStage(stage, TILE_CATALOG);
    const eligible = weatherTiles(stage, TILE_CATALOG);
    expect(eligible).toEqual([1, 2, 4, 5, 6, 7, 8]);
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const s = createGame(config, `w${i}`, track);
      expect(s.weather.length).toBeLessThanOrEqual(4);
      for (const w of s.weather) {
        expect(eligible).toContain(w.tile);
        seen.add(w.effect);
        const squares = Object.values(s.track.squares).filter((q) => q.ref.tile === w.tile);
        expect(squares.every((q) => q.weather === w.effect)).toBe(true);
      }
      expect(createGame(config, `w${i}`, track).weather).toEqual(s.weather);
    }
    expect(seen.size).toBe(4);
    // The race plays through.
    let s = createGame(config, 'w-play', track);
    for (let n = 0; n < 3000 && s.phase !== 'stageEnd'; n++) {
      const seat = s.teams.find((t) => legalActions(s, t.seat).length)!.seat;
      const r = apply(s, legalActions(s, seat)[0]!);
      if (!r.ok) throw new Error(r.error.message);
      s = r.state;
    }
    expect(s.phase).toBe('stageEnd');
  });
});
