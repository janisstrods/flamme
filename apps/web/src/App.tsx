import { Board } from './components/Board';
import { HandPanel } from './components/HandPanel';
import { Home, Results } from './components/Screens';
import { SidePanel } from './components/SidePanel';
import { useRace } from './game/store';

/** M2: local races against bots with placeholder art. The M3 style gate brings the real look. */
export function App() {
  const screen = useRace((s) => s.screen);
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
