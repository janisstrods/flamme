/**
 * Game-level contracts shared by engine, server, client and AI: cards, actions, events and the
 * redacted per-seat view. FROZEN at the end of M0 (lead-owned).
 *
 * Two invariants every consumer relies on:
 *  1. Every GameEvent is public. Anything private (hands, recycled piles, deck order, the seed)
 *     reaches a client only through `GameView.own`, built by the engine's `viewFor`.
 *  2. Lane 0 is the rightmost lane in the direction of travel.
 */
import { z } from 'zod';
import {
  CardKind,
  ClassificationKind,
  RiderType,
  SpecialistPower,
  SquareId,
  WeatherEffect,
} from '@velo/content';
import { RiderId, SeatId, TeamColor, TeamId } from './config';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const CardId = z.string().min(1);
export type CardId = z.infer<typeof CardId>;

export const Card = z.object({
  id: CardId,
  kind: CardKind,
  value: z.number().int().nonnegative(),
  powers: z.array(SpecialistPower).default([]),
});
export type Card = z.infer<typeof Card>;

export const Position = z.object({
  square: SquareId,
  /**
   * 0 = rightmost lane. Negative lanes are the verge to the right of the road, used only by
   * Nimble riders on a full square (G-SPC-7). Time trials allow several teams in one lane.
   */
  lane: z.number().int().min(-12).max(2),
});
export type Position = z.infer<typeof Position>;

export const Phase = z.enum([
  'setup',
  'draft', // Grand Tour specialist draft
  'breakaway', // Peloton breakaway bidding
  'placement', // start grid
  'energy',
  'movement',
  'end',
  'refresh', // extended-stage refresh phase
  'stageEnd',
  'betweenStages',
  'tourEnd',
]);
export type Phase = z.infer<typeof Phase>;

export const Jersey = z.enum(['yellow', 'green', 'polkaDot']);
export type Jersey = z.infer<typeof Jersey>;

// ---------------------------------------------------------------------------
// Actions (intents). Clients send these; the engine validates them.
// ---------------------------------------------------------------------------

export const Action = z.discriminatedUnion('type', [
  /** Energy phase: the rider to deal for first. Breakaway phase: the rider that bids (E-009). */
  z.object({ type: z.literal('chooseRider'), seat: SeatId, rider: RiderId }),
  z.object({ type: z.literal('playCard'), seat: SeatId, rider: RiderId, card: CardId }),
  z.object({
    type: z.literal('placeRider'),
    seat: SeatId,
    rider: RiderId,
    position: Position,
  }),
  z.object({
    type: z.literal('draftSpecialist'),
    seat: SeatId,
    rider: RiderId,
    specialist: z.string(),
  }),
  z.object({
    type: z.literal('refreshChoice'),
    seat: SeatId,
    rider: RiderId,
    cards: z.array(CardId),
  }),
  /** Host (or server) moves a between-stages sequence or results screen on. */
  z.object({ type: z.literal('advance'), seat: SeatId }),
]);
export type Action = z.infer<typeof Action>;
export type ActionType = Action['type'];

// ---------------------------------------------------------------------------
// Events. Ordered, granular, public. The client animates from these.
// ---------------------------------------------------------------------------

export const PublicCard = z.object({ kind: CardKind, value: z.number().int().nonnegative() });
export type PublicCard = z.infer<typeof PublicCard>;

export const ValueModifier = z.object({
  source: z.enum([
    'ascent',
    'descent',
    'supply',
    'crashRecovery',
    'strongAscents',
    'strongDescents',
    'other',
  ]),
  /** The card value after this modifier was applied. */
  result: z.number().int(),
});
export type ValueModifier = z.infer<typeof ValueModifier>;

export const CrashCause = z.enum(['wet', 'sharpCorner']);
export type CrashCause = z.infer<typeof CrashCause>;

export const TourPointReason = z.enum([
  'podium',
  'restDay',
  'generalBonus',
  'teamBonus',
  'sprintBonus',
  'mountainBonus',
]);

