import { Board } from './components/Board';
import { HandPanel } from './components/HandPanel';
import { Home, Results } from './components/Screens';
import { SidePanel } from './components/SidePanel';
import { StageStrip } from './components/StageStrip';
import { useEffect, useState } from 'react';
import { Gallery } from './art/Gallery';
import { useRace } from './game/store';

/** Local races against bots: home, race screen (strip, board, side panel, hand) and results. */
export function App() {
  const screen = useRace((s) => s.screen);
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  if (hash === '#/gallery') return <Gallery />;
  if (screen === 'home') return <Home />;
  return (
    <div className="race">
      <div className="race__board">
        <StageStrip />
        <Board />
      </div>
      <SidePanel />
      <HandPanel />
      <Results />
    </div>
  );
}
