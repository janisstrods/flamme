/**
 * Our own card layout: big value, rider-type mark, team colour band. Distinct designs for energy,
 * exhaustion, attack, muscle, specialist-power and stage cards, and a back per team.
 * Drawn in a 60×86 box; scale with `width`.
 */
import type { SpecialistPower, StageLayout } from '@velo/content';
import type { TeamColor } from '@velo/protocol';
import { Icon } from './Icons';
import type { IconName } from './Icons';
import { TEAM_STYLES } from './teams';

const patternId = (team: TeamColor) => `card-pat-${team}`;

const POWER_ICON: Record<SpecialistPower, IconName> = {
  strongAscents6: 'mountain',
  strongAscents7: 'mountain',
  strongDescents: 'descent',
  recovery: 'recovery',
  relentless: 'relentless',
  breakaway: 'breakaway',
  chase: 'chase',
  nimble: 'nimble',
};

export type CardArtProps =
  | {
      kind: 'energy';
      team: TeamColor;
      rider: 'rouleur' | 'sprinteur';
      value: number;
      powers?: SpecialistPower[];
    }
  | { kind: 'exhaustion'; rider: 'rouleur' | 'sprinteur' }
  | { kind: 'attack'; team: TeamColor }
  | { kind: 'muscle'; team: TeamColor }
  | { kind: 'back'; team: TeamColor }
  | { kind: 'stage'; name: string; layout: StageLayout };

function Frame({ children, fill = '#fffdf8' }: { children: React.ReactNode; fill?: string }) {
  return (
    <>
      <rect x={1} y={1.5} width={58} height={84} rx={7} fill="rgba(20,24,30,0.18)" />
      <rect x={1} y={0.5} width={58} height={84} rx={7} fill={fill} stroke="rgba(20,24,30,0.14)" />
      {children}
    </>
  );
}

function Corner({ value, color }: { value: string | number; color: string }) {
  return (
    <>
      <text className="card-art__corner" x={7} y={22} fill={color}>
        {value}
      </text>
      <text className="card-art__corner" x={7} y={22} fill={color} transform="rotate(180 30 43)">
        {value}
      </text>
    </>
  );
}

function Band({ team }: { team: TeamColor }) {
  return (
    <g>
      <clipPath id={`band-${team}`}>
        <rect x={1} y={0.5} width={58} height={84} rx={7} />
      </clipPath>
      <rect
        x={1}
        y={0.5}
        width={58}
        height={9}
        fill={`url(#${patternId(team)})`}
        clipPath={`url(#band-${team})`}
      />
      <rect
        x={1}
        y={76}
        width={58}
        height={8.5}
        fill={TEAM_STYLES[team].color}
        clipPath={`url(#band-${team})`}
      />
    </g>
  );
}

export function CardArt(props: CardArtProps & { width?: number }) {
  const width = props.width ?? 72;
  return (
    <svg
      className="card-art"
      width={width}
      height={(width * 86) / 60}
      viewBox="0 0 60 86"
      role="img"
      aria-label={label(props)}
    >
      <defs>
        <PatternDefs />
      </defs>
      {render(props)}
    </svg>
  );
}

function label(p: CardArtProps): string {
  switch (p.kind) {
    case 'energy':
      return `${p.rider} energy card ${p.value}`;
    case 'exhaustion':
      return `${p.rider} exhaustion card 2`;
    case 'attack':
      return 'Attack card: front rider 2, rear rider 9';
    case 'muscle':
      return 'Muscle card 5';
    case 'back':
      return `${p.team} card back`;
    case 'stage':
      return `Stage card ${p.name}`;
  }
}

