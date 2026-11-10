/**
 * Tour (campaign) screens, shown over the board between stages and at the end of the tour:
 * stage results, Tour Points earned, jerseys, the four classifications, the rest day, the next
 * stage, and the final podium (plan section 8).
 */
import { TILE_CATALOG, layoutStage, tourStages } from '@velo/content';
import { restDayAfter } from '@velo/engine';
import type { GameView, Jersey, RiderId, TeamColor } from '@velo/protocol';
import { useMemo, useState } from 'react';
import { CardArt } from '../art/Card';
import { TEAM_STYLES } from '../art/teams';
import { nameBook } from '../game/names';
import { useRace } from '../game/store';
import type { TourAward } from '../game/store';

export const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const JERSEY: Record<Jersey, { label: string; color: string }> = {
  yellow: { label: 'Yellow (overall time)', color: 'var(--jersey-yellow)' },
  green: { label: 'Green (sprints)', color: 'var(--jersey-green)' },
  polkaDot: { label: 'Polka dot (mountains)', color: 'var(--jersey-polka)' },
};

const REASON: Record<TourAward['reason'], string> = {
  podium: 'stage podiums',
  restDay: 'rest days',
  generalBonus: 'overall time',
  teamBonus: 'team time',
  sprintBonus: 'sprints',
  mountainBonus: 'mountains',
};

type Tab = 'general' | 'team' | 'sprint' | 'mountain';

/** Names for teams and riders, from the room (players' names, bot levels). */
function useNames() {
  const { room, seat, view } = useRace();
  return useMemo(() => {
    const book = nameBook(room?.config);
    const team = (t: string) => `${book.team(t)}${t === seat ? ' (you)' : ''}`;
    const rider = (id: RiderId) => book.rider(id);
    const color = (t: string) =>
      (view?.teams.find((x) => x.team === t)?.color ?? 'red') as TeamColor;
    return { team, rider, color };
  }, [room, seat, view]);
}

function Swatch({ team }: { team: string }) {
  const { color } = useNames();
  return <span className="swatch" style={{ background: TEAM_STYLES[color(team)].color }} />;
}

function Standings({ view, tab }: { view: GameView; tab: Tab }) {
  const names = useNames();
  const scoring = view.riders.filter((r) => r.tour);
  if (tab === 'team') {
    const teams = [...view.teams]
      .filter((t) => t.tourPoints !== undefined)
      .sort((a, b) => (b.tourPoints ?? 0) - (a.tourPoints ?? 0));
    return (
      <ol className="standings">
        {teams.map((t) => (
          <li key={t.team}>
            <Swatch team={t.team} /> {names.team(t.team)}
            <b>{t.tourPoints} TP</b>
          </li>
        ))}
      </ol>
    );
  }
  const value = (r: (typeof scoring)[number]) =>
    tab === 'general'
      ? r.tour!.seconds
      : tab === 'sprint'
        ? r.tour!.sprintPoints
        : r.tour!.mountainPoints;
  const sorted = [...scoring].sort((a, b) =>
    tab === 'general' ? value(a) - value(b) : value(b) - value(a),
  );
  const best = sorted[0] ? value(sorted[0]) : 0;
  return (
    <ol className="standings">
      {sorted.map((r) => (
        <li key={r.id}>
          <Swatch team={r.team} /> {names.rider(r.id)}
          {r.jersey && (
            <span
              className="jersey-dot"
              style={{ background: JERSEY[r.jersey].color }}
              title={JERSEY[r.jersey].label}
            />
          )}
          <b>
            {tab === 'general'
              ? value(r) === best
                ? formatTime(value(r))
                : `+${formatTime(value(r) - best)}`
              : `${value(r)} pts`}
          </b>
        </li>
      ))}
    </ol>
  );
}

function StandingsTabs({ view }: { view: GameView }) {
  const [tab, setTab] = useState<Tab>('general');
  return (
    <section className="tour__standings">
      <div className="tabs" role="tablist">
        {(
          [
            ['general', 'Overall'],
            ['team', 'Tour Points'],
            ['sprint', 'Sprint'],
            ['mountain', 'Mountain'],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'is-on' : ''}
            onClick={() => setTab(t)}
          >
            {label}
          </button>
        ))}
      </div>
      <Standings view={view} tab={tab} />
    </section>
  );
}

function Jerseys() {
  const { view } = useRace();
  const names = useNames();
  const holder = (j: Jersey) => view?.riders.find((r) => r.jersey === j)?.id;
  return (
    <ul className="tour__jerseys">
      {(['yellow', 'green', 'polkaDot'] as const).map((j) => {
        const id = holder(j);
        return id ? (
          <li key={j}>
            <span className="jersey-dot jersey-dot--big" style={{ background: JERSEY[j].color }} />
            <span>
              <small>{JERSEY[j].label}</small>
              {names.rider(id)}
            </span>
          </li>
        ) : null;
      })}
    </ul>
  );
}

