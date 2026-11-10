import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Dev builds only: expose the store for debugging and scripted play-throughs.
if (import.meta.env.DEV) {
  void import('./game/store').then(({ useRace }) => {
    (window as unknown as { __race: typeof useRace }).__race = useRace;
  });
}
