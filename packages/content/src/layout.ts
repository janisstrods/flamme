/**
 * Stage geometry for the renderer (plan section 5, "Compiling a stage: Geometry").
 * Walks the tiles like a turtle, chaining each tile's exit to the next tile's entry, and returns a
 * polygon, centre and lane points per square, keyed by the same ids as `compileStage`.
 *
 * Units: one square is 1 unit long; one lane is 1 unit wide. Screen coordinates (y grows down).
 * The layout resembles a physical build but does not try to match real tile dimensions.
 */
import { squareIdOf } from './schema';
import type { SquareSpec, StageDefinition, TileCatalog, TileSide } from './schema';

export type Point = readonly [number, number];

export interface SquareGeometry {
  id: string;
  /** Outline, clockwise, in screen coordinates. */
  polygon: Point[];
  center: Point;
  /** Direction of travel at the square's centre, radians (screen coordinates). */
  heading: number;
  /** Centre of each lane, lane 0 (rightmost) first. */
  lanes: Point[];
  /** The edge the rider crosses when entering the square, right end first. */
  entryEdge: [Point, Point];
}

export interface StageLayout {
  squares: Record<string, SquareGeometry>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Pairs of squares that overlap on screen (empty for a clean layout). */
  overlaps: [string, string][];
}

const LANE_WIDTH = 1;
const deg = (d: number) => (d * Math.PI) / 180;

/** Total turn of a tile in radians; positive = left (counter-clockwise on screen). */
function tileTurn(tile: TileSide): number {
  const s = tile.shape;
  switch (s.kind) {
    case 'curve':
      return (s.direction === 'left' ? 1 : -1) * deg(s.severity === 'tight' ? 90 : 45);
    case 'sharpCorner':
      return (s.direction === 'left' ? 1 : -1) * deg(180);
    case 'roundabout':
      return (s.direction === 'left' ? 1 : -1) * deg(90);
    default:
      return 0;
  }
}

interface Turtle {
  x: number;
  y: number;
  /** Heading in maths coordinates (y up); converted at output. */
  h: number;
}

/** Advance one square of length 1 turning by `turn` radians; returns sampled centreline points. */
function advance(t: Turtle, turn: number, samples = 6): { pts: Turtle[]; end: Turtle } {
  const pts: Turtle[] = [];
  for (let i = 0; i <= samples; i++) {
    const f = i / samples;
    if (Math.abs(turn) < 1e-9) {
      pts.push({ x: t.x + Math.cos(t.h) * f, y: t.y + Math.sin(t.h) * f, h: t.h });
    } else {
      const r = 1 / turn; // signed radius: positive turns left
      const cx = t.x - Math.sin(t.h) * r;
      const cy = t.y + Math.cos(t.h) * r;
      const h = t.h + turn * f;
      pts.push({ x: cx + Math.sin(h) * r, y: cy - Math.cos(h) * r, h });
    }
  }
  return { pts, end: pts[pts.length - 1]! };
}

const toScreen = (x: number, y: number): Point => [x, -y];

function squareGeometry(id: string, spec: SquareSpec, pts: Turtle[]): SquareGeometry {
  const half = (spec.lanes * LANE_WIDTH) / 2;
  const right = (p: Turtle, d: number): Point =>
    toScreen(p.x + Math.sin(p.h) * d, p.y - Math.cos(p.h) * d);
  const leftEdge = pts.map((p) => right(p, -half));
  const rightEdge = pts.map((p) => right(p, half));
  const mid = pts[Math.floor(pts.length / 2)]!;
  const lanes: Point[] = [];
  for (let k = 0; k < spec.lanes; k++) lanes.push(right(mid, half - LANE_WIDTH * (k + 0.5)));
  return {
    id,
    polygon: [...leftEdge, ...rightEdge.reverse()],
    center: toScreen(mid.x, mid.y),
    heading: -mid.h,
    lanes,
    entryEdge: [right(pts[0]!, half), right(pts[0]!, -half)],
  };
}

/** Squares closer than this along the road are neighbours (a bend's own inside), never an overlap. */
const MIN_APART = 5;
/** Grass that must show between two stretches of road, in lane widths. */
const MIN_GAP = 0.45;

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function pointToSegment(p: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
}

