/**
 * Tour (campaign) screens: the results between stages, the final podium, and the standings that
 * can be opened from the race view (plan section 8). Every row says who is who: team colour,
 * rider name, team, rider type, jersey, and "you".
 */
import { TILE_CATALOG, layoutStage, tourStages } from '@velo/content';
import { restDayAfter } from '@velo/engine';
import type { GameView, Jersey, RiderId } from '@velo/protocol';
import { useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { CardArt } from '../art/Card';
import { Icon } from '../art/Icons';
import { useRace } from '../game/store';
import type { TourAward } from '../game/store';
import { JERSEY_INFO, RiderTag, TeamTag, useWho } from './Tags';

export const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const REASON: Record<TourAward['reason'], string> = {
  podium: 'stage podiums',
  restDay: 'rest days',
  generalBonus: 'overall time',
  teamBonus: 'team time',
  sprintBonus: 'sprints',
  mountainBonus: 'mountains',
};

/** The standings overlay opened from the race view. */
export const useStandingsPanel = create<{ open: boolean; toggle(open?: boolean): void }>((set) => ({
  open: false,
  toggle: (open) => set((s) => ({ open: open ?? !s.open })),
}));

type Tab = 'general' | 'sprint' | 'mountain';

/** Ties go to whoever crossed the line first on the latest stage (G-BTW-2, G-END-2). */
function useLatestPlace(): (rider: RiderId) => number {
  const result = useRace((s) => s.result);
  return (rider) => {
    const i = result?.indexOf(rider) ?? -1;
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
}

function RiderStandings({ view, tab }: { view: GameView; tab: Tab }) {
  const place = useLatestPlace();
  const scoring = view.riders.filter((r) => r.tour);
  const value = (r: (typeof scoring)[number]) =>
    tab === 'general'
      ? r.tour!.seconds
      : tab === 'sprint'
        ? r.tour!.sprintPoints
        : r.tour!.mountainPoints;
  const sorted = [...scoring].sort(
    (a, b) =>
      (tab === 'general' ? value(a) - value(b) : value(b) - value(a)) || place(a.id) - place(b.id),
  );
  const best = sorted[0] ? value(sorted[0]) : 0;
  return (
    <table className="standings-table">
      <tbody>
        {sorted.map((r, i) => (
          <tr key={r.id}>
            <td className="standings-table__place">{i + 1}</td>
            <td>
              <RiderTag id={r.id} />
            </td>
            <td className="standings-table__value">
              {tab === 'general'
                ? value(r) === best
                  ? formatTime(value(r))
                  : `+${formatTime(value(r) - best)}`
                : `${value(r)} pts`}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StandingsTabs({ view }: { view: GameView }) {
  const [tab, setTab] = useState<Tab>('general');
  return (
    <section className="tour__standings">
      <div className="tabs" role="tablist">
        {(
          [
            ['general', 'Overall time'],
            ['sprint', 'Sprint points'],
            ['mountain', 'Mountain points'],
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
      <RiderStandings view={view} tab={tab} />
    </section>
  );
}

/** Team standings on Tour Points, with what each team earned on the latest stage. */
function TeamStandings({ view, stage }: { view: GameView; stage?: number }) {
  const { tour } = useRace();
  const place = useLatestPlace();
  const bestPlace = (team: string) =>
    Math.min(...view.riders.filter((r) => r.team === team).map((r) => place(r.id)));
  const teams = [...view.teams]
    .filter((t) => t.tourPoints !== undefined)
    .sort(
      (a, b) => (b.tourPoints ?? 0) - (a.tourPoints ?? 0) || bestPlace(a.team) - bestPlace(b.team),
    );
  const gained = (team: string) =>
    stage === undefined
      ? 0
      : tour.awards
          .filter((a) => a.team === team && a.stage === stage)
          .reduce((n, a) => n + a.points, 0);
  return (
    <table className="standings-table">
      <tbody>
        {teams.map((t, i) => (
          <tr key={t.team}>
            <td className="standings-table__place">{i + 1}</td>
            <td>
              <TeamTag team={t.team} />
            </td>
            <td className="standings-table__value">
              <b>{t.tourPoints} TP</b>
              {gained(t.team) > 0 && <small className="gain">+{gained(t.team)}</small>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Jerseys({ view }: { view: GameView }) {
  const holders = (['yellow', 'green', 'polkaDot'] as Jersey[]).flatMap((j) => {
    const r = view.riders.find((x) => x.jersey === j);
    return r ? [{ j, r }] : [];
  });
  if (holders.length === 0) return <p className="note">No jerseys yet.</p>;
  return (
    <ul className="jersey-cards">
      {holders.map(({ j, r }) => (
        <li key={j} className={`jersey-card jersey-card--${j}`}>
          <span className="jersey-card__stripe" style={{ background: JERSEY_INFO[j].color }} />
          <div>
            <small>{JERSEY_INFO[j].label}</small>
            <RiderTag id={r.id} />
            <small className="jersey-card__value">
              {j === 'yellow'
                ? formatTime(r.tour?.seconds ?? 0)
                : `${j === 'green' ? r.tour?.sprintPoints : r.tour?.mountainPoints} pts`}
            </small>
          </div>
        </li>
      ))}
    </ul>
  );
}

const MEDAL = ['1st', '2nd', '3rd'];

function BetweenStages({ view }: { view: GameView }) {
  const { room, result, tour, legal, act, leave, session } = useRace();
  const stages = room?.config.mode.kind === 'tour' ? tourStages(room.config.mode.schedule) : [];
  const n = view.stageNumber;
  const next = stages[n];
  const layout = useMemo(() => (next ? layoutStage(next, TILE_CATALOG) : null), [next]);
  const advance = legal.find((a) => a.type === 'advance');
  const rest = room ? restDayAfter(room.config, n) : false;
  const order = result ?? [];
  const best = Math.min(...order.map((id) => tour.stageTimes[id] ?? 0));
  const podiumPoints = tour.awards.filter((a) => a.stage === n && a.reason === 'podium');
  // G-TTT-1: in a team time trial each team takes one podium place (its first rider home).
  const ttt = stages[n - 1]?.type === 'teamTimeTrial';
  const onPodium = new Set<string>();
  const podium = order
    .filter((id) => {
      const r = view.riders.find((x) => x.id === id);
      if (!r?.tour) return false;
      if (!ttt) return true;
      if (onPodium.has(r.team)) return false;
      onPodium.add(r.team);
      return true;
    })
    .slice(0, podiumPoints.length || 3);
  const tokensOf = (id: RiderId) => tour.stageTokens.filter((t) => t.rider === id);
  const { book } = useWho();
  const stageTime = (id: RiderId) => tour.stageTimes[id] ?? 0;
  const teamOf = (id: RiderId) => view.riders.find((r) => r.id === id)?.team;
  // G-TTT-1: a team rides on the time of its rider who crossed the line last.
  const slowerMate = (id: RiderId) => {
    if (!ttt || !tour.teamTimeAdded[id]) return undefined;
    const mates = order.filter((x) => teamOf(x) === teamOf(id));
    const last = mates[mates.length - 1];
    return last !== id ? last : undefined;
  };
  const time = (id: RiderId) => {
    const t = stageTime(id);
    return (
      <>
        {formatTime(t)}
        <small className="time-gap">{t === best ? 'fastest' : `+${formatTime(t - best)}`}</small>
      </>
    );
  };
  const winner = podium[0];
  const fastest =
    order.filter((id) => stageTime(id) === best && podium.includes(id))[0] ??
    order.find((id) => stageTime(id) === best);
  const winnerMate = winner ? slowerMate(winner) : undefined;
  return (
    <div className="results tour">
      <p className="eyebrow">
        Stage {n} of {stages.length} · results
      </p>
      <h2>{stages[n - 1]?.name}</h2>

      <ol className="stage-podium">
        {podium.map((id, i) => (
          <li key={id} className={`stage-podium__step stage-podium__step--${i + 1}`}>
            <span className="stage-podium__medal">{MEDAL[i]}</span>
            <RiderTag id={id} />
            <span className="stage-podium__meta">
              {formatTime(stageTime(id))} · +{podiumPoints[i]?.points ?? 3 - i} TP
            </span>
          </li>
        ))}
      </ol>

      <p className="tour__explain">
        Tour Points go to the first three {ttt ? 'teams' : 'riders'} across the line. The yellow
        jersey goes to the lowest total time.
        {ttt && " In a team time trial both riders take the slower rider's time."}
        {winner && fastest && stageTime(winner) > best && (
          <>
            {' '}
            <b>{book.rider(winner)}</b> crossed first
            {winnerMate ? (
              <>
                {' '}
                but rides on <b>{book.rider(winnerMate)}</b>&rsquo;s time (+
                {formatTime(stageTime(winner) - best)})
              </>
            ) : null}
            ; the fastest time went to <b>{book.rider(fastest)}</b>.
          </>
        )}
      </p>

      <div className="tour__grid">
        <section>
          <h3>Stage finish</h3>
          <table className="standings-table">
            <thead>
              <tr>
                <th colSpan={2}>Order across the line</th>
                <th className="standings-table__value">Stage time</th>
              </tr>
            </thead>
            <tbody>
              {order.map((id, i) => (
                <tr key={id}>
                  <td className="standings-table__place">{i + 1}</td>
                  <td>
                    <RiderTag id={id} />
                  </td>
                  <td className="standings-table__value">
                    {time(id)}
                    {slowerMate(id) && (
                      <small className="time-gap">team time: {book.rider(slowerMate(id)!)}</small>
                    )}
                    {tokensOf(id).map((t, k) => (
                      <small
                        key={k}
                        className={`token-chip token-chip--${t.kind}`}
                        title={`${t.value} ${t.kind} points`}
                      >
                        +{t.value}
                      </small>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section>
          <h3>Teams on Tour Points</h3>
          <TeamStandings view={view} stage={n} />
          <h3>Jerseys</h3>
          <Jerseys view={view} />
        </section>
      </div>
      <StandingsTabs view={view} />
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
            Next: stage {n + 1}, {next?.name}
            {next && next.type !== 'normal'
              ? ` (${next.type === 'teamTimeTrial' ? 'team time trial' : next.type === 'individualTimeTrial' ? 'individual time trial' : 'long stage with a refresh'})`
              : ''}
            . Played cards are back in the decks and every rider has shed half its exhaustion cards.
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
  const { tour, leave, seat, room } = useRace();
  // The engine's final order when we have it: it has the tie-break applied (G-END-2).
  const final = (team: string) => {
    const i = tour.ranking?.indexOf(team) ?? -1;
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const ranking = [...view.teams]
    .filter((t) => t.tourPoints !== undefined)
    .sort((a, b) => final(a.team) - final(b.team) || (b.tourPoints ?? 0) - (a.tourPoints ?? 0));
  const breakdown = (team: string) => {
    const by = new Map<string, number>();
    for (const a of tour.awards.filter((x) => x.team === team))
      by.set(REASON[a.reason], (by.get(REASON[a.reason]) ?? 0) + a.points);
    return [...by.entries()];
  };
  const winner = ranking[0];
  const winnerName = winner
    ? room?.config.seats.find((s) => s.seat === winner.team)?.names?.team
    : '';
  return (
    <div className="results tour">
      <p className="eyebrow">The tour is over</p>
      <h2>
        {winner?.team === seat
          ? 'You win the tour!'
          : `${winnerName ?? 'The winners'} win the tour`}
      </h2>
      <table className="standings-table tour__final">
        <tbody>
          {ranking.map((t, i) => (
            <tr key={t.team} className={t.team === seat ? 'mine' : ''}>
              <td className="tour__place">{i + 1}</td>
              <td>
                <TeamTag team={t.team} />
                <div className="chips">
                  {breakdown(t.team).map(([k, v]) => (
                    <small key={k} className="chip">
                      {v} {k}
                    </small>
                  ))}
                </div>
              </td>
              <td className="standings-table__value">
                <b className="tour__tp">{t.tourPoints} TP</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="tour__grid">
        <section>
          <h3>Jerseys</h3>
          <Jerseys view={view} />
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

/** Campaign standings from the race view: where the tour stands, teams, jerseys, classifications. */
function StandingsOverlay({ view }: { view: GameView }) {
  const { room } = useRace();
  const { toggle } = useStandingsPanel();
  if (room?.config.mode.kind !== 'tour') return null;
  const schedule = room.config.mode.schedule;
  let stage = 0;
  return (
    <div
      className="overlay"
      role="dialog"
      aria-label="Tour standings"
      onClick={() => toggle(false)}
    >
      <div className="results tour" onClick={(e) => e.stopPropagation()}>
        <header className="rules-panel__head">
          <div>
            <p className="eyebrow">Tour standings</p>
            <h2>
              Stage {view.stageNumber} of {tourStages(schedule).length}
            </h2>
          </div>
          <button
            className="icon-btn"
            onClick={() => toggle(false)}
            aria-label="Close the standings"
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <ol className="tour__progress">
          {schedule.map((s, i) => {
            if (s === 'rest')
              return (
                <li key={`rest${i}`} className="tour__progress-rest" title="Rest day">
                  rest
                </li>
              );
            stage++;
            const state =
              stage < view.stageNumber ? 'done' : stage === view.stageNumber ? 'now' : 'next';
            return (
              <li key={`${s.id}${i}`} className={`tour__progress-stage is-${state}`} title={s.name}>
                <b>{stage}</b> {s.name}
              </li>
            );
          })}
        </ol>
        <div className="tour__grid">
          <section>
            <h3>Teams on Tour Points</h3>
            <TeamStandings view={view} />
            <h3>Jerseys</h3>
            <Jerseys view={view} />
          </section>
          <section>
            <StandingsTabs view={view} />
          </section>
        </div>
      </div>
    </div>
  );
}

export function TourScreens() {
  const { view, animating, queue, replay, room } = useRace();
  const standingsOpen = useStandingsPanel((s) => s.open);
  const isTour = room?.config.mode.kind === 'tour';
  // T opens the tour standings; Esc closes them.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === 'Escape') useStandingsPanel.getState().toggle(false);
      else if (isTour && (e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey)
        useStandingsPanel.getState().toggle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isTour]);
  if (!view || replay) return null;
  const between =
    !animating &&
    queue.length === 0 &&
    (view.phase === 'betweenStages' || view.phase === 'tourEnd');
  if (between)
    return (
      <div className="overlay" role="dialog" aria-label="Tour results">
        {view.phase === 'tourEnd' ? <TourEnd view={view} /> : <BetweenStages view={view} />}
      </div>
    );
  return standingsOpen ? <StandingsOverlay view={view} /> : null;
}
