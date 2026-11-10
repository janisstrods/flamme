/**
 * Room and game configuration. FROZEN at the end of M0 (lead-owned).
 */
import { z } from 'zod';
import { StageDefinition, WeatherEffect } from '@velo/content';

export const SeatId = z.string().regex(/^seat-(\d|1[01])$/, 'seat-0 … seat-11');
export type SeatId = z.infer<typeof SeatId>;

/** A team is identified by the seat that controls it. */
export const TeamId = SeatId;
export type TeamId = SeatId;

/** `${teamId}:R` (rouleur) or `${teamId}:S` (sprinteur). */
export const RiderId = z.string().regex(/^seat-(\d|1[01]):[RS]$/);
export type RiderId = z.infer<typeof RiderId>;

export const TeamColor = z.enum(['red', 'blue', 'green', 'black', 'pink', 'white']);
export type TeamColor = z.infer<typeof TeamColor>;

export const AiLevel = z.enum(['easy', 'medium', 'hard']);
export type AiLevel = z.infer<typeof AiLevel>;

export const AiPersonality = z.enum(['balanced', 'attacker', 'wheelSucker', 'climber']);
export type AiPersonality = z.infer<typeof AiPersonality>;

export const SeatController = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('open') }),
  z.object({ kind: z.literal('human'), playerId: z.string().min(1) }),
  z.object({ kind: z.literal('ai'), level: AiLevel, personality: AiPersonality.optional() }),
  z.object({ kind: z.literal('dummy'), team: z.enum(['peloton', 'muscle']) }),
]);
export type SeatController = z.infer<typeof SeatController>;

/** Names shown for a team and its two riders (cosmetic; players pick their own, bots get some). */
export const TeamNames = z.object({
  team: z.string().trim().min(1).max(32),
  rouleur: z.string().trim().min(1).max(32),
  sprinteur: z.string().trim().min(1).max(32),
});
export type TeamNames = z.infer<typeof TeamNames>;

export const SeatConfig = z.object({
  seat: SeatId,
  controller: SeatController,
  names: TeamNames.optional(),
  color: TeamColor.optional(),
  /** Exhaustion cards added to each of this team's decks at setup (base handicap, B-SET-6). */
  handicap: z.number().int().min(0).max(6).optional(),
  /** Peloton one-rider-each variant: which single rider this seat controls. */
  singleRider: z.enum(['rouleur', 'sprinteur']).optional(),
});
export type SeatConfig = z.infer<typeof SeatConfig>;

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------

export const ModulesConfig = z.object({
  peloton: z
    .object({
      breakaway: z.boolean().default(false),
      /** 7–12 players, one rider per seat. */
      oneRiderEach: z.boolean().default(false),
    })
    .optional(),
  meteo: z
    .object({
      /** Explicit placements, or omitted to draw them from the seeded RNG at setup. */
      placements: z
        .array(z.object({ tile: z.number().int().nonnegative(), effect: WeatherEffect }))
        .optional(),
    })
    .optional(),
  grandTour: z
    .object({
      newTiles: z.boolean().default(false),
      specialists: z.boolean().default(false),
      specialStages: z.boolean().default(false),
    })
    .optional(),
  champion: z
    .object({
      handicaps: z.boolean().default(false),
    })
    .optional(),
});
export type ModulesConfig = z.infer<typeof ModulesConfig>;

export const TurnTimer = z.union([z.literal('off'), z.literal(60), z.literal(120)]);
export type TurnTimer = z.infer<typeof TurnTimer>;

export const GameMode = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('single'), stage: StageDefinition }),
  z.object({
    kind: z.literal('tour'),
    /** Stage definitions in order; 'rest' marks a rest day. */
    schedule: z.array(z.union([StageDefinition, z.literal('rest')])).min(3),
  }),
  z.object({
    kind: z.literal('timeTrial'),
    stage: StageDefinition,
    style: z.enum(['team', 'individual']),
  }),
]);
export type GameMode = z.infer<typeof GameMode>;

export const RoomOptions = z.object({
  showRemainingValues: z.boolean().default(true),
  allowSpectators: z.boolean().default(true),
  turnTimer: TurnTimer.default('off'),
});
export type RoomOptions = z.infer<typeof RoomOptions>;

/** Everything the engine needs to create a game, apart from the seed. */
export const GameConfig = z.object({
  modules: ModulesConfig,
  mode: GameMode,
  seats: z.array(SeatConfig).min(1).max(12),
  options: RoomOptions,
});
export type GameConfig = z.infer<typeof GameConfig>;

// ---------------------------------------------------------------------------
// Dependency checks for the lobby
// ---------------------------------------------------------------------------

export interface ConfigIssue {
  path: string;
  /** One line, our own words, shown next to the disabled option. */
  message: string;
}

const isPlaying = (s: SeatConfig) => s.controller.kind !== 'open';

/** Lobby-level dependency rules from plan section 2. Returns an empty list when the config is valid. */
export function checkModuleDependencies(config: GameConfig): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const { modules, mode } = config;
  const playing = config.seats.filter(isPlaying);
  const teams = playing.length;
  const peloton = modules.peloton !== undefined;

  if (modules.peloton?.oneRiderEach) {
    if (teams < 7)
      issues.push({
        path: 'modules.peloton.oneRiderEach',
        message: 'One rider each is for 7 to 12 players.',
      });
    if (playing.some((s) => s.singleRider === undefined))
      issues.push({
        path: 'seats',
        message: 'In one-rider-each, every seat must pick a rouleur or a sprinteur.',
      });
    if (playing.some((s) => s.controller.kind === 'dummy'))
      issues.push({ path: 'seats', message: 'Dummy teams do not ride in one-rider-each.' });
  } else if (teams > 6) {
    issues.push({
      path: 'seats',
      message: 'More than six teams needs the Peloton one-rider-each variant.',
    });
  }
  if (!peloton && teams > 4)
    issues.push({ path: 'seats', message: 'Five or six teams needs the Peloton module.' });
  // Dummy teams come in the Peloton box but need none of its tiles, so base races may use them (D-024).

  const dummies = playing.filter(
    (s) => s.controller.kind === 'dummy' && s.controller.team === 'peloton',
  );
  if (dummies.length > 1)
    issues.push({ path: 'seats', message: 'Only one Peloton dummy team per race.' });

  const gt = modules.grandTour;
  if (mode.kind === 'tour' && gt === undefined)
    issues.push({ path: 'mode', message: 'Tours need the Grand Tour module.' });
  if (mode.kind === 'timeTrial' && !gt?.specialStages)
    issues.push({ path: 'mode', message: 'Time trials need Grand Tour special stages.' });
  if (mode.kind === 'tour') {
    const stages = mode.schedule.filter((s) => s !== 'rest');
    if (stages.length < 3)
      issues.push({ path: 'mode.schedule', message: 'A tour needs at least three stages.' });
    if (stages.length >= 21 && !peloton)
      issues.push({
        path: 'mode.schedule',
        message: 'The full 21-stage tour needs the Peloton module.',
      });
    if (!gt?.specialStages && stages.some((s) => s.type !== 'normal'))
      issues.push({
        path: 'mode.schedule',
        message: 'This tour has special stages; switch on Grand Tour special stages.',
      });
  }

  const seen = new Set<string>();
  for (const s of config.seats) {
    if (seen.has(s.seat)) issues.push({ path: 'seats', message: `${s.seat} appears twice.` });
    seen.add(s.seat);
  }
  return issues;
}
