/**
 * Lobby: the room's invite link, seats (players, bots, open), and the host's setup: stage, number
 * of teams and turn timer. The host starts the race once every seat is filled.
 */
import {
  ORIGINAL_STAGES,
  TILE_CATALOG,
  TOUR_PRESETS,
  layoutStage,
  tourStages,
} from '@velo/content';
import type { GameConfig, SeatConfig, TurnTimer } from '@velo/protocol';
import { useMemo, useState } from 'react';
import { CardArt } from '../art/Card';
import { Icon } from '../art/Icons';
import { TEAM_STYLES } from '../art/teams';
import { SEAT_CHOICES, choiceOf, controllerFor, controllerLabel } from '../game/controllers';
import type { SeatChoice } from '../game/controllers';
import {
  hasBreakawayTile,
  randomStage,
  setupIssues,
  singleStages,
  stageLabel,
  tourMode,
  withGrandTour,
  withMode,
  withPeloton,
} from '../game/setup';
import { seatColors } from '@velo/engine';
import { useRace } from '../game/store';
import { inviteLink } from '../net/session';
import { allStages } from '../game/customStages';
import { ChatBox } from './Chat';
import { TeamNamesEditor } from './TeamNamesEditor';

const SEAT_IDS = Array.from({ length: 12 }, (_, i) => `seat-${i}`);

