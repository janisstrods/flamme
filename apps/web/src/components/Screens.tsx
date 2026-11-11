/**
 * Home (play solo, host a room, resume or import a saved room), the join screen for invite links,
 * and the results overlay. Illustrated headers use the art components.
 */
import { presetRestDays, restDaysLabel } from '../game/restDays';
import {
  ORIGINAL_STAGES,
  TILE_CATALOG,
  TOUR_PRESETS,
  suggestedRestDays,
  layoutStage,
  tourStages,
} from '@velo/content';
import type { RoomSnapshot } from '@velo/host';
import type { AiLevel, GameConfig, RiderId, SeatConfig, TeamColor } from '@velo/protocol';
import { useMemo, useRef, useState } from 'react';
import { CardArt } from '../art/Card';
import { RiderArt } from '../art/Rider';
import { ArtDefs } from '../art/TrackArt';
import { BOT_LEVELS } from '../game/controllers';
import {
  fieldLimit,
  fieldLimitNote,
  RANDOM_TOUR_LENGTHS,
  newTourSeed,
  randomStage,
  randomTourMode,
  setupIssues,
  singleStages,
  stageLabel,
  tourMode,
  withGrandTour,
  withPeloton,
} from '../game/setup';
import type { TourChoice } from '../game/setup';
import { allStages } from '../game/customStages';
import { nameBook } from '../game/names';
import { RiderTag } from './Tags';
import { TeamNamesEditor } from './TeamNamesEditor';
import { useRace } from '../game/store';
import { useRulesPanel } from '../rules/RulesPanel';
import { useSettingsPanel } from './SettingsPanel';
import { deleteSavedRoom, listSavedRooms, loadIdentity, newInvite } from '../net/session';
import type { Invite } from '../net/session';

/** A road sweeping across the header with a small breakaway on it. */
function HomeBanner() {
  const riders: [number, number, TeamColor, 'rouleur' | 'sprinteur'][] = [
    [7.2, 2.15, 'red', 'sprinteur'],
    [6.2, 2.75, 'blue', 'rouleur'],
    [5.2, 2.2, 'green', 'rouleur'],
    [4.2, 2.8, 'black', 'sprinteur'],
    [2.6, 2.25, 'pink', 'rouleur'],
  ];
  return (
    <svg
      className="home__banner"
      viewBox="0 0 12 4.6"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <ArtDefs />
      </defs>
      <rect width={12} height={4.6} fill="var(--grass)" />
      <ellipse cx={10.2} cy={0.6} rx={3} ry={1.4} fill="#7fbf73" opacity={0.7} />
      <rect x={-1} y={1.55} width={14} height={1.9} fill="var(--verge)" />
      <rect x={-1} y={1.75} width={14} height={1.5} fill="var(--road)" />
      <line
        x1={-1}
        x2={13}
        y1={2.5}
        y2={2.5}
        stroke="var(--lane-line)"
        strokeWidth={0.04}
        strokeDasharray="0.16 0.12"
      />
      <line x1={-1} x2={13} y1={1.77} y2={1.77} stroke="var(--road-edge)" strokeWidth={0.04} />
      <line x1={-1} x2={13} y1={3.23} y2={3.23} stroke="var(--road-edge)" strokeWidth={0.04} />
      {[0.8, 1.6, 9.6, 10.6, 11.3].map((x, i) => (
        <g key={i}>
          <circle
            cx={x + 0.08}
            cy={(i % 2 ? 4.05 : 0.95) + 0.1}
            r={0.36}
            fill="rgba(20,40,20,0.2)"
          />
          <circle cx={x} cy={i % 2 ? 4.05 : 0.95} r={0.36} fill="#4f9d5a" />
        </g>
      ))}
      {riders.map(([x, y, team, type]) => (
        <g key={team} transform={`translate(${x},${y}) scale(0.9)`}>
          <RiderArt team={team} type={type} />
        </g>
      ))}
    </svg>
  );
}

function NameField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label>
      Your name
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 24))}
        placeholder="Shown to other players"
        maxLength={24}
      />
    </label>
  );
}

