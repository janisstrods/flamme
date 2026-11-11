/**
 * Seeded stage generator (plan section 5). Follows the rulebooks' stage-design advice:
 *  - base: the start, every turn and the straights, the finish; 2–3 climbs;
 *  - Peloton (P-DES-1): each Peloton straight replaces a base straight; 2–3 climb or cobblestone
 *    sections in all; no supply zone next to the finish; for five or six teams add the bonus tile
 *    (#9) and both supply zones, and use the wide start (#1);
 *  - the breakaway variant puts the breakaway tile (#2) right after the start (P-BRK-1), white side
 *    for five or six teams, black side otherwise, including one-rider-each fields (D-012).
 * Layouts that cross themselves are rejected. Pure: the same seed gives the same stage.
 */
import { compileStage, validateStage } from './compile';
import { layoutStage } from './layout';
import type { StageDefinition, TileCatalog } from './schema';

export interface GenerateOptions {
  /** Teams that will race: five or more needs the Peloton tiles and the wide start. */
  teams?: number;
  /** Use the Peloton tiles (cobblestones, supply zones). */
  peloton?: boolean;
  /** Put the breakaway tile after the start. */
  breakaway?: boolean;
  /** Grand Tour new tiles: a sharp corner and a roundabout, each replacing a base straight. */
  newTiles?: boolean;
  /** Extended stage (G-EXT-1): four more six-square straights, 24 squares longer. */
  extended?: boolean;
  /** A time trial (no breakaway or bonus tile, G16). */
  timeTrial?: 'team' | 'individual';
  /** Use the wide finish (tours). */
  wideFinish?: boolean;
  /** Attempts before giving up (each is a full layout check). */
  attempts?: number;
}

