/**
 * Grand Tour campaign (docs/RULES_SPEC.md G-*): timing, tokens, between stages, rest days and the
 * end of the tour, with a hand-checked scoring example.
 */
import { TOUR_PRESETS, tourSchedule } from '@velo/content';
import type { GameConfig, GameEvent } from '@velo/protocol';
import { describe, expect, it } from 'vitest';
import { apply, createGame, legalActions, viewFor } from './api';
import { exhaustionCard } from './core/cards';
import { tourFinishCheck } from './core/tour';
import type { GameState } from './state';
import { playRandom, runRound } from './testing';

const tourConfig = (stages: string[], teams = 3, restAfter?: number | number[]): GameConfig => ({
  modules: { grandTour: { newTiles: false, specialists: false, specialStages: false } },
  mode: { kind: 'tour', schedule: tourSchedule(stages, restAfter) },
  seats: Array.from({ length: teams }, (_, i) => ({
    seat: `seat-${i}`,
    controller: { kind: 'human' as const, playerId: `p${i}` },
  })),
  options: { showRemainingValues: true, allowSpectators: true, turnTimer: 'off' },
});

/** Squares of the current stage in race order. */
const line = (s: GameState) => Object.values(s.track.squares).sort((a, b) => a.index - b.index);
const at = (s: GameState, index: number) => line(s).find((q) => q.index === index)!.id;

/** Put the listed riders on squares (by index) and take everyone else far back. */
function racing(s: GameState, places: Record<string, [number, number]>) {
  const back = line(s)[0]!.index;
  let k = 0;
  for (const r of Object.values(s.riders)) {
    const code = `${r.id.split(':')[0]!.slice(5)}${r.id.split(':')[1]}`;
    const p = places[code];
    r.position = p
      ? { square: at(s, p[0]), lane: p[1] }
      : { square: at(s, back + Math.floor(k / 2)), lane: k++ % 2 };
  }
  s.placementOrder = [];
  s.phase = 'energy';
  s.round = 1;
}

describe('tour stages (G-FIN-1, G-FIN-2, G-TOK-1, G-CRD-1)', () => {
  // Orchard Ring: a climb up to the square before the line, then the flat wide finish
  // (+40 on the line, then +30, +20, +10, +0).
  const stages = ['orchard-ring', 'harbour-loop', 'three-hills'];

  it('finishers take the seconds of their pack front; everyone else takes a minute', () => {
    const s = createGame(tourConfig(stages), 'time');
    const f = s.track.finishIndex;
    expect(s.track.squares[at(s, f + 3)]!.timingSeconds).toBe(10);
    racing(s, { '0R': [f - 1, 0], '1R': [f - 1, 1] });
    const events = runRound(s, { '0R': 4, '1R': 2 });
    // 0R ends 3 past the line (+10), 1R 1 past; slipstream closes 1R up: one pack, both +10.
    const done = events.filter((e) => e.type === 'riderFinished');
    expect(done).toEqual([
      { type: 'riderFinished', rider: 'seat-0:R', place: 1, seconds: 10 },
      { type: 'riderFinished', rider: 'seat-1:R', place: 2, seconds: 10 },
    ]);
    const penalty = events.find((e) => e.type === 'timePenalty');
    expect(penalty?.type === 'timePenalty' && penalty.riders).toHaveLength(4);
    expect(s.riders['seat-0:R']!.tour!.seconds).toBe(10);
    expect(s.riders['seat-2:S']!.tour!.seconds).toBe(60);
    // Finished riders take no exhaustion and leave the road; the stage goes on.
    expect(events.some((e) => e.type === 'exhaustionTaken' && e.rider === 'seat-0:R')).toBe(false);
    expect(s.phase).toBe('energy');
  });

  it('riders reaching a token pile take its tokens, furthest ahead first', () => {
    const s = createGame(tourConfig(stages), 'tok');
    const minor = s.tokens.find((t) => t.pile === 'minor')!;
    expect(minor).toMatchObject({ kind: 'sprint', square: at(s, s.track.finishIndex) });
    const f = s.track.finishIndex;
    racing(s, { '2R': [f - 1, 0], '0R': [f - 1, 1], '1S': [f - 2, 0] });
    const events = runRound(s, { '2R': 5, '0R': 2, '1S': 2 });
    // (The major pile is earlier on the stage; these riders were put past it, so ignore it.)
    const taken = events.filter((e) => e.type === 'tokenTaken' && e.pile === 'minor');
    expect(taken.map((e) => e.type === 'tokenTaken' && [e.rider, e.value])).toEqual([
      ['seat-2:R', 2],
      ['seat-0:R', 1],
    ]);
    expect(minor.remaining).toEqual([]);
    expect(s.riders['seat-2:R']!.tour!.sprintPoints).toBe(2);
  });

  it('played energy is set aside and exhaustion goes back to the supply', () => {
    const s = createGame(tourConfig(['harbour-loop', 'orchard-ring', 'three-hills']), 'cards');
    racing(s, { '0R': [3, 0] });
    s.riders['seat-0:R']!.locked = exhaustionCard(s.riders['seat-0:R']!);
    runRound(s, {});
    expect(s.riders['seat-0:R']!.setAside).toHaveLength(0);
    runRound(s, { '0R': 5 });
    expect(s.riders['seat-0:R']!.setAside.map((c) => c.value)).toEqual([5]);
  });
});

