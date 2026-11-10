/**
 * Sessions (ADR-0001). One code path for all three ways to play:
 *  - solo:  a Room runs in this tab; the local player talks to it directly.
 *  - host:  the same, and friends connect to it peer-to-peer (WebRTC via Trystero; peers find each
 *           other through public WebTorrent trackers, so there is no server of our own).
 *  - guest: this tab connects to a friend's Room over WebRTC.
 * The UI only ever sees ServerMessages, so it cannot tell solo from online.
 *
 * Secrecy: guests send messages to the host peer only (never broadcast: card ids would leak),
 * and the host sends each peer only that peer's view.
 */
import { Room } from '@velo/host';
import type { RoomSnapshot } from '@velo/host';
import { PROTOCOL_VERSION, ServerEnvelope } from '@velo/protocol';
import type { ClientMessage, ServerMessage, TeamNames } from '@velo/protocol';
import { generateNames } from '@velo/content';
import type { Room as P2PRoom } from '@trystero-p2p/torrent';

const APP_ID = 'tour-de-jour.v1';
const LOCAL = 'local';
const SAVE_PREFIX = 'tdj.room.';

export type ConnectionState = 'connecting' | 'connected' | 'lost';

export interface SessionCallbacks {
  onMessage(msg: ServerMessage): void;
  onConnection(state: ConnectionState): void;
}

export interface Identity {
  token: string;
  name: string;
  /** Names for this player's team and riders (generated at first, editable). */
  profile?: TeamNames;
}

/** This identity's team and rider names, generated from its token until the player picks some. */
export const profileOf = (id: Identity): TeamNames => id.profile ?? generateNames(id.token);

export interface Invite {
  code: string;
  secret: string;
}

// ---------------------------------------------------------------------------
// Identity, invites and saves (guarded: storage can be unavailable)
// ---------------------------------------------------------------------------

export function randomId(length: number, alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
}

/**
 * Identity is per browser. `?player=N` in the URL selects a separate identity, so two people can
 * share one computer (or one person can test with two tabs).
 */
function identityKey(): string {
  try {
    const n = new URLSearchParams(location.search).get('player');
    return n && /^[a-z0-9]{1,8}$/i.test(n) ? `tdj.identity.${n}` : 'tdj.identity';
  } catch {
    return 'tdj.identity';
  }
}

export function loadIdentity(): Identity {
  try {
    const raw = localStorage.getItem(identityKey());
    if (raw) {
      const id = JSON.parse(raw) as Identity;
      if (id.token?.length >= 16) return id;
    }
  } catch {
    // fall through
  }
  const id = { token: randomId(24), name: '' };
  saveIdentity(id);
  return id;
}

export function saveIdentity(id: Identity): void {
  try {
    localStorage.setItem(identityKey(), JSON.stringify(id));
  } catch {
    // identity still works for this tab
  }
}

