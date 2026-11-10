/** Right panel: teams and their lock-in status, round, and the event log. */
import { viewFor } from '@velo/engine';
import { useEffect, useRef } from 'react';
import { HUMAN, useRace } from '../game/store';

const STATUS: Record<string, string> = {
  idle: '',
  choosingFirst: 'choosing…',
  choosingSecond: 'second rider…',
  locked: 'locked in',
};

export function SidePanel() {
  const { state, log, setup, goHome } = useRace();
  const logEnd = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: 'end' });
  }, [log.length]);
  if (!state) return null;
  const view = viewFor(state, HUMAN);
  return (
    <aside className="side-panel">
      <header>
        <div className="stage-name">{setup?.stage.name}</div>
        <div className="round">
          {state.phase === 'placement' ? 'Start grid' : `Round ${state.round}`}
        </div>
      </header>
      <ul className="teams">
        {view.teams.map((t) => (
          <li key={t.team}>
            <span className={`dot dot--${t.color}`} />
            {t.team === HUMAN ? 'You' : `Team ${Number(t.team.slice(5)) + 1}`}
            <span className="status">{STATUS[t.status]}</span>
          </li>
        ))}
      </ul>
      <div className="log" aria-live="polite">
        {log.map((l) => (
          <div key={l.id} className={l.text.startsWith('Round') ? 'log__round' : ''}>
            {l.text}
          </div>
        ))}
        <div ref={logEnd} />
      </div>
      <button className="btn btn--quiet" onClick={goHome}>
        Leave race
      </button>
    </aside>
  );
}
