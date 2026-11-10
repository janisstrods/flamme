import { Suspense, lazy, useEffect, useState } from 'react';

import { Board } from './components/Board';
import { Coach } from './components/Coach';
import { ReplayBar } from './components/ReplayBar';
import { HandPanel } from './components/HandPanel';
import { Lobby } from './components/Lobby';
import { Home, JoinScreen, Results } from './components/Screens';
import { SidePanel } from './components/SidePanel';
import { SpecialScreens } from './components/SpecialScreens';
import { StageStrip } from './components/StageStrip';
import { TourScreens } from './components/TourScreens';
import { useRace } from './game/store';
import { RulesPanel } from './rules/RulesPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { parseInvite } from './net/session';

// Rarely used pages load on demand, keeping the race itself light.
const Gallery = lazy(() => import('./art/Gallery').then((m) => ({ default: m.Gallery })));
const Editor = lazy(() => import('./editor/Editor').then((m) => ({ default: m.Editor })));

/** Routes: #/gallery, #/join/CODE/SECRET (invite), otherwise home → lobby → race. */
export function App() {
  const session = useRace((s) => s.session);
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Hosts run the game: warn before closing the tab while friends are connected.
  useEffect(() => {
    if (session?.kind !== 'host') return;
    const onUnload = (e: BeforeUnloadEvent) => {
      if ((useRace.getState().room?.players.filter((p) => p.connected).length ?? 0) > 1)
        e.preventDefault();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [session]);

  if (hash === '#/gallery' || hash === '#/editor')
    return (
      <Suspense fallback={<p className="note loading">Loading…</p>}>
        {hash === '#/gallery' ? <Gallery /> : <Editor />}
      </Suspense>
    );
  return (
    <>
      <Screen hash={hash} />
      <RulesPanel />
      <SettingsPanel />
    </>
  );
}

function Screen({ hash }: { hash: string }) {
  const { screen, session, connection, room, showLobby } = useRace();
  if (screen === 'home') {
    const invite = parseInvite(hash);
    return invite ? <JoinScreen invite={invite} /> : <Home />;
  }
  if (screen === 'lobby' || (showLobby && room?.status === 'finished')) return <Lobby />;
  return (
    <div className="race">
      <div className="race__board">
        <StageStrip />
        <Board />
        {session?.kind === 'guest' && connection === 'lost' && (
          <div className="banner" role="status">
            Lost the connection to the host. Your seat and cards are kept; reconnecting when they
            are back…
          </div>
        )}
      </div>
      <SidePanel />
      <HandPanel />
      <Results />
      <TourScreens />
      <Coach />
      <ReplayBar />
      <SpecialScreens />
    </div>
  );
}
