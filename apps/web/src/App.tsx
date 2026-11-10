import { Board } from './components/Board';
import { HandPanel } from './components/HandPanel';
import { Home, Results } from './components/Screens';
import { SidePanel } from './components/SidePanel';
import { useEffect, useState } from 'react';
import { Gallery } from './art/Gallery';
import { useRace } from './game/store';

/** M2: local races against bots with placeholder art. The M3 style gate brings the real look. */
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
        <Board />
      </div>
      <SidePanel />
      <HandPanel />
      <Results />
    </div>
  );
}