function render(p: CardArtProps) {
  switch (p.kind) {
    case 'energy': {
      const ink = 'var(--ink)';
      return (
        <Frame>
          <Band team={p.team} />
          <Corner value={p.value} color={ink} />
          <text className="card-art__value" x={30} y={54} fill={ink}>
            {p.value}
          </text>
          <Icon x={39} y={13} name={p.rider} size={14} color="var(--ink-2)" />
          {(p.powers ?? []).map((power, i, all) => (
            <g key={power} transform={`translate(${30 - (all.length * 13) / 2 + i * 13 + 1}, 61)`}>
              <rect
                width={11}
                height={11}
                rx={3}
                fill="var(--accent-soft)"
                stroke="var(--accent)"
                strokeWidth={0.6}
              />
              <Icon x={1.5} y={1.5} name={POWER_ICON[power]} size={8} color="var(--accent)" />
              {power.startsWith('strongAscents') && (
                <text className="card-art__power-num" x={9.5} y={11.5}>
                  {power.slice(-1)}
                </text>
              )}
            </g>
          ))}
        </Frame>
      );
    }
    case 'exhaustion':
      return (
        <Frame fill="#efe7e4">
          <rect x={1} y={0.5} width={58} height={9} rx={7} fill="#b9a7a2" />
          <Corner value={2} color="#8a5a52" />
          <text className="card-art__value" x={30} y={50} fill="#8a5a52">
            2
          </text>
          <Icon x={23} y={56} name={'exhaustion'} size={14} color="#8a5a52" />
          <text className="card-art__caption" x={30} y={80} fill="#8a5a52">
            {p.rider === 'rouleur' ? 'TIRED · R' : 'TIRED · S'}
          </text>
        </Frame>
      );
    case 'attack':
      return (
        <Frame>
          <Band team={p.team} />
          <Icon x={22} y={14} name={'attack'} size={16} color="var(--danger)" />
          <text className="card-art__split" x={18} y={58} fill="var(--ink)">
            2
          </text>
          <text className="card-art__split" x={42} y={58} fill="var(--ink)">
            9
          </text>
          <line x1={30} y1={34} x2={30} y2={64} stroke="var(--line)" strokeWidth={1.2} />
          <text className="card-art__caption" x={18} y={70} fill="var(--ink-2)">
            FRONT
          </text>
          <text className="card-art__caption" x={42} y={70} fill="var(--ink-2)">
            REAR
          </text>
        </Frame>
      );
    case 'muscle':
      return (
        <Frame>
          <Band team={p.team} />
          <Corner value={5} color="var(--ink)" />
          <text className="card-art__value" x={30} y={54} fill="var(--ink)">
            5
          </text>
          <Icon x={23} y={58} name={'muscle'} size={14} color="var(--ink-2)" />
        </Frame>
      );
    case 'back':
      return (
        <Frame fill={TEAM_STYLES[p.team].color}>
          <rect
            x={5}
            y={4.5}
            width={50}
            height={76}
            rx={5}
            fill={`url(#${patternId(p.team)})`}
            opacity={0.9}
          />
          <circle cx={30} cy={43} r={13} fill="#fffdf8" />
          <text className="card-art__logo" x={30} y={47.5} fill="var(--ink)">
            TdJ
          </text>
        </Frame>
      );
    case 'stage': {
      const { minX, minY, maxX, maxY } = p.layout.bounds;
      const k = Math.min(50 / (maxX - minX), 50 / (maxY - minY));
      return (
        <Frame>
          <text className="card-art__title" x={30} y={12} fill="var(--ink)">
            {p.name}
          </text>
          <g
            transform={`translate(${30 - ((maxX + minX) / 2) * k}, ${44 - ((maxY + minY) / 2) * k}) scale(${k})`}
          >
            {Object.values(p.layout.squares).map((g) => (
              <polygon
                key={g.id}
                points={g.polygon.map((pt) => pt.join(',')).join(' ')}
                fill="var(--road)"
              />
            ))}
          </g>
          <text className="card-art__caption" x={30} y={80} fill="var(--ink-2)">
            STAGE
          </text>
        </Frame>
      );
    }
  }
}

/** Team pattern defs scaled for the card box. */
function PatternDefs() {
  return (
    <>
      {(Object.keys(TEAM_STYLES) as TeamColor[]).map((team) => {
        const t = TEAM_STYLES[team];
        const s = 6;
        return (
          <pattern
            key={team}
            id={patternId(team)}
            width={s}
            height={s}
            patternUnits="userSpaceOnUse"
          >
            <rect width={s} height={s} fill={t.color} />
            {t.pattern === 'hoops' && (
              <rect y={s * 0.6} width={s} height={s * 0.4} fill={t.mark} opacity={0.85} />
            )}
            {t.pattern === 'stripes' && (
              <rect x={s * 0.6} width={s * 0.4} height={s} fill={t.mark} opacity={0.85} />
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