/** A small seeded PRNG (mulberry32 over a string hash). */
function rngFor(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_STRAIGHTS = ['b', 'c', 'd', 'f', 'l', 'm', 'n'];
const BASE_TURNS = ['e', 'g', 'h', 'i', 'j', 'k', 'o', 'p', 'q', 'r', 's', 't'];
/** Peloton straights other than the breakaway (2) and bonus (9) tiles. */
const PELOTON_STRAIGHTS = ['3', '4', '5', '6', '7', '8'];
/** Sides that are supply zones (their other sides are cobblestones). */
const SUPPLY = ['3_w', '4_w'];

/** Count climb and cobblestone sections along the main line. */
function sections(stage: StageDefinition, catalog: TileCatalog): number {
  const track = compileStage(stage, catalog);
  const sq = Object.values(track.squares)
    .filter((q) => !q.branch)
    .sort((a, b) => a.index - b.index);
  let n = 0;
  sq.forEach((q, i) => {
    const hard = q.terrain === 'ascent' || q.terrain === 'cobblestone';
    const prev = sq[i - 1];
    if (hard && !(prev && (prev.terrain === 'ascent' || prev.terrain === 'cobblestone'))) n++;
  });
  return n;
}

export function generateStage(
  seed: string,
  catalog: TileCatalog,
  opts: GenerateOptions = {},
): StageDefinition {
  const rand = rngFor(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const shuffle = <T>(xs: readonly T[]) => {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
  };
  const big = (opts.teams ?? 4) >= 5;
  const peloton = opts.peloton || big || opts.breakaway;
  const known = new Set(catalog.tiles.map((t) => t.id));
  const attempts = opts.attempts ?? 4000;
  /** The sides of a tile with no climb or cobbles (both sides if neither is plain). */
  const plainSides = (tile: string): string[] =>
    ['w', 's'].filter((sd) => {
      const t = catalog.tiles.find((x) => x.id === `${tile}_${sd}`);
      return (
        t !== undefined &&
        t.segments.every(
          (seg) =>
            seg.type === 'linear' &&
            seg.squares.every((q) => q.terrain !== 'ascent' && q.terrain !== 'cobblestone'),
        )
      );
    });
  const hasPlainSide = (tile: string) => plainSides(tile).length > 0;
  const easySides = (tile: string) => (hasPlainSide(tile) ? plainSides(tile) : ['w', 's']);

  for (let attempt = 0; attempt < attempts; attempt++) {
    const side = () => pick(['w', 's']);
    const middle: string[] = [];
    let straights = shuffle(BASE_STRAIGHTS);
    /** Base straights that made way for other tiles: free again for an extended stage. */
    const spare: string[] = [];
    if (peloton) {
      // Big fields use both supply zones; otherwise 1–3 Peloton straights on random sides.
      const extra = big ? shuffle(PELOTON_STRAIGHTS).slice(0, 2 + Math.floor(rand() * 2)) : [];
      const chosen = big
        ? [
            '3_w',
            '4_w',
            ...extra.filter((t) => t !== '3' && t !== '4').map((t) => `${t}_${side()}`),
          ]
        : shuffle(PELOTON_STRAIGHTS)
            .slice(0, 1 + Math.floor(rand() * 3))
            .map((t) => `${t}_${side()}`);
      spare.push(...straights.slice(0, chosen.length));
      straights = straights.slice(chosen.length);
      middle.push(...chosen);
      if (big) middle.push(`9_${side()}`);
    }
    if (opts.newTiles) {
      // One sharp corner and one roundabout, each in place of a base straight.
      spare.push(...straights.slice(0, 2));
      straights = straights.slice(2);
      middle.push(`z_${side()}`, `${pick(['x', 'y'])}_${side()}`);
    }
    if (opts.extended) {
      // Four more six-square straights: Peloton straights not used yet, then the base straights
      // that were swapped out above. Always four, so the stage is always 24 squares longer.
      // Tiles with a plain side first, each on its easier side, so the extra road adds length
      // rather than more climbs and cobbles than the 2–3 sections a stage should have.
      const used = new Set(middle.map((t) => t.split('_')[0]));
      const pool = shuffle([...PELOTON_STRAIGHTS.filter((t) => !used.has(t)), ...spare]);
      const more = [...pool.filter(hasPlainSide), ...pool.filter((t) => !hasPlainSide(t))].slice(
        0,
        4,
      );
      if (more.length < 4) continue;
      middle.push(...more.map((t) => `${t}_${pick(easySides(t))}`));
    }
    middle.push(...straights.map((t) => `${t}_${side()}`));
    middle.push(...BASE_TURNS.map((t) => `${t}_${side()}`));
    const ordered = shuffle(middle);
    const tiles = [
      big ? `1_${side()}` : `a_${side()}`,
      ...(opts.breakaway && !opts.timeTrial ? [(opts.teams ?? 4) <= 6 && big ? '2_w' : '2_s'] : []),
      ...ordered.filter((t) => !(opts.timeTrial && t.startsWith('9_'))),
      `${opts.wideFinish ? 'v' : 'u'}_${side()}`,
    ];
    if (SUPPLY.includes(tiles.at(-2)!)) continue;
    if (tiles.some((t) => !known.has(t))) continue;
    const stage: StageDefinition = {
      id: `gen-${seed}`,
      name: `Random stage ${seed}`,
      source: 'generated',
      playerVariant: big ? '5-6' : '2-4',
      type: opts.timeTrial
        ? opts.timeTrial === 'team'
          ? 'teamTimeTrial'
          : 'individualTimeTrial'
        : opts.extended
          ? 'extended'
          : 'normal',
      tiles,
    };
    if (validateStage(stage, catalog).length) continue;
    const n = sections(stage, catalog);
    if (n < 2 || n > 3) continue;
    const layout = layoutStage(stage, catalog);
    if (layout.overlaps.length) continue;
    const w = layout.bounds.maxX - layout.bounds.minX;
    const h = layout.bounds.maxY - layout.bounds.minY;
    if (w / h < 1 || w / h > (opts.extended ? 3 : 2.6)) continue;
    return stage;
  }
  throw new Error(`generateStage: no layout found for seed ${seed}`);
}

export interface GenerateTourOptions {
  /** Racing stages in the tour (rest days come on top). */
  stages: number;
  /** Teams that will race: five or more gives every stage the wide start. */
  teams?: number;
  /** Put the breakaway tile after the start of every stage that is not a time trial. */
  breakaway?: boolean;
  /**
   * Grand Tour variety: a team time trial to open (five stages or more), individual time trials
   * (seven or more), long stages, and hairpins and roundabouts on some of the others.
   */
  special?: boolean;
}

export interface GeneratedTour {
  /** The racing stages in order, each with the wide finish (G-TOU-4). */
  stages: StageDefinition[];
  /** Suggested rest days: after these stage numbers (1-based). */
  restAfter: number[];
}

/** Our own invented place words for generated stage names. */
const STAGE_PLACES = [
  'Alder',
  'Birchwater',
  'Bracken',
  'Cinder',
  'Clover',
  'Dunmore',
  'Elmfield',
  'Falcon',
  'Fennel',
  'Gorse',
  'Hazel',
  'Heron',
  'Ivy',
  'Kelp',
  'Lichen',
  'Linden',
  'Marram',
  'Nettle',
  'Otter',
  'Pebble',
  'Quill',
  'Rowan',
  'Sorrel',
  'Tansy',
  'Umber',
  'Vetch',
  'Willow',
  'Yarrow',
  'Zephyr',
];
const STAGE_WORDS: Record<NonNullable<StageDefinition['type']>, readonly string[]> = {
  normal: ['Loop', 'Circuit', 'Ring', 'Run', 'Classic', 'Rally', 'Dash', 'Crossing', 'Round'],
  extended: ['Marathon', 'Long Haul', 'Traverse', 'Odyssey'],
  teamTimeTrial: ['Prologue'],
  individualTimeTrial: ['Time Trial', 'Chrono'],
};

/** Rest days for a tour of `n` stages: none under five, one halfway, two from fourteen up. */
export function suggestedRestDays(n: number): number[] {
  if (n < 5) return [];
  if (n < 14) return [Math.ceil(n / 2)];
  return [Math.round((n * 3) / 7), Math.round((n * 5) / 7)];
}

/**
 * A whole tour from one seed: stage `n` is always `gen-{seed}-{n}`, and the same seed and options
 * give the same tour. The last stage is always a normal one. With `special`, stage 2 always has
 * the new tiles, so such a tour can be told from a plain one by its stages.
 */
export function generateTour(
  seed: string,
  catalog: TileCatalog,
  opts: GenerateTourOptions,
): GeneratedTour {
  const n = Math.max(1, Math.floor(opts.stages));
  const rand = rngFor(`tour-${seed}`);
  const types: NonNullable<StageDefinition['type']>[] = Array.from({ length: n }, () => 'normal');
  /** Put a special stage on stage `at` (1-based), or the nearest free stage before the last. */
  const place = (at: number, type: (typeof types)[number]) => {
    for (let d = 0; d < n; d++)
      for (const i of [at - 1 + d, at - 1 - d])
        if (i >= 0 && i < n - 1 && types[i] === 'normal') {
          types[i] = type;
          return;
        }
  };
  if (opts.special) {
    if (n >= 5) types[0] = 'teamTimeTrial';
    if (n >= 7) place(n - 1, 'individualTimeTrial');
    if (n >= 14) place(Math.floor(n / 2), 'individualTimeTrial');
    const long = n >= 5 ? Math.max(1, Math.floor(n / 7)) : 0;
    for (let k = 0; k < long; k++) place(Math.round(((k + 0.5) * n) / long), 'extended');
  }
  const places = [...STAGE_PLACES];
  for (let i = places.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [places[i], places[j]] = [places[j]!, places[i]!];
  }
  const stages = types.map((type, i) => {
    const words = STAGE_WORDS[type];
    const name = `${places[i % places.length]} ${words[Math.floor(rand() * words.length)]}`;
    const trial = type === 'teamTimeTrial' || type === 'individualTimeTrial';
    const newTiles = !!opts.special && !trial && (i === 1 || rand() < 0.5);
    const stageOpts: GenerateOptions = {
      wideFinish: true,
      ...(opts.teams !== undefined ? { teams: opts.teams } : {}),
      ...(opts.breakaway ? { breakaway: true } : {}),
      ...(newTiles ? { newTiles: true } : {}),
      ...(type === 'extended' ? { extended: true } : {}),
      ...(trial ? { timeTrial: type === 'teamTimeTrial' ? 'team' : 'individual' } : {}),
    };
    // A seed with no layout is rare; the next one in line keeps the tour reproducible.
    for (let retry = 0; ; retry++) {
      try {
        const made = generateStage(
          `${seed}-${i + 1}${retry ? `~${retry}` : ''}`,
          catalog,
          stageOpts,
        );
        return { ...made, id: `gen-${seed}-${i + 1}`, name };
      } catch (e) {
        if (retry >= 5) throw e;
      }
    }
  });
  return { stages, restAfter: suggestedRestDays(n) };
}
