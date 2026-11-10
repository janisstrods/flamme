/**
 * Replays (plan section 10): rebuild a finished race from its config, seed and action log (the
 * room's save), as one spectator view per round, so the board can show any moment of it.
 */
import { apply, createGame, viewFor } from '@velo/engine';
import type { GameState } from '@velo/engine';
import type { GameView } from '@velo/protocol';
import type { RoomSnapshot } from '@velo/host';

export interface ReplayFrame {
  view: GameView;
  /** "Stage 2, round 5" and the like. */
  label: string;
}

/** One frame after placement and one after every round (and at the start of each stage). */
export function replayFrames(snapshot: RoomSnapshot): ReplayFrame[] {
  if (!snapshot.seed) return [];
  // The game's own config: the lobby config may have changed since the race ended.
  const config = snapshot.gameConfig ?? snapshot.config;
  let state: GameState = createGame(config, snapshot.seed);
  const tour = config.mode.kind === 'tour';
  const label = (s: GameState, what: string) => `${tour ? `Stage ${s.stageNumber}, ` : ''}${what}`;
  const frames: ReplayFrame[] = [];
  const push = (what: string) =>
    frames.push({ view: viewFor(state, 'spectator'), label: label(state, what) });
  for (const action of snapshot.actions) {
    const res = apply(state, action);
    if (!res.ok) break;
    const before = state;
    state = res.state;
    for (const e of res.events) {
      if (
        e.type === 'phaseChanged' &&
        e.phase === 'energy' &&
        e.round === 1 &&
        before.phase !== 'energy'
      )
        push('start');
      else if (e.type === 'phaseChanged' && (e.phase === 'energy' || e.phase === 'refresh'))
        push(`after round ${state.round - (e.phase === 'energy' ? 1 : 0)}`);
      else if (e.type === 'stageEnded') push('finish');
    }
  }
  return frames;
}
