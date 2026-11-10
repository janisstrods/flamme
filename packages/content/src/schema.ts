/**
 * Content schemas: the data contracts for tiles, stages, specialists and tours.
 *
 * FROZEN at the end of M0. Only the lead changes this file; other tracks request changes.
 * Every value here is data the Content track transcribes and the engine compiles.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------

/** Where a piece of content comes from. `fixture` is test-only data, never shown in the app. */
export const ContentSource = z.enum([
  'base',
  'peloton',
  'meteo',
  'grandTour',
  'original',
  'generated',
  'custom',
  'fixture',
]);
export type ContentSource = z.infer<typeof ContentSource>;

export const Terrain = z.enum(['flat', 'ascent', 'descent', 'cobblestone', 'supply']);
export type Terrain = z.infer<typeof Terrain>;

export const RiderType = z.enum(['rouleur', 'sprinteur']);
export type RiderType = z.infer<typeof RiderType>;

/**
 * Per-square flags. Lane 0 is always the RIGHTMOST lane in the direction of travel
 * (the lane that resolves first and wins ties).
 */
export const SquareFlag = z.enum([
  'startGrid', // a square riders may be placed on before the race
  'startLine', // the first square after the start line
  'finishLine', // the first square past the finish line
  'sharpCorner', // Grand Tour: a blocked rider stopping here crashes
  'breakaway', // Peloton breakaway tile square
]);
export type SquareFlag = z.infer<typeof SquareFlag>;

export const LaneCount = z.union([z.literal(1), z.literal(2), z.literal(3)]);
export type LaneCount = z.infer<typeof LaneCount>;

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

export const SquareSpec = z.object({
  lanes: LaneCount,
  terrain: Terrain,
  flags: z.array(SquareFlag).default([]),
  /** Wide finish: seconds shown on the timing strip beside this square, if any. */
  timingSeconds: z.number().int().nonnegative().optional(),
  /** True once checked against the owner's tile photos. */
  verified: z.boolean().default(false),
});
export type SquareSpec = z.infer<typeof SquareSpec>;

/** A run of squares travelled in order. */
export const LinearSegment = z.object({
  type: z.literal('linear'),
  squares: z.array(SquareSpec).min(1),
});

/**
 * Parallel branches that rejoin at the end of the segment (roundabouts).
 * Each branch is a single-lane run; branch 0 is the inner (short) branch.
 */
export const SplitSegment = z.object({
  type: z.literal('split'),
  branches: z.array(z.object({ name: z.string(), squares: z.array(SquareSpec).min(1) })).min(2),
});

export const TileSegment = z.discriminatedUnion('type', [LinearSegment, SplitSegment]);
export type TileSegment = z.infer<typeof TileSegment>;

export const TileShape = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('straight') }),
  z.object({
    kind: z.literal('curve'),
    severity: z.enum(['gentle', 'tight']),
    direction: z.enum(['left', 'right']),
  }),
  z.object({ kind: z.literal('start') }),
  z.object({ kind: z.literal('finish') }),
  z.object({ kind: z.literal('wideFinish') }),
  /** Grand Tour hairpin; `direction` is the way the road turns. */
  z.object({ kind: z.literal('sharpCorner'), direction: z.enum(['left', 'right']) }),
  /** Grand Tour roundabout; `direction` is the way the road leaves (left-facing x/y, right-facing X/Y). */
  z.object({ kind: z.literal('roundabout'), direction: z.enum(['left', 'right']) }),
]);
export type TileShape = z.infer<typeof TileShape>;

/**
 * One side of a physical tile. Lowercase and uppercase ids of the same letter are the two sides.
 */
export const TileSide = z.object({
  id: z.string().min(1),
  /** The id of the other side of the same physical tile. */
  flipSide: z.string().min(1).optional(),
  source: ContentSource,
  shape: TileShape,
  segments: z.array(TileSegment).min(1),
  notes: z.string().optional(),
});
export type TileSide = z.infer<typeof TileSide>;

export const TileCatalog = z.object({
  version: z.number().int().positive(),
  tiles: z.array(TileSide),
});
export type TileCatalog = z.infer<typeof TileCatalog>;

// ---------------------------------------------------------------------------
// Stages
// ---------------------------------------------------------------------------

/** Addresses one square inside a stage definition, before compilation. */
export const SquareRef = z.object({
  /** Index into `StageDefinition.tiles`. */
  tile: z.number().int().nonnegative(),
  /** Index of the segment inside the tile. */
  segment: z.number().int().nonnegative().default(0),
  /** Branch index for split segments; omitted for linear segments. */
  branch: z.number().int().nonnegative().optional(),
  /** Index of the square inside the segment (or branch). */
  square: z.number().int().nonnegative(),
});
export type SquareRef = z.infer<typeof SquareRef>;

/**
 * Canonical compiled square id: `t{tile}.s{segment}.q{square}`, or `t{tile}.s{segment}.b{branch}.q{square}`
 * inside a split segment. Stable across compiles, so event logs and fixtures can name squares.
 */
export function squareIdOf(ref: {
  tile: number;
  segment?: number;
  branch?: number | undefined;
  square: number;
}): string {
  const seg = ref.segment ?? 0;
  return ref.branch === undefined
    ? `t${ref.tile}.s${seg}.q${ref.square}`
    : `t${ref.tile}.s${seg}.b${ref.branch}.q${ref.square}`;
}

