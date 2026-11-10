/**
 * Who's who on results and standings: a team tag (colour, name, who rides it) and a rider tag
 * (team colour, rider name, team and rider type, jersey, "you").
 */
import type { Jersey, RiderId, TeamColor } from '@velo/protocol';
import { TEAM_STYLES } from '../art/teams';
import { controllerLabel } from '../game/controllers';
import { nameBook } from '../game/names';
import { useRace } from '../game/store';

export const JERSEY_INFO: Record<Jersey, { label: string; short: string; color: string }> = {
  yellow: {
    label: 'Yellow jersey: overall leader (lowest time)',
    short: 'Yellow',
    color: 'var(--jersey-yellow)',
  },
  green: {
    label: 'Green jersey: most sprint points',
    short: 'Green',
    color: 'var(--jersey-green)',
  },
  polkaDot: {
    label: 'Polka dot jersey: most mountain points',
    short: 'Polka dot',
    color: 'var(--jersey-polka)',
  },
};

export function useWho() {
  const { room, view, seat } = useRace();
  const book = nameBook(room?.config);
  const color = (team: string) =>
    (view?.teams.find((t) => t.team === team)?.color ?? 'red') as TeamColor;
  const owner = (team: string) => {
    if (team === seat) return 'you';
    const s = room?.config.seats.find((x) => x.seat === team);
    if (!s) return '';
    if (s.controller.kind === 'human') {
      const id = s.controller.playerId;
      return room?.players.find((p) => p.id === id)?.name ?? 'player';
    }
    return controllerLabel(s.controller);
  };
  return { book, color, owner, seat };
}

export function TeamTag({ team, compact = false }: { team: string; compact?: boolean }) {
  const { book, color, owner, seat } = useWho();
  return (
    <span className={`tag tag--team${team === seat ? ' tag--mine' : ''}`}>
      <span className="tag__swatch" style={{ background: TEAM_STYLES[color(team)].color }} />
      <span className="tag__text">
        <b>{book.team(team)}</b>
        {!compact && <small>{owner(team)}</small>}
      </span>
    </span>
  );
}

export function JerseyDot({ jersey }: { jersey: Jersey }) {
  return (
    <span
      className="jersey-dot"
      style={{ background: JERSEY_INFO[jersey].color }}
      title={JERSEY_INFO[jersey].label}
      aria-label={JERSEY_INFO[jersey].label}
    />
  );
}

export function RiderTag({ id }: { id: RiderId }) {
  const { book, color, seat } = useWho();
  const view = useRace((s) => s.view);
  const team = id.split(':')[0]!;
  const jersey = view?.riders.find((r) => r.id === id)?.jersey;
  return (
    <span className={`tag tag--rider${team === seat ? ' tag--mine' : ''}`}>
      <span className="tag__swatch" style={{ background: TEAM_STYLES[color(team)].color }} />
      <span className="tag__text">
        <b>
          {book.rider(id)} {jersey && <JerseyDot jersey={jersey} />}
          {team === seat && <span className="badge">you</span>}
        </b>
        <small>
          {book.team(team)} · {book.type(id)}
        </small>
      </span>
    </span>
  );
}
