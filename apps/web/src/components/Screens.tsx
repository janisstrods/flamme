/**
 * Home (play solo, host a room, resume or import a saved room), the join screen for invite links,
 * and the results overlay. Illustrated headers use the art components.
 */
import { ORIGINAL_STAGES, TILE_CATALOG, layoutStage } from '@velo/content';
import { randomBaseStage } from '@velo/engine/testing';
import type { RoomSnapshot } from '@velo/host';
import type { RiderId, TeamColor } from '@velo/protocol';
import { useMemo, useRef, useState } from 'react';
import { CardArt } from '../art/Card';
import { RiderArt } from '../art/Rider';
import { ArtDefs } from '../art/TrackArt';
import { riderName } from '../game/narrate';
import { useRace } from '../game/store';
import { deleteSavedRoom, listSavedRooms, loadIdentity, newInvite } from '../net/session';
import type { Invite } from '../net/session';

const newSeed = () => Math.random().toString(36).slice(2, 8);

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
  const { startSolo, hostOnline } = useRace();
  const [name, setName] = useState(() => loadIdentity().name);
  const [stageId, setStageId] = useState(ORIGINAL_STAGES[0]!.id);
  const [opponents, setOpponents] = useState(2);
  const [saves, setSaves] = useState(() => listSavedRooms());
  const [importError, setImportError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const stage = ORIGINAL_STAGES.find((s) => s.id === stageId);
  const layout = useMemo(() => (stage ? layoutStage(stage, TILE_CATALOG) : null), [stage]);
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
            <label>
              Stage
              <select value={stageId} onChange={(e) => setStageId(e.target.value)}>
                {ORIGINAL_STAGES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                <option value="random">Random stage</option>
              </select>
            </label>
            <label>
              Opponents
              <select value={opponents} onChange={(e) => setOpponents(Number(e.target.value))}>
                {[1, 2, 3].map((n) => (
                  <option key={n} value={n}>
                    {n} bot team{n > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="home__buttons">
              <button
                className="btn btn--primary btn--big"
                onClick={() => {
                  const seed = newSeed();
                  const chosen =
                    stageId === 'random'
                      ? { ...randomBaseStage(seed), name: `Random stage ${seed}` }
                      : ORIGINAL_STAGES.find((s) => s.id === stageId)!;
                  startSolo({ stage: chosen, opponents }, name);
                }}
              >
                Race solo
              </button>
              <button className="btn btn--big" onClick={() => hostOnline(name)}>
                Host a room for friends
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
              {saves.map((s) => (
                <li key={s.invite.code}>
                  <span>
                    Room <b>{s.invite.code}</b> ·{' '}
                    {s.snapshot.status === 'playing' ? 'race in progress' : s.snapshot.status} ·{' '}
                    {s.snapshot.players.length} player{s.snapshot.players.length === 1 ? '' : 's'}
                  </span>
                  <button
                    className="btn"
                    onClick={() => hostOnline(name, { invite: s.invite, snapshot: s.snapshot })}
                  >
                    Resume
                  </button>
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
          </section>
        )}
        <p className="note">
          Online rooms run in the host’s browser; friends join with the invite link.{' '}
          <button className="link-btn" onClick={() => file.current?.click()}>
            Host from a save file
          </button>{' '}
          · <a href="#/gallery">Art gallery</a>
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

function Podium({ order, colorOf }: { order: RiderId[]; colorOf: (id: RiderId) => TeamColor }) {
  // [place index, x, drop]: winner in the middle on the tallest step.
  const steps: [number, number, number][] = [
    [0, 1.6, 0],
    [1, 0.6, 1.3],
    [2, 2.6, 1.8],
  ];
  return (
    <svg className="podium" viewBox="0 0 3.2 2.4" aria-hidden="true">
      <defs>
        <ArtDefs />
      </defs>
      {steps.map(([place, x, drop]) => {
        const id = order[place];
        if (!id) return null;
        return (
          <g key={place}>
            <rect
              x={x - 0.45}
              y={0.9 + drop * 0.3}
              width={0.9}
              height={1.5 - drop * 0.3}
              rx={0.06}
              fill={place === 0 ? 'var(--jersey-yellow)' : 'var(--surface-2)'}
            />
            <text className="podium__place" x={x} y={1.55 + drop * 0.3}>
              {place + 1}
            </text>
            <g transform={`translate(${x},${0.55 + drop * 0.3}) scale(0.8)`}>
              <RiderArt
                team={colorOf(id)}
                type={id.endsWith(':R') ? 'rouleur' : 'sprinteur'}
                heading={-Math.PI / 2}
              />
            </g>
          </g>
        );
      })}
    </svg>
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
  } = useRace();
  if (!view || !room || view.phase !== 'stageEnd' || animating || !result || showLobby) return null;
  const isHost = room.players.find((p) => p.id === me)?.isHost ?? false;
  const solo = session?.kind === 'solo';
  const nameOf = (id: RiderId) => {
    const team = id.split(':')[0]!;
    if (team === seat) return riderName(id, team);
    const s = room.config.seats.find((x) => x.seat === team);
    const who =
      s?.controller.kind === 'human'
        ? (room.players.find((p) => s.controller.kind === 'human' && p.id === s.controller.playerId)
            ?.name ?? 'Player')
        : `Bot ${Number(team.slice(5)) + 1}`;
    return `${who}’s ${id.endsWith(':R') ? 'rouleur' : 'sprinteur'}`;
  };
  const colorOf = (id: RiderId) =>
    (view.teams.find((t) => t.team === id.split(':')[0])?.color ?? 'red') as TeamColor;
  const winner = result[0]!;
  return (
    <div className="overlay" role="dialog" aria-label="Race results">
      <div className="results">
        <Podium order={result} colorOf={colorOf} />
        <h2>{winner.startsWith(`${seat}:`) ? 'You win!' : `${nameOf(winner)} wins`}</h2>
        <ol>
          {result.map((id) => (
            <li key={id} className={seat && id.startsWith(`${seat}:`) ? 'mine' : ''}>
              {nameOf(id)}
            </li>
          ))}
        </ol>
        <div className="results__actions">
          {solo ? (
            <button
              className="btn btn--primary"
              onClick={() => {
                const stage =
                  room.config.mode.kind === 'single' ? room.config.mode.stage : ORIGINAL_STAGES[0]!;
                startSolo({ stage, opponents: room.config.seats.length - 1 }, '');
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