const cross = (o: Point, a: Point, b: Point) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Smallest distance between two outlines; 0 when their edges cross. */
function polygonGap(a: Point[], b: Point[]): number {
  let best = Infinity;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i]!;
    const a2 = a[(i + 1) % a.length]!;
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j]!;
      const b2 = b[(j + 1) % b.length]!;
      if (cross(a1, a2, b1) * cross(a1, a2, b2) < 0 && cross(b1, b2, a1) * cross(b1, b2, a2) < 0)
        return 0;
      best = Math.min(
        best,
        pointToSegment(a1, b1, b2),
        pointToSegment(a2, b1, b2),
        pointToSegment(b1, a1, a2),
        pointToSegment(b2, a1, a2),
      );
    }
  }
  return best;
}

/** Lay out a stage. Unknown tiles throw; use `validateStage` first for friendly errors. */
export function layoutStage(stage: StageDefinition, catalog: TileCatalog): StageLayout {
  const byId = new Map(catalog.tiles.map((t) => [t.id, t]));
  const squares: Record<string, SquareGeometry> = {};
  /** Distance of each square from the start, in squares along the inner line. */
  const along: Record<string, number> = {};
  let travelled = 0;
  let turtle: Turtle = { x: 0, y: 0, h: 0 };

  stage.tiles.forEach((tileId, tile) => {
    const t = byId.get(tileId);
    if (!t) throw new Error(`layoutStage: unknown tile ${tileId}`);
    const total = t.segments.reduce(
      (n, s) =>
        n +
        (s.type === 'linear'
          ? s.squares.length
          : Math.min(...s.branches.map((b) => b.squares.length))),
      0,
    );
    const turnPerSquare = tileTurn(t) / Math.max(total, 1);
    t.segments.forEach((seg, segment) => {
      if (seg.type === 'linear') {
        seg.squares.forEach((spec, square) => {
          const id = squareIdOf({ tile, segment, square });
          const { pts, end } = advance(turtle, turnPerSquare);
          squares[id] = squareGeometry(id, spec, pts);
          along[id] = travelled++;
          turtle = end;
        });
        return;
      }
      // Split segment: branches share the entry pose and run as concentric arcs side by side
      // (inner branch on the turning side), so both start and end on the same line across the road
      // and join the squares before and after. The inner arc is tighter and shorter, the outer
      // wider and longer; each branch's squares divide its own arc evenly.
      const shortest = Math.min(...seg.branches.map((b) => b.squares.length));
      const segTurn = turnPerSquare * shortest;
      const start = turtle;
      let exit = turtle;
      seg.branches.forEach((b, branch) => {
        const side = (branch === 0 ? 1 : -1) * Math.sign(segTurn || 1) * 0.5;
        let bt: Turtle = {
          x: start.x - Math.sin(start.h) * side,
          y: start.y + Math.cos(start.h) * side,
          h: start.h,
        };
        // `side` is the offset to the left of the centreline, whose radius is shortest / segTurn.
        const arc = shortest - side * segTurn;
        b.squares.forEach((spec, square) => {
          const id = squareIdOf({ tile, segment, branch, square });
          const len = arc / b.squares.length;
          const { pts } = advance(bt, segTurn / b.squares.length, 6);
          const scaled = pts.map((p) => ({
            ...p,
            x: bt.x + (p.x - bt.x) * len,
            y: bt.y + (p.y - bt.y) * len,
          }));
          squares[id] = squareGeometry(id, spec, scaled);
          along[id] = travelled + (square * shortest) / b.squares.length;
          bt = scaled[scaled.length - 1]!;
        });
        if (branch === 0)
          exit = { x: bt.x + Math.sin(bt.h) * side, y: bt.y - Math.cos(bt.h) * side, h: bt.h };
      });
      turtle = exit;
      travelled += shortest;
    });
  });

  const all = Object.values(squares).flatMap((s) => s.polygon);
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const bounds = {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };

  // Overlap check: squares far apart in the race whose outlines touch or come closer than a thin
  // strip of verge. Outlines rather than centres, so wide roads (three lanes, the wide finish) are
  // measured by their real edges.
  const overlaps: [string, string][] = [];
  const list = Object.values(squares);
  const reach = list.map((s) => Math.max(...s.polygon.map((p) => dist(p, s.center))));
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      if (Math.abs(along[a.id]! - along[b.id]!) < MIN_APART) continue;
      if (dist(a.center, b.center) > reach[i]! + reach[j]! + MIN_GAP) continue;
      if (polygonGap(a.polygon, b.polygon) < MIN_GAP) overlaps.push([a.id, b.id]);
    }
  }
  return { squares, bounds, overlaps };
}
