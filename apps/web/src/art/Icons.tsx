/**
 * One consistent icon set: 24×24, 2px round strokes, `currentColor`. Our own drawings.
 */
import type { SVGProps } from 'react';

export type IconName =
  | 'ascent'
  | 'descent'
  | 'cobble'
  | 'supply'
  | 'slipstream'
  | 'noSlipstream'
  | 'exhaustion'
  | 'crosswind'
  | 'tailwind'
  | 'headwind'
  | 'wet'
  | 'timer'
  | 'settings'
  | 'podium'
  | 'sprint'
  | 'mountain'
  | 'refresh'
  | 'attack'
  | 'muscle'
  | 'recovery'
  | 'relentless'
  | 'breakaway'
  | 'chase'
  | 'nimble'
  | 'rouleur'
  | 'sprinteur';

const PATHS: Record<IconName, string> = {
  ascent: 'M3 19 L21 5 M8 19 h-5 v-5 M14 9 l3 -1 M10 12 l3 -1',
  descent: 'M3 5 L21 19 M21 14 v5 h-5 M10 12 l-3 -1 M14 15 l-3 -1',
  cobble:
    'M4 6 h5 v4 h-5z M11 6 h5 v4 h-5z M18 6 h2 v4 M4 13 h2 v4 h-2 M8 13 h5 v4 h-5z M15 13 h5 v4 h-5z',
  supply: 'M10 3 h4 v3 l2 3 v11 a1 1 0 0 1 -1 1 h-6 a1 1 0 0 1 -1 -1 v-11 l2 -3z M9 13 h6',
  slipstream: 'M3 8 h10 M3 12 h14 M3 16 h10 M17 8 a4 4 0 0 1 0 8',
  noSlipstream: 'M3 8 h10 M3 12 h14 M3 16 h10 M4 20 L20 4',
  exhaustion: 'M12 3 C9 8 7 10.5 7 14 a5 5 0 0 0 10 0 c0 -3.5 -2 -6 -5 -11z M10 15 a2 2 0 0 0 2 2',
  crosswind: 'M12 3 v18 M8 7 l4 -4 l4 4 M3 12 h5 M16 12 h5',
  tailwind: 'M3 8 h12 a3 3 0 1 0 -3 -3 M3 13 h16 a3 3 0 1 1 -3 3 M3 18 h7',
  headwind: 'M21 8 h-12 a3 3 0 1 1 3 -3 M21 13 h-16 a3 3 0 1 0 3 3 M21 18 h-7',
  wet: 'M12 3 C8 9 6 12 6 15 a6 6 0 0 0 12 0 c0 -3 -2 -6 -6 -12z',
  timer: 'M12 21 a8 8 0 1 0 0 -16 a8 8 0 0 0 0 16z M12 9 v4 l3 2 M10 2 h4',
  settings:
    'M12 15 a3 3 0 1 0 0 -6 a3 3 0 0 0 0 6z M12 2 v3 M12 19 v3 M2 12 h3 M19 12 h3 M5 5 l2 2 M17 17 l2 2 M5 19 l2 -2 M17 7 l2 -2',
  podium:
    'M3 21 v-6 h6 v6 M9 21 v-10 h6 v10 M15 21 v-4 h6 v4 M12 4 l1 2 h2 l-1.5 1.5 l.5 2 l-2 -1 l-2 1 l.5 -2 l-1.5 -1.5 h2z',
  sprint: 'M4 20 L4 4 M4 4 h12 l-3 4 l3 4 h-12',
  mountain: 'M2 20 L9 8 L13 14 L16 10 L22 20z M7.5 10.5 L9 8 L10.5 10.5',
  refresh: 'M20 12 a8 8 0 1 1 -2.5 -5.8 M20 4 v5 h-5',
  attack: 'M13 2 L5 13 h6 l-1 9 l8 -11 h-6z',
  muscle: 'M5 16 c0 -6 3 -9 6 -9 l2 -3 l3 1 l-1 4 c3 1 4 4 4 7 c0 2 -2 4 -7 4 c-4 0 -7 -1 -7 -4z',
  recovery: 'M4 7 h16 M6 7 l1 13 h10 l1 -13 M9 7 V4 h6 v3 M10 11 v6 M14 11 v6',
  relentless: 'M12 3 L4 6 v6 c0 5 3.5 8 8 9 c4.5 -1 8 -4 8 -9 V6z M9 12 l2 2 l4 -4',
  breakaway: 'M3 12 h10 M9 8 l4 4 l-4 4 M17 5 v14 M21 5 v14',
  chase: 'M3 8 h8 l-3 -3 M3 16 h8 l-3 3 M14 12 h7 M18 9 l3 3 l-3 3',
  nimble: 'M5 4 v16 M12 4 v16 M19 4 v16 M15 12 h6 M18 9 l3 3 l-3 3',
  rouleur:
    'M12 5 a2 2 0 1 0 0 -0.01 M7 21 a3 3 0 1 0 0 -0.01 M17 21 a3 3 0 1 0 0 -0.01 M12 7 v6 l-5 5 M12 13 l5 5 M8 10 h8',
  sprinteur:
    'M16 6 a2 2 0 1 0 0 -0.01 M6 20 a3 3 0 1 0 0 -0.01 M18 20 a3 3 0 1 0 0 -0.01 M15 8 l-7 4 l-2 8 M8 12 l10 8 M15 8 l4 3',
};

export function Icon({
  name,
  size = 20,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

export const ICON_NAMES = Object.keys(PATHS) as IconName[];
