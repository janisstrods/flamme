/**
 * Top-down rider on a bike, facing +x (rotate with the road). About 0.9 units long, so it sits
 * inside one 1×1 lane cell.
 *
 * Rouleur: broad, upright shoulders and a short back. Sprinteur: long, low, narrow aero tuck with
 * the helmet pushed forward. Both carry a race-number disc with their letter. States: normal,
 * selected (soft halo), crashed (tipped over, skid marks), finished (chequered tag).
 */
import type { Jersey, TeamColor } from '@velo/protocol';
import { TEAM_STYLES, patternId } from './teams';

export interface RiderArtProps {
  team: TeamColor;
  type: 'rouleur' | 'sprinteur';
  state?: 'normal' | 'selected' | 'crashed' | 'finished';
  jersey?: Jersey | undefined;
  /** Heading in radians (screen coordinates). */
  heading?: number;
}

const JERSEY_FILL: Record<Jersey, string> = {
  yellow: 'var(--jersey-yellow)',
  green: 'var(--jersey-green)',
  polkaDot: 'url(#pat-polka)',
};

interface Build {
  torso: string;
  arms: string;
  helmet: { cx: number; rx: number; ry: number };
  bib: number;
}

const BUILD: Record<RiderArtProps['type'], Build> = {
  rouleur: {
    torso:
      'M0.1 -0.17 C0.17 -0.17 0.17 0.17 0.1 0.17 L-0.13 0.115 C-0.25 0.09 -0.25 -0.09 -0.13 -0.115 Z',
    arms: 'M0.04 -0.125 Q0.14 -0.14 0.212 -0.118 M0.04 0.125 Q0.14 0.14 0.212 0.118',
    helmet: { cx: 0.115, rx: 0.08, ry: 0.066 },
    bib: -0.1,
  },
  sprinteur: {
    torso:
      'M0.15 -0.135 C0.21 -0.135 0.21 0.135 0.15 0.135 L-0.16 0.085 C-0.28 0.065 -0.28 -0.065 -0.16 -0.085 Z',
    arms: 'M0.1 -0.1 Q0.17 -0.115 0.222 -0.105 M0.1 0.1 Q0.17 0.115 0.222 0.105',
    helmet: { cx: 0.19, rx: 0.088, ry: 0.06 },
    bib: -0.12,
  },
};

const TYRE = '#22252b';

export function RiderArt({ team, type, state = 'normal', jersey, heading = 0 }: RiderArtProps) {
  const t = TEAM_STYLES[team];
  const b = BUILD[type];
  const crashed = state === 'crashed';
  const rotate = (heading * 180) / Math.PI + (crashed ? 62 : 0);
  const h = b.helmet;
  return (
    <g className={`rider-art rider-art--${state}`}>
      {state === 'selected' && (
        <circle
          r={0.49}
          fill="rgba(255,210,63,0.18)"
          stroke="var(--jersey-yellow)"
          strokeWidth={0.035}
        />
      )}
      <g transform={`rotate(${rotate})`}>
        <ellipse cx={0.03} cy={0.06} rx={0.5} ry={0.26} fill="url(#rider-shadow)" />
        {crashed && (
          <path
            d="M-0.62 -0.12 Q-0.5 -0.1 -0.42 -0.02 M-0.6 0.06 Q-0.5 0.06 -0.43 0.1"
            stroke="rgba(20,22,26,0.45)"
            strokeWidth={0.03}
            strokeLinecap="round"
            fill="none"
          />
        )}
        {/* bike */}
        <rect x={-0.45} y={-0.026} width={0.25} height={0.052} rx={0.026} fill={TYRE} />
        <rect x={0.2} y={-0.026} width={0.25} height={0.052} rx={0.026} fill={TYRE} />
        <rect x={-0.3} y={-0.016} width={0.56} height={0.032} rx={0.016} fill="#9aa3ad" />
        <rect x={0.2} y={-0.135} width={0.032} height={0.27} rx={0.016} fill={TYRE} />
        {/* arms: soft outline, then sleeve */}
        <path
          d={b.arms}
          stroke="rgba(15,18,22,0.28)"
          strokeWidth={0.06}
          strokeLinecap="round"
          fill="none"
        />
        <path d={b.arms} stroke={t.color} strokeWidth={0.04} strokeLinecap="round" fill="none" />
        {/* torso: jersey, sheen, outline */}
        <path d={b.torso} fill={jersey ? JERSEY_FILL[jersey] : `url(#${patternId(team)})`} />
        <path d={b.torso} fill="url(#rider-sheen)" />
        <path d={b.torso} fill="none" stroke="rgba(15,18,22,0.22)" strokeWidth={0.014} />
        {/* aero helmet with two vents */}
        <ellipse
          cx={h.cx}
          cy={0}
          rx={h.rx}
          ry={h.ry}
          fill={t.color}
          stroke="rgba(15,18,22,0.3)"
          strokeWidth={0.013}
        />
        <ellipse cx={h.cx} cy={0} rx={h.rx} ry={h.ry} fill="url(#rider-sheen)" />
        {[-0.024, 0.024].map((y) => (
          <rect
            key={y}
            x={h.cx - h.rx * 0.55}
            y={y - 0.006}
            width={h.rx * 1.05}
            height={0.012}
            rx={0.006}
            fill="rgba(15,18,22,0.35)"
          />
        ))}
        {/* race-number disc: stays upright so the letter is always readable */}
        <g transform={`translate(${b.bib}, 0) rotate(${-rotate})`}>
          <circle r={0.072} fill="#ffffff" stroke="rgba(15,18,22,0.55)" strokeWidth={0.012} />
          <text className="rider-art__badge" dy="0.36em">
            {type === 'rouleur' ? 'R' : 'S'}
          </text>
        </g>
      </g>
      {state === 'finished' && (
        <g transform="translate(-0.3,-0.32)">
          <rect
            x={-0.09}
            y={-0.07}
            width={0.18}
            height={0.14}
            rx={0.03}
            fill="#ffffff"
            stroke={TYRE}
            strokeWidth={0.014}
          />
          <path
            d="M-0.06 -0.045h0.04v0.03h-0.04zM0.02 -0.045h0.04v0.03h-0.04zM-0.02 -0.015h0.04v0.03h-0.04zM-0.06 0.015h0.04v0.03h-0.04zM0.02 0.015h0.04v0.03h-0.04z"
            fill={TYRE}
          />
        </g>
      )}
    </g>
  );
}

/** Patterns and gradients used by riders. Render inside <defs>. */
export function JerseyPatterns() {
  return (
    <>
      <pattern id="pat-polka" width={0.075} height={0.075} patternUnits="userSpaceOnUse">
        <rect width={0.075} height={0.075} fill="#ffffff" />
        <circle cx={0.0375} cy={0.0375} r={0.016} fill="var(--jersey-polka)" />
      </pattern>
      <radialGradient id="rider-shadow">
        <stop offset="0%" stopColor="rgb(10,20,30)" stopOpacity={0.32} />
        <stop offset="70%" stopColor="rgb(10,20,30)" stopOpacity={0.12} />
        <stop offset="100%" stopColor="rgb(10,20,30)" stopOpacity={0} />
      </radialGradient>
      <linearGradient id="rider-sheen" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" stopOpacity={0.28} />
        <stop offset="45%" stopColor="#ffffff" stopOpacity={0.04} />
        <stop offset="100%" stopColor="#000000" stopOpacity={0.12} />
      </linearGradient>
    </>
  );
}
