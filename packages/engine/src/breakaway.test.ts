import { TILE_CATALOG, compileStage } from '@velo/content';
import type { StageDefinition } from '@velo/content';
import type { Action, GameConfig, GameEvent, SeatConfig } from '@velo/protocol';
import { describe, expect, it } from 'vitest';
import { apply, createGame, legalActions, viewFor } from './api';
import type { GameState } from './state';
import { playRandom } from './testing';

const stage = (start: string, breakaway: string): StageDefinition => ({
  id: 'brk',
  name: 'Breakaway test',
  source: 'generated',
  playerVariant: 'any',
  type: 'normal',
  tiles: [start, breakaway, 'c_w', 'd_w', 'e_w', 'f_w', 'g_w', 'h_w', 'i_w', 'u_w'],
});

function setup(teams: number, opts: { start?: string; tile?: string; dummy?: boolean } = {}) {
  const st = stage(opts.start ?? 'a_w', opts.tile ?? '2_s');
  const seats: SeatConfig[] = Array.from({ length: teams }, (_, i) => ({
    seat: `seat-${i}`,
    controller:
      opts.dummy && i === teams - 1
        ? { kind: 'dummy' as const, team: 'muscle' as const }
        : { kind: 'human' as const, playerId: `p${i}` },
  }));
  const config: GameConfig = {
    modules: { peloton: { breakaway: true, oneRiderEach: false } },
    mode: { kind: 'single', stage: st },
    seats,
    options: { showRemainingValues: true, allowSpectators: true, turnTimer: 'off' },
  };
  const track = compileStage(st, TILE_CATALOG);
  return { config, track, state: createGame(config, `brk${teams}`, track) };
}

const ok = (s: GameState, a: Action) => {
  const r = apply(s, a);
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r;
};

function placeAll(state: GameState): GameState {
  let s = state;
  while (s.phase === 'placement') s = ok(s, legalActions(s, s.placementOrder[0]!)[0]!).state;
  return s;
}

