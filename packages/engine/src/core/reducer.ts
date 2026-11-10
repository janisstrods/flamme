/**
 * The event reducer: every public effect is emitted as a GameEvent and applied here, so the state
 * and the client's animation can never disagree. Mutates `state`, which is always a fresh clone.
 */
import type { GameEvent } from '@velo/protocol';
import type { GameState, RiderState } from '../state';
import { exhaustionCard } from './cards';

function rider(state: GameState, id: string): RiderState {
  const r = state.riders[id];
  if (!r) throw new Error(`Unknown rider ${id}`);
  return r;
}

export function applyEvent(state: GameState, ev: GameEvent): void {
  switch (ev.type) {
    case 'phaseChanged':
      state.phase = ev.phase;
      state.round = ev.round;
      if (ev.phase === 'energy') for (const t of state.teams) t.firstRider = null;
      return;
    case 'riderPlaced':
      rider(state, ev.rider).position = { ...ev.at };
      state.placementOrder = state.placementOrder.filter((t) =>
        state.teams
          .find((x) => x.team === t)!
          .riders.some((r) => rider(state, r).position === null),
      );
      return;
    case 'riderChosen':
      state.teams.find((t) => t.team === ev.team)!.firstRider = ev.rider;
      return;
    case 'riderMoved':
    case 'riderShifted':
      rider(state, ev.rider).position = { ...ev.to };
      return;
    case 'slipstream':
      for (const m of ev.moves) rider(state, m.rider).position = { ...m.to };
      return;
    case 'riderCrashed':
      for (const id of ev.riders) rider(state, id).crashed = true;
      return;
    case 'exhaustionTaken': {
      const r = rider(state, ev.rider);
      r.recycled.push(exhaustionCard(r));
      if (state.exhaustionSupply !== null) state.exhaustionSupply -= 1;
      return;
    }
    case 'riderFinished': {
      const r = rider(state, ev.rider);
      r.finished = true;
      r.finishPlace = ev.place;
      return;
    }
    case 'stageEnded':
      state.result = [...ev.order];
      return;
    default:
      // Announcement-only events (cardLocked, cardsRevealed, deckReshuffled, …) change nothing here;
      // the private changes behind them are made directly by the phase that emits them.
      return;
  }
}

/** Emit and apply in one step. */
export function emit(state: GameState, events: GameEvent[], ev: GameEvent): void {
  applyEvent(state, ev);
  events.push(ev);
}