describe('end of a stage and of the tour: a hand-checked example (G-POD-1, G-BTW-*, G-END-*)', () => {
  /** Six riders, last stage, everyone across the line with these totals. */
  function finalStage(restAfter?: number) {
    const stages = ['harbour-loop', 'orchard-ring', 'three-hills'];
    const s = createGame(tourConfig(stages, 3, restAfter), 'hand');
    const table: Record<string, [number, number, number, number]> = {
      // seconds, sprint points, mountain points, place on the last stage
      'seat-0:R': [600, 5, 0, 2],
      'seat-0:S': [640, 3, 2, 5],
      'seat-1:R': [590, 0, 5, 1],
      'seat-1:S': [700, 1, 0, 6],
      'seat-2:R': [610, 5, 3, 3],
      'seat-2:S': [650, 0, 1, 4],
    };
    for (const [id, [seconds, sp, mt, place]] of Object.entries(table)) {
      const r = s.riders[id]!;
      r.tour = { seconds, sprintPoints: sp, mountainPoints: mt, jersey: null, stageSeconds: 0 };
      r.finished = true;
      r.finishPlace = place;
      r.position = { square: s.track.finishSquare, lane: 0 };
    }
    const deck0R = s.riders['seat-0:R']!;
    for (let i = 0; i < 5; i++) deck0R.recycled.push(exhaustionCard(deck0R));
    return s;
  }
  const awarded = (events: GameEvent[]) =>
    events.flatMap((e) => (e.type === 'tourPointsAwarded' ? [[e.team, e.points, e.reason]] : []));

  it('podium, half the exhaustion back, jerseys with a tie and a displaced jersey, bonuses', () => {
    const s = finalStage();
    s.stageNumber = 3;
    const events: GameEvent[] = [];
    expect(tourFinishCheck(s, events)).toBe(true);
    expect(awarded(events)).toEqual([
      // Podium: 1R, 0R, 2R.
      ['seat-1', 3, 'podium'],
      ['seat-0', 2, 'podium'],
      ['seat-2', 1, 'podium'],
      // General, 3-stage column: 1R 590, 0R 600, 2R 610.
      ['seat-1', 3, 'generalBonus'],
      ['seat-0', 2, 'generalBonus'],
      ['seat-2', 1, 'generalBonus'],
      // Team: 1240 (0), 1260 (2), 1290 (1).
      ['seat-0', 1, 'teamBonus'],
      // Sprint: 0R and 2R tie on 5; 0R crossed first on the last stage.
      ['seat-0', 2, 'sprintBonus'],
      ['seat-2', 1, 'sprintBonus'],
      // Mountain: 1R 5, 2R 3.
      ['seat-1', 2, 'mountainBonus'],
      ['seat-2', 1, 'mountainBonus'],
    ]);
    expect(s.teams.map((t) => t.tourPoints)).toEqual([7, 8, 4]);
    expect(events.find((e) => e.type === 'tourEnded')).toEqual({
      type: 'tourEnded',
      ranking: ['seat-1', 'seat-0', 'seat-2'],
    });
    // Yellow 1R; green 0R (tie broken by the last stage); polka dot passes from 1R to 2R.
    expect(events.filter((e) => e.type === 'jerseyAwarded')).toEqual([
      { type: 'jerseyAwarded', jersey: 'yellow', rider: 'seat-1:R' },
      { type: 'jerseyAwarded', jersey: 'green', rider: 'seat-0:R' },
      { type: 'jerseyAwarded', jersey: 'polkaDot', rider: 'seat-2:R' },
    ]);
    expect(events).toContainEqual({ type: 'exhaustionReturned', rider: 'seat-0:R', count: 2 });
    expect(s.riders['seat-0:R']!.recycled.filter((c) => c.kind === 'exhaustion')).toHaveLength(3);
    expect(s.phase).toBe('tourEnd');
  });

  it('a rest day pays each classification leader and lets everyone else recover again', () => {
    const s = finalStage(1);
    s.stageNumber = 1;
    const events: GameEvent[] = [];
    tourFinishCheck(s, events);
    // Leaders: GC 1R, sprint 0R, mountain 1R (one rider can earn twice).
    expect(awarded(events).filter(([, , why]) => why === 'restDay')).toEqual([
      ['seat-1', 1, 'restDay'],
      ['seat-0', 1, 'restDay'],
      ['seat-1', 1, 'restDay'],
    ]);
    // 0R leads the sprint, so it does not recover twice: 5 → 3 exhaustion cards.
    expect(s.riders['seat-0:R']!.recycled.filter((c) => c.kind === 'exhaustion')).toHaveLength(3);
    expect(s.phase).toBe('betweenStages');
  });
});

