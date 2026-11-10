import { FIXTURE_STAGE, FIXTURE_TILES, TILE_CATALOG, compileStage } from '@velo/content';
import type { GameConfig } from '@velo/protocol';
import { describe, expect, it } from 'vitest';
import type { GameState } from './state';
import {
  boardFromView,
  createGame,
  previewFromView,
  previewMove,
  simulateRound,
  viewFor,
} from './api';
import { playRandom, randomBaseStage } from './testing';

const config: GameConfig = {
  modules: {},
  mode: { kind: 'single', stage: FIXTURE_STAGE },
  seats: [0, 1].map((i) => ({
    seat: `seat-${i}`,
    controller: { kind: 'human' as const, playerId: `p${i}` },
  })),
  options: { showRemainingValues: true, allowSpectators: true, turnTimer: 'off' },
};

describe('previewFromView', () => {
  it('matches previewMove on the full state at every energy step of a game', () => {
    const track = compileStage(FIXTURE_STAGE, FIXTURE_TILES);
    let checked = 0;
    playRandom(createGame(config, 'pv', track), 'pv', ({ after }) => {
      for (const team of after.teams) {
        const view = viewFor(after, team.seat);
        for (const own of view.own?.riders ?? []) {
          for (const card of own.hand ?? []) {
            expect(previewFromView(view, track, config, own.rider, card)).toEqual(
              previewMove(after, own.rider, card),
            );
            checked++;
          }
        }
      }
    });
    expect(checked).toBeGreaterThan(20);
  });
});

describe('simulateRound', () => {
  const positions = (s: GameState) =>
    Object.fromEntries(Object.values(s.riders).map((r) => [r.id, r.position]));

  const check = (seats: GameConfig['seats'], seed: string) => {
    const stage = randomBaseStage(seed);
    const track = compileStage(stage, TILE_CATALOG);
    const cfg: GameConfig = {
      ...config,
      seats,
      mode: { kind: 'single', stage: { ...FIXTURE_STAGE, ...stage } },
    };
    let rounds = 0;
    playRandom(createGame(cfg, seed, track), seed, ({ before, after, events }) => {
      const revealed = events.find((e) => e.type === 'cardsRevealed');
      if (!revealed || revealed.type !== 'cardsRevealed') return;
      const plays = Object.fromEntries(revealed.plays.map((p) => [p.rider, p.card.value]));
      const board = boardFromView(viewFor(before, 'seat-0'));
      const sim = simulateRound(board, track, cfg, plays);
      expect(Object.fromEntries(sim.board.riders.map((r) => [r.id, r.position]))).toEqual(
        positions(after),
      );
      expect(sim.exhausted).toEqual(
        events.flatMap((e) => (e.type === 'exhaustionTaken' ? [e.rider] : [])),
      );
      rounds++;
    });
    expect(rounds).toBeGreaterThan(5);
  };

  it('reproduces every round of a random game from the public view and the revealed values', () => {
    check(config.seats, 'sim');
  });

  it('handles dummy teams too', () => {
    check(
      [
        config.seats[0]!,
        { seat: 'seat-1', controller: { kind: 'dummy', team: 'muscle' } },
        { seat: 'seat-2', controller: { kind: 'dummy', team: 'peloton' } },
      ],
      'sim-d',
    );
  });
});
