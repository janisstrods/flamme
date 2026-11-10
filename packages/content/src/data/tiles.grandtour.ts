/**
 * Grand Tour tiles, drafted from the Grand Tour rulebook's component picture and worked examples
 * (pp.1, 9, 10). Unverified until checked against the physical tiles. Known uncertainties:
 *  - Wide finish: lanes past the line read as 3; timing seconds not legible (D-017).
 *  - Sharp corner: read as 2 two-lane squares, 3 single-lane marked squares, 1 two-lane square;
 *    which side turns which way is a guess.
 */
import type { SquareSpec, TileSide } from '../schema';

const sq = (
  lanes: 1 | 2 | 3,
  terrain: SquareSpec['terrain'],
  flags: SquareSpec['flags'] = [],
): SquareSpec => ({
  lanes,
  terrain,
  flags,
  verified: false,
});

const wideFinish = (terrain: 'flat' | 'ascent'): SquareSpec[] => [
  sq(2, terrain),
  sq(3, terrain, ['finishLine']),
  ...Array.from({ length: 4 }, () => sq(3, terrain)),
];

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
  notes: 'Riders ending at the split take the inner branch if possible (G-RND-2).',
});

export const GRAND_TOUR_TILES: TileSide[] = [
  {
    id: 'v_w',
    flipSide: 'v_s',
    source: 'grandTour',
    shape: { kind: 'wideFinish' },
    segments: [{ type: 'linear', squares: wideFinish('flat') }],
    notes: 'Flatland wide finish; timing strip side with six values.',
  },
  {
    id: 'v_s',
    flipSide: 'v_w',
    source: 'grandTour',
    shape: { kind: 'wideFinish' },
    segments: [{ type: 'linear', squares: wideFinish('ascent') }],
    notes: 'Ascent wide finish: all six squares are ascent; timing strip side with five values.',
  },
  {
    id: 'z_w',
    flipSide: 'z_s',
    source: 'grandTour',
    shape: { kind: 'sharpCorner', direction: 'right' },
    segments: [{ type: 'linear', squares: sharpCorner() }],
  },
  {
    id: 'z_s',
    flipSide: 'z_w',
    source: 'grandTour',
    shape: { kind: 'sharpCorner', direction: 'left' },
    segments: [{ type: 'linear', squares: sharpCorner() }],
  },
  roundabout('x_w', 'x_s', 'left'),
  roundabout('x_s', 'x_w', 'right'),
  roundabout('y_w', 'y_s', 'left'),
  roundabout('y_s', 'y_w', 'right'),
];