/** Each team bids with the given rider and the highest (or a chosen) card of its hand. */
function bidRound(
  state: GameState,
  pick: (seat: string, values: number[]) => number = (_s, v) => Math.max(...v),
): { state: GameState; events: GameEvent[] } {
  let s = state;
  const events: GameEvent[] = [];
  for (const team of s.teams) {
    if (team.dummy) continue;
    const legal = legalActions(s, team.seat);
    const choose = legal.find((a) => a.type === 'chooseRider');
    if (choose) {
      const r = ok(s, choose);
      s = r.state;
      events.push(...r.events);
    }
    const cards = legalActions(s, team.seat).filter((a) => a.type === 'playCard');
    const rider = s.riders[s.teams.find((t) => t.seat === team.seat)!.firstRider!]!;
    const values = rider.hand!.map((c) => c.value);
    const want = pick(team.seat, values);
    const card = rider.hand!.find((c) => c.value === want)!;
    const r = ok(
      s,
      cards.find((a) => a.type === 'playCard' && a.card === card.id)!,
    );
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

describe('breakaway bidding (P-BRK-*)', () => {
  it('starts after placement: each team chooses one bidder, dummy teams do not bid', () => {
    const { state } = setup(3, { dummy: true });
    const s = placeAll(state);
    expect(s.phase).toBe('breakaway');
    expect(legalActions(s, 'seat-0').map((a) => a.type)).toEqual(['chooseRider', 'chooseRider']);
    expect(legalActions(s, 'seat-2')).toEqual([]);
    const after = ok(s, legalActions(s, 'seat-0')[0]!).state;
    expect(legalActions(after, 'seat-0')).toHaveLength(4);
    expect(viewFor(after, 'seat-0').teams[0]!.status).toBe('choosingSecond');
  });

  it('two rounds, then the highest total goes to the breakaway square in lane 0', () => {
    const { state, track } = setup(3);
    let s = placeAll(state);
    const r1 = bidRound(s);
    s = r1.state;
    expect(r1.events.filter((e) => e.type === 'breakawayRevealed')).toHaveLength(1);
    expect(s.phase).toBe('breakaway');
    const r2 = bidRound(s);
    s = r2.state;
    expect(s.phase).toBe('energy');
    expect(s.round).toBe(1);

    const reveals = r2.events.filter((e) => e.type === 'breakawayRevealed');
    const won = r2.events.find((e) => e.type === 'breakawayWon');
    expect(won && won.type === 'breakawayWon' && won.riders).toHaveLength(1);
    const winner = won!.type === 'breakawayWon' ? won!.riders[0]! : '';
    const sq = Object.values(track.squares).find((q) => q.flags.includes('breakaway'))!;
    expect(s.riders[winner]!.position).toEqual({ square: sq.id, lane: 0 });

    // Winner: two bid cards out of the game (public history), two exhaustion cards in its deck.
    const w = s.riders[winner]!;
    expect(w.played).toHaveLength(2);
    expect(w.drawPile).toHaveLength(15);
    expect(w.drawPile.filter((c) => c.kind === 'exhaustion')).toHaveLength(2);
    expect(w.recycled).toHaveLength(0);
    // Losers keep all fifteen cards, shuffled back into one deck.
    for (const t of s.teams) {
      const bidder = r1.events.find((e) => e.type === 'riderChosen' && e.team === t.team);
      const id = bidder?.type === 'riderChosen' ? bidder.rider : '';
      if (id === winner) continue;
      expect(s.riders[id]!.drawPile).toHaveLength(15);
      expect(s.riders[id]!.played).toHaveLength(0);
    }
    expect(reveals[0]!.type === 'breakawayRevealed' && reveals[0]!.round).toBe(2);
  });

  it('five or six teams: two riders break away, highest bid in the rightmost lane', () => {
    const { state, track } = setup(5, { start: '1_s', tile: '2_w' });
    let s = placeAll(state);
    s = bidRound(s).state;
    const r2 = bidRound(s);
    const won = r2.events.find((e) => e.type === 'breakawayWon');
    const riders = won?.type === 'breakawayWon' ? won.riders : [];
    expect(riders).toHaveLength(2);
    const sq = Object.values(track.squares).find((q) => q.flags.includes('breakaway'))!;
    expect(r2.state.riders[riders[0]!]!.position).toEqual({ square: sq.id, lane: 0 });
    expect(r2.state.riders[riders[1]!]!.position).toEqual({ square: sq.id, lane: 1 });
  });

  it('ties go to the rider furthest back, then leftmost', () => {
    const { state } = setup(2);
    let s = placeAll(state);
    // Give both bidders identical hands so the totals tie.
    const fix = (st: GameState) => {
      for (const r of Object.values(st.riders))
        if (r.hand) r.hand = r.hand.map((c, i) => ({ ...c, value: [5, 4, 3, 2][i]! }));
    };
    const round = (st: GameState) => {
      let x = st;
      for (const seat of ['seat-0', 'seat-1']) {
        const choose = legalActions(x, seat).find((a) => a.type === 'chooseRider');
        if (choose) x = ok(x, choose).state;
        fix(x);
        const five = legalActions(x, seat).find(
          (a) =>
            a.type === 'playCard' &&
            Object.values(x.riders).some((r) => r.hand?.find((c) => c.id === a.card)?.value === 5),
        )!;
        x = ok(x, five).state;
      }
      return x;
    };
    s = round(s);
    const before = s;
    s = round(s);
    const bidders = before.teams.map((t) => before.riders[t.firstRider!]!);
    const index = (id: string) => before.track.squares[id]!.index;
    const back = [...bidders].sort(
      (a, b) =>
        index(a.position!.square) - index(b.position!.square) ||
        b.position!.lane - a.position!.lane,
    )[0]!;
    const winner = Object.values(s.riders).find(
      (r) => r.position && s.track.squares[r.position.square]!.flags.includes('breakaway'),
    )!;
    expect(winner.id).toBe(back.id);
  });

  it('random games with the breakaway play to the end', () => {
    for (const teams of [2, 4, 6]) {
      const { state } = setup(teams, teams > 4 ? { start: '1_s', tile: '2_w' } : {});
      const { state: end, events } = playRandom(state, `brk-${teams}`);
      expect(end.phase).toBe('stageEnd');
      expect(events.some((e) => e.type === 'breakawayWon')).toBe(true);
    }
  });
});
