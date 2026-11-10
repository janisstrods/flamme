/** Decks, drawing and exhaustion cards (B-SET-2, B-ENG-1 … B-ENG-6). */
import { EXHAUSTION_VALUE, STARTING_DECKS } from '@velo/content';
import type { RiderType } from '@velo/content';
import type { Card, GameEvent, RiderId } from '@velo/protocol';
import { shuffle } from '../rng';
import type { GameState, RiderState } from '../state';

export function exhaustionCard(rider: RiderState): Card {
  rider.exhaustionReceived += 1;
  return {
    id: `${rider.id}#x${rider.exhaustionReceived}`,
    kind: 'exhaustion',
    value: EXHAUSTION_VALUE,
    powers: [],
  };
}

/** Unshuffled starting deck with stable ids `${rider}#${n}`. */
export function startingDeck(rider: RiderId, type: RiderType): Card[] {
  const entries = STARTING_DECKS[type] ?? [];
  const cards: Card[] = [];
  for (const e of entries)
    for (let i = 0; i < e.count; i++)
      cards.push({
        id: `${rider}#${cards.length}`,
        kind: e.kind,
        value: e.value,
        powers: [...e.powers],
      });
  return cards;
}

/** Shuffle a rider's recycled cards into a new face-down deck. */
function reshuffle(state: GameState, rider: RiderState, events: GameEvent[]): void {
  const [deck, rng] = shuffle(state.rng, rider.recycled);
  state.rng = rng;
  rider.drawPile = deck;
  rider.recycled = [];
  events.push({ type: 'deckReshuffled', rider: rider.id });
}

/**
 * Deal `n` cards into the rider's hand. Reshuffles recycled cards when the face-down pile runs out;
 * draws everything if fewer than `n` exist; with no cards at all, deals one exhaustion card (D-010).
 */
export function deal(state: GameState, rider: RiderState, n: number, events: GameEvent[]): void {
  const hand: Card[] = [];
  while (hand.length < n) {
    if (rider.drawPile.length === 0) {
      if (rider.recycled.length === 0) break;
      reshuffle(state, rider, events);
    }
    hand.push(rider.drawPile.shift()!);
  }
  if (hand.length === 0) hand.push(exhaustionCard(rider));
  rider.hand = hand;
}

/** Lock in one card from the hand; the rest go face up under the deck (B-ENG-2). */
export function lockCard(rider: RiderState, cardId: string): void {
  const hand = rider.hand ?? [];
  const card = hand.find((c) => c.id === cardId);
  if (!card) throw new Error(`Card ${cardId} is not in ${rider.id}'s hand`);
  rider.locked = card;
  rider.recycled.push(...hand.filter((c) => c.id !== cardId));
  rider.hand = null;
}

/** Every card the rider still owns this stage (for conservation checks and remaining values). */
export function cardsInDeck(rider: RiderState): Card[] {
  return [
    ...rider.drawPile,
    ...rider.recycled,
    ...(rider.hand ?? []),
    ...(rider.locked ? [rider.locked] : []),
  ];
}