export const GameEvent = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stageStarted'),
    stageId: z.string(),
    stageNumber: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('phaseChanged'),
    phase: Phase,
    round: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('weatherPlaced'),
    tile: z.number().int().nonnegative(),
    effect: WeatherEffect,
  }),
  z.object({
    type: z.literal('specialistDrafted'),
    team: TeamId,
    rider: RiderId,
    specialist: z.string(),
  }),
  z.object({
    type: z.literal('breakawayRevealed'),
    round: z.union([z.literal(1), z.literal(2)]),
    bids: z.array(z.object({ rider: RiderId, card: PublicCard })),
  }),
  /** Breakaway winners, highest bid first; they are then placed with riderPlaced events. */
  z.object({ type: z.literal('breakawayWon'), riders: z.array(RiderId) }),
  z.object({ type: z.literal('riderPlaced'), rider: RiderId, at: Position }),
  z.object({ type: z.literal('riderChosen'), team: TeamId, rider: RiderId }),
  z.object({ type: z.literal('cardLocked'), team: TeamId, rider: RiderId }),
  z.object({ type: z.literal('deckReshuffled'), rider: RiderId }),
  z.object({
    type: z.literal('cardsRevealed'),
    plays: z.array(z.object({ rider: RiderId, card: PublicCard })),
  }),
  z.object({
    type: z.literal('riderMoved'),
    rider: RiderId,
    from: Position,
    to: Position,
    cardValue: z.number().int(),
    effectiveValue: z.number().int(),
    modifiers: z.array(ValueModifier),
    /** Squares passed through, excluding `from`, including `to`. */
    path: z.array(SquareId),
    /**
     * True when the rider lost at least one square to blocking (full or all-crashed squares).
     * This is what triggers wet and sharp-corner crashes.
     */
    blocked: z.boolean(),
    /** True when the rider stopped before an ascent it would only have reached on step 6+ (B-TER-2). */
    ascentEdge: z.boolean().optional(),
  }),
  /** A rider moved outside normal movement or slipstream. */
  z.object({
    type: z.literal('riderShifted'),
    rider: RiderId,
    from: Position,
    to: Position,
    reason: z.enum(['chase', 'nimble', 'nimblePushed', 'standUp', 'narrowing']),
  }),
  z.object({
    type: z.literal('riderCrashed'),
    riders: z.array(RiderId),
    at: SquareId,
    cause: CrashCause,
  }),
  z.object({
    type: z.literal('slipstream'),
    /** The pack that moved up, front rider first. */
    riders: z.array(RiderId),
    moves: z.array(z.object({ rider: RiderId, from: Position, to: Position })),
  }),
  z.object({ type: z.literal('exhaustionTaken'), rider: RiderId }),
  z.object({
    type: z.literal('tokenTaken'),
    rider: RiderId,
    kind: ClassificationKind,
    pile: z.enum(['major', 'minor']),
    value: z.number().int().positive(),
  }),
  z.object({ type: z.literal('refreshTriggered'), rider: RiderId }),
  z.object({ type: z.literal('cardsRetrieved'), rider: RiderId, cards: z.array(PublicCard) }),
  z.object({
    type: z.literal('riderFinished'),
    rider: RiderId,
    place: z.number().int().positive(),
    /** Tour only: seconds from the timing strip, or accumulated penalty. */
    seconds: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal('timePenalty'),
    riders: z.array(RiderId),
    seconds: z.number().int().positive(),
  }),
  z.object({ type: z.literal('stageEnded'), order: z.array(RiderId) }),
  z.object({
    type: z.literal('tourPointsAwarded'),
    team: TeamId,
    points: z.number().int(),
    reason: TourPointReason,
  }),
  z.object({ type: z.literal('jerseyAwarded'), jersey: Jersey, rider: RiderId }),
  z.object({
    type: z.literal('exhaustionReturned'),
    rider: RiderId,
    count: z.number().int().nonnegative(),
  }),
  z.object({ type: z.literal('tourEnded'), ranking: z.array(TeamId) }),
]);
export type GameEvent = z.infer<typeof GameEvent>;
export type GameEventType = GameEvent['type'];

// ---------------------------------------------------------------------------
// Redacted view, one per seat (or spectator).
// ---------------------------------------------------------------------------

export const TeamStatus = z.enum(['idle', 'choosingFirst', 'choosingSecond', 'locked']);
export type TeamStatus = z.infer<typeof TeamStatus>;

export const PublicRider = z.object({
  id: RiderId,
  team: TeamId,
  type: RiderType,
  position: Position.nullable(),
  crashed: z.boolean(),
  finished: z.boolean(),
  /** Cards face down still to draw. Count only. */
  drawPileCount: z.number().int().nonnegative(),
  /** Exhaustion cards anywhere in this rider's deck. Public. */
  exhaustionCount: z.number().int().nonnegative(),
  /** Every card this rider has revealed this stage, in order. */
  played: z.array(PublicCard),
  /** Values still in the rider's deck (not order). Present only when the room option is on. */
  remainingValues: z.record(z.string(), z.number().int().nonnegative()).optional(),
  specialist: z.string().optional(),
  jersey: Jersey.optional(),
  tour: z
    .object({
      seconds: z.number().int().nonnegative(),
      sprintPoints: z.number().int().nonnegative(),
      mountainPoints: z.number().int().nonnegative(),
    })
    .optional(),
});
export type PublicRider = z.infer<typeof PublicRider>;

export const OwnRider = z.object({
  rider: RiderId,
  /** The current hand; null when this rider has not been dealt this round. */
  hand: z.array(Card).nullable(),
  recycled: z.array(Card),
  /** The card locked in this round, until it is revealed. */
  locked: Card.nullable(),
  /** Tours: energy cards played this stage, set aside (what a refresh can take back). */
  setAside: z.array(Card).optional(),
});
export type OwnRider = z.infer<typeof OwnRider>;

export const GameView = z.object({
  viewer: z.union([SeatId, z.literal('spectator')]),
  stageId: z.string(),
  stageNumber: z.number().int().positive(),
  phase: Phase,
  round: z.number().int().nonnegative(),
  teams: z.array(
    z.object({
      team: TeamId,
      color: TeamColor,
      status: TeamStatus,
      tourPoints: z.number().int().nonnegative().optional(),
    }),
  ),
  riders: z.array(PublicRider),
  weather: z.array(z.object({ tile: z.number().int().nonnegative(), effect: WeatherEffect })),
  tokens: z.array(
    z.object({
      pile: z.enum(['major', 'minor']),
      kind: ClassificationKind,
      square: SquareId,
      /** Values still on the pile, top first. */
      remaining: z.array(z.number().int().positive()),
    }),
  ),
  /** Extended stages: where the refresh token lies and who took it (null while it is there). */
  refresh: z.object({ square: SquareId, holder: RiderId.nullable() }).optional(),
  /** Private part. Null for spectators. */
  own: z
    .object({
      team: TeamId,
      firstRider: RiderId.nullable(),
      riders: z.array(OwnRider),
    })
    .nullable(),
});
export type GameView = z.infer<typeof GameView>;
