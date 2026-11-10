import { TILE_CATALOG, compileStage } from '@velo/content';
import { apply, createGame, legalActions, viewFor } from '@velo/engine';
import type { GameState } from '@velo/engine';
import { randomBaseStage } from '@velo/engine/testing';
import type { Action, AiLevel, GameConfig, SeatConfig } from '@velo/protocol';
import { describe, expect, it } from 'vitest';
import { effortToFinish, expectedBest, makeBot, roundsToFinish } from './index';

describe('deck estimates', () => {
  it('expectedBest is the mean of the best of k draws', () => {
    // Best of four from 1..5: 5 with probability 4/5, otherwise 4.
    expect(expectedBest([1, 2, 3, 4, 5], 4)).toBeCloseTo(4.8);
    expect(expectedBest([2, 4], 1)).toBe(3);
    expect(expectedBest([3, 9], 4)).toBe(9);
  });

  it('roundsToFinish grows with distance and with exhaustion in the deck', () => {
    const deck = [3, 4, 5, 6, 7, 3, 4, 5, 6, 7, 3, 4, 5, 6, 7];
    expect(roundsToFinish(30, deck, 4)).toBeLessThan(roundsToFinish(40, deck, 4));
    expect(roundsToFinish(40, deck, 4)).toBeLessThan(roundsToFinish(40, [...deck, 2, 2, 2, 2], 4));
    expect(roundsToFinish(0, deck, 4)).toBe(0);
  });

  it('effortToFinish is zero at the line and counts climbs as more work', () => {
    const track = compileStage(randomBaseStage('effort'), TILE_CATALOG);
    const effort = effortToFinish(track);
    const finish = Object.values(track.squares).find((s) => s.index === track.finishIndex)!;
    expect(effort.get(finish.id)).toBe(0);
    const start = track.startGrid[0]!;
    expect(effort.get(start)!).toBeGreaterThan(track.finishIndex - track.squares[start]!.index - 1);
  });
});

function race(levels: (AiLevel | 'muscle')[], seed: string) {
  const stage = randomBaseStage(seed);
  const track = compileStage(stage, TILE_CATALOG);
  const seats: SeatConfig[] = levels.map((l, i) => ({
    seat: `seat-${i}`,
    controller: l === 'muscle' ? { kind: 'dummy', team: 'muscle' } : { kind: 'ai', level: l },
  }));
  const config: GameConfig = {
    modules: {},
    mode: { kind: 'single', stage },
    seats,
    options: { showRemainingValues: false, allowSpectators: false, turnTimer: 'off' },
  };
  let state: GameState = createGame(config, seed, track);
  const bots = new Map(
    levels.map((l, i) => [
      `seat-${i}`,
      l === 'muscle' ? null : makeBot({ level: l, seed: `${seed}${i}`, track, config }),
    ]),
  );
  const actions: Action[] = [];
  for (let n = 0; n < 5000 && state.phase !== 'stageEnd'; n++) {
    const team = state.teams.find((t) => legalActions(state, t.seat).length > 0)!;
    const legal = legalActions(state, team.seat);
    const action = bots.get(team.seat)!.decide(viewFor(state, team.seat), team.seat, legal);
    expect(legal).toContainEqual(action);
    const res = apply(state, action);
    if (!res.ok) throw new Error(res.error.message);
    state = res.state;
    actions.push(action);
  }
  return { state, actions };
}

describe('bots', () => {
  it('every level finishes a race with only legal actions, even with remaining values hidden', () => {
    const { state } = race(['easy', 'medium', 'hard', 'muscle'], 'levels');
    expect(state.phase).toBe('stageEnd');
  });

  it('is reproducible for a seed', () => {
    expect(race(['medium', 'hard'], 'again').actions).toEqual(
      race(['medium', 'hard'], 'again').actions,
    );
  });
});
