/**
 * Stage strip (plan section 10): the whole stage as a straightened profile with terrain bands, the
 * start and finish lines, a weather band and a dot per rider. Click anywhere to send the camera there.
 */
import type { TeamColor } from '@velo/protocol';
import { useMemo } from 'react';
import { TEAM_STYLES } from '../art/teams';
import { nameBook } from '../game/names';
import { useRace } from '../game/store';

const BAND: Record<string, string> = {
  flat: 'var(--road)',
  ascent: 'var(--ascent)',
  descent: 'var(--descent)',
  cobblestone: 'var(--cobble)',
  supply: 'var(--supply)',
};

/** Weather band along the top of the strip (Meteo). */
const WEATHER: Record<string, string> = {
  wet: 'var(--weather-wet)',
  crosswind: '#7d93a3',
  tailwind: 'var(--weather-tail)',
  headwind: 'var(--weather-head)',
};

export function StageStrip() {
  const { view, track, seat, display, focusSquare, room } = useRace();
  const book = nameBook(room?.config);
  const line = useMemo(() => {
    if (!track) return null;
    // Main line only: the inner branch stands in for split segments.
    const squares = Object.values(track.squares)
      .filter((s) => s.branch === undefined || s.ref.branch === 0)
      .sort((a, b) => a.index - b.index);
    let h = 0;
    const heights = squares.map(
      (s) => (h += s.terrain === 'ascent' ? 1 : s.terrain === 'descent' ? -1 : 0),
    );
    const min = Math.min(0, ...heights);
    const max = Math.max(1, ...heights);
    const pos = new Map(squares.map((s, i) => [s.id, i]));
    // Riders on an outer branch show at the matching point of the inner branch.
    const inner = new Map<string, typeof squares>();
    for (const s of squares)
      if (s.ref.branch === 0) {
        const key = `${s.ref.tile}.${s.ref.segment}`;
        inner.set(key, [...(inner.get(key) ?? []), s]);
      }
    const outer = new Map<string, typeof squares>();
    for (const s of Object.values(track.squares))
      if (s.ref.branch !== undefined && s.ref.branch !== 0) {
        const key = `${s.ref.tile}.${s.ref.segment}.${s.ref.branch}`;
        outer.set(key, [...(outer.get(key) ?? []), s]);
      }
    for (const [key, list] of outer) {
      const short = inner.get(key.split('.').slice(0, 2).join('.'));
      if (!short?.length) continue;
      const sorted = short.sort((x, y) => x.ref.square - y.ref.square);
      for (const s of list) {
        const t = list.length > 1 ? s.ref.square / (list.length - 1) : 0;
        const twin = sorted[Math.min(sorted.length - 1, Math.round(t * (sorted.length - 1)))]!;
        pos.set(s.id, pos.get(twin.id)!);
      }
    }
    return { squares, heights: heights.map((v) => (v - min) / (max - min)), pos };
  }, [track]);
  if (!view || !track || !line) return null;
  const n = line.squares.length;
  const profile = line.heights.map((v, i) => `${i + 0.5},${10 - 2 - v * 6}`).join(' ');
  const finishAt = line.pos.get(track.finishSquare) ?? n - 1;
  const refreshAt = view.refresh ? line.pos.get(view.refresh.square) : undefined;
  const startAt = line.squares.findIndex((s) => s.flags.includes('startLine'));

  // Stack riders that share a square.
  const stacks = new Map<number, number>();
  const dots = view.riders.flatMap((r) => {
    const p = display[r.id];
    if (!p) return [];
    const i = line.pos.get(p.square);
    if (i === undefined) return [];
    const k = stacks.get(i) ?? 0;
    stacks.set(i, k + 1);
    const team = (view.teams.find((t) => t.team === r.team)?.color ?? 'red') as TeamColor;
    return [
      { id: r.id, i, k, team, mine: r.team === seat, letter: r.type === 'rouleur' ? 'R' : 'S' },
    ];
  });

  return (
    <div
      className="stage-strip"
      role="button"
      tabIndex={0}
      aria-label="Stage profile. Click to move the camera; Enter jumps to your front rider."
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        // Keyboard: jump to your front rider, or to the race leader when watching.
        e.preventDefault();
        e.stopPropagation();
        const front = [...dots].sort((x, y) => Number(y.mine) - Number(x.mine) || y.i - x.i)[0];
        if (front) focusSquare(line.squares[front.i]!.id);
      }}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const i = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n)));
        focusSquare(line.squares[i]!.id);
      }}
    >
      <svg
        viewBox={`0 0 ${n} 10`}
        preserveAspectRatio="none"
        className="stage-strip__profile"
        aria-hidden="true"
      >
        <polygon points={`0.5,10 ${profile} ${n - 0.5},10`} fill="rgba(255,255,255,0.55)" />
        <polyline
          points={profile}
          fill="none"
          stroke="var(--ink-2)"
          strokeWidth={0.12}
          vectorEffect="non-scaling-stroke"
        />
        {line.squares.map((s, i) => (
          <rect key={s.id} x={i} y={8.6} width={1.02} height={1.4} fill={BAND[s.terrain]} />
        ))}
        {line.squares.map((s, i) =>
          s.weather ? (
            <rect
              key={`w${s.id}`}
              x={i}
              y={0}
              width={1.02}
              height={1.3}
              fill={WEATHER[s.weather]}
            />
          ) : null,
        )}
        {startAt >= 0 && <rect x={startAt} y={0} width={0.25} height={10} fill="#ffffff" />}
        <rect x={finishAt} y={0} width={0.35} height={10} fill="var(--ink)" />
        {refreshAt !== undefined && (
          <rect
            x={refreshAt}
            y={0}
            width={0.3}
            height={10}
            fill="var(--refresh)"
            opacity={view.refresh?.holder ? 0.35 : 1}
          />
        )}
      </svg>
      {dots.map((d) => (
        <span
          key={d.id}
          className={`stage-strip__dot stage-strip__dot--${d.letter === 'R' ? 'rouleur' : 'sprinteur'}${d.mine ? ' stage-strip__dot--mine' : ''}`}
          style={{
            left: `${((d.i + 0.5) / n) * 100}%`,
            bottom: `${10 + d.k * 13}px`,
            background: TEAM_STYLES[d.team].color,
            color: TEAM_STYLES[d.team].mark,
          }}
          title={`${book.rider(d.id)}, ${book.team(d.id.split(':')[0]!)}`}
        >
          {d.letter}
        </span>
      ))}
      <span
        className="stage-strip__label stage-strip__label--finish"
        style={{ left: `${(finishAt / n) * 100}%` }}
      >
        Finish
      </span>
      {refreshAt !== undefined && !view.refresh?.holder && (
        <span
          className="stage-strip__label stage-strip__label--refresh"
          style={{ left: `${(refreshAt / n) * 100}%` }}
        >
          Refresh
        </span>
      )}
    </div>
  );
}
