/**
 * Peloton breakaway bidding (docs/RULES_SPEC.md P-BRK-1..4, D-026).
 *
 * After placement, each playing team picks one rider (`chooseRider`), which is dealt four cards
 * and bids one face down (`playCard`); the rest are recycled. Once every bidder has locked in, the
 * bids are revealed. Two bidding rounds. The highest two-card totals (one winner, or two with five
 * or six teams) go to the breakaway square on tile #2, highest bid in the rightmost lane. Ties go
 * to the rider furthest back, then leftmost. Winners' bid cards leave the game and each winner
 * recycles two exhaustion cards; losers recycle their bids; then every bidder shuffles its
 * recycled cards into its deck. Dummy teams do not bid.
 */
import type { Card, GameEvent } from '@velo/protocol';
import type { GameState, RiderState } from '../state';
import { deal } from './cards';
import { Hooks } from './compose';
import { emit } from './reducer';
import { square } from './track';
import { shuffle } from '../rng';

export const breakawayEnabled = (state: Readonly<GameState>) =>
  state.config.modules.peloton?.breakaway === true;

/** The breakaway square: the square of tile #2 marked for the breakaway. */
export function breakawaySquare(state: Readonly<GameState>): string | undefined {
  return Object.values(state.track.squares).find((s) => s.flags.includes('breakaway'))?.id;
}

/** Teams that bid: every team except dummy teams, with a rider still in the race. */
export const biddingTeams = (state: Readonly<GameState>) => state.teams.filter((t) => !t.dummy);

/** How many riders break away: two with five or six teams, otherwise one (P-BRK-3). */
export function breakawayWinners(state: Readonly<GameState>): number {
  const teams = state.teams.length;
  const one = state.config.modules.peloton?.oneRiderEach === true;
  const sq = breakawaySquare(state);
  const lanes = sq ? square(state.track, sq).lanes : 1;
  return Math.min(teams >= 5 && teams <= 6 && !one ? 2 : 1, lanes);
}

/** Enter the bidding phase after placement. */
export function startBreakaway(state: GameState, events: GameEvent[]): void {
  state.breakaway = { round: 1, bids: {} };
  emit(state, events, { type: 'phaseChanged', phase: 'breakaway', round: 0 });
}

/** The rider a team bids with, if chosen. */
export const bidderOf = (state: Readonly<GameState>, team: string): RiderState | undefined => {
  const t = state.teams.find((x) => x.team === team);
  return t?.firstRider ? state.riders[t.firstRider] : undefined;
};

/** A team chose its bidding rider: deal it a hand. */
export function chooseBidder(state: GameState, rider: RiderState, events: GameEvent[]): void {
  emit(state, events, { type: 'riderChosen', team: rider.team, rider: rider.id });
  deal(state, rider, new Hooks(state).handSize(rider.id), events);
}

/** After a bid is locked: reveal when everyone has bid, then deal round 2 or resolve. */
export function afterBid(state: GameState, events: GameEvent[]): void {
  const bidders = biddingTeams(state).map((t) => bidderOf(state, t.team));
  if (bidders.some((r) => !r || !r.locked)) return;
  const b = state.breakaway!;
  const riders = bidders as RiderState[];
  emit(state, events, {
    type: 'breakawayRevealed',
    round: b.round,
    bids: riders.map((r) => ({
      rider: r.id,
      card: { kind: r.locked!.kind, value: r.locked!.value },
    })),
  });
  for (const r of riders) {
    (b.bids[r.id] ??= []).push(r.locked!);
    r.locked = null;
  }
  if (b.round === 1) {
    b.round = 2;
    for (const r of riders) deal(state, r, new Hooks(state).handSize(r.id), events);
    return;
  }
  resolve(state, riders, events);
}

const total = (cards: readonly Card[]) => cards.reduce((s, c) => s + c.value, 0);

function resolve(state: GameState, riders: RiderState[], events: GameEvent[]): void {
  const bids = state.breakaway!.bids;
  const index = (r: RiderState) => square(state.track, r.position!.square).index;
  // Highest total first; ties to the rider furthest back, then leftmost (highest lane).
  const ranked = [...riders].sort(
    (a, b) =>
      total(bids[b.id]!) - total(bids[a.id]!) ||
      index(a) - index(b) ||
      b.position!.lane - a.position!.lane,
  );
  const target = breakawaySquare(state);
  const winners = target ? ranked.slice(0, breakawayWinners(state)) : [];
  for (const r of riders) {
    const cards = bids[r.id]!;
    if (winners.includes(r)) {
      // Out of this race (P-BRK-4), kept in the public history of revealed cards. In a tour
      // they are played energy like any other, so they come back after the stage (G-CRD-1, D-042).
      r.played.push(...cards);
      if (r.tour) r.setAside.push(...cards.filter((c) => c.kind === 'energy'));
      emit(state, events, { type: 'exhaustionTaken', rider: r.id });
      emit(state, events, { type: 'exhaustionTaken', rider: r.id });
    } else {
      r.recycled.push(...cards);
    }
    const [deck, rng] = shuffle(state.rng, [...r.drawPile, ...r.recycled]);
    state.rng = rng;
    r.drawPile = deck;
    r.recycled = [];
    emit(state, events, { type: 'deckReshuffled', rider: r.id });
  }
  emit(state, events, { type: 'breakawayWon', riders: winners.map((r) => r.id) });
  winners.forEach((r, lane) =>
    emit(state, events, { type: 'riderPlaced', rider: r.id, at: { square: target!, lane } }),
  );
  state.breakaway = null;
  emit(state, events, { type: 'phaseChanged', phase: 'energy', round: 1 });
}
