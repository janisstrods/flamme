import { FIXTURE_STAGE, FIXTURE_TILES, compileStage } from '@velo/content';
import { GameView } from '@velo/protocol';
import type { GameConfig, SeatConfig, GameEvent } from '@velo/protocol';
import fixtureEvents from '../../protocol/src/fixtures/round1.events.json' with { type: 'json' };
import { describe, expect, it } from 'vitest';
import { apply, createGame, legalActions, previewMove, viewFor } from './api';
import type { GameState } from './state';
import { runRound, scenario } from './testing';

const track = compileStage(FIXTURE_STAGE, FIXTURE_TILES);
const config = (n: number, extra: Partial<SeatConfig> = {}): GameConfig => ({
  modules: {},
  mode: { kind: 'single', stage: FIXTURE_STAGE },
  seats: Array.from({ length: n }, (_, i) => ({
    seat: `seat-${i}`,
    controller: { kind: 'human' as const, playerId: `p${i}` },
    ...extra,
  })),
  options: { showRemainingValues: true, allowSpectators: true, turnTimer: 'off' },
});

const ok = (r: ReturnType<typeof apply>) => {
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r;
};

/** Place every rider using the first legal action for whoever is placing. */
function placeAll(state: GameState): GameState {
  let s = state;
  while (s.phase === 'placement') {
    const seat = s.placementOrder[0]!;
    s = ok(apply(s, legalActions(s, seat)[0]!)).state;
  }
  return s;
}

describe('setup and placement (B-SET-*)', () => {
  it('builds shuffled 15-card decks, plus handicap exhaustion cards', () => {
    const s = createGame(config(2, { handicap: 1 }), 'seed', track);
    for (const r of Object.values(s.riders)) {
      expect(r.drawPile).toHaveLength(16);
      expect(r.drawPile.filter((c) => c.kind === 'exhaustion')).toHaveLength(1);
    }
  });

  it('teams place both riders in turn, rightmost lane first, then the race starts', () => {
    const s0 = createGame(config(3), 'seed', track);
    const first = s0.placementOrder[0]!;
    const legal = legalActions(s0, first);
    expect(legal.every((a) => a.type === 'placeRider' && a.position.lane === 0)).toBe(true);
    const other = s0.teams.find((t) => t.team !== first)!.seat;
    expect(apply(s0, legalActions(s0, first)[0]!).ok).toBe(true);
    const wrong = apply(s0, {
      type: 'placeRider',
      seat: other,
      rider: `${other}:R`,
      position: { square: 't0.s0.q3', lane: 0 },
    });
    expect(wrong.ok).toBe(false);
    const s = placeAll(s0);
    expect(s.phase).toBe('energy');
    expect(s.round).toBe(1);
    expect(
      Object.values(s.riders).every(
        (r) => r.position && s.track.startGrid.includes(r.position.square),
      ),
    ).toBe(true);
  });
});

