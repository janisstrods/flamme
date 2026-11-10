/**
 * Rule-module hook points (plan section 4). FROZEN at the end of M0: only the lead changes
 * these interfaces. Every expansion rule plugs into one of these hooks; the core loop never
 * checks `if (peloton)`.
 *
 * Modules live under `packages/engine/src/modules/<id>/` and are composed in a fixed order
 * (base first). Hooks receive read-only context and return values; they never mutate state.
 * Hooks that return `GameEvent[]` describe effects; the core applies every event through one
 * event reducer, so state changes and the client's animation always agree.
 */
import type { CompiledSquare, SquareId, TrackGraph } from '@velo/content';
import type { Card, CrashCause, GameEvent, Position, RiderId, ValueModifier } from '@velo/protocol';
import type { GameState, RiderState } from './state';

export type ModuleId =
  | 'base'
  | 'peloton'
  | 'meteo'
  | 'grandTour.tour'
  | 'grandTour.newTiles'
  | 'grandTour.specialists'
  | 'grandTour.specialStages'
  | 'champion.handicaps'
  | 'dummies'
  /** Crash consequences (C-*), shared by the Meteo wet tile and Grand Tour sharp corners. */
  | 'crashes';

export interface HookContext {
  readonly state: Readonly<GameState>;
  readonly track: TrackGraph;
  square(id: SquareId): CompiledSquare;
  rider(id: RiderId): Readonly<RiderState>;
}

/**
 * Value modifiers run in three stages, in this order (plan section 4; confirm in M0):
 * minimums (descent, supply zone), then penalties (crash recovery), then caps (ascent).
 * Within a stage, modules run in composition order.
 */
export type ModifierStage = 'minimum' | 'penalty' | 'cap';

export interface ModifierProposal {
  stage: ModifierStage;
  source: ValueModifier['source'];
  apply(value: number): number;
}

export interface MoveCandidate {
  rider: RiderId;
  from: Position;
  /** Squares the rider would pass through, ignoring occupancy, ending at the unobstructed target. */
  path: SquareId[];
  effectiveValue: number;
}

export type CardDisposal = 'remove' | 'setAside' | 'returnToSupply';

export interface RuleModule {
  readonly id: ModuleId;

  /** Cards drawn this energy phase. Receives the value so far (base: 4). */
  handSize?(ctx: HookContext, rider: RiderId, current: number): number;

  /** Contribute value modifiers for a revealed card. */
  valueModifiers?(ctx: HookContext, rider: RiderId, card: Card): ModifierProposal[];

  /** Reorder riders for the movement phase. Receives the base order (front to back, lane 0 first). */
  movementOrder?(ctx: HookContext, order: readonly RiderId[]): RiderId[];

  /**
   * Choose where a moving rider ends up. Return undefined to defer to the next module;
   * the base module always answers (blocking, nearest free square behind, rightmost free lane).
   */
  landing?(
    ctx: HookContext,
    move: MoveCandidate,
    occupancy: ReadonlyMap<SquareId, ReadonlySet<number>>,
  ): Position | undefined;

  /** Decide whether a rider crashes after landing. */
  crashCheck?(
    ctx: HookContext,
    rider: RiderId,
    landed: Position,
    blocked: boolean,
  ): CrashCause | null;

  /**
   * Return false to stop a square giving or receiving slipstream (ascents, cobbles, crosswind,
   * crashed riders, Breakaway power, time trials). `riders` are the riders on that square.
   */
  slipstreamEligible?(
    ctx: HookContext,
    role: 'give' | 'receive',
    square: SquareId,
    riders: readonly RiderId[],
  ): boolean;

  /** Return false to veto (or true to force) exhaustion for a rider. Receives the base decision. */
  exhaustion?(ctx: HookContext, rider: RiderId, current: boolean): boolean;

  /** What happens to a played card at the end phase. Base: remove. Tour: setAside / returnToSupply. */
  cardDisposal?(ctx: HookContext, rider: RiderId, card: Card, current: CardDisposal): CardDisposal;

  /** Effects of a card the moment it is revealed (Recovery returns an exhaustion card). */
  onReveal?(ctx: HookContext, rider: RiderId, card: Card): GameEvent[];

  /**
   * Adjust a rider's position right after its own move, before the next rider moves (Chase).
   * Return undefined to leave it; the core emits `riderShifted`.
   */
  afterMove?(
    ctx: HookContext,
    rider: RiderId,
    card: Card,
    landed: Position,
    occupancy: ReadonlyMap<SquareId, ReadonlySet<number>>,
  ): Position | undefined;

  /**
   * End of round, after slipstream and before exhaustion: resolve everything that depends on the
   * squares riders reached or passed this round (tokens, refresh token, finish timing).
   * `passed` maps each rider to every square it entered this round, in order.
   */
  endOfRound?(ctx: HookContext, passed: ReadonlyMap<RiderId, readonly SquareId[]>): GameEvent[];
}
