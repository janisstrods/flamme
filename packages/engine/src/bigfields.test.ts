import { TILE_CATALOG, compileStage } from '@velo/content';
import type { StageDefinition } from '@velo/content';
import { checkModuleDependencies } from '@velo/protocol';
import type { GameConfig, SeatConfig } from '@velo/protocol';
import { describe, expect, it } from 'vitest';
import { checkStage, createGame, viewFor } from './api';
import { playRandom } from './testing';

const stage = (start: string, second: string): StageDefinition => ({
  id: 'big',
  name: 'Big field',
  source: 'generated',
  playerVariant: '5-6',
  type: 'normal',
  tiles: [start, second, '9_s', 'c_w', 'd_w', 'e_w', 'f_w', 'g_w', 'h_w', 'i_w', 'u_w'],
});

function config(
  n: number,
  peloton: GameConfig['modules']['peloton'],
  st: StageDefinition,
): GameConfig {
  const seats: SeatConfig[] = Array.from({ length: n }, (_, i) => ({
    seat: `seat-${i}`,
    controller: { kind: 'human' as const, playerId: `p${i}` },
    ...(peloton?.oneRiderEach ? { singleRider: i % 3 === 0 ? 'sprinteur' : 'rouleur' } : {}),
  }));
  return {
    modules: peloton ? { peloton } : {},
    mode: { kind: 'single', stage: st },
    seats,
    options: { showRemainingValues: true, allowSpectators: true, turnTimer: 'off' },
  };
}

describe('five and six teams (P-GEN-1)', () => {
  it('six teams race on a wide start, with supply zones and cobbles', () => {
    const st = stage('1_s', '3_w');
    const cfg = config(6, { breakaway: false, oneRiderEach: false }, st);
    expect(checkModuleDependencies(cfg)).toEqual([]);
    const track = compileStage(st, TILE_CATALOG);
    expect(checkStage(cfg, track)).toEqual([]);
    const { state } = playRandom(createGame(cfg, 'six', track), 'six');
    expect(state.result).toHaveLength(12);
    expect(state.modules).toContain('peloton');
  });

  it('the lobby hears when the grid is too small or the breakaway tile is missing', () => {
    const st = stage('a_w', 'b_w');
    const cfg = config(6, { breakaway: true, oneRiderEach: false }, st);
    const issues = checkStage(cfg, compileStage(st, TILE_CATALOG));
    expect(issues).toHaveLength(2);
    expect(issues[0]).toContain('start grid holds');
  });
});

describe('one rider each, 7 to 12 players (P-ONE-1)', () => {
  it('each seat races its one chosen rider; colours pair up by rider type', () => {
    const st = stage('1_s', '2_s');
    const cfg = config(9, { breakaway: true, oneRiderEach: true }, st);
    expect(checkModuleDependencies(cfg)).toEqual([]);
    const track = compileStage(st, TILE_CATALOG);
    expect(checkStage(cfg, track)).toEqual([]);
    const s = createGame(cfg, 'one', track);
    expect(Object.keys(s.riders)).toHaveLength(9);
    expect(s.riders['seat-0:S']).toBeDefined();
    expect(s.riders['seat-1:R']).toBeDefined();
    const pairs = s.teams.map((t) => `${t.color}:${s.riders[t.riders[0]!]!.type}`);
    expect(new Set(pairs).size).toBe(9);
    expect(viewFor(s, 'seat-3').own?.riders).toHaveLength(1);

    const { state, events } = playRandom(s, 'one');
    expect(state.result).toHaveLength(9);
    const won = events.find((e) => e.type === 'breakawayWon');
    expect(won?.type === 'breakawayWon' && won.riders).toHaveLength(1);
  });

  it('needs 7 to 12 seats, a rider per seat and no dummy teams', () => {
    const st = stage('1_s', '2_s');
    const cfg = config(6, { breakaway: false, oneRiderEach: true }, st);
    expect(checkModuleDependencies(cfg).map((i) => i.message)).toContain(
      'One rider each is for 7 to 12 players.',
    );
  });
});
