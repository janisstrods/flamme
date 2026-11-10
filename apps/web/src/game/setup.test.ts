import { TOUR_PRESETS } from '@velo/content';
import type { GameConfig } from '@velo/protocol';
import { describe, expect, it } from 'vitest';
import { setupIssues, tourMode, withGrandTour, withPeloton } from './setup';

/** What the home screen and the lobby build for a preset tour with bots. */
function presetConfig(id: string, teams: number): GameConfig {
  const p = TOUR_PRESETS.find((t) => t.id === id)!;
  return withGrandTour(
    withPeloton({
      modules: {},
      mode: tourMode({ stages: p.stages, restAfter: p.restAfter }),
      seats: Array.from({ length: teams }, (_, i) => ({
        seat: `seat-${i}`,
        controller:
          i === 0
            ? { kind: 'human' as const, playerId: 'me' }
            : { kind: 'ai' as const, level: 'medium' as const },
      })),
      options: { showRemainingValues: true, allowSpectators: true, turnTimer: 'off' },
    }),
  );
}

describe('race setup', () => {
  it.each(TOUR_PRESETS.map((t) => [t.name, t.id] as const))(
    '%s can start with four teams (the modules it needs are switched on)',
    (_n, id) => {
      expect(setupIssues(presetConfig(id, 4))).toEqual([]);
    },
  );

  it('the 21-stage tour switches the Peloton module on by itself', () => {
    expect(presetConfig('grand-tour', 3).modules.peloton).toEqual({
      breakaway: false,
      oneRiderEach: false,
    });
  });
});
