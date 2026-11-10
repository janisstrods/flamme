/**
 * Right panel: stage and round, teams with lock-in status, the event log, and view controls:
 * speed (normal / fast / skip), sound, follow camera and a replay of the last round.
 */
import { viewFor } from '@velo/engine';
import type { TeamColor } from '@velo/protocol';
import { useEffect, useRef } from 'react';
import { Icon } from '../art/Icons';
import { TEAM_STYLES } from '../art/teams';
import { useSettings } from '../game/settings';
import type { Speed } from '../game/settings';
import { HUMAN, useRace } from '../game/store';

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
  const { state, log, setup, goHome, lastRound, animating, replaying, replayLastRound } = useRace();
  const { speed, sound, follow, reducedMotion, setSpeed, setSound, setFollow } = useSettings();
  const logEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'end' });
  }, [log.length]);
  if (!state) return null;
  const view = viewFor(state, HUMAN);
  return (
    <aside className="side-panel">
      <header className="side-panel__head">
        <div>
          <div className="stage-name">{setup?.stage.name}</div>
          <div className="round">
            {state.phase === 'placement'
              ? 'Start grid'
              : state.phase === 'stageEnd'
                ? 'Finished'
                : `Round ${state.round}`}
          </div>
        </div>
        <button className="icon-btn" onClick={goHome} title="Leave race" aria-label="Leave race">
          <Icon name="close" size={18} />
        </button>
      </header>
      <ul className="teams">
        {view.teams.map((t) => (
          <li key={t.team} className={t.status === 'locked' ? 'is-locked' : ''}>
            <span
              className="swatch"
              style={{ background: TEAM_STYLES[t.color as TeamColor].color }}
            />
            {t.team === HUMAN ? 'You' : `Team ${Number(t.team.slice(5)) + 1}`}
            <span className="status">
              {t.status === 'locked' && <Icon name="relentless" size={13} />}
              {STATUS[t.status]}
            </span>
          </li>
        ))}
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
      <div className="log" aria-live="polite">
        {log.map((l) => (
          <div key={l.id} className={l.text.startsWith('Round') ? 'log__round' : ''}>
            {l.text}
          </div>
        ))}
        <div ref={logEnd} />
      </div>
    </aside>
  );
}
