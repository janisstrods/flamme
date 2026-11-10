/**
 * AI opponents (milestone M5). Bots see only `viewFor(state, seat)` and act through `Action`s,
 * exactly like a human seat.
 */
import type { Action, GameView, SeatId } from '@velo/protocol';

export interface Bot {
  readonly name: string;
  /** Choose the next action for `seat` given its redacted view and its legal actions. */
  decide(view: GameView, seat: SeatId, legal: readonly Action[]): Action;
}
