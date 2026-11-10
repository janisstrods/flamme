/**
 * Client store: driven only by ServerMessages from the session (solo, host or guest), so the UI
 * sees exactly what a guest would: the room, this player's redacted view, legal actions and the
 * public event stream. Events go through an animation queue so players can follow cause and
 * effect; the board shows `display` positions, which catch up with the view as the queue plays.
 */
import { TILE_CATALOG, applyWeather, compileStage, layoutStage } from '@velo/content';
import type { StageDefinition, StageLayout, TrackGraph } from '@velo/content';
import type { RoomSnapshot } from '@velo/host';
import type {
  Action,
  ClientMessage,
  GameConfig,
  GameEvent,
  GameView,
  Position,
  PublicCard,
  RiderId,
  RoomState,
  SeatConfig,
  SeatId,
  ServerMessage,
} from '@velo/protocol';
import { create } from 'zustand';
import { guestSession, hostSession, loadIdentity, saveIdentity } from '../net/session';
import type { ConnectionState, Invite, Session } from '../net/session';
import { narrate } from './narrate';
import { withPeloton } from './setup';
import { timeScale } from './settings';
import {
  playBell,
  playCrash,
  playCrowd,
  playFlip,
  playTired,
  playWhirr,
  playWhoosh,
} from './sound';

const STEP_MS = 170;

export interface LogLine {
  id: number;
  text: string;
  round: number;
}

export interface ChatLine {
  id: number;
  playerId: string;
  name: string;
  text: string;
}

/** Short-lived visual effects on riders; `key` changes restart CSS animations. */
export interface RiderEffect {
  kind: 'slipstream' | 'tired' | 'bump' | 'crash';
  key: number;
}

type Display = Record<RiderId, Position | null>;

interface QueuedEvent {
  event: GameEvent;
  replay: boolean;
}

export interface SoloSetup {
  stage: StageDefinition;
  /** Who the other seats are: bots by level, or dummy teams. */
  opponents: SeatConfig['controller'][];
  /** Peloton breakaway bidding before the start. */
  breakaway?: boolean;
  /** Meteo weather, drawn at random when the race starts. */
  weather?: boolean;
}

interface RaceStore {
  screen: 'home' | 'lobby' | 'race';
  session: Session | null;
  connection: ConnectionState;
  room: RoomState | null;
  me: string | null;
  /** The seat this player holds in the current race, if any. */
  seat: SeatId | null;
  view: GameView | null;
  legal: Action[];
  track: TrackGraph | null;
  layout: StageLayout | null;
  display: Display;
  /** Riders shown lying down: follows the animation (crashes, standing up), like `display`. */
  downed: Record<RiderId, boolean>;
  moveMs: Record<RiderId, number>;
  effects: Record<RiderId, RiderEffect>;
  queue: QueuedEvent[];
  animating: boolean;
  replaying: boolean;
  revealed: Record<RiderId, PublicCard> | null;
  lastRound: { display: Display; downed: Record<RiderId, boolean>; events: GameEvent[] } | null;
  result: RiderId[] | null;
  log: LogLine[];
  chat: ChatLine[];
  selectedCard: string | null;
  hoverCard: string | null;
  placingRider: RiderId | null;
  focus: { square: string; key: number } | null;
  error: string | null;
  /** True while a host looks at the setup between races. */
  showLobby: boolean;

  startSolo(setup: SoloSetup, name: string): void;
  hostOnline(name: string, restore?: { invite: Invite; snapshot: RoomSnapshot }): void;
  joinOnline(invite: Invite, name: string): void;
  leave(): void;
  send(msg: ClientMessage): void;
  act(action: Action): void;
  replayLastRound(): void;
  select(card: string | null): void;
  hover(card: string | null): void;
  choosePlacingRider(rider: RiderId | null): void;
  focusSquare(square: string): void;
  setShowLobby(on: boolean): void;
}

