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

/** Front of the race first: higher index first, then lower lane (B-MOV-2). */
export function compareFrontFirst(track: TrackGraph, a: Position, b: Position): number {
  const ia = square(track, a.square).index;
  const ib = square(track, b.square).index;
  return ib - ia || a.lane - b.lane;
}

export function ridersFrontFirst(state: GameState): RiderState[] {
  return Object.values(state.riders)
    .filter((r) => onTrack(r))
    .sort((a, b) => compareFrontFirst(state.track, a.position!, b.position!));
}
