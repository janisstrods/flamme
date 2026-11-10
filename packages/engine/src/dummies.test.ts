import { FIXTURE_STAGE, TILE_CATALOG, compileStage } from '@velo/content';
import type { GameConfig, SeatConfig } from '@velo/protocol';
import { describe, expect, it } from 'vitest';
import { createGame, legalActions, viewFor } from './api';
import { flipDummies } from './core/dummies';
import { playRandom, randomBaseStage, runRound, scenario } from './testing';

const stage = randomBaseStage('dummies');
const track = compileStage(stage, TILE_CATALOG);
const config = (seats: SeatConfig[]): GameConfig => ({
  modules: {},
  mode: { kind: 'single', stage: { ...FIXTURE_STAGE, ...stage } },
  seats,
  options: { showRemainingValues: true, allowSpectators: true, turnTimer: 'off' },
});
const SEATS: SeatConfig[] = [
  { seat: 'seat-0', controller: { kind: 'human', playerId: 'p0' } },
  { seat: 'seat-1', controller: { kind: 'dummy', team: 'muscle' } },
  { seat: 'seat-2', controller: { kind: 'dummy', team: 'peloton' } },
];

describe('dummy teams (P-PEL-1, P-MUS-1, P-DUM-1)', () => {
  it('place themselves first, Peloton team ahead of the Muscle team, as far forward as possible', () => {
    const s = createGame(config(SEATS), 'd1', track);
    const grid = track.startGrid;
    expect(s.riders['seat-2:R']!.position).toEqual({ square: grid[0], lane: 0 });
    expect(s.riders['seat-2:S']!.position).toEqual({ square: grid[1], lane: 0 });
    // Muscle team: sprinteur in front of its rouleur.
    expect(s.riders['seat-1:S']!.position).toEqual({ square: grid[0], lane: 1 });
    expect(s.riders['seat-1:R']!.position).toEqual({ square: grid[1], lane: 1 });
    expect(s.placementOrder).toEqual(['seat-0']);
    expect(legalActions(s, 'seat-1')).toEqual([]);
  });

  it('build their decks: a shared rouleur deck with two attack cards; a muscle card for the sprinteur', () => {
    const s = createGame(config(SEATS), 'd2', track);
    const peloton = s.teams.find((t) => t.dummy === 'peloton')!;
    expect(peloton.sharedDeck).toHaveLength(17);
    expect(peloton.sharedDeck.filter((c) => c.kind === 'attack')).toHaveLength(2);
    expect(s.riders['seat-1:S']!.drawPile.filter((c) => c.kind === 'muscle')).toEqual([
      expect.objectContaining({ value: 5 }),
    ]);
    expect(s.riders['seat-1:R']!.drawPile).toHaveLength(15);
  });

  it('flip when everyone else has locked in, and never take exhaustion', () => {
    const end = playRandom(createGame(config(SEATS), 'd3', track), 'd3', ({ events }) => {
      for (const e of events)
        if (e.type === 'exhaustionTaken')
          expect(e.rider.startsWith('seat-0:'), `${e.rider} took exhaustion`).toBe(true);
    });
    expect(end.state.phase).toBe('stageEnd');
    const reveals = end.events.filter((e) => e.type === 'cardsRevealed');
    for (const r of reveals) {
      if (r.type !== 'cardsRevealed') continue;
      const pel = r.plays.filter((p) => p.rider.startsWith('seat-2:'));
      if (pel.length === 2 && pel[0]!.card.kind !== 'attack')
        expect(pel[0]!.card.value).toBe(pel[1]!.card.value);
    }
  });

  it('an attack card moves the front Peloton rider 2 and the rear one 9', () => {
    const sc = scenario(`
      terrain  .  .  .  .  .  .  .  .  .  .  .  .  .  .
      lane 0   2S 2R .  .  .  .  .  .  .  .  .  .  .  .
    `);
    const s = sc.state;
    const team = s.teams.find((t) => t.team === 'seat-2')!;
    team.dummy = 'peloton';
    team.controller = 'dummy';
    team.sharedDeck = [{ id: 'seat-2:A#0', kind: 'attack', value: 0, powers: [] }];
    s.modules = ['base', 'dummies'];
    flipDummies(s, []);
    runRound(s, {});
    expect(sc.at('2R')).toEqual([3, 0]); // front rider: 2
    expect(sc.at('2S')).toEqual([9, 0]); // rear rider: 9
  });

  it('views show the Peloton team’s shared deck and never another team’s cards', () => {
    const s = createGame(config(SEATS), 'd4', track);
    const v = viewFor(s, 'seat-0');
    const pel = v.riders.find((r) => r.id === 'seat-2:R')!;
    expect(pel.drawPileCount).toBe(17);
    expect(pel.remainingValues?.attack).toBe(2);
    expect(v.teams.find((t) => t.team === 'seat-2')?.status).toBe('idle');
  });
});
