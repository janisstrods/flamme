/**
 * Grand Tour tiles, checked against high-resolution photos of the Grand Tour punchboards on
 * BoardGameGeek (images 8597765–8597768) and the rulebook (pp.1, 3–5, 9, 10), 2026-11-10.
 * Timing seconds come from the Timing tile placed beside the wide finish (D-017): the side with
 * six values (+1:00 reminder before the line, then five squares) goes with the flat face, the side
 * with five values (+1:00, then four squares) with the ascent face.
 */
import type { SquareSpec, TileSide } from '../schema';

const sq = (
  lanes: 1 | 2 | 3,
  terrain: SquareSpec['terrain'],
  flags: SquareSpec['flags'] = [],
  timingSeconds?: number,
): SquareSpec => ({
  lanes,
  terrain,
  flags,
  verified: true,
  ...(timingSeconds !== undefined ? { timingSeconds } : {}),
});

/** Flat face (v): 1 two-lane square, then 5 three-lane squares past the line, +0:40 … +0:00. */
const flatWideFinish: SquareSpec[] = [
  sq(2, 'flat'),
  sq(3, 'flat', ['finishLine'], 40),
  sq(3, 'flat', [], 30),
  sq(3, 'flat', [], 20),
  sq(3, 'flat', [], 10),
  sq(3, 'flat', [], 0),
];

/** Ascent face (V): all ascent; 2 two-lane squares, then 4 three-lane squares, +0:30 … +0:00. */
const ascentWideFinish: SquareSpec[] = [
  sq(2, 'ascent'),
  sq(2, 'ascent'),
  sq(3, 'ascent', ['finishLine'], 30),
  sq(3, 'ascent', [], 20),
  sq(3, 'ascent', [], 10),
  sq(3, 'ascent', [], 0),
];

/** Hairpin: 2 two-lane squares, 3 single-lane crash squares (wavy blue line), 1 two-lane square. */
const sharpCorner = (): SquareSpec[] => [
  sq(2, 'flat'),
  sq(2, 'flat'),
  sq(1, 'flat', ['sharpCorner']),
  sq(1, 'flat', ['sharpCorner']),
  sq(1, 'flat', ['sharpCorner']),
  sq(2, 'flat'),
];

const roundabout = (id: string, flipSide: string, direction: 'left' | 'right'): TileSide => ({
  id,
  flipSide,
  source: 'grandTour',
  shape: { kind: 'roundabout', direction },
  segments: [
    { type: 'linear', squares: [sq(2, 'flat'), sq(2, 'flat'), sq(2, 'flat')] },
    {
      type: 'split',
      branches: [
        { name: 'inner', squares: [sq(1, 'flat'), sq(1, 'flat'), sq(1, 'flat')] },
        { name: 'outer', squares: Array.from({ length: 5 }, () => sq(1, 'flat')) },
      ],
    },
  ],
  notes:
    'Both branches run to the tile edge. Riders ending at the split take the inner branch if possible (G-RND-2).',
});

export const GRAND_TOUR_TILES: TileSide[] = [
  {
    id: 'v_w',
    flipSide: 'v_s',
    source: 'grandTour',
    shape: { kind: 'wideFinish' },
    segments: [{ type: 'linear', squares: flatWideFinish }],
    notes: 'Flatland wide finish; timing strip side with six values.',
  },
  {
    id: 'v_s',
    flipSide: 'v_w',
    source: 'grandTour',
    shape: { kind: 'wideFinish' },
    segments: [{ type: 'linear', squares: ascentWideFinish }],
    notes: 'Ascent wide finish: all six squares are ascent; timing strip side with five values.',
  },
  {
    id: 'z_w',
    flipSide: 'z_s',
    source: 'grandTour',
    shape: { kind: 'sharpCorner', direction: 'left' },
    segments: [{ type: 'linear', squares: sharpCorner() }],
  },
  {
    id: 'z_s',
    flipSide: 'z_w',
    source: 'grandTour',
    shape: { kind: 'sharpCorner', direction: 'right' },
    segments: [{ type: 'linear', squares: sharpCorner() }],
  },
  roundabout('x_w', 'x_s', 'left'),
  roundabout('x_s', 'x_w', 'right'),
  roundabout('y_w', 'y_s', 'left'),
  roundabout('y_s', 'y_w', 'right'),
];
