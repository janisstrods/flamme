/**
 * AI opponents. Bots see only `viewFor(state, seat)` and act through `Action`s, exactly like a
 * human seat. `randomBot` is the floor for self-play; `makeBot` builds the Easy/Medium/Hard bots.
 */
import { nextInt, seedRng } from '@velo/engine';
import type { RngState } from '@velo/engine';
import type { Action, GameView, SeatId } from '@velo/protocol';

export interface Bot {
  readonly name: string;
  /** Choose the next action for `seat` given its redacted view and its legal actions. */
  decide(view: GameView, seat: SeatId, legal: readonly Action[]): Action;
}

/** Picks uniformly among legal actions. Seeded, so self-play runs are reproducible. */
export function randomBot(seed: string): Bot {
  let rng: RngState = seedRng(`bot:${seed}`);
  return {
    name: 'random',
    decide(_view, _seat, legal) {
      if (legal.length === 0) throw new Error('randomBot: no legal actions');
      const [i, next] = nextInt(rng, legal.length);
      rng = next;
      return legal[i]!;
    },
  };
}

export { effortToFinish, expectedBest, makeBot, roundsToFinish } from './bots';
export type { BotOptions } from './bots';
