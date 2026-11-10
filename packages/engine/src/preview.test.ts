import { FIXTURE_STAGE, FIXTURE_TILES, compileStage } from '@velo/content';
import type { GameConfig } from '@velo/protocol';
import { describe, expect, it } from 'vitest';
import { previewFromView, previewMove, viewFor } from './api';
import { playRandom } from './testing';
import { createGame } from './api';

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
