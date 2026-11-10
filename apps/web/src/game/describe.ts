/**
 * Plain-language descriptions of a square and a rider for the board's hover cards (plan section
 * 10: "hover any rider for team, type, exhaustion count and its card history; hover any square for
 * terrain and effects"). Pure functions over the public view, so they are easy to test.
 */
import { SPECIALISTS } from '@velo/content';
import type { TrackGraph } from '@velo/content';
import type { GameConfig, GameView, RiderId } from '@velo/protocol';
import { controllerLabel } from './controllers';
import type { NameBook } from './names';

export interface InfoLine {
  /** What it is ("Climb", "Crosswind"). */
  label: string;
  /** What it does, briefly ("cards count at most 5"). */
  effect?: string;
  tone?: 'terrain' | 'weather' | 'warn' | 'good' | 'plain';
}

export interface Info {
  title: string;
  subtitle?: string;
  lines: InfoLine[];
}

export const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

export const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const TERRAIN: Record<string, InfoLine> = {
  flat: { label: 'Flat road', tone: 'terrain' },
  ascent: {
    label: 'Climb',
    effect: 'cards count at most 5; no slipstream here',
    tone: 'terrain',
  },
  descent: { label: 'Descent', effect: 'starting here, cards count at least 5', tone: 'terrain' },
  cobblestone: { label: 'Cobbles', effect: 'no slipstream to or from here', tone: 'terrain' },
  supply: {
    label: 'Supply zone',
    effect: 'starting here, cards count at least 4',
    tone: 'terrain',
  },
};

const WEATHER: Record<string, InfoLine> = {
  crosswind: { label: 'Crosswind', effect: 'no slipstream on this tile', tone: 'weather' },
  tailwind: { label: 'Tailwind', effect: 'starting here, draw 5 cards', tone: 'weather' },
  headwind: { label: 'Headwind', effect: 'starting here, draw only 3 cards', tone: 'weather' },
  wet: { label: 'Wet road', effect: 'a blocked rider stopping here crashes', tone: 'weather' },
};

/** Squares to the finish line from a square (branch squares count from where they split). */
function toFinish(track: TrackGraph, id: string): number {
  let sq = track.squares[id]!;
  let extra = 0;
  while (sq.branch !== undefined && sq.next[0]) {
    extra++;
    sq = track.squares[sq.next[0]]!;
  }
  return Math.max(0, track.finishIndex - sq.index + extra);
}

export function describeSquare(
  view: GameView,
  track: TrackGraph,
  id: string,
  book: NameBook,
): Info {
  const sq = track.squares[id]!;
  const terrain = TERRAIN[sq.terrain] ?? { label: sq.terrain };
  // Flat road needs no line of its own; anything else says what it does.
  const lines: InfoLine[] = sq.terrain === 'flat' ? [] : [terrain];
  if (sq.weather) lines.push(WEATHER[sq.weather]!);
  if (sq.flags.includes('sharpCorner'))
    lines.push({ label: 'Hairpin', effect: 'a blocked rider stopping here crashes', tone: 'warn' });
  if (sq.branch !== undefined)
    lines.push({
      label: `Roundabout, ${sq.branch} lane`,
      effect: 'riders stay in their lane to the end of the tile; no slipstream across',
      tone: 'terrain',
    });
  if (sq.flags.includes('breakaway'))
    lines.push({
      label: 'Breakaway square',
      effect: 'where breakaway winners start',
      tone: 'plain',
    });
  if (sq.flags.includes('startGrid')) lines.push({ label: 'Start grid', tone: 'plain' });
  if (sq.flags.includes('finishLine')) lines.push({ label: 'Finish line', tone: 'good' });
  if (sq.timingSeconds !== undefined && view.riders.some((r) => r.tour))
    lines.push({
      label: `Finish time +${sq.timingSeconds} s`,
      effect: 'for a group whose front rider stops here',
      tone: 'plain',
    });
  for (const pile of view.tokens)
    if (pile.square === id && pile.remaining.length)
      lines.push({
        label: `${pile.pile === 'major' ? 'Major' : 'Minor'} ${pile.kind} points`,
        effect: `${pile.remaining.join(', ')} left: first to reach it takes the top one`,
        tone: 'good',
      });
  const here = view.riders.filter((r) => r.position?.square === id && !(r.finished && r.tour));
  if (here.some((r) => r.crashed))
    lines.push({
      label: 'Crash here',
      effect: 'no slipstream to or from this square',
      tone: 'warn',
    });
  if (here.length)
    lines.push({
      label: here.map((r) => book.rider(r.id)).join(', '),
      tone: 'plain',
    });
  const left = toFinish(track, id);
  const where =
    sq.index >= track.finishIndex && sq.branch === undefined
      ? 'past the line'
      : `${left} square${left === 1 ? '' : 's'} to the finish`;
  return {
    title: [sq.weather ? WEATHER[sq.weather]!.label : '', terrain.label]
      .filter(Boolean)
      .join(' · '),
    subtitle: `${sq.lanes} lane${sq.lanes > 1 ? 's' : ''} · ${where}`,
    lines,
  };
}

