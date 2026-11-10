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

  for (let attempt = 0; attempt < attempts; attempt++) {
    const side = () => pick(['w', 's']);
    const middle: string[] = [];
    let straights = shuffle(BASE_STRAIGHTS);
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
      straights = straights.slice(chosen.length);
      middle.push(...chosen);
      if (big) middle.push(`9_${side()}`);
    }
    if (opts.newTiles) {
      // One sharp corner and one roundabout, each in place of a base straight.
      straights = straights.slice(2);
      middle.push(`z_${side()}`, `${pick(['x', 'y'])}_${side()}`);
    }
    if (opts.extended) {
      // Four more six-square straights (Peloton straights not used yet), all flat-ish sides.
      const used = new Set(middle.map((t) => t.split('_')[0]));
      const more = shuffle(PELOTON_STRAIGHTS.filter((t) => !used.has(t))).slice(0, 4);
      middle.push(...more.map((t) => `${t}_${side()}`));
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
