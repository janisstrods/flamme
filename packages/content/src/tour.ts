/**
 * Tour helpers (Grand Tour campaign): the wide finish, where the sprint and mountain token piles go,
 * and our tour presets (C-002: original stages instead of the published stage cards).
 */
import { compileStage } from './compile';
import { ORIGINAL_STAGES } from './data/stages';
import { squareIdOf } from './schema';
import type {
  ClassificationKind,
  SquareId,
  StageDefinition,
  TileCatalog,
  TrackGraph,
} from './schema';

/** G-TOU-4: tours always use the wide finish (flat u → v, climbing U → V; same shape and length). */
export function withWideFinish(stage: StageDefinition): StageDefinition {
  const last = stage.tiles.at(-1)!;
  const wide = last === 'u_w' ? 'v_w' : last === 'u_s' ? 'v_s' : last;
  return wide === last ? stage : { ...stage, tiles: [...stage.tiles.slice(0, -1), wide] };
}

export interface TokenPile {
  square: SquareId;
  kind: ClassificationKind;
}

/** Main-line squares (the inner branch stands in for splits), in race order. */
function mainLine(track: TrackGraph) {
  return Object.values(track.squares)
    .filter((s) => s.ref.branch === undefined || s.ref.branch === 0)
    .sort((a, b) => a.index - b.index);
}

/**
 * Where the major (5/3/1) and minor (2/1) token piles go (G-TOK-2), unless the stage marks them.
 * Major: mountain side on the first square after the longest climb of at least 5 squares (ties:
 * nearest the finish; a climb over the line puts it on the first square past the line), else
 * sprint side past the line. Minor: sprint side past the line when the majors are elsewhere; else
 * mountain side after the longest remaining climb; else sprint side at the start of a 6-square
 * tile about halfway.
 */
export function tokenPiles(
  stage: StageDefinition,
  track: TrackGraph,
): { major: TokenPile; minor: TokenPile } {
  const line = mainLine(track);
  const finish = line.find((s) => s.index === track.finishIndex) ?? line.at(-1)!;
  const marker = (m: NonNullable<StageDefinition['tour']>['majorTokens']) =>
    m && { square: squareIdOf(m.at), kind: m.kind };
  const majorMark = marker(stage.tour?.majorTokens);
  const minorMark = marker(stage.tour?.minorTokens);

  // Climbs: runs of ascent squares, as [first index, last index] into `line`.
  const climbs: [number, number][] = [];
  line.forEach((s, i) => {
    if (s.terrain !== 'ascent') return;
    const last = climbs.at(-1);
    if (last && last[1] === i - 1) last[1] = i;
    else climbs.push([i, i]);
  });
  const length = (c: [number, number]) => c[1] - c[0] + 1;
  const after = (c: [number, number]) =>
    line[c[1]]!.index >= finish.index ? finish.id : (line[c[1] + 1]?.id ?? finish.id);
  // Longest first; ties to the one nearest the finish.
  const byLength = [...climbs].sort((a, b) => length(b) - length(a) || b[0] - a[0]);

  const bigClimb = byLength.find((c) => length(c) >= 5);
  const major: TokenPile =
    majorMark ??
    (bigClimb
      ? { square: after(bigClimb), kind: 'mountain' }
      : { square: finish.id, kind: 'sprint' });

  let minor: TokenPile;
  if (minorMark) minor = minorMark;
  else if (major.square !== finish.id) minor = { square: finish.id, kind: 'sprint' };
  else {
    const rest = byLength.filter((c) => c !== bigClimb && after(c) !== finish.id);
    if (rest.length > 0) minor = { square: after(rest[0]!), kind: 'mountain' };
    else {
      // The first square of a six-square tile nearest the middle of the stage.
      const tiles = new Map<number, SquareId[]>();
      for (const s of line) tiles.set(s.ref.tile, [...(tiles.get(s.ref.tile) ?? []), s.id]);
      const mid = stage.tiles.length / 2;
      const six = [...tiles.entries()]
        .filter(([t, ids]) => ids.length === 6 && t > 0 && t < stage.tiles.length - 1)
        .sort((a, b) => Math.abs(a[0] - mid) - Math.abs(b[0] - mid));
      minor = { square: six[0]?.[1][0] ?? line[Math.floor(line.length / 2)]!.id, kind: 'sprint' };
    }
  }
  return { major, minor };
}

/**
 * Where the refresh token goes on an extended stage (G-EXT-1, design advice): the stage's marker,
 * else the first square of a six-square tile close to or just after halfway, a supply zone if one
 * is there.
 */
