/** Track and occupancy helpers. Pure functions over the compiled graph and the current state. */
import type { CompiledSquare, SquareId, TrackGraph } from '@velo/content';
import type { Position, RiderId } from '@velo/protocol';
import type { GameState, RiderState } from '../state';

export function square(track: TrackGraph, id: SquareId): CompiledSquare {
  const sq = track.squares[id];
  if (!sq) throw new Error(`Unknown square ${id}`);
  return sq;
}

/**
 * The squares a rider would enter moving `steps` forward from `from`, following the first
 * successor at each split (modules may pick branches differently). Stops at the end of the track.
 */
export function pathFrom(track: TrackGraph, from: SquareId, steps: number): SquareId[] {
  const out: SquareId[] = [];
  let cur = from;
  for (let i = 0; i < steps; i++) {
    const next = square(track, cur).next[0];
    if (next === undefined) break;
    out.push(next);
    cur = next;
  }
  return out;
}

/** Riders currently on the track (placed, not removed), keyed by square then lane. */
export type Occupancy = Map<SquareId, Map<number, RiderId>>;

export function occupancy(state: GameState, exclude?: RiderId): Occupancy {
  const occ: Occupancy = new Map();
  for (const r of Object.values(state.riders)) {
    if (!r.position || r.id === exclude || !onTrack(r)) continue;
    let lanes = occ.get(r.position.square);
    if (!lanes) occ.set(r.position.square, (lanes = new Map()));
    lanes.set(r.position.lane, r.id);
  }
  return occ;
}

/** Lane-only view of occupancy, as the hook interfaces expect. */
export function laneSets(occ: Occupancy): Map<SquareId, Set<number>> {
  const out = new Map<SquareId, Set<number>>();
  for (const [sq, lanes] of occ) out.set(sq, new Set(lanes.keys()));
  return out;
}

export function onTrack(r: RiderState): boolean {
  return r.position !== null && !(r.finished && r.tour !== null);
}

/** Lowest free lane on a square, or undefined when the square is full. */
export function freeLane(
  track: TrackGraph,
  occupied: ReadonlySet<number> | undefined,
  id: SquareId,
): number | undefined {
  const lanes = square(track, id).lanes;
  for (let lane = 0; lane < lanes; lane++) if (!occupied?.has(lane)) return lane;
  return undefined;
}

/**
 * Every path of exactly `steps` squares (or to the end of the track) from `from`, one per way
 * through the splits ahead, inner branch first.
 */
export function pathsFrom(track: TrackGraph, from: SquareId, steps: number): SquareId[][] {
  const out: SquareId[][] = [];
  const walk = (cur: SquareId, path: SquareId[]) => {
    const next = square(track, cur).next;
    if (path.length === steps || next.length === 0) return void out.push(path);
    for (const n of next) walk(n, [...path, n]);
  };
  walk(from, []);
  return out;
}

/**
 * Sort key for "further ahead in the race" (B-MOV-2, G-RND-4). On a split (roundabout) every
 * branch square counts as just ahead of the last shared square; among branch squares the one
 * nearest the tile exit is ahead, and the inner branch wins a tie.
 */
export function raceKey(track: TrackGraph, id: SquareId): [number, number, number] {
  const sq = square(track, id);
  if (sq.branch === undefined) return [sq.index, 0, 0];
  let dist = 0;
  let cur = sq;
  while (cur.branch !== undefined && cur.next[0] !== undefined) {
    dist++;
    cur = square(track, cur.next[0]);
  }
  let base = sq;
  while (base.branch !== undefined && base.prev[0] !== undefined)
    base = square(track, base.prev[0]);
  return [base.index + 0.5, -dist, sq.ref.branch ?? 0];
}

/** Has a rider on this square crossed the finish line? (Branch squares never have.) */
export const pastTheLine = (track: TrackGraph, id: SquareId) => {
  const sq = square(track, id);
  return sq.branch === undefined && sq.index >= track.finishIndex;
};

/** Front of the race first (B-MOV-2, G-RND-4), then the lower (more rightward) lane. */
export function compareFrontFirst(track: TrackGraph, a: Position, b: Position): number {
  if (a.square === b.square) return a.lane - b.lane;
  const ka = raceKey(track, a.square);
  const kb = raceKey(track, b.square);
  return kb[0] - ka[0] || kb[1] - ka[1] || ka[2] - kb[2] || a.lane - b.lane;
}

/**
 * The squares of one way through the stage, in race order: the inner branch at every split, or
 * the outer one. On tracks without splits both are the whole track.
 */
export function routeOf(track: TrackGraph, which: 'inner' | 'outer'): SquareId[] {
  const first = Object.values(track.squares).find((s) => s.prev.length === 0);
  const out: SquareId[] = [];
  let cur = first?.id;
  while (cur !== undefined) {
    out.push(cur);
    const next = square(track, cur).next;
    cur = which === 'inner' ? next[0] : next.at(-1);
  }
  return out;
}

export const hasSplits = (track: TrackGraph) =>
  Object.values(track.squares).some((s) => s.next.length > 1);

export function ridersFrontFirst(state: GameState): RiderState[] {
  return Object.values(state.riders)
    .filter((r) => onTrack(r))
    .sort((a, b) => compareFrontFirst(state.track, a.position!, b.position!));
}
