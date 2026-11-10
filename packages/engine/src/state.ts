/**
 * Engine-internal game state. NOT part of the frozen contract: the Rules track may add fields
 * in M1+. It never leaves the server; clients only ever see `viewFor(state, seat)`.
 *
 * Plain JSON-serialisable data only, so states can be cloned, hashed and compared in tests.
 */
import type { RiderType, TrackGraph } from '@velo/content';
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
import type { RngState } from './rng';

export interface RiderState {
  id: RiderId;
  team: TeamId;
  type: RiderType;
  position: Position | null;
  /** Face-down cards, top of the deck first. */
  drawPile: Card[];
  /** Face-up cards waiting under the deck. */
  recycled: Card[];
  /** Cards dealt this energy phase; null when not dealt. */
  hand: Card[] | null;
  /** Locked-in card for this round, until revealed. */
  locked: Card | null;
  /** Cards revealed and removed this stage (public history). */
  played: Card[];
  /** Tour only: energy cards set aside until the end of the stage. */
  setAside: Card[];
  crashed: boolean;
  finished: boolean;
  finishPlace: number | null;
  specialist: string | null;
  tour: {
    seconds: number;
    sprintPoints: number;
    mountainPoints: number;
    jersey: Jersey | null;
  } | null;
}

export interface TeamState {
  team: TeamId;
  seat: SeatId;
  controller: 'human' | 'ai' | 'dummy';
  riders: RiderId[];
  /** Which rider this team chose to draw for first this round. */
  firstRider: RiderId | null;
  tourPoints: number;
}

export interface TokenPileState {
  pile: 'major' | 'minor';
  kind: 'sprint' | 'mountain';
  square: string;
  remaining: number[];
}

export interface GameState {
  /** Bump when the state shape changes incompatibly; persisted logs replay from config + seed. */
  schema: 1;
  config: GameConfig;
  rng: RngState;
  phase: Phase;
  round: number;
  stageNumber: number;
  track: TrackGraph;
  teams: TeamState[];
  riders: Record<RiderId, RiderState>;
  tokens: TokenPileState[];
  /** Exhaustion cards left in the shared supply (null if unlimited; see RULES_DECISIONS). */
  exhaustionSupply: number | null;
  nextCardId: number;
}