export function Home() {
  const { startSolo, hostOnline, resumeSolo, startTutorial, startReplay } = useRace();
  const [name, setName] = useState(() => loadIdentity().name);
  const stages = useMemo(() => allStages(), []);
  const [stageId, setStageId] = useState(ORIGINAL_STAGES[0]!.id);
  const [opponents, setOpponents] = useState(2);
  const [level, setLevel] = useState<AiLevel>('medium');
  const [dummies, setDummies] = useState<'none' | 'peloton' | 'muscle' | 'both'>('none');
  const [breakaway, setBreakaway] = useState(false);
  const [weather, setWeather] = useState(false);
  const [tourId, setTourId] = useState<string>('none');
  const [restDay, setRestDay] = useState(true);
  const [specialists, setSpecialists] = useState(false);
  const preset = TOUR_PRESETS.find((t) => t.id === tourId);
  // A random tour is generated when the tour starts, for the field chosen by then.
  const random = tourId === 'random';
  const [randomLength, setRandomLength] = useState(7);
  const [randomSpecial, setRandomSpecial] = useState(false);
  const tour: TourChoice | undefined = preset && {
    stages: preset.stages,
    restAfter: restDay ? presetRestDays(preset) : undefined,
  };
  const stage = random
    ? undefined
    : stages.find((s) => s.id === (preset ? preset.stages[0] : stageId));
  // The field this stage or tour can take (its narrowest start grid); random ones adapt.
  const limitMode: GameConfig['mode'] | null = tour
    ? tourMode(tour)
    : stage
      ? { kind: 'single', stage }
      : null;
  const teamLimit = limitMode ? fieldLimit(limitMode).teams : 6;
  const limitNote = limitMode ? fieldLimitNote(limitMode) : null;
  const dummyChoice: ('peloton' | 'muscle')[] =
    dummies === 'both' ? ['peloton', 'muscle'] : dummies === 'none' ? [] : [dummies];
  // Automatic teams that no longer fit are left out.
  const dummyTeams = dummyChoice.slice(0, Math.max(0, teamLimit - 1));
  const maxBots = Math.min(5, teamLimit - 1) - dummyTeams.length;
  const minBots = dummyTeams.length > 0 ? 0 : 1;
  const bots = Math.max(minBots, Math.min(opponents, maxBots));
  const [saves, setSaves] = useState(() => listSavedRooms());
  const [allSaves, setAllSaves] = useState(false);
  const error = useRace((x) => x.error);
  const [importError, setImportError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const layout = useMemo(() => (stage ? layoutStage(stage, TILE_CATALOG) : null), [stage]);
  const opponentSeats: SeatConfig['controller'][] = [
    ...Array.from({ length: bots }, () => ({ kind: 'ai' as const, level })),
    ...dummyTeams.map((team) => ({ kind: 'dummy' as const, team })),
  ];
  const issues = useMemo(
    () =>
      stage
        ? setupIssues(
            withGrandTour(
              withPeloton(
                {
                  modules: {},
                  mode: tour ? tourMode(tour) : { kind: 'single', stage },
                  seats: [{ kind: 'human' as const, playerId: 'me' }, ...opponentSeats].map(
                    (controller, i) => ({
                      seat: `seat-${i}`,
                      controller,
                    }),
                  ),
                  options: { showRemainingValues: true, allowSpectators: true, turnTimer: 'off' },
                },
                { breakaway },
              ),
              specialists,
            ),
          )
        : // The stages do not exist yet; the one clash is known ahead (time trials from 5 stages).
          random && randomSpecial && breakaway && randomLength >= 5
          ? [
              'Time trials have no breakaway tile. Switch breakaway bidding off, or untick Grand Tour stages.',
            ]
          : [],
    // opponentSeats is rebuilt every render; its content is captured by these values.
    [
      stage,
      bots,
      level,
      dummies,
      breakaway,
      tourId,
      restDay,
      specialists,
      random,
      randomSpecial,
      randomLength,
    ],
  );
  return (
    <main className="home">
      <HomeBanner />
      <div className="home__body">
        <div className="home__intro">
          <h1>Tour de Jour</h1>
          <p className="tagline">A cycling race of cards, slipstreams and tired legs.</p>
        </div>
        <div className="home__panel">
          <div className="home__form">
            <NameField value={name} onChange={setName} />
            <TeamNamesEditor />
            <label>
              Play
              <select
                value={tourId}
                onChange={(e) => {
                  setTourId(e.target.value);
                  // The Grand Tour presets come with the specialist draft (it can be switched off).
                  setSpecialists(
                    TOUR_PRESETS.find((t) => t.id === e.target.value)?.specialists ?? false,
                  );
                }}
              >
                <option value="none">One stage</option>
                {TOUR_PRESETS.map((t) => (
                  <option key={t.id} value={t.id}>
                    Tour: {t.name} ({t.stages.length} stages)
                  </option>
                ))}
                <option value="random">Tour: Random (new stages every time)</option>
              </select>
            </label>
            {random && (
              <>
                <p className="note">
                  A tour of freshly generated stages that nobody has raced before. Tour Points for
                  stage podiums and classifications; jerseys for overall time, sprints and
                  mountains.
                </p>
                <label>
                  Length
                  <select
                    value={randomLength}
                    onChange={(e) => setRandomLength(Number(e.target.value))}
                  >
                    {RANDOM_TOUR_LENGTHS.map((n) => (
                      <option key={n} value={n}>
                        {n} stages
                      </option>
                    ))}
                  </select>
                </label>
                <label
                  className="check"
                  title="A team time trial to open longer tours, individual time trials, long stages with a refresh, and hairpins and roundabouts"
                >
                  <input
                    type="checkbox"
                    checked={randomSpecial}
                    onChange={(e) => setRandomSpecial(e.target.checked)}
                  />
                  Grand Tour stages: time trials, long stages, hairpins and roundabouts
                </label>
                {suggestedRestDays(randomLength).length > 0 && (
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={restDay}
                      onChange={(e) => setRestDay(e.target.checked)}
                    />
                    {restDaysLabel({
                      stages: Array.from({ length: randomLength }),
                      restAfter: suggestedRestDays(randomLength),
                    })}
                  </label>
                )}
              </>
            )}
            {preset && (
              <>
                <p className="note">
                  {preset.description} Tour Points for stage podiums and classifications; jerseys
                  for overall time, sprints and mountains.
                </p>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={restDay}
                    onChange={(e) => setRestDay(e.target.checked)}
                  />
                  {restDaysLabel(preset)}
                </label>
              </>
            )}
            {!preset && !random && (
              <label>
                Stage
                <select value={stageId} onChange={(e) => setStageId(e.target.value)}>
                  {singleStages(stages).map((s) => (
                    <option key={s.id} value={s.id}>
                      {stageLabel(s)}
                    </option>
                  ))}
                  <option value="random">Random stage</option>
                </select>
              </label>
            )}
            <div className="home__row">
              <label>
                Opponents
                <select value={bots} onChange={(e) => setOpponents(Number(e.target.value))}>
                  {[0, 1, 2, 3, 4, 5]
                    .filter((n) => n >= minBots && n <= maxBots)
                    .map((n) => (
                      <option key={n} value={n}>
                        {n === 0 ? 'No bots' : `${n} bot team${n > 1 ? 's' : ''}`}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Bots
                <select value={level} onChange={(e) => setLevel(e.target.value as AiLevel)}>
                  {BOT_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label title="Automatic teams that flip one card a round instead of choosing">
              Automatic teams
              <select
                value={dummies}
                onChange={(e) => setDummies(e.target.value as typeof dummies)}
              >
                <option value="none">None</option>
                <option value="peloton" disabled={teamLimit < 2}>
                  Peloton team
                </option>
                <option value="muscle" disabled={teamLimit < 2}>
                  Muscle team
                </option>
                <option value="both" disabled={teamLimit < 3}>
                  Both
                </option>
              </select>
            </label>
            {limitNote && (
              <p className="note home__limit">
                {limitNote} You plus {teamLimit - 1} more: bots and automatic teams together.
              </p>
            )}
            <label
              className="check"
              title="Each team picks a specialist for each rider; their cards change the decks"
            >
              <input
                type="checkbox"
                checked={specialists}
                onChange={(e) => setSpecialists(e.target.checked)}
              />
              Specialist riders (a draft before the start)
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={weather}
                onChange={(e) => setWeather(e.target.checked)}
              />
              Weather: wind and rain on the straights
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={breakaway}
                onChange={(e) => setBreakaway(e.target.checked)}
              />
              Breakaway bidding before the start
            </label>
            {issues.map((i) => (
              <p key={i} className="note home__issue">
                {i}
              </p>
            ))}
            <div className="home__buttons">
              <button
                className="btn btn--primary btn--big"
                disabled={issues.length > 0}
                onClick={() => {
                  const chosen =
                    stageId === 'random'
                      ? randomStage(1 + opponentSeats.length, breakaway)
                      : stages.find((s) => s.id === stageId)!;
                  startSolo(
                    {
                      stage: chosen,
                      opponents: opponentSeats,
                      breakaway,
                      weather,
                      specialists,
                      ...(tour ? { tour } : {}),
                      ...(random
                        ? {
                            mode: randomTourMode(
                              {
                                seed: newTourSeed(),
                                stages: randomLength,
                                special: randomSpecial,
                                rest: restDay,
                              },
                              1 + opponentSeats.length,
                              breakaway,
                            ),
                          }
                        : {}),
                    },
                    name,
                  );
                }}
              >
                {preset || random ? 'Start the tour' : 'Race solo'}
              </button>
              <button className="btn btn--big" onClick={() => hostOnline(name)}>
                Host a room for friends
              </button>
              <button className="btn btn--quiet" onClick={() => startTutorial(name)}>
                New here? Learn to play
              </button>
            </div>
          </div>
          <div className="home__preview" aria-hidden="true">
            {layout && stage ? (
              <CardArt kind="stage" name={stage.name} layout={layout} width={132} />
            ) : (
              <div className="home__random">?</div>
            )}
          </div>
        </div>
        {saves.length > 0 && (
          <section className="home__saves">
            <h2>Your rooms</h2>
            <ul>
              {(allSaves ? saves : saves.slice(0, SAVES_SHOWN)).map((s) => (
                <li key={s.invite.code}>
                  <span>
                    {s.solo ? 'Solo tour' : 'Room'} <b>{s.invite.code}</b> ·{' '}
                    {s.snapshot.config.mode.kind === 'tour'
                      ? `${tourStages(s.snapshot.config.mode.schedule).length}-stage tour`
                      : s.snapshot.status === 'playing'
                        ? 'race in progress'
                        : s.snapshot.status}{' '}
                    · {s.snapshot.players.length} player{s.snapshot.players.length === 1 ? '' : 's'}
                    <small className="home__saved-at"> · {ago(s.savedAt)}</small>
                  </span>
                  <button
                    className="btn"
                    onClick={() =>
                      s.solo
                        ? resumeSolo(name, { invite: s.invite, snapshot: s.snapshot })
                        : hostOnline(name, { invite: s.invite, snapshot: s.snapshot })
                    }
                  >
                    Resume
                  </button>
                  {s.snapshot.seed && s.snapshot.actions.length > 0 && (
                    <button className="btn" onClick={() => startReplay(s.snapshot, 'home')}>
                      Replay
                    </button>
                  )}
                  <button
                    className="btn btn--quiet"
                    onClick={() => {
                      deleteSavedRoom(s.invite.code);
                      setSaves(listSavedRooms());
                    }}
                  >
                    Forget
                  </button>
                </li>
              ))}
            </ul>
            {saves.length > SAVES_SHOWN && (
              <button className="link-btn home__more" onClick={() => setAllSaves(!allSaves)}>
                {allSaves ? 'Show fewer' : `Show all ${saves.length}`}
              </button>
            )}
            {error && <div className="error">{error}</div>}
          </section>
        )}
        <p className="note">
          Online rooms run in the host’s browser; friends join with the invite link.{' '}
          <button className="link-btn" onClick={() => file.current?.click()}>
            Host from a save file
          </button>{' '}
          ·{' '}
          <a
            href="#rules"
            onClick={(e) => {
              e.preventDefault();
              useRulesPanel.getState().toggle(true);
            }}
          >
            Rules
          </a>{' '}
          ·{' '}
          <a
            href="#settings"
            onClick={(e) => {
              e.preventDefault();
              useSettingsPanel.getState().toggle(true);
            }}
          >
            Settings
          </a>{' '}
          · <a href="#/editor">Track editor</a> · <a href="#/gallery">Art gallery</a>
        </p>
        {importError && <div className="error">{importError}</div>}
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              const parsed = JSON.parse(await f.text()) as {
                invite?: Invite;
                snapshot?: RoomSnapshot;
              };
              if (parsed.snapshot?.version !== 1) throw new Error('not a save');
              hostOnline(name, { invite: parsed.invite ?? newInvite(), snapshot: parsed.snapshot });
            } catch {
              setImportError('That file is not a Tour de Jour save.');
            }
          }}
        />
      </div>
    </main>
  );
}

export function JoinScreen({ invite }: { invite: Invite }) {
  const joinOnline = useRace((s) => s.joinOnline);
  const [name, setName] = useState(() => loadIdentity().name);
  return (
    <main className="home">
      <HomeBanner />
      <div className="home__body">
        <div className="home__intro">
          <h1>Join room {invite.code}</h1>
          <p className="tagline">A friend invited you to a race.</p>
        </div>
        <div className="home__panel home__panel--narrow">
          <form
            className="home__form"
            onSubmit={(e) => {
              e.preventDefault();
              joinOnline(invite, name.trim() || 'Guest');
            }}
          >
            <NameField value={name} onChange={setName} />
            <TeamNamesEditor />
            <button className="btn btn--primary btn--big" type="submit">
              Join the room
            </button>
            <a className="note" href="#/">
              Not now
            </a>
          </form>
        </div>
      </div>
    </main>
  );
}

const SAVES_SHOWN = 5;

/** "today", "yesterday", "5 days ago", then a date. */
function ago(at: number): string {
  const days = Math.floor((Date.now() - at) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function Podium({ order, colorOf }: { order: RiderId[]; colorOf: (id: RiderId) => TeamColor }) {
  // Second, first, third: the winner stands in the middle on the tallest step.
  const steps = [1, 0, 2];
  return (
    <ol className="podium">
      {steps.map((place) => {
        const id = order[place];
        if (!id) return <li key={place} className="podium__col" />;
        return (
          <li key={place} className={`podium__col podium__col--${place + 1}`}>
            <svg className="podium__rider" viewBox="-0.6 -0.6 1.2 1.2" aria-hidden="true">
              <defs>
                <ArtDefs />
              </defs>
              <RiderArt
                team={colorOf(id)}
                type={id.endsWith(':R') ? 'rouleur' : 'sprinteur'}
                heading={-Math.PI / 2}
              />
            </svg>
            <div className="podium__step">{place + 1}</div>
            <div className="podium__who">
              <RiderTag id={id} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Results() {
  const {
    view,
    room,
    me,
    seat,
    session,
    result,
    animating,
    showLobby,
    send,
    leave,
    replayLastRound,
    setShowLobby,
    startSolo,
    replay,
    startReplay,
  } = useRace();
  if (!view || !room || view.phase !== 'stageEnd' || animating || !result || showLobby || replay)
    return null;
  const isHost = room.players.find((p) => p.id === me)?.isHost ?? false;
  const solo = session?.kind === 'solo';
  const book = nameBook(room.config);
  const colorOf = (id: RiderId) =>
    (view.teams.find((t) => t.team === id.split(':')[0])?.color ?? 'red') as TeamColor;
  const winner = result[0]!;
  return (
    <div className="overlay" role="dialog" aria-label="Race results">
      <div className="results">
        <p className="eyebrow results__eyebrow">
          {room.config.mode.kind === 'single' ? room.config.mode.stage.name : ''} · finish
        </p>
        <h2>
          {winner.startsWith(`${seat}:`)
            ? `You win with ${book.rider(winner)}!`
            : `${book.rider(winner)} wins for ${book.team(winner.split(':')[0]!)}`}
        </h2>
        <Podium order={result} colorOf={colorOf} />
        <table className="standings-table results__table">
          <tbody>
            {result.map((id, i) => (
              <tr key={id} className={seat && id.startsWith(`${seat}:`) ? 'mine' : ''}>
                <td className="standings-table__place">{i + 1}</td>
                <td>
                  <RiderTag id={id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="results__actions">
          {solo ? (
            <button
              className="btn btn--primary"
              onClick={() => {
                const stage =
                  room.config.mode.kind === 'single' ? room.config.mode.stage : ORIGINAL_STAGES[0]!;
                startSolo(
                  {
                    stage,
                    opponents: room.config.seats
                      .filter((s) => s.seat !== seat)
                      .map((s) => s.controller),
                    breakaway: room.config.modules.peloton?.breakaway ?? false,
                    weather: room.config.modules.meteo !== undefined,
                    specialists: room.config.modules.grandTour?.specialists ?? false,
                  },
                  '',
                );
              }}
            >
              Race again
            </button>
          ) : isHost ? (
            <>
              <button className="btn btn--primary" onClick={() => send({ type: 'startGame' })}>
                Race again
              </button>
              <button className="btn" onClick={() => setShowLobby(true)}>
                Change setup
              </button>
            </>
          ) : (
            <span className="note">Waiting for the host to start the next race.</span>
          )}
          {session && session.kind !== 'guest' && (
            <button
              className="btn"
              onClick={() => {
                const snap = session.snapshot();
                if (snap) startReplay(snap, 'race');
              }}
            >
              Watch the whole race
            </button>
          )}
          <button className="btn" onClick={replayLastRound}>
            Watch the finish again
          </button>
          <button className="btn btn--quiet" onClick={leave}>
            {solo ? 'Home' : 'Leave room'}
          </button>
        </div>
      </div>
    </div>
  );
}
