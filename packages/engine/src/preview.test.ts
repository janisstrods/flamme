import {
  FIXTURE_STAGE,
  FIXTURE_TILES,
  TILE_CATALOG,
  applyWeather,
  compileStage,
  weatherTiles,
} from '@velo/content';
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

  const check = (seats: GameConfig['seats'], seed: string, meteo = false) => {
    const stage = randomBaseStage(seed);
    const base = compileStage(stage, TILE_CATALOG);
    // Meteo: weather on every straight tile, wet ones included, so crashes happen.
    const effects = ['wet', 'crosswind', 'wet', 'tailwind', 'headwind'] as const;
    const placements = weatherTiles(stage, TILE_CATALOG).map((tile, i) => ({
      tile,
      effect: effects[i % effects.length]!,
    }));
    const cfg: GameConfig = {
      ...config,
      ...(meteo ? { modules: { meteo: { placements } } } : {}),
      seats,
      mode: { kind: 'single', stage: { ...FIXTURE_STAGE, ...stage } },
    };
    let rounds = 0;
    let crashes = 0;
    playRandom(createGame(cfg, seed, base), seed, ({ before, after, events }) => {
      const revealed = events.find((e) => e.type === 'cardsRevealed');
      if (!revealed || revealed.type !== 'cardsRevealed') return;
      const plays = Object.fromEntries(revealed.plays.map((p) => [p.rider, p.card.value]));
      const view = viewFor(before, 'seat-0');
      // What a client does: compile the stage and lay the view's weather on it.
      const track = applyWeather(base, view.weather);
      const sim = simulateRound(boardFromView(view), track, cfg, plays);
      expect(Object.fromEntries(sim.board.riders.map((r) => [r.id, r.position]))).toEqual(
        positions(after),
      );
      expect(Object.fromEntries(sim.board.riders.map((r) => [r.id, r.crashed]))).toEqual(
        Object.fromEntries(Object.values(after.riders).map((r) => [r.id, r.crashed])),
      );
      crashes += events.filter((e) => e.type === 'riderCrashed').length;
      expect(sim.exhausted).toEqual(
        events.flatMap((e) => (e.type === 'exhaustionTaken' ? [e.rider] : [])),
      );
      rounds++;
    });
    expect(rounds).toBeGreaterThan(5);
    return crashes;
  };

  it('reproduces every round of a random game from the public view and the revealed values', () => {
    check(config.seats, 'sim');
  });

  it('handles weather and crashes (Meteo)', () => {
    let crashes = 0;
    for (const seed of ['sim-m1', 'sim-m2', 'sim-m3', 'sim-m4'])
      crashes += check(
        [0, 1, 2, 3].map((i) => ({
          seat: `seat-${i}`,
          controller: { kind: 'human' as const, playerId: `p${i}` },
        })),
        seed,
        true,
      );
    expect(crashes).toBeGreaterThan(0);
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
