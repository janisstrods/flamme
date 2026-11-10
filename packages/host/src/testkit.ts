/** Test helpers: a fake clock/scheduler and in-memory clients wired to a Room. */
import { PROTOCOL_VERSION } from '@velo/protocol';
import type { Action, ClientMessage, GameView, ServerMessage } from '@velo/protocol';
import { Room } from './room';
import type { HostDeps, RoomSnapshot } from './room';

export class FakeClock {
  t = 0;
  private timers: { at: number; fn: () => void; id: number }[] = [];
  private nextId = 1;
  setTimer = (ms: number, fn: () => void) => {
    const id = this.nextId++;
    this.timers.push({ at: this.t + ms, fn, id });
    return id;
  };
  clearTimer = (id: unknown) => {
    this.timers = this.timers.filter((x) => x.id !== id);
  };
  /** Advance time, running due timers in order (including ones they schedule). */
  advance(ms: number) {
    const end = this.t + ms;
    for (;;) {
      this.timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const next = this.timers[0];
      if (!next || next.at > end) break;
      this.timers.shift();
      this.t = next.at;
      next.fn();
    }
    this.t = end;
  }
}

export class TestClient {
  inbox: ServerMessage[] = [];
  raw: string[] = [];
  view: GameView | null = null;
  legal: Action[] = [];
  playerId: string | null = null;
  constructor(
    readonly peer: string,
    readonly token: string,
    readonly room: Room,
  ) {}
  receive(env: { v: number; msg: ServerMessage }) {
    this.raw.push(JSON.stringify(env));
    this.inbox.push(env.msg);
    if (env.msg.type === 'view' || env.msg.type === 'events') {
      this.view = env.msg.view;
      this.legal = env.msg.legal;
    }
    if (env.msg.type === 'welcome') this.playerId = env.msg.playerId;
  }
  send(msg: ClientMessage) {
    this.room.receive(this.peer, { v: PROTOCOL_VERSION, msg });
  }
  join(name = this.peer) {
    this.send({ type: 'join', room: this.room.code, name, token: this.token });
  }
  errors() {
    return this.inbox.filter(
      (m): m is Extract<ServerMessage, { type: 'error' }> => m.type === 'error',
    );
  }
}

let counter = 0;
export function setup(snapshot?: RoomSnapshot, opts: { code?: string; hostToken?: string } = {}) {
  const clock = new FakeClock();
  const clients = new Map<string, TestClient>();
  const saves: RoomSnapshot[] = [];
  const deps: HostDeps = {
    send: (peer, msg) => clients.get(peer)?.receive(msg),
    now: () => clock.t,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
    random: () => `r${++counter}`,
    save: (s) => saves.push(s),
    botDelayMs: 100,
  };
  const room = new Room(
    opts.code ?? 'ROOM1',
    opts.hostToken ?? 'host-token-0000000',
    deps,
    snapshot,
  );
  const client = (peer: string, token: string) => {
    const c = new TestClient(peer, token, room);
    clients.set(peer, c);
    return c;
  };
  return { room, clock, client, saves, clients };
}
