/**
 * Public engine API (plan section 4). Signatures FROZEN at the end of M0; bodies arrive in M1.
 *
 * The engine is pure and deterministic: no I/O, no clock, no Math.random. State changes only
 * through `apply`. The same config, seed and actions always give the same states and events.
 */
import type { TrackGraph } from '@velo/content';
import type {
  Action,
  Card,
  GameConfig,
  GameEvent,
  GameView,
  Position,
  RiderId,
  SeatId,
} from '@velo/protocol';
import type { GameState } from './state';

export type EngineErrorCode =
  | 'NOT_YOUR_TURN'
  | 'WRONG_PHASE'
  | 'UNKNOWN_RIDER'
  | 'NOT_YOUR_RIDER'
  | 'CARD_NOT_IN_HAND'
  | 'ALREADY_LOCKED'
  | 'ILLEGAL_POSITION'
  | 'INVALID_ACTION'
  | 'NOT_IMPLEMENTED';

export interface EngineError {
  code: EngineErrorCode;
  message: string;
}

export type ApplyResult =
  { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: EngineError };

export interface MovePreview {
  rider: RiderId;
  cardValue: number;
  /** Value after terrain, weather and specialist modifiers. */
  effectiveValue: number;
  /** Where the rider would land if nothing blocked it. */
  unobstructed: Position;
  /** Squares between the start and the unobstructed landing square. */
  path: string[];
  /** Short machine-readable hint keys for the UI (e.g. 'cappedByAscent', 'narrowAhead'). */
  hints: string[];
}

export type Viewer = SeatId | 'spectator';

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} is not implemented yet (milestone M1).`);
    this.name = 'NotImplementedError';
  }
}

/** Build the initial state for a game. `track` is the compiled stage for stage 1. */
export function createGame(_config: GameConfig, _seed: string, _track: TrackGraph): GameState {
  throw new NotImplementedError('createGame');
}

/** Everything a seat may do right now. Empty if the seat has nothing to do. */
export function legalActions(_state: GameState, _seat: SeatId): Action[] {
  throw new NotImplementedError('legalActions');
}

/** Validate and apply one action. Never throws for a bad action: returns a typed error instead. */
export function apply(_state: GameState, _action: Action): ApplyResult {
  return { ok: false, error: { code: 'NOT_IMPLEMENTED', message: 'apply arrives in M1.' } };
}

/** The redacted view for one seat or a spectator. Must never include another team's private data. */
export function viewFor(_state: GameState, _viewer: Viewer): GameView {
  throw new NotImplementedError('viewFor');
}

/** Terrain-adjusted value and unobstructed landing square, for UI hints and AI. */
export function previewMove(_state: GameState, _rider: RiderId, _card: Card): MovePreview {
  throw new NotImplementedError('previewMove');
}