export function refreshSquare(stage: StageDefinition, track: TrackGraph): SquareId {
  if (stage.tour?.refreshToken) return squareIdOf(stage.tour.refreshToken);
  const line = mainLine(track);
  const tiles = new Map<number, (typeof line)[number][]>();
  for (const sq of line) tiles.set(sq.ref.tile, [...(tiles.get(sq.ref.tile) ?? []), sq]);
  const half = stage.tiles.length / 2;
  const candidates = [...tiles.entries()]
    .filter(
      ([t, sqs]) => sqs.length === 6 && t >= Math.floor(half) - 1 && t < stage.tiles.length - 1,
    )
    .sort(
      (a, b) =>
        Number(b[1][0]!.terrain === 'supply') - Number(a[1][0]!.terrain === 'supply') ||
        Math.abs(a[0] - half) - Math.abs(b[0] - half),
    );
  return (candidates[0]?.[1][0] ?? line[Math.floor(line.length / 2)]!).id;
}

export interface TourPreset {
  id: string;
  name: string;
  description: string;
  /** Stage ids from ORIGINAL_STAGES, in order. */
  stages: string[];
  /** Suggested rest days: after these stage numbers (1-based). */
  restAfter?: number | number[];
  /** Needs the Grand Tour new tiles / special stages. */
  needs?: ('newTiles' | 'specialStages')[];
  /** Start with the specialist draft switched on (players can still switch it off). */
  specialists?: boolean;
}

export const TOUR_PRESETS: readonly TourPreset[] = [
  {
    id: 'tour-de-jour',
    name: 'Tour de Jour',
    description: 'The basic seven-stage tour: flat starts, cobbles, feed zones and three climbs.',
    stages: [
      'harbour-loop',
      'orchard-ring',
      'cobble-coast',
      'three-hills',
      'feed-station',
      'paving-stones',
      'grand-peloton',
    ],
    restAfter: 4,
  },
  {
    id: 'grand-tour-week',
    name: 'Grand Tour Week',
    description:
      'Seven stages with everything: a team time trial, hairpins and roundabouts, a long stage with a refresh, and an individual time trial.',
    stages: [
      'prologue',
      'hairpin-hollow',
      'roundabout-run',
      'long-road',
      'granite-gate',
      'clockwork',
      'mountain-marathon',
    ],
    restAfter: 4,
    needs: ['newTiles', 'specialStages'],
    specialists: true,
  },
  {
    id: 'grand-tour',
    name: 'The Grand Tour',
    description:
      'Twenty-one stages and two rest days: prologue, flat days, cobbles, hairpins, three long stages and two time trials.',
    stages: [
      'prologue',
      'harbour-loop',
      'hairpin-hollow',
      'orchard-ring',
      'granite-gate',
      'long-road',
      'cobble-coast',
      'roundabout-run',
      'three-hills',
      'bridge-of-wheels',
      'clockwork',
      'endless-orchard',
      'coastline-circuit',
      'feed-station',
      'ringroad-rally',
      'paving-stones',
      'mountain-marathon',
      'copperleaf-classic',
      'switchback',
      'final-clock',
      'grand-peloton',
    ],
    restAfter: [9, 15],
    needs: ['newTiles', 'specialStages'],
    specialists: true,
  },
  {
    id: 'weekend',
    name: 'Weekend Tour',
    description: 'Three stages for an evening.',
    stages: ['harbour-loop', 'three-hills', 'cobble-coast'],
  },
];

/** A tour schedule from stage ids: wide finishes, and 'rest' after `restAfter` if given. */
export function tourSchedule(
  stageIds: readonly string[],
  restAfter?: number | readonly number[],
): (StageDefinition | 'rest')[] {
  const rests =
    restAfter === undefined ? [] : typeof restAfter === 'number' ? [restAfter] : restAfter;
  const out: (StageDefinition | 'rest')[] = [];
  stageIds.forEach((id, i) => {
    const stage = ORIGINAL_STAGES.find((s) => s.id === id);
    if (!stage) throw new Error(`tourSchedule: unknown stage ${id}`);
    out.push(withWideFinish(stage));
    if (rests.includes(i + 1) && i < stageIds.length - 1) out.push('rest');
  });
  return out;
}

/** The racing stages of a schedule, in order (rest days left out). */
export const tourStages = (schedule: readonly (StageDefinition | 'rest')[]) =>
  schedule.filter((s): s is StageDefinition => s !== 'rest');

/** Compile stage `n` (1-based) of a schedule. */
export const compileTourStage = (
  schedule: readonly (StageDefinition | 'rest')[],
  n: number,
  catalog: TileCatalog,
) => compileStage(tourStages(schedule)[n - 1]!, catalog);
