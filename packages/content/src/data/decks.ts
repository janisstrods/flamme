/**
 * Starting decks and card constants.
 * UNVERIFIED: taken from the implementation plan; confirm against the base rulebook in M0
 * and record the result in docs/RULES_DECISIONS.md.
 */
import type { StartingDecks } from '../schema';

export const EXHAUSTION_VALUE = 2;

export const STARTING_DECKS: StartingDecks = {
  rouleur: [3, 4, 5, 6, 7].map((value) => ({
    kind: 'energy' as const,
    value,
    count: 3,
    powers: [],
  })),
  sprinteur: [2, 3, 4, 5, 9].map((value) => ({
    kind: 'energy' as const,
    value,
    count: 3,
    powers: [],
  })),
};

/** Cards drawn per energy phase, before weather modifies it. */
export const HAND_SIZE = 4;