export function Lobby() {
  const { room, me, seat, session, connection, send, leave, error, setShowLobby } = useRace();
  const [copied, setCopied] = useState(false);
  const stages = useMemo(() => allStages(), []);
  const mode = room?.config.mode;
  const stage =
    mode?.kind === 'single'
      ? mode.stage
      : mode?.kind === 'tour'
        ? (tourStages(mode.schedule)[0] ?? null)
        : null;
  const layout = useMemo(() => (stage ? layoutStage(stage, TILE_CATALOG) : null), [stage]);

  if (!room) {
    return (
      <main className="lobby lobby--waiting">
        <div className="lobby__card">
          <h2>{connection === 'lost' ? 'Lost the host' : 'Connecting to the host…'}</h2>
          <p className="note">
            {connection === 'lost'
              ? 'The host’s game is not reachable right now. It reconnects by itself when they are back.'
              : 'Looking for your friend’s game. This usually takes a few seconds.'}
          </p>
          <button className="btn" onClick={leave}>
            Back to home
          </button>
        </div>
      </main>
    );
  }

  const isHost = room.players.find((p) => p.id === me)?.isHost ?? false;
  const config = room.config;
  const configure = (next: Partial<GameConfig>) =>
    send({ type: 'configure', config: withPeloton({ ...config, ...next }) });
  const setSeats = (seats: SeatConfig[]) => configure({ seats });
  const breakaway = config.modules.peloton?.breakaway ?? false;
  const oneRider = config.modules.peloton?.oneRiderEach ?? false;
  const maxTeams = oneRider ? 12 : 6;
  const setPeloton = (opts: { breakaway?: boolean; oneRiderEach?: boolean }) =>
    send({
      type: 'configure',
      config: withPeloton(
        {
          ...config,
          seats: config.seats.map((s, i) => ({
            ...s,
            ...(opts.oneRiderEach && !s.singleRider
              ? { singleRider: i % 2 ? ('sprinteur' as const) : ('rouleur' as const) }
              : {}),
          })),
        },
        opts,
      ),
    });
  const open = config.seats.filter((s) => s.controller.kind === 'open').length;
  const tourIds =
    config.mode.kind === 'tour' ? tourStages(config.mode.schedule).map((s) => s.id) : null;
  const currentTour = tourIds
    ? TOUR_PRESETS.find((t) => t.stages.join() === tourIds.join())
    : undefined;
  const hasRest = config.mode.kind === 'tour' && config.mode.schedule.includes('rest');
  const colors = seatColors(config);
  const issues = open > 0 ? [] : setupIssues(config);
  const link = session?.invite ? inviteLink(session.invite) : null;

  const occupant = (s: SeatConfig) => {
    if (s.controller.kind === 'human') {
      const playerId = s.controller.playerId;
      const p = room.players.find((x) => x.id === playerId);
      return {
        label: p ? `${p.name}${p.id === me ? ' (you)' : ''}` : 'Player',
        connected: p?.connected ?? false,
        host: p?.isHost ?? false,
      };
    }
    return { label: controllerLabel(s.controller), connected: true, host: false };
  };

  return (
    <main className="lobby">
      <header className="lobby__head">
        <div>
          <p className="eyebrow">Room {room.room}</p>
          <h1>{isHost ? 'Your room' : 'Waiting room'}</h1>
        </div>
        <div className="lobby__actions">
          {room.status === 'finished' && isHost && (
            <button className="btn" onClick={() => setShowLobby(false)}>
              Back to results
            </button>
          )}
          {session?.kind === 'host' && (
            <button
              className="btn"
              title="A save file lets you, or a friend, host this room again later"
              onClick={() => {
                const snapshot = session.snapshot();
                if (!snapshot || !session.invite) return;
                const blob = new Blob(
                  [JSON.stringify({ invite: session.invite, snapshot }, null, 1)],
                  { type: 'application/json' },
                );
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = `tour-de-jour-${room.room}.json`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
              }}
            >
              Download save
            </button>
          )}
          <button className="btn btn--quiet" onClick={leave}>
            Leave room
          </button>
        </div>
      </header>

      {link && (
        <section className="lobby__invite">
          <div>
            <b>Invite friends</b>
            <p className="note">
              Send this link. Anyone with it can join. Keep this tab open: your browser runs the
              game.
            </p>
          </div>
          <code className="lobby__link">{link}</code>
          <button
            className="btn btn--primary"
            onClick={() => {
              void navigator.clipboard?.writeText(link).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </section>
      )}

      <div className="lobby__grid">
        <section className="lobby__card">
          <h2>Teams</h2>
          <ul className="seats">
            {config.seats.map((s, i) => {
              const who = occupant(s);
              const color = colors[s.seat] ?? 'red';
              const mine = s.controller.kind === 'human' && s.controller.playerId === me;
              return (
                <li key={s.seat} className={`seat${mine ? ' seat--mine' : ''}`}>
                  <span
                    className="swatch swatch--big"
                    style={{ background: TEAM_STYLES[color].color }}
                  />
                  <span className={`seat__who${who.connected ? '' : ' is-away'}`}>
                    {s.controller.kind === 'ai' && <Icon name="settings" size={14} />} {who.label}
                    {who.host && <span className="badge">host</span>}
                    {s.names && (
                      <span className="seat__names">
                        {s.names.team} · {s.names.rouleur}, {s.names.sprinteur}
                      </span>
                    )}
                    {!who.connected && <span className="badge badge--muted">away</span>}
                  </span>
                  <span className="seat__actions">
                    {oneRider && (
                      <select
                        aria-label={`Rider for team ${i + 1}`}
                        value={s.singleRider ?? 'rouleur'}
                        disabled={!isHost || room.status === 'playing'}
                        onChange={(e) =>
                          setSeats(
                            config.seats.map((x) =>
                              x.seat === s.seat
                                ? { ...x, singleRider: e.target.value as 'rouleur' | 'sprinteur' }
                                : x,
                            ),
                          )
                        }
                      >
                        <option value="rouleur">Rouleur</option>
                        <option value="sprinteur">Sprinteur</option>
                      </select>
                    )}
                    {s.controller.kind === 'open' && !mine && (
                      <button
                        className="btn"
                        onClick={() => send({ type: 'takeSeat', seat: s.seat })}
                      >
                        {seat ? 'Switch here' : 'Take seat'}
                      </button>
                    )}
                    {mine && room.status !== 'playing' && (
                      <button
                        className="btn btn--quiet"
                        onClick={() => send({ type: 'leaveSeat' })}
                      >
                        Leave seat
                      </button>
                    )}
                    {isHost && s.controller.kind !== 'human' && (
                      <select
                        aria-label={`Who rides for team ${i + 1}`}
                        value={choiceOf(s.controller) ?? 'open'}
                        disabled={room.status === 'playing' && s.controller.kind === 'dummy'}
                        onChange={(e) =>
                          send({
                            type: 'assignSeat',
                            seat: s.seat,
                            controller: controllerFor(e.target.value as SeatChoice),
                          })
                        }
                      >
                        {SEAT_CHOICES.filter(
                          (c) =>
                            room.status !== 'playing' ||
                            c.value === choiceOf(s.controller) ||
                            (c.value !== 'open' && c.value !== 'peloton' && c.value !== 'muscle'),
                        ).map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {isHost && s.controller.kind === 'human' && !mine && (
                      <button
                        className="btn btn--quiet"
                        onClick={() =>
                          send({
                            type: 'kick',
                            playerId: s.controller.kind === 'human' ? s.controller.playerId : '',
                          })
                        }
                      >
                        Remove
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
          {isHost && (
            <div className="seats__count">
              <button
                className="btn"
                disabled={config.seats.length <= 1}
                onClick={() => setSeats(config.seats.slice(0, -1))}
              >
                − Team
              </button>
              <button
                className="btn"
                disabled={config.seats.length >= maxTeams}
                onClick={() =>
                  setSeats([
                    ...config.seats,
                    {
                      seat: SEAT_IDS[config.seats.length]!,
                      controller: { kind: 'ai', level: 'medium' },
                      ...(oneRider
                        ? {
                            singleRider:
                              config.seats.length % 2
                                ? ('sprinteur' as const)
                                : ('rouleur' as const),
                          }
                        : {}),
                    },
                  ])
                }
              >
                + Team
              </button>
            </div>
          )}
          {seat && <TeamNamesEditor compact />}
          <h3>Players here</h3>
          <ul className="people">
            {room.players.map((p) => (
              <li key={p.id} className={p.connected ? '' : 'is-away'}>
                <span className={`dot${p.connected ? ' dot--on' : ''}`} /> {p.name}
                {p.id === me && ' (you)'}
                {p.isHost && <span className="badge">host</span>}
                {!p.seat && <span className="badge badge--muted">watching</span>}
              </li>
            ))}
          </ul>
        </section>

        <section className="lobby__card">
          <h2>Stage</h2>
          <div className="lobby__stage">
            {layout && stage && (
              <CardArt kind="stage" name={stage.name} layout={layout} width={120} />
            )}
            <div className="lobby__setup">
              {isHost ? (
                <>
                  <label>
                    Play
                    <select
                      value={currentTour?.id ?? 'none'}
                      onChange={(e) => {
                        const t = TOUR_PRESETS.find((x) => x.id === e.target.value);
                        configure(
                          withMode(
                            config,
                            t
                              ? tourMode({ stages: t.stages, restAfter: t.restAfter })
                              : { kind: 'single', stage: ORIGINAL_STAGES[0]! },
                          ),
                        );
                      }}
                    >
                      <option value="none">One stage</option>
                      {TOUR_PRESETS.map((t) => (
                        <option key={t.id} value={t.id}>
                          Tour: {t.name} ({t.stages.length} stages)
                        </option>
                      ))}
                    </select>
                  </label>
                  {currentTour && (
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={hasRest}
                        onChange={(e) =>
                          configure(
                            withMode(
                              config,
                              tourMode({
                                stages: currentTour.stages,
                                restAfter: e.target.checked
                                  ? (currentTour.restAfter ??
                                    Math.ceil(currentTour.stages.length / 2))
                                  : undefined,
                              }),
                            ),
                          )
                        }
                      />
                      Rest day halfway
                    </label>
                  )}
                  <label hidden={mode?.kind === 'tour'}>
                    Stage
                    <select
                      value={stages.some((s) => s.id === stage?.id) ? stage?.id : 'random'}
                      onChange={(e) => {
                        const id = e.target.value;
                        const next =
                          id === 'random'
                            ? randomStage(config.seats.length, breakaway)
                            : stages.find((s) => s.id === id)!;
                        configure({ mode: { kind: 'single', stage: next } });
                      }}
                    >
                      {singleStages(stages).map((s) => (
                        <option key={s.id} value={s.id}>
                          {stageLabel(s)}
                        </option>
                      ))}
                      <option value="random">Random stage</option>
                    </select>
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={breakaway}
                      onChange={(e) => setPeloton({ breakaway: e.target.checked })}
                    />
                    Breakaway bidding
                    {stage && !hasBreakawayTile(stage) && breakaway && (
                      <span className="note"> needs a stage with the breakaway tile</span>
                    )}
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={config.modules.grandTour?.specialists ?? false}
                      onChange={(e) => configure(withGrandTour(config, e.target.checked))}
                    />
                    Specialist riders (draft)
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={config.modules.meteo !== undefined}
                      onChange={(e) => {
                        const modules = { ...config.modules };
                        if (e.target.checked) modules.meteo = {};
                        else delete modules.meteo;
                        configure({ modules });
                      }}
                    />
                    Weather (Meteo)
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={oneRider}
                      onChange={(e) => setPeloton({ oneRiderEach: e.target.checked })}
                    />
                    One rider each (7 to 12 players)
                  </label>
                  <label>
                    Turn timer
                    <select
                      value={String(config.options.turnTimer)}
                      onChange={(e) => {
                        const v = e.target.value;
                        const turnTimer: TurnTimer = v === 'off' ? 'off' : v === '60' ? 60 : 120;
                        configure({ options: { ...config.options, turnTimer } });
                      }}
                    >
                      <option value="off">Off</option>
                      <option value="60">60 seconds</option>
                      <option value="120">120 seconds</option>
                    </select>
                  </label>
                </>
              ) : (
                <p className="note">
                  {currentTour ? `Tour: ${currentTour.name}.` : `${stage?.name}.`}
                  {breakaway ? ' Breakaway bidding.' : ''}
                  {config.modules.meteo ? ' Weather.' : ''}
                  {oneRider ? ' One rider each.' : ''} Turn timer:{' '}
                  {config.options.turnTimer === 'off' ? 'off' : `${config.options.turnTimer} s`}.
                  The host chooses the setup.
                </p>
              )}
            </div>
          </div>
          {isHost ? (
            <button
              className="btn btn--primary btn--big lobby__start"
              disabled={open > 0 || issues.length > 0}
              onClick={() => send({ type: 'startGame' })}
            >
              {open > 0
                ? `Fill ${open} open seat${open > 1 ? 's' : ''} to start`
                : room.status === 'finished'
                  ? 'Start the next race'
                  : 'Start the race'}
            </button>
          ) : (
            <p className="note lobby__start">Waiting for the host to start the race.</p>
          )}
          {issues.map((i) => (
            <p key={i} className="note lobby__issue">
              {i}
            </p>
          ))}
          {error && <div className="error">{error}</div>}
          <h3>Chat</h3>
          <ChatBox />
        </section>
      </div>
    </main>
  );
}