export function newInvite(): Invite {
  return { code: randomId(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'), secret: randomId(16) };
}

export function inviteLink(invite: Invite): string {
  const base = `${location.origin}${location.pathname}`;
  return `${base}#/join/${invite.code}/${invite.secret}`;
}

export function parseInvite(hash: string): Invite | null {
  const m = /^#\/join\/([A-Z0-9]{4,8})\/([a-z0-9]{8,64})$/.exec(hash);
  return m ? { code: m[1]!, secret: m[2]! } : null;
}

export interface SavedRoom {
  invite: Invite;
  snapshot: RoomSnapshot;
  savedAt: number;
  /** A solo tour: resumes without going online. */
  solo?: boolean;
}

export function listSavedRooms(): SavedRoom[] {
  const out: SavedRoom[] = [];
  let keys: string[] = [];
  try {
    keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? '');
  } catch {
    // no saves available
  }
  for (const key of keys) {
    if (!key.startsWith(SAVE_PREFIX)) continue;
    // One unreadable save must not hide the others.
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as SavedRoom | null;
      if (saved?.snapshot?.version === 1 && saved.invite?.code && saved.snapshot.config)
        out.push(saved);
    } catch {
      // skip this one
    }
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export function deleteSavedRoom(code: string): void {
  try {
    localStorage.removeItem(SAVE_PREFIX + code);
  } catch {
    // nothing to delete
  }
}

function writeSave(invite: Invite, snapshot: RoomSnapshot, solo = false): void {
  try {
    const saved: SavedRoom = { invite, snapshot, savedAt: Date.now(), ...(solo ? { solo } : {}) };
    localStorage.setItem(SAVE_PREFIX + invite.code, JSON.stringify(saved));
  } catch {
    // saving is best effort; the export button still works
  }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface Session {
  readonly kind: 'solo' | 'host' | 'guest';
  readonly invite: Invite | null;
  send(msg: ClientMessage): void;
  /** Hosts only: the current save, for export. */
  snapshot(): RoomSnapshot | null;
  close(): void;
}

const envelope = (msg: ClientMessage) => ({ v: PROTOCOL_VERSION, msg });

/** Dev builds only: expose the WebRTC room for debugging connections. */
function debugExpose(room: P2PRoom) {
  if (import.meta.env?.DEV) (globalThis as { __p2p?: P2PRoom }).__p2p = room;
}

/** Host a Room in this tab: solo (no network) or online (friends join over WebRTC). */
export function hostSession(
  kind: 'solo' | 'host',
  identity: Identity,
  cb: SessionCallbacks,
  restore?: { invite: Invite; snapshot: RoomSnapshot },
): Session {
  const invite = restore?.invite ?? newInvite();
  let p2p: P2PRoom | null = null;
  let p2pSend: ((data: unknown, peer: string) => void) | null = null;
  let closed = false;

  const deliverLocal = (env: { msg: ServerMessage }) => {
    // Async, so the Room never re-enters itself through the UI.
    queueMicrotask(() => {
      if (!closed) cb.onMessage(env.msg);
    });
  };

  const room = new Room(
    invite.code,
    identity.token,
    {
      send: (peer, env) => {
        if (peer === LOCAL) deliverLocal(env);
        else p2pSend?.(env, peer);
      },
      now: () => Date.now(),
      setTimer: (ms, fn) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      random: () => randomId(12),
      // Online rooms always save; solo play saves tours, so a tour can go on another day.
      save: (s: RoomSnapshot) => {
        if (kind === 'host') writeSave(invite, s);
        else if (s.config.mode.kind === 'tour' && s.status !== 'lobby') writeSave(invite, s, true);
      },
      botDelayMs: 220,
    },
    restore ? { ...restore.snapshot, hostToken: identity.token } : undefined,
  );

  if (kind === 'host') {
    // Loaded on demand so solo play (and tests) never touch WebRTC.
    void import('@trystero-p2p/torrent').then(({ joinRoom }) => {
      if (closed) return;
      p2p = joinRoom({ appId: APP_ID, password: invite.secret }, invite.code);
      debugExpose(p2p);
      const msg = p2p.makeAction<never>('msg');
      const hello = p2p.makeAction<boolean>('host');
      p2pSend = (data, peer) => void msg.send(data as never, { target: peer });
      p2p.onPeerJoin = (peer) => void hello.send(true, { target: peer });
      p2p.onPeerLeave = (peer) => room.disconnect(peer);
      msg.onMessage = (data, ctx) => room.receive(ctx.peerId, data);
    });
  }

  cb.onConnection('connected');
  queueMicrotask(() => {
    room.receive(
      LOCAL,
      envelope({
        type: 'join',
        room: invite.code,
        name: identity.name || 'Host',
        token: identity.token,
        profile: profileOf(identity),
      }),
    );
    if (restore) room.resume();
  });

  return {
    kind,
    invite: kind === 'host' ? invite : null,
    send: (m) => room.receive(LOCAL, envelope(m)),
    snapshot: () => room.snapshot(),
    close: () => {
      closed = true;
      room.dispose();
      void p2p?.leave();
    },
  };
}

/** Join a friend's Room over WebRTC. Reconnects automatically when the host reappears. */
export function guestSession(invite: Invite, identity: Identity, cb: SessionCallbacks): Session {
  let p2p: P2PRoom | null = null;
  let sendRaw: ((data: unknown, peer: string) => void) | null = null;
  let host: string | null = null;
  let closed = false;
  cb.onConnection('connecting');

  const sendToHost = (m: ClientMessage) => {
    if (host) sendRaw?.(envelope(m), host);
  };

  void import('@trystero-p2p/torrent').then(({ joinRoom }) => {
    if (closed) return;
    p2p = joinRoom({ appId: APP_ID, password: invite.secret }, invite.code);
    debugExpose(p2p);
    const msg = p2p.makeAction<never>('msg');
    const hello = p2p.makeAction<boolean>('host');
    sendRaw = (data, peer) => void msg.send(data as never, { target: peer });
    hello.onMessage = (_data, ctx) => {
      host = ctx.peerId;
      cb.onConnection('connected');
      sendToHost({
        type: 'join',
        room: invite.code,
        name: identity.name || 'Guest',
        token: identity.token,
        profile: profileOf(identity),
      });
    };
    msg.onMessage = (data, ctx) => {
      if (closed || ctx.peerId !== host) return;
      const parsed = ServerEnvelope.safeParse(data);
      if (parsed.success) cb.onMessage(parsed.data.msg);
    };
    p2p.onPeerLeave = (peer) => {
      if (peer === host) {
        host = null;
        cb.onConnection('lost');
      }
    };
  });

  return {
    kind: 'guest',
    invite,
    send: sendToHost,
    snapshot: () => null,
    close: () => {
      closed = true;
      void p2p?.leave();
    },
  };
}
