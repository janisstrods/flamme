/**
 * Property tests (plan section 11): random base stages, seeds, team counts and handicaps, played
 * with random legal actions. Invariants are checked after every single action.
 */
import { TILE_CATALOG, compileStage } from '@velo/content';
import { GameView } from '@velo/protocol';
import type { GameConfig } from '@velo/protocol';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createGame, viewFor } from './api';
import { cardsInDeck } from './core/cards';
import { occupancy, square } from './core/track';
import type { GameState } from './state';
import { playRandom, randomBaseStage, type PlayStep } from './testing';

const config = (teams: number, handicap: number): GameConfig => ({
  modules: {},
  mode: { kind: 'single', stage: randomBaseStage('cfg') },
  seats: Array.from({ length: teams }, (_, i) => ({
    seat: `seat-${i}`,
    controller: { kind: 'ai' as const, level: 'easy' as const },
    handicap,
  })),
  options: { showRemainingValues: true, allowSpectators: true, turnTimer: 'off' },
});

const game = (stageSeed: string, seed: string, teams: number, handicap: number) =>
  createGame(config(teams, handicap), seed, compileStage(randomBaseStage(stageSeed), TILE_CATALOG));

function checkCards(s: GameState) {
  for (const r of Object.values(s.riders)) {
    const owned = cardsInDeck(r).length + r.played.length;
    // Handicap cards count as exhaustion received at setup.
    expect(owned, `${r.id} card count`).toBe(15 + r.exhaustionReceived);
    const ids = [...cardsInDeck(r), ...r.played].map((c) => c.id);
    expect(new Set(ids).size, `${r.id} duplicate card ids`).toBe(ids.length);
  }
}

function checkLanes(s: GameState) {
  const seen = new Set<string>();
  for (const r of Object.values(s.riders)) {
    if (!r.position) continue;
    const key = `${r.position.square}/${r.position.lane}`;
    expect(seen.has(key), `two riders on ${key}`).toBe(false);
    seen.add(key);
    expect(r.position.lane).toBeGreaterThanOrEqual(0);
    expect(r.position.lane).toBeLessThan(square(s.track, r.position.square).lanes);
  }
}

function checkForward({ before, after }: PlayStep) {
  for (const r of Object.values(before.riders)) {
    if (!r.position) continue;
    const now = after.riders[r.id]!.position!;
    expect(square(after.track, now.square).index).toBeGreaterThanOrEqual(
      square(before.track, r.position.square).index,
    );
  }
}

/** After a round, no slipstream-eligible pack sits exactly one empty square behind another. */
function checkNoMissedSlipstream(s: GameState) {
  const occ = occupancy(s);
  for (const sq of occ.keys()) {
    const here = square(s.track, sq);
    const gap = here.next[0];
    if (gap === undefined || occ.has(gap)) continue;
    const giver = square(s.track, gap).next[0];
    if (giver === undefined || !occ.has(giver)) continue;
    const ascent = (id: string) => square(s.track, id).terrain === 'ascent';
    expect(ascent(sq) || ascent(giver), `missed slipstream from ${sq} to ${giver}`).toBe(true);
  }
}

describe('engine properties over random races', () => {
  it('conserves cards, keeps one rider per lane, never moves backwards, never misses slipstream', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 0, max: 2 }),
        (stageSeed, seed, teams, handicap) => {
          const start = game(stageSeed, seed, teams, handicap);
          const end = playRandom(start, seed, (step) => {
            checkCards(step.after);
            checkLanes(step.after);
            checkForward(step);
            const resolved = step.events.some((e) => e.type === 'cardsRevealed');
            if (resolved) checkNoMissedSlipstream(step.after);
          });
          expect(end.state.phase).toBe('stageEnd');
          expect(end.state.result).toHaveLength(teams * 2);
        },
      ),
      { numRuns: 150 },
    );
  });

  it('is deterministic: the same seed and actions give the same states and events', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.integer({ min: 2, max: 4 }),
        (seed, teams) => {
          const a = playRandom(game('det', seed, teams, 0), seed);
          const b = playRandom(game('det', seed, teams, 0), seed);
          expect(JSON.stringify(b.events)).toBe(JSON.stringify(a.events));
          expect(JSON.stringify(b.state)).toBe(JSON.stringify(a.state));
        },
      ),
      { numRuns: 15 },
    );
  });

  it('every view matches the schema and shows private cards only to their owner', () => {
    const start = game('views', 'views', 4, 0);
    playRandom(start, 'views', ({ after }) => {
      for (const viewer of [...after.teams.map((t) => t.seat), 'spectator' as const]) {
        const view = GameView.parse(viewFor(after, viewer));
        expect(JSON.stringify({ r: view.riders, t: view.teams })).not.toContain('#');
        for (const r of view.own?.riders ?? []) expect(r.rider.startsWith(`${viewer}:`)).toBe(true);
      }
    });
  });
});
