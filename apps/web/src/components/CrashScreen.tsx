/**
 * Catches a crash while drawing the app and shows what went wrong, instead of a blank page.
 * The details can be copied from a phone, where there is no console to read.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { useRace } from '../game/store';

/** Errors outside rendering (timers, promises), kept so the crash details can include them. */
const earlier: string[] = [];
const remember = (text: string) => {
  earlier.push(text);
  if (earlier.length > 5) earlier.shift();
};
window.addEventListener('error', (e) =>
  remember(e.error instanceof Error ? (e.error.stack ?? e.error.message) : e.message),
);
window.addEventListener('unhandledrejection', (e) =>
  remember(e.reason instanceof Error ? (e.reason.stack ?? e.reason.message) : String(e.reason)),
);

/** Where the game was when it crashed: enough to find the stage and the moment. */
function gameState(): string {
  try {
    const { screen, session, room, view, track, queue, animating, replay, legal } =
      useRace.getState();
    const mode = room?.config.mode;
    return JSON.stringify(
      {
        screen,
        session: session?.kind ?? null,
        mode: mode?.kind ?? null,
        stages:
          mode?.kind === 'tour' ? mode.schedule.filter((s) => s !== 'rest').length : undefined,
        modules: room ? Object.keys(room.config.modules) : [],
        seats: room?.config.seats.length ?? 0,
        phase: view?.phase ?? null,
        stageNumber: view?.stageNumber ?? null,
        round: view?.round ?? null,
        trackStage: track?.stageId ?? null,
        queued: queue.length,
        animating,
        replay: replay !== null,
        legal: [...new Set(legal.map((a) => a.type))],
      },
      null,
      1,
    );
  } catch (err) {
    return `unavailable (${String(err)})`;
  }
}

interface State {
  details: string | null;
  copied: boolean;
}

export class CrashScreen extends Component<{ children: ReactNode }, State> {
  override state: State = { details: null, copied: false };

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    const stack = error instanceof Error ? (error.stack ?? error.message) : String(error);
    this.setState({
      details: [
        stack,
        `Components:${info.componentStack ?? ' unknown'}`,
        `Game: ${gameState()}`,
        earlier.length > 0 ? `Earlier errors:\n${earlier.join('\n')}` : '',
        `Page: ${location.pathname}${location.hash.split('/').slice(0, 2).join('/')}`,
        `Browser: ${navigator.userAgent}`,
        `Window: ${window.innerWidth}×${window.innerHeight}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    });
  }

  static getDerivedStateFromError(): Partial<State> {
    return { details: 'Collecting details…' };
  }

  override render() {
    const { details, copied } = this.state;
    if (details === null) return this.props.children;
    const copy = () => {
      void navigator.clipboard
        ?.writeText(details)
        .then(() => this.setState({ copied: true }))
        .catch(() => undefined);
    };
    return (
      <main className="crash">
        <h1>Something broke</h1>
        <p className="note">
          The game hit an error and could not draw this screen. Reload to get back in; a tour can be
          picked up again with Resume. The details below say what went wrong.
        </p>
        <div className="results__actions">
          <button className="btn btn--primary" onClick={() => location.reload()}>
            Reload
          </button>
          <button className="btn btn--quiet" onClick={copy}>
            {copied ? 'Copied' : 'Copy details'}
          </button>
        </div>
        <pre className="crash__details">{details}</pre>
      </main>
    );
  }
}