/** Where a rider stands in a tour: overall rank and gap, team rank and points, classifications. */
export function standing(view: GameView, rider: RiderId) {
  const r = view.riders.find((x) => x.id === rider);
  if (!r?.tour) return null;
  const scoring = view.riders.filter((x) => x.tour);
  const byTime = [...scoring].sort((a, b) => a.tour!.seconds - b.tour!.seconds);
  // Ties share a rank ("joint 2nd"); before anyone has finished a stage there are no times.
  const rank = 1 + scoring.filter((x) => x.tour!.seconds < r.tour!.seconds).length;
  const tied = scoring.filter((x) => x.tour!.seconds === r.tour!.seconds).length > 1;
  const gap = r.tour.seconds - byTime[0]!.tour!.seconds;
  const team = view.teams.find((t) => t.team === r.team);
  const points = team?.tourPoints ?? 0;
  const tps = view.teams.filter((t) => t.tourPoints !== undefined).map((t) => t.tourPoints ?? 0);
  return {
    rank,
    tied,
    noTimes: scoring.every((x) => x.tour!.seconds === 0),
    of: byTime.length,
    gap,
    teamRank: 1 + tps.filter((p) => p > points).length,
    teamTied: tps.filter((p) => p === points).length > 1,
    teamPoints: points,
    sprint: r.tour.sprintPoints,
    mountain: r.tour.mountainPoints,
  };
}

export function describeRider(
  view: GameView,
  config: GameConfig,
  track: TrackGraph,
  id: RiderId,
  mySeat: string | null,
  book: NameBook,
  playerName: (seat: string) => string | null,
): Info {
  const r = view.riders.find((x) => x.id === id)!;
  const seat = config.seats.find((s) => s.seat === r.team);
  const who =
    r.team === mySeat
      ? 'your team'
      : ((seat?.controller.kind === 'human' ? playerName(r.team) : null) ??
        (seat ? controllerLabel(seat.controller) : ''));
  const spec = r.specialist && SPECIALISTS.find((s) => s.id === r.specialist)?.name;
  const lines: InfoLine[] = [
    {
      label: `${r.type === 'rouleur' ? 'Rouleur' : 'Sprinteur'}${spec ? ` · ${spec}` : ''}`,
      tone: 'plain',
    },
  ];
  const JERSEY = {
    yellow: 'Yellow jersey: overall leader',
    green: 'Green jersey: best sprinter',
    polkaDot: 'Polka dot jersey: best climber',
  };
  if (r.jersey) lines.push({ label: JERSEY[r.jersey], tone: 'good' });
  const st = standing(view, id);
  if (st) {
    lines.push(
      st.noTimes
        ? { label: 'No tour times yet', effect: 'times start at the first finish', tone: 'plain' }
        : {
            label: `${st.tied ? 'Joint ' : ''}${ordinal(st.rank)} overall of ${st.of}`,
            effect: st.gap ? `+${clock(st.gap)} behind the leader` : 'leads on time',
            tone: 'good',
          },
    );
    lines.push({
      label: `Team ${st.teamTied ? 'joint ' : ''}${ordinal(st.teamRank)} with ${st.teamPoints} Tour Point${st.teamPoints === 1 ? '' : 's'}`,
      tone: 'plain',
    });
    if (st.sprint || st.mountain)
      lines.push({
        label:
          [st.sprint ? `${st.sprint} sprint` : '', st.mountain ? `${st.mountain} mountain` : '']
            .filter(Boolean)
            .join(' · ') + ' points',
        tone: 'plain',
      });
  }
  if (r.crashed)
    lines.push({ label: 'Crashed', effect: 'its next card counts 2 less', tone: 'warn' });
  if (r.exhaustionCount)
    lines.push({
      label: `${r.exhaustionCount} exhaustion card${r.exhaustionCount > 1 ? 's' : ''} in the deck`,
      tone: 'warn',
    });
  if (r.played.length)
    lines.push({
      label: `Played: ${r.played
        .slice(-6)
        .map((c) => (c.kind === 'exhaustion' ? '2×' : c.value))
        .join(', ')}`,
      tone: 'plain',
    });
  if (r.finished) lines.push({ label: 'Finished', tone: 'good' });
  else if (r.position)
    lines.push({
      label: `${toFinish(track, r.position.square)} squares to the finish`,
      tone: 'plain',
    });
  return { title: book.rider(id), subtitle: `${book.team(r.team)} · ${who}`, lines };
}
