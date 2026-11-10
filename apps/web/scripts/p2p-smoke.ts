/**
 * End-to-end smoke test of online play over the real internet: one process hosts a room with the
 * app's own session code, another joins as a guest, and both play a full race through public
 * WebTorrent trackers and WebRTC (werift stands in for the browser's RTCPeerConnection).
 *   npx tsx apps/web/scripts/p2p-smoke.ts            (runs host and guest as two processes)
 */
import { spawn } from 'node:child_process';
import { RTCPeerConnection } from 'werift';
import type { ServerMessage } from '@velo/protocol';

(globalThis as { RTCPeerConnection?: unknown }).RTCPeerConnection = RTCPeerConnection;
const { guestSession, hostSession, randomId } = await import('../src/net/session');

const [role, code, secret] = process.argv.slice(2);
const log = (...a: unknown[]) => console.log(`[${role ?? 'main'}]`, ...a);
const DEADLINE = Date.now() + 240_000;

function autoPlay(
  name: string,
  session: { send: (m: never) => void },
  msgs: ServerMessage[],
  done: () => boolean,
) {
  return new Promise<void>((resolve, reject) => {
    const tick = setInterval(() => {
      if (done()) {
        clearInterval(tick);
        resolve();
      } else if (Date.now() > DEADLINE) {
        clearInterval(tick);
        reject(new Error(`${name} timed out`));
      }
    }, 200);
    void msgs;
  });
}

if (!role) {
  // Orchestrator: start the host, read its invite, start the guest.
  const host = spawn(process.execPath, ['--import', 'tsx', process.argv[1]!, 'host'], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  let guestStarted = false;
  let exitCodes = 0;
  const finish = (c: number | null) => {
    exitCodes += c ?? 1;
  };
  host.stdout.on('data', (buf: Buffer) => {
    const text = buf.toString();
    process.stdout.write(text);
    const m = /INVITE (\S+) (\S+)/.exec(text);
    if (m && !guestStarted) {
      guestStarted = true;
      const guest = spawn(
        process.execPath,
        ['--import', 'tsx', process.argv[1]!, 'guest', m[1]!, m[2]!],
        { stdio: ['ignore', 'inherit', 'inherit'] },
      );
      guest.on('exit', (c) => {
        finish(c);
        if (c !== 0) host.kill();
      });
    }
  });
  host.on('exit', (c) => {
    finish(c);
    setTimeout(() => {
      log(exitCodes === 0 ? 'PASS: a full online race finished on both sides' : 'FAIL');
      process.exit(exitCodes === 0 ? 0 : 1);
    }, 500);
  });
} else if (role === 'host') {
  const msgs: ServerMessage[] = [];
  let status = 'lobby';
  let started = false;
  const session = hostSession(
    'host',
    { token: randomId(24), name: 'Host' },
    {
      onMessage: (m) => {
        msgs.push(m);
        if (m.type === 'room' || m.type === 'welcome') {
          status = m.room.status;
          const guestSeated = m.room.players.some((p) => !p.isHost && p.seat === 'seat-1');
          if (guestSeated && !started) {
            started = true;
            log('guest is seated, starting the race');
            session.send({ type: 'startGame' });
          }
        }
        if ((m.type === 'view' || m.type === 'events') && m.legal.length > 0)
          setTimeout(() => session.send({ type: 'intent', action: m.legal[0]! }), 50);
      },
      onConnection: () => {},
    },
  );
  setTimeout(() => session.send({ type: 'takeSeat', seat: 'seat-0' }), 300);
  log(`INVITE ${session.invite!.code} ${session.invite!.secret}`);
  await autoPlay('host', session as never, msgs, () => status === 'finished');
  log('race finished on the host');
  session.close();
  setTimeout(() => process.exit(0), 3000); // let the last messages reach the guest
} else {
  const msgs: ServerMessage[] = [];
  const raws: string[] = [];
  let status = 'lobby';
  let seated = false;
  const t0 = Date.now();
  const session = guestSession(
    { code: code!, secret: secret! },
    { token: randomId(24), name: 'Guest' },
    {
      onMessage: (m) => {
        msgs.push(m);
        raws.push(JSON.stringify(m));
        if (m.type === 'welcome') {
          log(`connected to the host after ${((Date.now() - t0) / 1000).toFixed(1)}s`);
          if (!seated) {
            seated = true;
            session.send({ type: 'takeSeat', seat: 'seat-1' });
          }
        }
        if (m.type === 'room' || m.type === 'welcome') status = m.room.status;
        if ((m.type === 'view' || m.type === 'events') && m.legal.length > 0)
          setTimeout(() => session.send({ type: 'intent', action: m.legal[0]! }), 50);
      },
      onConnection: (c) => log('connection', c),
    },
  );
  await autoPlay('guest', session as never, msgs, () => status === 'finished');
  const leaked = raws
    .flatMap((r) => r.match(/seat-\d:[RS]#\w+/g) ?? [])
    .filter((id) => !id.startsWith('seat-1:'));
  const events = msgs.filter((m) => m.type === 'events').length;
  log(
    `race finished on the guest: ${events} event batches received, ${leaked.length} foreign card ids seen`,
  );
  session.close();
  process.exit(leaked.length === 0 ? 0 : 1);
}
