/**
 * Lobby: the room's invite link, seats (players, bots, open), and the host's setup: stage, number
 * of teams and turn timer. The host starts the race once every seat is filled.
 */
import { ORIGINAL_STAGES, TILE_CATALOG, layoutStage } from '@velo/content';
import { randomBaseStage } from '@velo/engine/testing';
import type { GameConfig, SeatConfig, TeamColor, TurnTimer } from '@velo/protocol';
import { useMemo, useState } from 'react';
import { CardArt } from '../art/Card';
import { Icon } from '../art/Icons';
import { TEAM_COLORS, TEAM_STYLES } from '../art/teams';
import { SEAT_CHOICES, choiceOf, controllerFor, controllerLabel } from '../game/controllers';
import type { SeatChoice } from '../game/controllers';
import { useRace } from '../game/store';
import { inviteLink } from '../net/session';
import { ChatBox } from './Chat';

const SEAT_IDS = ['seat-0', 'seat-1', 'seat-2', 'seat-3'] as const;

export function Lobby() {
  const { room, me, seat, session, connection, send, leave, error, setShowLobby } = useRace();
  const [copied, setCopied] = useState(false);
  const stage = room?.config.mode.kind === 'single' ? room.config.mode.stage : null;
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
    send({ type: 'configure', config: { ...config, ...next } });
  const setSeats = (seats: SeatConfig[]) => configure({ seats });
  const open = config.seats.filter((s) => s.controller.kind === 'open').length;
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
              const color = (s.color ?? TEAM_COLORS[i]) as TeamColor;
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
                    {!who.connected && <span className="badge badge--muted">away</span>}
                  </span>
                  <span className="seat__actions">
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
                disabled={config.seats.length >= 4}
                onClick={() =>
                  setSeats([
                    ...config.seats,
                    {
                      seat: SEAT_IDS[config.seats.length]!,
                      controller: { kind: 'ai', level: 'medium' },
                    },
                  ])
                }
              >
                + Team
              </button>
            </div>
          )}
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
                    Stage
                    <select
                      value={ORIGINAL_STAGES.some((s) => s.id === stage?.id) ? stage?.id : 'random'}
                      onChange={(e) => {
                        const id = e.target.value;
                        const next =
                          id === 'random'
                            ? (() => {
                                const seed = Math.random().toString(36).slice(2, 8);
                                return { ...randomBaseStage(seed), name: `Random stage ${seed}` };
                              })()
                            : ORIGINAL_STAGES.find((s) => s.id === id)!;
                        configure({ mode: { kind: 'single', stage: next } });
                      }}
                    >
                      {ORIGINAL_STAGES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                      <option value="random">Random stage</option>
                    </select>
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
                  {stage?.name}. Turn timer:{' '}
                  {config.options.turnTimer === 'off' ? 'off' : `${config.options.turnTimer} s`}.
                  The host chooses the setup.
                </p>
              )}
            </div>
          </div>
          {isHost ? (
            <button
              className="btn btn--primary btn--big lobby__start"
              disabled={open > 0}
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
          {error && <div className="error">{error}</div>}
          <h3>Chat</h3>
          <ChatBox />
        </section>
      </div>
    </main>
  );
}
