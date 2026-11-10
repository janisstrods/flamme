/**
 * Team colours and patterns. Each team has a colour and a pattern so teams stay distinct without
 * colour (plan section 9). Patterns are SVG <pattern> defs shared by riders and card backs.
 */
import type { TeamColor } from '@velo/protocol';

export interface TeamStyle {
  color: string;
  /** Colour used for pattern marks and text on the team colour. */
  mark: string;
  pattern: 'solid' | 'bands' | 'pinstripes' | 'chevrons' | 'dots' | 'quarters';
  label: string;
}

export const TEAM_STYLES: Record<TeamColor, TeamStyle> = {
  red: { color: 'var(--team-red)', mark: '#ffffff', pattern: 'solid', label: 'Red, solid' },
  blue: { color: 'var(--team-blue)', mark: '#ffffff', pattern: 'bands', label: 'Blue, bands' },
  green: {
    color: 'var(--team-green)',
    mark: '#ffffff',
    pattern: 'pinstripes',
    label: 'Green, pinstripes',
  },
  black: {
    color: 'var(--team-black)',
    mark: '#f2c14e',
    pattern: 'chevrons',
    label: 'Black, chevrons',
  },
  pink: { color: 'var(--team-pink)', mark: '#ffffff', pattern: 'dots', label: 'Pink, dots' },
  white: {
    color: 'var(--team-white)',
    mark: '#2a2d33',
    pattern: 'quarters',
    label: 'White, quarters',
  },
};

export const TEAM_COLORS = Object.keys(TEAM_STYLES) as TeamColor[];

export const patternId = (team: TeamColor) => `pat-${team}`;

/** Pattern definitions for every team. Render once inside an <svg><defs>. */
export function TeamPatterns({ size = 0.12 }: { size?: number }) {
  return (
    <>
      {TEAM_COLORS.map((team) => {
        const t = TEAM_STYLES[team];
        const s = size;
        return (
          <pattern
            key={team}
            id={patternId(team)}
            width={s}
            height={s}
            patternUnits="userSpaceOnUse"
          >
            <rect width={s} height={s} fill={t.color} />
            {t.pattern === 'bands' && (
              <rect x={s * 0.55} width={s * 0.45} height={s} fill={t.mark} opacity={0.85} />
            )}
            {t.pattern === 'pinstripes' && (
              <rect y={s * 0.75} width={s} height={s * 0.18} fill={t.mark} opacity={0.9} />
            )}
            {t.pattern === 'chevrons' && (
              <path
                d={`M0 ${s * 0.75} L${s / 2} ${s * 0.3} L${s} ${s * 0.75}`}
                fill="none"
                stroke={t.mark}
                strokeWidth={s * 0.18}
              />
            )}
            {t.pattern === 'dots' && (
              <circle cx={s / 2} cy={s / 2} r={s * 0.2} fill={t.mark} opacity={0.9} />
            )}
            {t.pattern === 'quarters' && (
              <>
                <rect width={s / 2} height={s / 2} fill={t.mark} opacity={0.85} />
                <rect
                  x={s / 2}
                  y={s / 2}
                  width={s / 2}
                  height={s / 2}
                  fill={t.mark}
                  opacity={0.85}
                />
              </>
            )}
          </pattern>
        );
      })}
    </>
  );
}
