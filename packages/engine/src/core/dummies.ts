/**
 * Dummy teams from the Peloton box (P-PEL-1, P-MUS-1, P-DUM-1). They need no decisions: they place
 * themselves before everyone else, flip their top card(s) when the others have locked in, take
 * slipstream, and never take exhaustion.
 */
import { STARTING_DECKS } from '@velo/content';
import type { Card, GameEvent, RiderId } from '@velo/protocol';
import type { RuleModule } from '../hooks';
import { shuffle } from '../rng';
import type { GameState, RiderState, TeamState } from '../state';
import { compareFrontFirst, freeLane, laneSets, occupancy, square } from './track';

/** Peloton team's shared deck: a rouleur deck plus two attack cards. */
export function pelotonDeck(seat: string): Card[] {
  const cards: Card[] = [];
  for (const e of STARTING_DECKS.rouleur ?? [])
    for (let i = 0; i < e.count; i++)
      cards.push({ id: `${seat}:P#${cards.length}`, kind: 'energy', value: e.value, powers: [] });
  cards.push({ id: `${seat}:A#0`, kind: 'attack', value: 0, powers: [] });
  cards.push({ id: `${seat}:A#1`, kind: 'attack', value: 0, powers: [] });
  return cards;
}

/** The Muscle team's extra card, added to its sprinteur's deck. */
export const muscleCard = (seat: string): Card => ({
  id: `${seat}:S#m`,
  kind: 'muscle',
  value: 5,
  powers: [],
});

/** P-DUM-1: Peloton team first, then Muscle teams, each as far forward as possible. */
export function placeDummies(state: GameState): void {
  const order = [
    ...state.teams.filter((t) => t.dummy === 'peloton'),
    ...state.teams.filter((t) => t.dummy === 'muscle'),
  ];
  for (const team of order) {
    const [front, back] =
      team.dummy === 'peloton'
        ? [team.riders[0]!, team.riders[1]!]
        : [team.riders.find((r) => r.endsWith(':S'))!, team.riders.find((r) => r.endsWith(':R'))!];
    const first = placeFrontmost(state, front, -1);
    placeFrontmost(state, back, first);
  }
}

/** Put a rider on the front-most free grid lane, strictly behind grid position `behind` if given. */
function placeFrontmost(state: GameState, rider: RiderId, behind: number): number {
  const occ = laneSets(occupancy(state));
  for (let i = behind + 1; i < state.track.startGrid.length; i++) {
    const sq = state.track.startGrid[i]!;
    const lane = freeLane(state.track, occ.get(sq), sq);
    if (lane !== undefined) {
      state.riders[rider]!.position = { square: sq, lane };
      return i;
    }
  }
  throw new Error('No room on the start grid for the dummy teams');
}

function draw(
  state: GameState,
  pile: () => Card[],
  refill: () => Card[],
  set: (deck: Card[]) => void,
): Card {
  if (pile().length === 0) {
    // D-025: the rulebook does not say; reshuffle the flipped cards into a new deck.
    const [deck, rng] = shuffle(state.rng, refill());
    state.rng = rng;
    set(deck);
  }
  return pile().shift()!;
}

/** Flip the dummy teams' cards for this round (after everyone else has locked in). */
export function flipDummies(state: GameState, _events: GameEvent[]): void {
  for (const team of state.teams) {
    if (!team.dummy) continue;
    const riders = team.riders
      .map((id) => state.riders[id]!)
      .filter((r) => !r.finished && r.position);
    if (riders.length === 0) continue;
    if (team.dummy === 'peloton') flipPeloton(state, team, riders);
    else
      for (const r of riders) {
        // A Muscle rider keeps its flipped cards in `recycled` (it has no other use for it) so
        // they can be reshuffled when the deck runs out.
        const card = draw(
          state,
          () => r.drawPile,
          () => r.recycled.splice(0),
          (d) => (r.drawPile = d),
        );
        r.recycled.push(card);
        r.locked = card;
      }
  }
}

function flipPeloton(state: GameState, team: TeamState, riders: RiderState[]): void {
  const card = draw(
    state,
    () => team.sharedDeck,
    () => team.sharedPlayed.splice(0),
    (d) => (team.sharedDeck = d),
  );
  team.sharedPlayed.push(card);
  if (card.kind !== 'attack') {
    for (const r of riders) r.locked = card;
    return;
  }
  // Attack: the front rider moves 2, the rear rider 9.
  const ordered = [...riders].sort((a, b) =>
    compareFrontFirst(state.track, a.position!, b.position!),
  );
  ordered.forEach((r, i) => {
    const value = ordered.length === 1 ? 9 : i === 0 ? 2 : 9;
    r.locked = { id: `${card.id}/${r.id}`, kind: 'attack', value, powers: [] };
  });
}

export const isDummy = (state: Readonly<GameState>, rider: RiderId) =>
  state.teams.some((t) => t.dummy !== null && t.riders.includes(rider));

/** Rule module: dummy riders never take exhaustion (P-DUM-1). */
export const dummiesModule: RuleModule = {
  id: 'dummies',
  exhaustion: (ctx, rider, current) => (isDummy(ctx.state, rider) ? false : current),
};

/** Square index helper for tests and views. */
export const indexOf = (state: GameState, id: string) => square(state.track, id).index;
