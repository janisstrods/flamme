/**
 * One consistent icon set: 24×24 grid, 2px round strokes, `currentColor`, generous padding.
 * Our own drawings.
 */
import type { SVGProps } from 'react';

/** Circle as a path, so every icon is a single `d` string. */
const c = (cx: number, cy: number, r: number) =>
  `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

const BIKE = `${c(5.5, 17, 3.5)} ${c(18.5, 17, 3.5)} M5.5 17L9.5 11h6l3 6 M9.5 11l2.5 6`;

const PATHS = {
  ascent: 'M3 18l6-6 4 4 8-8 M15 8h6v6',
  descent: 'M3 6l6 6 4-4 8 8 M15 16h6v-6',
  cobble: 'M3 5h7v5H3z M13 5h8v5h-8z M3 14h4v5H3z M10 14h11v5H10z',
  supply:
    'M10 2.5h4 M10.5 2.5v3L8.5 8.5V19.5a1.5 1.5 0 0 0 1.5 1.5h4a1.5 1.5 0 0 0 1.5-1.5V8.5l-2-3v-3 M8.5 13h7',
  slipstream: `M3 8h8 M3 12h10 M3 16h8 ${c(18, 12, 3)}`,
  noSlipstream: `M3 8h8 M3 12h10 M3 16h8 ${c(18, 12, 3)} M4 4l16 16`,
  exhaustion:
    'M12 3c-3 4.5-5.5 7.6-5.5 11a5.5 5.5 0 0 0 11 0C17.5 10.6 15 7.5 12 3z M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5',
  crosswind: 'M8 3v9 M16 3v9 M12 3v11 M7 15l5 5 5-5',
  tailwind: 'M3 8h9 M3 12h12 M3 16h9 M15 6l6 6-6 6',
  headwind: 'M21 8h-9 M21 12H9 M21 16h-9 M9 6l-6 6 6 6',
  wet: 'M7 14a4 4 0 0 1 .4-8A5.5 5.5 0 0 1 17.5 7a3.5 3.5 0 0 1-.5 7z M8 17.5l-1 3 M12 17.5l-1 3 M16 17.5l-1 3',
  timer: `${c(12, 13.5, 7.5)} M12 9.5v4l2.5 2 M10 2.5h4 M12 2.5v3.5`,
  settings: `M4 7h9 M19 7h1 M4 17h1 M11 17h9 ${c(16, 7, 2.5)} ${c(8, 17, 2.5)}`,
  podium: 'M3 20.5V15h6v5.5 M9 20.5V10h6v10.5 M15 20.5V17h6v3.5 M2.5 20.5h19',
  sprint: 'M5 21V3.5 M5 4h12l-2.5 4.5L17 13H5',
  mountain: 'M2.5 20L9 8.5l4 6 3-4.5 5.5 10z',
  refresh: 'M20.5 12a8.5 8.5 0 1 1-2.5-6 M20.5 3.5v6h-6',
  attack: 'M13 2.5L5 13.5h6.5l-1 8 8-11H12l1-8z',
  muscle: 'M3.5 9v6 M6.5 7v10 M17.5 7v10 M20.5 9v6 M6.5 12h11',
  recovery: 'M12 3c-3 4.5-5.5 7.6-5.5 11a5.5 5.5 0 0 0 11 0C17.5 10.6 15 7.5 12 3z M9.5 14h5',
  relentless: 'M12 3L5 6v5.5c0 4.5 3 8 7 9.5 4-1.5 7-5 7-9.5V6z M9 12l2 2 4-4',
  breakaway: 'M2.5 12h9 M8 8.5l3.5 3.5L8 15.5 M15.5 5v14 M19.5 5v14',
  chase: 'M3 7h6 M3 17h6 M3 12h12 M12 8.5l3.5 3.5-3.5 3.5 M20 5v14',
  nimble: `M4 3v18 M11 3v18 ${c(17, 12, 2.5)} M20.5 3v18`,
  rouleur: `${BIKE} ${c(12.5, 4.5, 1.8)} M12 6.5l-1.5 4.5 M11.8 8.2l3.7 2.8`,
  sprinteur: `${BIKE} ${c(16.5, 6.8, 1.8)} M14.8 7.8l-5.3 3.2 M14.6 8.4l1 2.6 M1.5 7h3 M1.5 10h2`,
  sound: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z M15.5 9a4.5 4.5 0 0 1 0 6 M18 6.5a8 8 0 0 1 0 11',
  soundOff: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z M16 9.5l5 5 M21 9.5l-5 5',
  follow: `${c(12, 12, 6.5)} ${c(12, 12, 1.5)} M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3`,
  close: 'M6 6l12 12 M18 6L6 18',
} as const;

export type IconName = keyof typeof PATHS;

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

/** The raw path of an icon, for drawing it inside another SVG (24×24 grid). */
export const iconPath = (name: IconName) => PATHS[name];
