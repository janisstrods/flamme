// Online play needs a secure context (WebRTC signalling uses Web Crypto): always use HTTPS.
if (
  location.protocol === 'http:' &&
  !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
) {
  location.replace(
    `https://${location.host}${location.pathname}${location.search}${location.hash}`,
  );
}
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './art/tokens.css';
import './art/art.css';
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
