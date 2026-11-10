import { TOUR_PRESETS } from '@velo/content';
import type { GameConfig } from '@velo/protocol';
import { describe, expect, it } from 'vitest';
import { ORIGINAL_STAGES } from '@velo/content';
import {
  fieldLimit,
  fieldLimitNote,
  fitSeats,
  setupIssues,
  tourMode,
  withGrandTour,
  withPeloton,
} from './setup';

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

describe('field limits', () => {
  const stage = (id: string) => ORIGINAL_STAGES.find((s) => s.id === id)!;

  it('come from the narrowest start grid of the stage or tour', () => {
    expect(fieldLimit({ kind: 'single', stage: stage('paving-stones') }).teams).toBe(6);
    expect(fieldLimit({ kind: 'single', stage: stage('harbour-loop') })).toMatchObject({
      teams: 4,
      riders: 8,
    });
    const gt = TOUR_PRESETS.find((t) => t.id === 'grand-tour')!;
    const mode = tourMode({ stages: gt.stages });
    expect(fieldLimit(mode).teams).toBe(4);
    expect(fieldLimit(mode, true).teams).toBe(8);
    expect(fieldLimitNote(mode)).toMatch(
      /^This tour takes up to 4 teams \(.+'s start grid holds 8 riders\)\.$/,
    );
    expect(fieldLimitNote({ kind: 'single', stage: stage('paving-stones') })).toBeNull();
  });

  it('extra bot and open seats are dropped when a smaller tour is picked; players stay', () => {
    const six = presetConfig('tour-de-jour', 6);
    six.seats[4] = { seat: 'seat-4', controller: { kind: 'human', playerId: 'friend' } };
    const gt = TOUR_PRESETS.find((t) => t.id === 'grand-tour')!;
    const fitted = fitSeats({ ...six, mode: tourMode({ stages: gt.stages }) });
    expect(fitted.seats).toHaveLength(4);
    expect(fitted.seats.map((x) => x.controller.kind)).toEqual(['human', 'ai', 'ai', 'human']);
    expect(fitted.seats.map((x) => x.seat)).toEqual(['seat-0', 'seat-1', 'seat-2', 'seat-3']);
  });
});
