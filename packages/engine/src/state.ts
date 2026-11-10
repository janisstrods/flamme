/**
 * Engine-internal game state. NOT part of the frozen contract: the Rules track may add fields.
 * It never leaves the server; clients only ever see `viewFor(state, seat)`.
 *
 * Plain JSON-serialisable data only. The compiled track is immutable and shared between states.
 */
import type { RiderType, StageType, TrackGraph, WeatherEffect } from '@velo/content';
import type {
  Card,
  GameConfig,
  Jersey,
  Phase,
  Position,
  RiderId,
  SeatId,
  TeamId,
} from '@velo/protocol';
import type { ModuleId } from './hooks';
import type { RngState } from './rng';

export interface RiderState {
  id: RiderId;
  team: TeamId;
  type: RiderType;
  position: Position | null;
  /** Face-down cards, top of the deck first. */
  drawPile: Card[];
  /** Face-up cards waiting under the deck, oldest first. */
  recycled: Card[];
  /** Cards dealt this energy phase; null when not dealt. */
  hand: Card[] | null;
  /** Locked-in card for this round, until it is revealed and disposed of. */
  locked: Card | null;
  /** Cards revealed this stage, in order (public history). */
  played: Card[];
  /** Tour only: energy cards set aside until the end of the stage. */
  setAside: Card[];
  /** Exhaustion cards this rider has received this game (used for card ids). */
  exhaustionReceived: number;
  crashed: boolean;
  finished: boolean;
  finishPlace: number | null;
  specialist: string | null;
  /** Tour only (null in single races). Totals over the whole tour, plus this stage's time. */
  tour: {
    seconds: number;
    sprintPoints: number;
    mountainPoints: number;
    jersey: Jersey | null;
    /** Time on the current stage so far: penalty minutes plus timing-strip seconds. */
    stageSeconds: number;
  } | null;
}

export interface TeamState {
  team: TeamId;
  seat: SeatId;
  controller: 'human' | 'ai' | 'dummy';
  color: string;
  riders: RiderId[];
  /** The rider dealt first this round; null until chosen. */
  firstRider: RiderId | null;
  /** Peloton expansion dummy teams (P-PEL-1, P-MUS-1); null for players and bots. */
  dummy: 'peloton' | 'muscle' | null;
  /** Peloton dummy team: the one deck both riders share, top first. */
  sharedDeck: Card[];
  /** Peloton dummy team: cards flipped so far, for reshuffling (D-025). */
  sharedPlayed: Card[];
  tourPoints: number;
}

export interface TokenPileState {
  pile: 'major' | 'minor';
  kind: 'sprint' | 'mountain';
  square: string;
  remaining: number[];
  /** Riders that have reached this pile already (each rider takes at most one token per pile). */
  reached: RiderId[];
}

export interface GameState {
  /** Bump when the state shape changes incompatibly; persisted logs replay from config + seed. */
  schema: 1;
  config: GameConfig;
  modules: ModuleId[];
  rng: RngState;
  phase: Phase;
  round: number;
  stageNumber: number;
  track: TrackGraph;
  /** Teams in seat (clockwise) order. */
  teams: TeamState[];
  riders: Record<RiderId, RiderState>;
  /** Placement phase: teams still to place, current placer first. */
  placementOrder: TeamId[];
  tokens: TokenPileState[];
  /** Exhaustion cards left in the shared supply (null = unlimited, D-003). */
  exhaustionSupply: number | null;
  /** Final order once the stage has ended. */
  result: RiderId[] | null;
  /** Peloton breakaway bidding in progress (P-BRK-*): the round and each bidder's revealed bids. */
  breakaway: { round: 1 | 2; bids: Record<RiderId, Card[]> } | null;
  /** The current stage's type: time trials change who affects whom (G-TTT-1, G-ITT-1). */
  stageType: StageType;
  /** Extended stages (G-EXT-1): the refresh token's square, who took it, and whether it was used. */
  refresh: { square: string; holder: RiderId | null; used: boolean; pending: RiderId[] } | null;
  /** Specialist draft in progress (G-SPC-1): picks still to make (team per pick) and copies left. */
  draft: { order: TeamId[]; pool: Record<string, number> } | null;
  /** Meteo weather on tiles (public). `track` already carries these effects on its squares. */
  weather: { tile: number; effect: WeatherEffect }[];
}