let logId = 0;
let effectKey = 0;
let soloSetup: SoloSetup | null = null;

const displayFrom = (view: GameView): Display =>
  Object.fromEntries(view.riders.map((r) => [r.id, r.position && { ...r.position }]));
const downedFrom = (view: GameView): Record<RiderId, boolean> =>
  Object.fromEntries(view.riders.map((r) => [r.id, r.crashed]));

/** The compiled stage without weather, and the weather last laid on it (Meteo). */
let baseTrack: TrackGraph | null = null;
let weatherKey = '';

const playerName = (room: RoomState | null, id: string) =>
  room?.players.find((p) => p.id === id)?.name ?? 'Someone';

export const useRace = create<RaceStore>((set, get) => {
  const effect = (rider: RiderId, kind: RiderEffect['kind']) =>
    set((s) => ({ effects: { ...s.effects, [rider]: { kind, key: effectKey++ } } }));

  /** Push events into the animation queue (and the log), then start playing them. */
  const enqueue = (events: GameEvent[], replay = false) => {
    if (!replay) {
      const seat = get().seat ?? '';
      const round = get().view?.round ?? 0;
      const lines = events
        .map((e) => narrate(e, seat))
        .filter((t): t is string => t !== null)
        .map((text) => ({ id: logId++, text, round }));
      if (events.some((e) => e.type === 'cardsRevealed'))
        set({ lastRound: { display: { ...get().display }, downed: { ...get().downed }, events } });
      const ended = events.find((e) => e.type === 'stageEnded');
      set((s) => ({
        log: [...s.log, ...lines].slice(-300),
        ...(ended?.type === 'stageEnded' ? { result: ended.order } : {}),
      }));
    }
    set((s) => ({ queue: [...s.queue, ...events.map((event) => ({ event, replay }))] }));
    if (!get().animating) pump();
  };

  /** Play the next queued event, then schedule the one after it. */
  const pump = (): void => {
    const [item, ...rest] = get().queue;
    if (!item) {
      const view = get().view;
      set({
        animating: false,
        replaying: false,
        ...(view ? { display: displayFrom(view), downed: downedFrom(view) } : {}),
      });
      return;
    }
    const k = timeScale();
    set({ animating: true, queue: rest, replaying: item.replay });
    const next = (ms: number): void => {
      if (k === 0) pump();
      else setTimeout(pump, ms * k);
    };
    const ev = item.event;
    const moveTo = (rider: RiderId, pos: Position, ms: number) =>
      set((s) => ({
        display: { ...s.display, [rider]: pos },
        moveMs: { ...s.moveMs, [rider]: ms * k },
      }));

    switch (ev.type) {
      case 'riderPlaced':
        moveTo(ev.rider, ev.at, 220);
        return next(240);
      case 'cardsRevealed':
        set({ revealed: Object.fromEntries(ev.plays.map((p) => [p.rider, p.card])) });
        playFlip();
        return next(1000);
      case 'breakawayRevealed':
        set({ revealed: Object.fromEntries(ev.bids.map((b) => [b.rider, b.card])) });
        playFlip();
        return next(1200);
      case 'breakawayWon':
        set({ revealed: null });
        if (ev.riders.length > 0) playCrowd();
        return next(300);
      case 'riderMoved': {
        set((s) => ({ downed: { ...s.downed, [ev.rider]: false } }));
        if (k === 0) {
          moveTo(ev.rider, ev.to, 0);
          return next(0);
        }
        const steps = ev.path.map((sq, i) =>
          i === ev.path.length - 1 ? ev.to : { square: sq, lane: ev.to.lane },
        );
        if (steps.length > 0) playWhirr((steps.length * STEP_MS * k) / 1000);
        let i = 0;
        const step = () => {
          const pos = steps[i++];
          if (!pos) {
            if (ev.blocked) effect(ev.rider, 'bump');
            return next(ev.blocked ? 320 : 120);
          }
          moveTo(ev.rider, pos, STEP_MS);
          setTimeout(step, STEP_MS * k);
        };
        return step();
      }
      case 'slipstream':
        set((s) => {
          const display = { ...s.display };
          const moveMs = { ...s.moveMs };
          for (const m of ev.moves) {
            display[m.rider] = m.to;
            moveMs[m.rider] = 480 * k;
          }
          return { display, moveMs };
        });
        for (const m of ev.moves) effect(m.rider, 'slipstream');
        playWhoosh();
        return next(600);
      case 'riderShifted':
        moveTo(ev.rider, ev.to, 260);
        return next(300);
      case 'riderCrashed':
        set((s) => ({
          downed: { ...s.downed, ...Object.fromEntries(ev.riders.map((id) => [id, true])) },
        }));
        for (const id of ev.riders) effect(id, 'crash');
        playCrash();
        return next(700);
      case 'exhaustionTaken':
        effect(ev.rider, 'tired');
        playTired();
        return next(380);
      case 'riderFinished':
        if (ev.place === 1) {
          playBell();
          playCrowd();
        }
        return next(ev.place === 1 ? 700 : 150);
      case 'phaseChanged':
        if (ev.phase === 'energy') set({ revealed: null });
        return next(ev.phase === 'end' ? 250 : 0);
      default:
        return next(0);
    }
  };

  /** Recompile the track when the room's stage changes. */
  const syncStage = (room: RoomState) => {
    if (room.config.mode.kind === 'tour') return;
    const stage = room.config.mode.stage;
    if (get().track?.stageId === stage.id && get().layout) return;
    baseTrack = compileStage(stage, TILE_CATALOG);
    weatherKey = '';
    set({ track: baseTrack, layout: layoutStage(stage, TILE_CATALOG) });
  };

  /** Lay the view's weather on the track, so previews and art see it (Meteo). */
  const syncWeather = (view: GameView) => {
    const key = JSON.stringify(view.weather);
    if (!baseTrack || key === weatherKey) return;
    weatherKey = key;
    set({ track: applyWeather(baseTrack, view.weather) });
  };

  const seatOf = (room: RoomState | null, me: string | null): SeatId | null =>
    room?.players.find((p) => p.id === me)?.seat ?? null;

  /** Solo sessions set themselves up as soon as the room welcomes the local player. */
  const soloAutoStart = (room: RoomState) => {
    const setup = soloSetup;
    if (!setup || get().session?.kind !== 'solo' || room.status !== 'lobby') return;
    soloSetup = null;
    const send = get().send;
    const config: GameConfig = withPeloton(
      {
        ...room.config,
        modules: setup.weather ? { meteo: {} } : {},
        mode: { kind: 'single', stage: setup.stage },
        seats: [{ kind: 'open' as const }, ...setup.opponents].map((controller, i) => ({
          seat: `seat-${i}`,
          controller,
        })),
      },
      { breakaway: setup.breakaway ?? false, oneRiderEach: false },
    );
    send({ type: 'configure', config });
    send({ type: 'takeSeat', seat: 'seat-0' });
    send({ type: 'startGame' });
  };

  const onMessage = (msg: ServerMessage) => {
    switch (msg.type) {
      case 'welcome':
        set({ me: msg.playerId, room: msg.room, seat: seatOf(msg.room, msg.playerId) });
        syncStage(msg.room);
        set({
          screen: msg.room.status === 'lobby' && get().session?.kind !== 'solo' ? 'lobby' : 'race',
        });
        soloAutoStart(msg.room);
        return;
      case 'room': {
        const prev = get().room;
        syncStage(msg.room);
        const starting = prev?.status !== 'playing' && msg.room.status === 'playing';
        const solo = get().session?.kind === 'solo';
        set({
          room: msg.room,
          seat: seatOf(msg.room, get().me),
          screen: msg.room.status === 'lobby' && !solo ? 'lobby' : 'race',
          ...(starting
            ? {
                result: null,
                log: [],
                lastRound: null,
                revealed: null,
                queue: [],
                effects: {},
                downed: {},
                showLobby: false,
              }
            : {}),
        });
        return;
      }
      case 'view':
        syncWeather(msg.view);
        set({ view: msg.view, legal: msg.legal });
        if (!get().animating && get().queue.length === 0)
          set({ display: displayFrom(msg.view), downed: downedFrom(msg.view) });
        return;
      case 'events':
        syncWeather(msg.view);
        set({ view: msg.view, legal: msg.legal, selectedCard: null, hoverCard: null });
        enqueue(msg.events);
        return;
      case 'chat':
        set((s) => ({
          chat: [
            ...s.chat,
            {
              id: logId++,
              playerId: msg.playerId,
              name: playerName(s.room, msg.playerId),
              text: msg.text,
            },
          ].slice(-100),
        }));
        return;
      case 'presence':
      case 'emote':
        return;
      case 'error':
        set({ error: msg.message });
        if (msg.code === 'KICKED') get().leave();
        return;
    }
  };

  const callbacks = {
    onMessage,
    onConnection: (connection: ConnectionState) => set({ connection }),
  };

  const reset = {
    room: null,
    me: null,
    seat: null,
    view: null,
    legal: [],
    display: {},
    moveMs: {},
    effects: {},
    downed: {},
    queue: [],
    animating: false,
    replaying: false,
    revealed: null,
    lastRound: null,
    result: null,
    log: [],
    chat: [],
    selectedCard: null,
    hoverCard: null,
    placingRider: null,
    focus: null,
    error: null,
    showLobby: false,
  } satisfies Partial<RaceStore>;

  const withName = (name: string) => {
    const identity = loadIdentity();
    if (name && name !== identity.name) saveIdentity({ ...identity, name });
    return { ...identity, name: name || identity.name };
  };

  return {
    screen: 'home',
    session: null,
    connection: 'connected',
    track: null,
    layout: null,
    ...reset,

    startSolo(setup, name) {
      get().session?.close();
      soloSetup = setup;
      set({ ...reset, screen: 'race', track: null, layout: null });
      set({ session: hostSession('solo', withName(name), callbacks) });
    },

    hostOnline(name, restore) {
      get().session?.close();
      soloSetup = null;
      set({ ...reset, screen: 'lobby', track: null, layout: null });
      set({ session: hostSession('host', withName(name), callbacks, restore) });
    },

    joinOnline(invite, name) {
      get().session?.close();
      soloSetup = null;
      set({ ...reset, screen: 'lobby', track: null, layout: null });
      set({ session: guestSession(invite, withName(name), callbacks) });
    },

    leave() {
      get().session?.close();
      set({ ...reset, session: null, screen: 'home', connection: 'connected' });
      if (typeof location !== 'undefined' && location.hash.startsWith('#/join/'))
        history.replaceState(null, '', location.pathname);
    },

    send(msg) {
      get().session?.send(msg);
    },

    act(action) {
      get().session?.send({ type: 'intent', action });
      set({
        selectedCard: null,
        hoverCard: null,
        ...(action.type === 'placeRider' ? { placingRider: null } : {}),
      });
    },

    replayLastRound() {
      const { lastRound, animating } = get();
      if (!lastRound || animating) return;
      set({ display: { ...lastRound.display }, downed: { ...lastRound.downed }, moveMs: {} });
      enqueue(lastRound.events, true);
    },

    select: (card) => set({ selectedCard: card }),
    hover: (card) => set({ hoverCard: card }),
    choosePlacingRider: (rider) => set({ placingRider: rider }),
    focusSquare: (square) => set({ focus: { square, key: effectKey++ } }),
    setShowLobby: (on) => set({ showLobby: on }),
  };
});
