/**
 * Extended stages (docs/RULES_SPEC.md G-EXT-1): the first rider to reach the refresh token takes
 * it (the furthest ahead if several reach it in one round). At the end of that round every rider
 * may take back played energy cards worth up to 24 in total (25 for the token holder), then
 * shuffles them, its recycled cards and its deck together.
 */
import type { Action, Card, GameEvent, RiderId, SeatId } from '@velo/protocol';
import { shuffle } from '../rng';
import type { GameState } from '../state';
import { isDummy } from './dummies';
import { emit } from './reducer';

export const REFRESH_LIMIT = 24;

export const refreshLimit = (state: Readonly<GameState>, rider: RiderId) =>
  REFRESH_LIMIT + (state.refresh?.holder === rider ? 1 : 0);

/** Energy cards a rider may take back: those played this stage (set aside in tours). */
export const retrievable = (state: Readonly<GameState>, rider: RiderId): Card[] => {
  const r = state.riders[rider]!;
  const source = r.tour ? r.setAside : r.played;
  return source.filter((c) => c.kind !== 'exhaustion');
};

/** The highest-value cards that fit under the limit, biggest first. */
export function bestRetrieval(state: Readonly<GameState>, rider: RiderId): string[] {
  let left = refreshLimit(state, rider);
  const out: string[] = [];
  for (const c of [...retrievable(state, rider)].sort((a, b) => b.value - a.value))
    if (c.value <= left) {
      out.push(c.id);
      left -= c.value;
    }
  return out;
}

/** At the end of the round the token was taken: start the refresh phase. */
export function maybeStartRefresh(state: GameState, events: GameEvent[]): boolean {
  const ref = state.refresh;
  if (!ref || ref.used || !ref.holder) return false;
  ref.used = true;
  ref.pending = Object.values(state.riders)
    .filter((r) => !r.finished && r.position && !isDummy(state, r.id))
    .map((r) => r.id);
  if (ref.pending.length === 0) return false;
  emit(state, events, { type: 'phaseChanged', phase: 'refresh', round: state.round });
  return true;
}

export function refreshActions(state: Readonly<GameState>, seat: SeatId): Action[] {
  const team = state.teams.find((t) => t.seat === seat);
  const rider = state.refresh?.pending.find((id) => team?.riders.includes(id));
  if (!rider) return [];
  const best = bestRetrieval(state, rider);
  return [
    { type: 'refreshChoice', seat, rider, cards: best },
    ...(best.length > 0 ? [{ type: 'refreshChoice' as const, seat, rider, cards: [] }] : []),
  ];
}

/** A rider's choice; the next round starts once every rider has chosen. Returns an error text. */
export function refreshChoice(
  state: GameState,
  rider: RiderId,
  cards: readonly string[],
  events: GameEvent[],
): string | null {
  const ref = state.refresh;
  if (!ref?.pending.includes(rider)) return 'That rider has nothing to take back now.';
  const pool = retrievable(state, rider);
  const chosen = cards.map((id) => pool.find((c) => c.id === id));
  if (chosen.some((c) => !c) || new Set(cards).size !== cards.length)
    return 'Pick played energy cards of this rider.';
  const total = chosen.reduce((n, c) => n + c!.value, 0);
  if (total > refreshLimit(state, rider))
    return `Take back cards worth at most ${refreshLimit(state, rider)}.`;
  const r = state.riders[rider]!;
  const ids = new Set(cards);
  r.setAside = r.setAside.filter((c) => !ids.has(c.id));
  r.played = r.played.filter((c) => !ids.has(c.id));
  const [deck, rng] = shuffle(state.rng, [...r.drawPile, ...r.recycled, ...(chosen as Card[])]);
  state.rng = rng;
  r.drawPile = deck;
  r.recycled = [];
  emit(state, events, {
    type: 'cardsRetrieved',
    rider,
    cards: (chosen as Card[]).map((c) => ({ kind: c.kind, value: c.value })),
  });
  ref.pending = ref.pending.filter((id) => id !== rider);
  if (ref.pending.length === 0)
    emit(state, events, { type: 'phaseChanged', phase: 'energy', round: state.round + 1 });
  return null;
}
