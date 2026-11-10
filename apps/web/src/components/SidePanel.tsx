/**
 * Right panel: stage and round, teams with lock-in status and who plays them, view controls
 * (speed, sound, follow camera, replay), and the race log or, online, the chat.
 */
import type { TeamColor } from '@velo/protocol';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../art/Icons';
import { TEAM_STYLES } from '../art/teams';
import { controllerLabel } from '../game/controllers';
import { useSettings } from '../game/settings';
import type { Speed } from '../game/settings';
import { useRace } from '../game/store';
import { ChatBox } from './Chat';

const STATUS: Record<string, string> = {
  idle: '',
  choosingFirst: 'choosing',
  choosingSecond: 'second rider',
  locked: 'locked in',
};

const SPEEDS: [Speed, string][] = [
  ['normal', 'Normal'],
  ['fast', 'Fast'],
  ['skip', 'Skip'],
];

export function SidePanel() {
  const {
    view,
    room,
    seat,
    session,
    log,
    chat,
    leave,
    lastRound,
    animating,
    replaying,
    replayLastRound,
  } = useRace();
  const { speed, sound, follow, reducedMotion, setSpeed, setSound, setFollow } = useSettings();
  const online = session?.kind !== 'solo';
  const [tab, setTab] = useState<'log' | 'chat'>('log');
  const [seenChat, setSeenChat] = useState(0);
  const logEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'end' });
  }, [log.length, tab]);
  useEffect(() => {
    if (tab === 'chat') setSeenChat(chat.length);
  }, [tab, chat.length]);
  if (!view || !room) return <aside className="side-panel" />;
  const stage = room.config.mode.kind === 'single' ? room.config.mode.stage.name : '';
  const playerFor = (team: string) => {
    const s = room.config.seats.find((x) => x.seat === team);
    if (s?.controller.kind === 'human') {
      const playerId = s.controller.playerId;
      const p = room.players.find((x) => x.id === playerId);
      return { name: p?.name ?? 'Player', connected: p?.connected ?? false };
    }
    return { name: s ? controllerLabel(s.controller) : 'Bot', connected: true };
  };
  const unread = chat.length - seenChat;
  return (
    <aside className="side-panel">
      <header className="side-panel__head">
        <div>
          <div className="stage-name">{stage}</div>
          <div className="round">
            {view.phase === 'placement'
              ? 'Start grid'
              : view.phase === 'stageEnd'
                ? 'Finished'
                : `Round ${view.round}`}
            {online && session?.invite && (
              <span className="room-code"> · Room {session.invite.code}</span>
            )}
          </div>
        </div>
        <button className="icon-btn" onClick={leave} title="Leave race" aria-label="Leave race">
          <Icon name="close" size={18} />
        </button>
      </header>
      <ul className="teams">
        {view.teams.map((t) => {
          const who = playerFor(t.team);
          return (
            <li key={t.team} className={t.status === 'locked' ? 'is-locked' : ''}>
              <span
                className="swatch"
                style={{ background: TEAM_STYLES[t.color as TeamColor].color }}
              />
              <span className={`teams__name${who.connected ? '' : ' is-away'}`}>
                {t.team === seat ? 'You' : who.name}
                {!who.connected && ' (away)'}
              </span>
              <span className="status">
                {t.status === 'locked' && <Icon name="relentless" size={13} />}
                {STATUS[t.status]}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="controls-row">
        <div className="segmented" role="radiogroup" aria-label="Animation speed">
          {SPEEDS.map(([s, label]) => (
            <button
              key={s}
              role="radio"
              aria-checked={speed === s}
              className={speed === s ? 'is-on' : ''}
              onClick={() => setSpeed(s)}
              disabled={reducedMotion}
              title={reducedMotion ? 'Your system asks for reduced motion' : undefined}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          className={`icon-btn${sound ? ' is-on' : ''}`}
          onClick={() => setSound(!sound)}
          aria-pressed={sound}
          title="Sound"
        >
          <Icon name={sound ? 'sound' : 'soundOff'} size={18} />
        </button>
        <button
          className={`icon-btn${follow ? ' is-on' : ''}`}
          onClick={() => setFollow(!follow)}
          aria-pressed={follow}
          title="Follow camera (Space)"
        >
          <Icon name="follow" size={18} />
        </button>
      </div>
      <button
        className="btn btn--quiet"
        disabled={!lastRound || animating}
        onClick={replayLastRound}
      >
        <Icon name="refresh" size={14} /> {replaying ? 'Replaying…' : 'Replay last round'}
      </button>
      {online && (
        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'log'}
            className={tab === 'log' ? 'is-on' : ''}
            onClick={() => setTab('log')}
          >
            Race log
          </button>
          <button
            role="tab"
            aria-selected={tab === 'chat'}
            className={tab === 'chat' ? 'is-on' : ''}
            onClick={() => setTab('chat')}
          >
            Chat{unread > 0 && tab !== 'chat' ? ` (${unread})` : ''}
          </button>
        </div>
      )}
      {tab === 'log' || !online ? (
        <div className="log" aria-live="polite">
          {log.map((l) => (
            <div key={l.id} className={l.text.startsWith('Round') ? 'log__round' : ''}>
              {l.text}
            </div>
          ))}
          <div ref={logEnd} />
        </div>
      ) : (
        <ChatBox />
      )}
    </aside>
  );
}