export const ClassificationKind = z.enum(['sprint', 'mountain']);
export type ClassificationKind = z.infer<typeof ClassificationKind>;

export const TourStageMarkers = z.object({
  majorTokens: z.object({ at: SquareRef, kind: ClassificationKind }).optional(),
  minorTokens: z.object({ at: SquareRef, kind: ClassificationKind }).optional(),
  /** Extended stages only. */
  refreshToken: SquareRef.optional(),
});
export type TourStageMarkers = z.infer<typeof TourStageMarkers>;

export const StageType = z.enum(['normal', 'teamTimeTrial', 'individualTimeTrial', 'extended']);
export type StageType = z.infer<typeof StageType>;

export const StageDefinition = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: ContentSource,
  playerVariant: z.enum(['2-4', '5-6', 'any']),
  type: StageType.default('normal'),
  /** Ordered tile-side ids, start tile first, finish tile last. */
  tiles: z.array(z.string().min(1)).min(2),
  tour: TourStageMarkers.optional(),
  /**
   * Expected total squares along the main line across every tile (grid squares included;
   * for split segments, the shortest branch counts). A load-time transcription check.
   */
  expectedLength: z.number().int().positive().optional(),
});
export type StageDefinition = z.infer<typeof StageDefinition>;

// ---------------------------------------------------------------------------
// Compiled track (output of the stage compiler, input to the engine)
// ---------------------------------------------------------------------------

export const SquareId = z.string().min(1);
export type SquareId = z.infer<typeof SquareId>;

export const WeatherEffect = z.enum(['crosswind', 'tailwind', 'headwind', 'wet']);
export type WeatherEffect = z.infer<typeof WeatherEffect>;

export const CompiledSquare = z.object({
  id: SquareId,
  lanes: LaneCount,
  terrain: Terrain,
  flags: z.array(SquareFlag),
  /** Successor squares. Length > 1 only where the track splits. */
  next: z.array(SquareId),
  prev: z.array(SquareId),
  /**
   * Distance from the start-line square along this square's path. The start-line square is 0,
   * grid squares are negative, and the finish-line square is `TrackGraph.finishIndex`.
   * Branch squares count along their own branch.
   */
  index: z.number().int(),
  /** Where this square came from in the stage definition. */
  ref: SquareRef,
  /** Name of the branch for split segments (e.g. 'inner', 'outer'). */
  branch: z.string().optional(),
  weather: WeatherEffect.optional(),
  timingSeconds: z.number().int().nonnegative().optional(),
});
export type CompiledSquare = z.infer<typeof CompiledSquare>;

export const TrackGraph = z.object({
  stageId: z.string(),
  squares: z.record(SquareId, CompiledSquare),
  /** Grid squares, front of the grid first. */
  startGrid: z.array(SquareId),
  /** The first square past the finish line. */
  finishSquare: SquareId,
  /** `index` of the finish square. A rider with index >= finishIndex has crossed the line. */
  finishIndex: z.number().int(),
});
export type TrackGraph = z.infer<typeof TrackGraph>;

// ---------------------------------------------------------------------------
// Specialists and tours (Grand Tour)
// ---------------------------------------------------------------------------

/** Card powers from the Grand Tour specialists (rules G-SPC-3 … G-SPC-9). */
export const SpecialistPower = z.enum([
  'strongAscents6', // ascent cap 6 for this card
  'strongAscents7', // ascent cap 7 for this card
  'strongDescents', // descent minimum 7 for this card
  'recovery',
  'relentless',
  'breakaway',
  'chase',
  'nimble',
]);
export type SpecialistPower = z.infer<typeof SpecialistPower>;

/** Specialist cards are `energy` cards with `powers`. `muscle` is the Muscle team's extra card. */
export const CardKind = z.enum(['energy', 'exhaustion', 'attack', 'muscle']);
export type CardKind = z.infer<typeof CardKind>;

export const DeckEntry = z.object({
  kind: CardKind,
  value: z.number().int().nonnegative(),
  count: z.number().int().positive(),
  powers: z.array(SpecialistPower).default([]),
});
export type DeckEntry = z.infer<typeof DeckEntry>;

export const Specialist = z.object({
  id: z.string().min(1),
  /** Number 1–6 within its rider type, as in the rulebook's specialist table. */
  number: z.number().int().min(1).max(6),
  /** Display name: a generic cycling role name. */
  name: z.string().min(1),
  riderType: RiderType,
  removes: z.array(DeckEntry),
  adds: z.array(DeckEntry),
  verified: z.boolean().default(false),
});
export type Specialist = z.infer<typeof Specialist>;

export const TourDefinition = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: ContentSource,
  /** Stage ids in order. A rest day is the literal 'rest'. */
  schedule: z.array(z.string().min(1)).min(3),
  requiresPeloton: z.boolean().default(false),
});
export type TourDefinition = z.infer<typeof TourDefinition>;

/** Starting decks, keyed by rider type. */
export const StartingDecks = z.record(RiderType, z.array(DeckEntry));
export type StartingDecks = z.infer<typeof StartingDecks>;
