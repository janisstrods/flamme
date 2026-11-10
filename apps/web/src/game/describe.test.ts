import {
  TILE_CATALOG,
  applyWeather,
  compileStage,
  tourSchedule,
  weatherTiles,
} from '@velo/content';
import { createGame, viewFor } from '@velo/engine';
import type { GameConfig } from '@velo/protocol';
import { describe, expect, it } from 'vitest';
import { describeRider, describeSquare, ordinal, standing } from './describe';
import { nameBook } from './names';

const schedule = tourSchedule(['harbour-loop', 'orchard-ring', 'three-hills']);
const config: GameConfig = {
  modules: { grandTour: { newTiles: false, specialists: false, specialStages: false } },
  mode: { kind: 'tour', schedule },
  seats: [0, 1].map((i) => ({
    seat: `seat-${i}`,
    controller: { kind: 'ai' as const, level: 'easy' as const },
    names: { team: `Team ${'AB'[i]}`, rouleur: `Rider ${i}R`, sprinteur: `Rider ${i}S` },
  })),
  options: { showRemainingValues: true, allowSpectators: true, turnTimer: 'off' },
};

describe('hover descriptions', () => {
  const state = createGame(config, 'desc');
  const view = viewFor(state, 'seat-0');
  const book = nameBook(config);
  const stage = schedule[0]! as Exclude<(typeof schedule)[number], 'rest'>;

  it('a square: terrain and weather with what they do, markers and distance', () => {
    const tile = weatherTiles(stage, TILE_CATALOG)[0]!;
    const track = applyWeather(compileStage(stage, TILE_CATALOG), [{ tile, effect: 'crosswind' }]);
    const climb = Object.values(track.squares).find((q) => q.terrain === 'ascent')!;
    const info = describeSquare(view, track, climb.id, book);
    expect(info.title).toBe('Climb');
    expect(info.subtitle).toMatch(/^2 lanes · \d+ squares to the finish$/);
    expect(info.lines[0]).toMatchObject({
      label: 'Climb',
      effect: expect.stringContaining('at most 5'),
    });
    expect(info.subtitle).toMatch(/to the finish/);
    const windy = Object.values(track.squares).find((q) => q.weather === 'crosswind')!;
    expect(describeSquare(view, track, windy.id, book).lines).toContainEqual(
      expect.objectContaining({ label: 'Crosswind', effect: 'no slipstream on this tile' }),
    );
    const finish = describeSquare(view, track, track.finishSquare, book);
    expect(finish.lines.map((l) => l.label)).toEqual(
      expect.arrayContaining(['Finish line', expect.stringMatching(/^Finish time \+\d+ s$/)]),
    );
  });

  it('a rider: name, team and who rides it, type, campaign standing', () => {
    const info = describeRider(view, config, state.track, 'seat-1:S', 'seat-0', book, () => null);
    expect(info.title).toBe('Rider 1S');
    expect(info.subtitle).toBe('Team B · Bot · Easy');
    expect(info.lines[0]!.label).toBe('Sprinteur');
    const st = standing(view, 'seat-1:S')!;
    expect(st.of).toBe(4);
    // Nobody has a time before the first finish.
    expect(st.noTimes).toBe(true);
    expect(info.lines.map((l) => l.label)).toContain('No tour times yet');
    expect(
      describeRider(view, config, state.track, 'seat-0:R', 'seat-0', book, () => null).subtitle,
    ).toBe('Team A · your team');
  });

  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
    ]);
  });
});