describe('whole tours', () => {
  it('the basic seven-stage tour plays end to end with a rest day', () => {
    const preset = TOUR_PRESETS[0]!;
    const cfg = tourConfig(preset.stages, 4, preset.restAfter);
    const { state, events } = playRandom(createGame(cfg, 'tour7'), 'tour7', undefined, 200_000);
    expect(state.phase).toBe('tourEnd');
    expect(events.filter((e) => e.type === 'stageStarted')).toHaveLength(6);
    expect(events.filter((e) => e.type === 'stageEnded')).toHaveLength(7);
    // Every stage pays a full podium (6) and the tour pays its bonuses.
    const podium = events.filter((e) => e.type === 'tourPointsAwarded' && e.reason === 'podium');
    expect(podium).toHaveLength(21);
    const total = state.teams.reduce((n, t) => n + t.tourPoints, 0);
    expect(total).toBeGreaterThanOrEqual(42 + 6 + 1);
    // Views carry the standings.
    const view = viewFor(state, 'seat-0');
    expect(view.teams[0]!.tourPoints).toBe(state.teams[0]!.tourPoints);
    expect(view.riders.every((r) => r.tour !== undefined)).toBe(true);
    expect(view.riders.filter((r) => r.jersey).length).toBeGreaterThanOrEqual(1);
  });

  it('between stages anyone may move the tour on; the next stage starts clean', () => {
    const cfg = tourConfig(['harbour-loop', 'orchard-ring', 'three-hills'], 2);
    let s = createGame(cfg, 'next');
    playRandom(
      s,
      'next',
      (step) => {
        if (step.after.phase === 'betweenStages' && s.phase !== 'betweenStages') s = step.after;
      },
      50_000,
    );
    expect(s.phase).toBe('betweenStages');
    expect(legalActions(s, 'seat-1')).toEqual([{ type: 'advance', seat: 'seat-1' }]);
    const r = apply(s, { type: 'advance', seat: 'seat-1' });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.events[0]).toEqual({ type: 'stageStarted', stageId: 'orchard-ring', stageNumber: 2 });
    const n = r.state;
    expect(n.phase).toBe('placement');
    for (const rider of Object.values(n.riders)) {
      expect(rider.position).toBeNull();
      expect(rider.played).toEqual([]);
      expect(rider.setAside).toEqual([]);
      expect(rider.drawPile.filter((c) => c.kind === 'energy')).toHaveLength(15);
    }
    // G-TOU-3: fewest Tour Points place first.
    const [first] = n.placementOrder;
    const tp = (t: string) => n.teams.find((x) => x.team === t)!.tourPoints;
    expect(n.teams.every((t) => tp(first!) <= t.tourPoints)).toBe(true);
    expect(viewFor(n, 'seat-0').stageId).toBe('orchard-ring');
  });
});
