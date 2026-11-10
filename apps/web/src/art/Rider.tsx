/**
 * Top-down rider on a bike, drawn from geometric shapes, facing +x (rotate with the road).
 * About 0.86 units long, so it sits inside one 1×1 lane cell.
 *
 * Rouleur: broad, upright shoulders. Sprinteur: long, low, narrow aero tuck. Both carry a letter
 * badge. States: normal, selected (ring), crashed (tipped over, scuffed), finished (chequered tag).
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

export function RiderArt({ team, type, state = 'normal', jersey, heading = 0 }: RiderArtProps) {
  const t = TEAM_STYLES[team];
  const rouleur = type === 'rouleur';
  const torso = rouleur ? { cx: -0.05, rx: 0.17, ry: 0.19 } : { cx: -0.03, rx: 0.23, ry: 0.13 };
  const crashed = state === 'crashed';
  const rotate = (heading * 180) / Math.PI + (crashed ? 62 : 0);
  return (
    <g className={`rider-art rider-art--${state}`} transform={`rotate(${rotate})`}>
      {/* soft shadow */}
      <ellipse cx={0.03} cy={0.05} rx={0.44} ry={0.2} fill="rgba(10,20,30,0.22)" />
      {state === 'selected' && (
        <circle r={0.47} fill="none" stroke="var(--jersey-yellow)" strokeWidth={0.06} />
      )}
      {/* bike: wheels and frame */}
      <rect x={0.2} y={-0.035} width={0.24} height={0.07} rx={0.035} fill="#1d1f24" />
      <rect x={-0.44} y={-0.035} width={0.24} height={0.07} rx={0.035} fill="#1d1f24" />
      <rect x={-0.24} y={-0.02} width={0.5} height={0.04} rx={0.02} fill="#9aa1ab" />
      {/* arms to the bars */}
      {['#1d1f24', t.color].map((stroke, i) => (
        <path
          key={i}
          d={
            rouleur
              ? 'M-0.02 -0.15 L0.2 -0.1 M-0.02 0.15 L0.2 0.1'
              : 'M0.06 -0.1 L0.24 -0.07 M0.06 0.1 L0.24 0.07'
          }
          stroke={stroke}
          strokeWidth={i === 0 ? 0.085 : 0.055}
          strokeLinecap="round"
        />
      ))}
      <rect x={0.19} y={-0.13} width={0.04} height={0.26} rx={0.02} fill="#1d1f24" />
      {/* jersey (torso) with team pattern, or a leader's jersey */}
      <ellipse
        cx={torso.cx}
        cy={0}
        rx={torso.rx}
        ry={torso.ry}
        fill={jersey ? JERSEY_FILL[jersey] : `url(#${patternId(team)})`}
        stroke={jersey ? t.color : 'rgba(0,0,0,0.18)'}
        strokeWidth={jersey ? 0.05 : 0.02}
      />
      {/* helmet */}
      <circle
        cx={rouleur ? 0.12 : 0.17}
        cy={0}
        r={0.085}
        fill={t.color}
        stroke="rgba(0,0,0,0.25)"
        strokeWidth={0.015}
      />
      <path
        d={`M${rouleur ? 0.17 : 0.22} -0.05 a0.07 0.07 0 0 1 0 0.1`}
        fill="none"
        stroke="#ffffff"
        strokeWidth={0.02}
        opacity={0.8}
      />
      {/* letter badge, kept upright-ish by counter-rotating */}
      <g transform={`translate(${torso.cx - torso.rx * 0.55}, 0) rotate(${-rotate})`}>
        <circle r={0.062} fill="#ffffff" stroke="#1d1f24" strokeWidth={0.014} />
        <text className="rider-art__badge" dy={0.026}>
          {rouleur ? 'R' : 'S'}
        </text>
      </g>
      {crashed && (
        <path
          d="M-0.3 -0.28 l0.1 0.06 M-0.22 -0.32 l0.04 0.1 M0.3 0.26 l-0.1 -0.04"
          stroke="var(--danger)"
          strokeWidth={0.03}
          strokeLinecap="round"
        />
      )}
      {state === 'finished' && (
        <g transform={`translate(-0.32,-0.3) rotate(${-rotate})`}>
          <rect
            x={-0.08}
            y={-0.06}
            width={0.16}
            height={0.12}
            rx={0.02}
            fill="#ffffff"
            stroke="#1d1f24"
            strokeWidth={0.015}
          />
          <path
            d="M-0.08 -0.06h0.04v0.04h-0.04zM0 -0.06h0.04v0.04h-0.04zM-0.04 -0.02h0.04v0.04h-0.04zM0.04 -0.02h0.04v0.04h-0.04zM-0.08 0.02h0.04v0.04h-0.04zM0 0.02h0.04v0.04h-0.04z"
            fill="#1d1f24"
          />
        </g>
      )}
    </g>
  );
}

/** Extra pattern for the polka-dot jersey. Render inside <defs>. */
export function JerseyPatterns() {
  return (
    <pattern id="pat-polka" width={0.08} height={0.08} patternUnits="userSpaceOnUse">
      <rect width={0.08} height={0.08} fill="#ffffff" />
      <circle cx={0.04} cy={0.04} r={0.017} fill="var(--jersey-polka)" />
    </pattern>
  );
}
