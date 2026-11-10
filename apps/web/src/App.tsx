import { useEffect, useState } from 'react';
import { Gallery } from './art/Gallery';
import { Board } from './components/Board';
import { HandPanel } from './components/HandPanel';
import { Lobby } from './components/Lobby';
import { Home, JoinScreen, Results } from './components/Screens';
import { SidePanel } from './components/SidePanel';
import { StageStrip } from './components/StageStrip';
import { useRace } from './game/store';
import { parseInvite } from './net/session';

/** Routes: #/gallery, #/join/CODE/SECRET (invite), otherwise home → lobby → race. */
export function App() {
  const { screen, session, connection, room, showLobby } = useRace();
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

  if (hash === '#/gallery') return <Gallery />;
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
    </div>
  );
}
