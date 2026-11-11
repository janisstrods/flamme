/**
 * Time trials (G-TTT-1, G-ITT-1): teams share squares and lanes, so the board spreads them along
 * the road. The spread follows the square's own outline (so it bends with a curve) and always
 * fits inside the square, however many teams ride: a rider is never drawn on a neighbouring
 * square or off its lane.
 */
import type { SquareGeometry } from '@velo/content';

/** Share of the square's length the whole field may take up. */
const MAX_SPREAD = 0.6;
/** Gap between neighbouring teams when there is room for it. */
const STEP = 0.2;

/**
 * Where a team's rider is drawn on a square in a time trial, and which way it faces there (the
 * road's direction at that spot, radians, so riders turn with a curve). Team 0 is furthest forward.
 */
export function trialPose(
  g: SquareGeometry,
  lane: number,
  team: number,
  teams: number,
): { point: [number, number]; heading: number } {
  const step = teams > 1 ? Math.min(STEP, MAX_SPREAD / (teams - 1)) : 0;
  // 0 = the entry edge, 1 = the exit edge.
  const along = 0.5 - (team - (teams - 1) / 2) * step;
  // The outline is the left edge front to back, then the right edge back to front.
  const n = g.polygon.length / 2;
  const f = Math.min(Math.max(along, 0), 1) * (n - 1);
  const i = Math.min(Math.floor(f), n - 2);
  const at = (edge: (k: number) => readonly [number, number]): [number, number] => {
    const a = edge(i);
    const b = edge(i + 1);
    return [a[0] + (b[0] - a[0]) * (f - i), a[1] + (b[1] - a[1]) * (f - i)];
  };
  const left = at((k) => g.polygon[k]!);
  const right = at((k) => g.polygon[2 * n - 1 - k]!);
  const across = (lane + 0.5) / g.lanes.length; // from the right edge
  // The line across the road points to the rider's right: (-sin h, cos h) on screen.
  const dx = right[0] - left[0];
  const dy = right[1] - left[1];
  return {
    point: [right[0] - dx * across, right[1] - dy * across],
    heading: Math.atan2(-dx, dy),
  };
}

/** The position alone. */
export const trialPoint = (
  g: SquareGeometry,
  lane: number,
  team: number,
  teams: number,
): [number, number] => trialPose(g, lane, team, teams).point;