function BetweenStages({ view }: { view: GameView }) {
  const { room, result, tour, legal, act, leave, session } = useRace();
  const names = useNames();
  const stages = room?.config.mode.kind === 'tour' ? tourStages(room.config.mode.schedule) : [];
  const n = view.stageNumber;
  const next = stages[n];
  const layout = useMemo(() => (next ? layoutStage(next, TILE_CATALOG) : null), [next]);
  const advance = legal.find((a) => a.type === 'advance');
  const rest = room ? restDayAfter(room.config, n) : false;
  const order = result ?? [];
  const best = Math.min(...order.map((id) => tour.stageTimes[id] ?? 0));
  const earned = tour.awards.filter((a) => a.stage === n);
  return (
    <div className="results tour">
      <p className="eyebrow">
        Stage {n} of {stages.length}
      </p>
      <h2>{stages[n - 1]?.name}: results</h2>
      <div className="tour__grid">
        <section>
          <h3>Stage</h3>
          <ol className="standings">
            {order.map((id) => {
              const t = tour.stageTimes[id] ?? 0;
              return (
                <li key={id}>
                  <Swatch team={id.split(':')[0]!} /> {names.rider(id)}
                  <b>{t === best ? formatTime(t) : `+${formatTime(t - best)}`}</b>
                </li>
              );
            })}
          </ol>
          {earned.length > 0 && (
            <>
              <h3>Tour Points</h3>
              <ul className="tour__awards">
                {earned.map((a, i) => (
                  <li key={i}>
                    <Swatch team={a.team} /> {names.team(a.team)} +{a.points}{' '}
                    <small>
                      {a.reason === 'podium' ? 'podium' : 'rest day: leads a classification'}
                    </small>
                  </li>
                ))}
              </ul>
            </>
          )}
          {tour.stageTokens.length > 0 && (
            <>
              <h3>Sprint and mountain points</h3>
              <ul className="tour__awards">
                {tour.stageTokens.map((t, i) => (
                  <li key={i}>
                    <Swatch team={t.rider.split(':')[0]!} /> {names.rider(t.rider)} +{t.value}{' '}
                    <small>{t.kind}</small>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section>
          <h3>Jerseys</h3>
          <Jerseys />
          <StandingsTabs view={view} />
        </section>
      </div>
      {rest && (
        <p className="tour__rest">
          Rest day. The classification leaders earn a Tour Point each; every other rider sheds half
          its exhaustion cards again.
        </p>
      )}
      <div className="tour__next">
        {next && layout && <CardArt kind="stage" name={next.name} layout={layout} width={110} />}
        <div>
          <p className="note">
            Next: stage {n + 1}, {next?.name}. Played cards are back in the decks and every rider
            has shed half its exhaustion cards.
            {session?.kind !== 'solo' && ' The tour is saved; you can stop here and resume later.'}
          </p>
          <div className="results__actions">
            {advance ? (
              <button className="btn btn--primary" onClick={() => act(advance)}>
                Start stage {n + 1}
              </button>
            ) : (
              <span className="note">Waiting for the host to start the next stage…</span>
            )}
            <button className="btn btn--quiet" onClick={leave}>
              Stop for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TourEnd({ view }: { view: GameView }) {
  const { tour, leave, seat } = useRace();
  const names = useNames();
  const ranking = [...view.teams]
    .filter((t) => t.tourPoints !== undefined)
    .sort((a, b) => (b.tourPoints ?? 0) - (a.tourPoints ?? 0));
  const breakdown = (team: string) => {
    const by = new Map<string, number>();
    for (const a of tour.awards.filter((x) => x.team === team))
      by.set(REASON[a.reason], (by.get(REASON[a.reason]) ?? 0) + a.points);
    return [...by.entries()].map(([k, v]) => `${v} ${k}`).join(', ');
  };
  const winner = ranking[0];
  return (
    <div className="results tour">
      <p className="eyebrow">The tour is over</p>
      <h2>
        {winner?.team === seat
          ? 'You win the tour!'
          : `${names.team(winner?.team ?? '')} wins the tour`}
      </h2>
      <ol className="tour__final">
        {ranking.map((t, i) => (
          <li key={t.team} className={t.team === seat ? 'mine' : ''}>
            <span className="tour__place">{i + 1}</span>
            <Swatch team={t.team} /> <b>{names.team(t.team)}</b>
            <span className="tour__tp">{t.tourPoints} TP</span>
            <small>{breakdown(t.team)}</small>
          </li>
        ))}
      </ol>
      <div className="tour__grid">
        <section>
          <h3>Jerseys</h3>
          <Jerseys />
        </section>
        <section>
          <StandingsTabs view={view} />
        </section>
      </div>
      <div className="results__actions">
        <button className="btn btn--primary" onClick={leave}>
          Back to home
        </button>
      </div>
    </div>
  );
}

export function TourScreens() {
  const { view, animating, queue } = useRace();
  if (!view || animating || queue.length > 0) return null;
  if (view.phase !== 'betweenStages' && view.phase !== 'tourEnd') return null;
  return (
    <div className="overlay" role="dialog" aria-label="Tour standings">
      {view.phase === 'tourEnd' ? <TourEnd view={view} /> : <BetweenStages view={view} />}
    </div>
  );
}
