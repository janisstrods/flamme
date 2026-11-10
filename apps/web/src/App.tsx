import { PROTOCOL_VERSION } from '@velo/protocol';

/** M0 placeholder. M2 replaces this with the board; M3 brings the real art. */
export function App() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32 }}>
      <h1>Velo</h1>
      <p>Working title. Foundations only: the playable board arrives in M2.</p>
      <p style={{ color: '#666' }}>Protocol v{PROTOCOL_VERSION}</p>
    </main>
  );
}