describe('energy phase (B-ENG-*)', () => {
  it('deals 4 to the chosen rider, recycles 3, then deals the other rider', () => {
    let s = placeAll(createGame(config(2), 'seed', track));
    s = ok(apply(s, { type: 'chooseRider', seat: 'seat-0', rider: 'seat-0:S' })).state;
    const hand = s.riders['seat-0:S']!.hand!;
    expect(hand).toHaveLength(4);
    expect(s.riders['seat-0:R']!.hand).toBeNull();
    expect(legalActions(s, 'seat-0').map((a) => a.type)).toEqual([
      'playCard',
      'playCard',
      'playCard',
      'playCard',
    ]);
    s = ok(
      apply(s, { type: 'playCard', seat: 'seat-0', rider: 'seat-0:S', card: hand[2]!.id }),
    ).state;
    const sp = s.riders['seat-0:S']!;
    expect(sp.locked?.id).toBe(hand[2]!.id);
    expect(sp.recycled).toHaveLength(3);
    expect(s.riders['seat-0:R']!.hand).toHaveLength(4);
    const relock = apply(s, {
      type: 'playCard',
      seat: 'seat-0',
      rider: 'seat-0:S',
      card: hand[0]!.id,
    });
    expect(relock.ok).toBe(false);
  });

  it('a rider with no cards at all plays an exhaustion card (D-010)', () => {
    let s = placeAll(createGame(config(1), 'seed', track));
    const r = s.riders['seat-0:R']!;
    r.drawPile = [];
    r.recycled = [];
    s = ok(apply(s, { type: 'chooseRider', seat: 'seat-0', rider: 'seat-0:R' })).state;
    expect(s.riders['seat-0:R']!.hand).toEqual([
      expect.objectContaining({ kind: 'exhaustion', value: 2 }),
    ]);
  });

  it('a short deck deals what exists after reshuffling (B-ENG-4, B-ENG-5)', () => {
    let s = placeAll(createGame(config(1), 'seed', track));
    const r = s.riders['seat-0:R']!;
    const all = [...r.drawPile];
    r.drawPile = all.slice(0, 1);
    r.recycled = all.slice(1, 3);
    const res = ok(apply(s, { type: 'chooseRider', seat: 'seat-0', rider: 'seat-0:R' }));
    s = res.state;
    expect(s.riders['seat-0:R']!.hand).toHaveLength(3);
    expect(res.events.some((e) => e.type === 'deckReshuffled')).toBe(true);
  });

  it('the round resolves when every rider is locked in, then a new energy phase starts', () => {
    let s = placeAll(createGame(config(2), 'seed', track));
    let events: GameEvent[] = [];
    for (const seat of ['seat-0', 'seat-1'] as const) {
      s = ok(apply(s, legalActions(s, seat)[0]!)).state;
      s = ok(apply(s, legalActions(s, seat)[0]!)).state;
      const res = ok(apply(s, legalActions(s, seat)[0]!));
      s = res.state;
      events = res.events;
    }
    expect(events.map((e) => e.type)).toContain('cardsRevealed');
    expect(s.phase).toBe('energy');
    expect(s.round).toBe(2);
    expect(s.teams.every((t) => t.firstRider === null)).toBe(true);
    expect(Object.values(s.riders).every((r) => r.played.length === 1 && r.locked === null)).toBe(
      true,
    );
  });
});

describe('redacted views', () => {
  it('match the schema and never show another team’s private cards', () => {
    let s = placeAll(createGame(config(3), 'seed', track));
    s = ok(apply(s, legalActions(s, 'seat-1')[0]!)).state; // choose a rider
    s = ok(apply(s, legalActions(s, 'seat-1')[0]!)).state; // lock its card
    for (const viewer of ['seat-0', 'seat-1', 'seat-2', 'spectator'] as const) {
      const view = GameView.parse(viewFor(s, viewer));
      const text = JSON.stringify(view.riders) + JSON.stringify(view.teams);
      expect(text).not.toMatch(/#/); // card ids only appear in `own`
      if (viewer === 'spectator') expect(view.own).toBeNull();
      else for (const r of view.own!.riders) expect(r.rider.startsWith(`${viewer}:`)).toBe(true);
    }
    expect(viewFor(s, 'seat-1').teams.find((t) => t.team === 'seat-1')?.status).toBe(
      'choosingSecond',
    );
  });
});

describe('previewMove', () => {
  it('reports the capped value and a hint before an ascent', () => {
    const sc = scenario(`
      terrain  .  .  ^  ^  .  .  .  .  .  .
      lane 0   0R .  .  .  .  .  .  .  .  .
    `);
    const p = previewMove(sc.state, 'seat-0:R', { id: 'x', kind: 'energy', value: 7, powers: [] });
    expect(p.effectiveValue).toBe(5);
    expect(p.unobstructed.square).toBe('q5');
    expect(p.hints).toContain('cappedByAscent');
  });
});

describe('M0 contract fixture', () => {
  it('the engine reproduces the hand-written round 1 event log', () => {
    const s = createGame(config(2), 'seed', track);
    const placed = (fixtureEvents as GameEvent[]).filter((e) => e.type === 'riderPlaced');
    for (const e of placed) if (e.type === 'riderPlaced') s.riders[e.rider]!.position = e.at;
    s.placementOrder = [];
    s.phase = 'energy';
    s.round = 1;
    const events = runRound(s, { '0R': 5, '0S': 9, '1R': 4, '1S': 3 });
    const expected = fixtureEvents as GameEvent[];
    const from = expected.findIndex((e) => e.type === 'phaseChanged' && e.phase === 'movement');
    expect(events).toEqual(expected.slice(from));
  });
});
