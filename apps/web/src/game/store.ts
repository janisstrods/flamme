/**
 * Client store: driven only by ServerMessages from the session (solo, host or guest), so the UI
 * sees exactly what a guest would: the room, this player's redacted view, legal actions and the
 * public event stream. Events go through an animation queue so players can follow cause and
 * effect; the board shows `display` positions, which catch up with the view as the queue plays.
 */
import {
  TILE_CATALOG,
  TUTORIAL_STAGE,
  applyWeather,
  compileStage,
  layoutStage,
  tourStages,
} from '@velo/content';
import type { StageDefinition, StageLayout, TrackGraph } from '@velo/content';
import type { RoomSnapshot } from '@velo/host';
import type {
  Action,
  ClientMessage,
  GameConfig,
  GameEvent,
  GameView,
  Jersey,
  Position,
  PublicCard,
  RiderId,
  RoomState,
  SeatConfig,
  TeamNames,
  SeatId,
  ServerMessage,
} from '@velo/protocol';
import { create } from 'zustand';
import { guestSession, hostSession, loadIdentity, saveIdentity } from '../net/session';
import type { ConnectionState, Invite, Session } from '../net/session';
import { nameBook } from './names';
import { replayFrames } from './replay';
import type { ReplayFrame } from './replay';
import { narrate } from './narrate';
import { tourMode, withGrandTour, withPeloton } from './setup';
import type { TourChoice } from './setup';
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

export interface TourAward {
  stage: number;
  team: string;
  points: number;
  reason: Extract<GameEvent, { type: 'tourPointsAwarded' }>['reason'];
}

export interface TourRecord {
  /** Current stage: each rider's time so far (penalty minutes plus timing seconds). */
  stageTimes: Record<RiderId, number>;
  /** Team time trial: seconds added at the end so a rider takes its slower teammate's time. */
  teamTimeAdded: Record<RiderId, number>;
  stageTokens: { rider: RiderId; kind: 'sprint' | 'mountain'; value: number }[];
  /** Every Tour Point award of the tour, in order. */
  awards: TourAward[];
  jerseys: Partial<Record<Jersey, RiderId>>;
  /** Extended stage: the rider who took the refresh token. */
  refreshHolder: RiderId | null;
  /** End of the tour: the teams in final order, ties already broken by the rules. */
  ranking?: string[];
}

const emptyTour = (): TourRecord => ({
  stageTimes: {},
  teamTimeAdded: {},
  stageTokens: [],
  awards: [],
  jerseys: {},
  refreshHolder: null,
});

export interface SoloSetup {
  stage: StageDefinition;
  /** Who the other seats are: bots by level, or dummy teams. */
  opponents: SeatConfig['controller'][];
  /** Peloton breakaway bidding before the start. */
  breakaway?: boolean;
  /** Meteo weather, drawn at random when the race starts. */
  weather?: boolean;
  /** Race a tour instead of a single stage (`stage` is then ignored). */
  tour?: TourChoice;
  /** A ready-made mode (random tours); wins over `stage` and `tour`. */
  mode?: GameConfig['mode'];
  /** Draft specialist riders first. */
  specialists?: boolean;
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
  /** Tours: what happened on the current stage, and every award so far (for the tour screens). */
  tour: TourRecord;
  /** Replay viewer: the race's frames and the one on the board. */
  replay: {
    frames: ReplayFrame[];
    index: number;
    back: 'race' | 'home';
    /** What the board showed before the replay (back to the race). */
    restore: Pick<RaceStore, 'view' | 'legal' | 'display' | 'downed' | 'room'> | null;
  } | null;
  startReplay(snapshot: RoomSnapshot, back: 'race' | 'home'): boolean;
  showFrame(index: number): void;
  closeReplay(): void;
  /** The tutorial race: coach tips waiting to be shown, and the ones already seen. */
  tutorial: boolean;
  coach: { queue: string[]; seen: string[] };
  coachTip(id: string): void;
  dismissTip(all?: boolean): void;
  startTutorial(name: string): void;
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
  /** Resume a solo tour from its save. */
  resumeSolo(name: string, restore: { invite: Invite; snapshot: RoomSnapshot }): void;
  joinOnline(invite: Invite, name: string): void;
  leave(): void;
  send(msg: ClientMessage): void;
  /** Save this player's team and rider names, and tell the room. */
  setProfile(profile: TeamNames): void;
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

const saveError = (err: unknown) =>
  `This save could not be opened. ${err instanceof Error ? err.message : ''}`.trim();

const playerName = (room: RoomState | null, id: string) =>
  room?.players.find((p) => p.id === id)?.name ?? 'Someone';

export const useRace = create<RaceStore>((set, get) => {
  const effect = (rider: RiderId, kind: RiderEffect['kind']) =>
    set((s) => ({ effects: { ...s.effects, [rider]: { kind, key: effectKey++ } } }));

  /** Fold result events into a tour record (stage times, tokens, awards, jerseys). */
  const foldTour = (start: TourRecord, events: GameEvent[], stageNow: number): TourRecord => {
    let t = start;
    let stage = stageNow;
    let ended = false;
    for (const e of events) {
      if (e.type === 'stageEnded') ended = true;
      if (e.type === 'stageStarted') {
        t = { ...emptyTour(), awards: t.awards, jerseys: t.jerseys };
        stage = e.stageNumber;
        ended = false;
      } else if (e.type === 'riderFinished' && e.seconds !== undefined)
        t = {
          ...t,
          stageTimes: { ...t.stageTimes, [e.rider]: (t.stageTimes[e.rider] ?? 0) + e.seconds },
        };
      else if (e.type === 'timePenalty') {
        const times = { ...t.stageTimes };
        for (const id of e.riders) times[id] = (times[id] ?? 0) + e.seconds;
        t = { ...t, stageTimes: times };
        // After the stage has ended, a penalty is the team time trial's slower-teammate time.
        if (ended) {
          const added = { ...t.teamTimeAdded };
          for (const id of e.riders) added[id] = (added[id] ?? 0) + e.seconds;
          t = { ...t, teamTimeAdded: added };
        }
      } else if (e.type === 'tokenTaken')
        t = {
          ...t,
          stageTokens: [...t.stageTokens, { rider: e.rider, kind: e.kind, value: e.value }],
        };
      else if (e.type === 'tourPointsAwarded')
        t = {
          ...t,
          awards: [...t.awards, { stage, team: e.team, points: e.points, reason: e.reason }],
        };
      else if (e.type === 'jerseyAwarded')
        t = { ...t, jerseys: { ...t.jerseys, [e.jersey]: e.rider } };
      else if (e.type === 'refreshTriggered') t = { ...t, refreshHolder: e.rider };
      else if (e.type === 'tourEnded') t = { ...t, ranking: e.ranking };
    }
    return t;
  };

  /** Keep the tour record in step with the events as they arrive. */
  const recordTour = (events: GameEvent[]) => {
    if (events.some((e) => e.type === 'stageStarted')) set({ result: null, lastRound: null });
    set({ tour: foldTour(get().tour, events, get().view?.stageNumber ?? 1) });
  };

  /**
   * Joining or returning to a game already under way: rebuild what the missed events would have
   * recorded, so results and standings show without having watched the race.
   */
  const catchUp = (history: GameEvent[], view: GameView) => {
    const lastStart = history.map((e) => e.type).lastIndexOf('stageStarted');
    const ended = history
      .slice(lastStart + 1)
      .find((e): e is Extract<GameEvent, { type: 'stageEnded' }> => e.type === 'stageEnded');
    const over = ['stageEnd', 'betweenStages', 'tourEnd'].includes(view.phase);
    set({
      tour: foldTour(emptyTour(), history, 1),
      result: over && ended ? ended.order : null,
    });
  };

  /** Push events into the animation queue (and the log), then start playing them. */
  const enqueue = (events: GameEvent[], replay = false, before: GameView | null = null) => {
    if (!replay) {
      const seat = get().seat ?? '';
      const round = get().view?.round ?? 0;
      const lines = events
        .map((e) => narrate(e, nameBook(get().room?.config), seat))
        .filter((t): t is string => t !== null)
        .map((text) => ({ id: logId++, text, round }));
      if (events.some((e) => e.type === 'cardsRevealed'))
        // Where the round began: the view before these events, not `display`, which may still be
        // part-way through animating the round before.
        set({
          lastRound: before
            ? { display: displayFrom(before), downed: downedFrom(before), events }
            : { display: { ...get().display }, downed: { ...get().downed }, events },
        });
      const ended = events.find((e) => e.type === 'stageEnded');
      recordTour(events);
      if (get().tutorial) {
        const mine = (id: string) => id.startsWith(`${seat}:`);
        for (const e of events) {
          if (e.type === 'cardsRevealed') get().coachTip('move');
          if (e.type === 'riderMoved' && e.blocked) get().coachTip('blocked');
          if (e.type === 'slipstream') get().coachTip('slipstream');
          if (e.type === 'exhaustionTaken' && mine(e.rider)) get().coachTip('exhaustion');
          if (e.type === 'stageEnded') get().coachTip('finish');
        }
      }
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
  const syncStage = (room: RoomState, stageNumber = get().view?.stageNumber ?? 1) => {
    if (room.config.mode.kind === 'timeTrial') return;
    const stage =
      room.config.mode.kind === 'tour'
        ? (tourStages(room.config.mode.schedule)[stageNumber - 1] ??
          tourStages(room.config.mode.schedule)[0]!)
        : room.config.mode.stage;
    if (get().track?.stageId === stage.id && get().layout) return;
    baseTrack = compileStage(stage, TILE_CATALOG);
    weatherKey = '';
    // Positions shown on the board belong to the stage before: its squares may not exist on this
    // one, so they go in the same update as the map (the view or the events fill them in again).
    set({
      track: baseTrack,
      layout: layoutStage(stage, TILE_CATALOG),
      display: {},
      moveMs: {},
      focus: null,
    });
  };

  /** Lay the view's weather on the track, so previews and art see it (Meteo). */
  const syncWeather = (view: GameView) => {
    const room = get().room;
    if (room) syncStage(room, view.stageNumber);
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
        modules: {
          ...(setup.weather ? { meteo: {} } : {}),
        },
        mode:
          setup.mode ??
          (setup.tour ? tourMode(setup.tour) : { kind: 'single', stage: setup.stage }),
        seats: [{ kind: 'open' as const }, ...setup.opponents].map((controller, i) => ({
          seat: `seat-${i}`,
          controller,
        })),
      },
      { breakaway: setup.breakaway ?? false, oneRiderEach: false },
    );
    send({ type: 'configure', config: withGrandTour(config, setup.specialists ?? false) });
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
        // While the replay viewer is up, the live room waits behind it.
        const viewing = get().replay;
        if (viewing?.restore) {
          set({
            replay: { ...viewing, restore: { ...viewing.restore, room: msg.room } },
            seat: seatOf(msg.room, get().me),
          });
          return;
        }
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
                tour: emptyTour(),
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
      case 'view': {
        const viewing = get().replay;
        if (viewing?.restore) {
          set({
            replay: {
              ...viewing,
              restore: {
                ...viewing.restore,
                view: msg.view,
                legal: msg.legal,
                display: displayFrom(msg.view),
                downed: downedFrom(msg.view),
              },
            },
          });
          return;
        }
        syncWeather(msg.view);
        set({ view: msg.view, legal: msg.legal });
        if (msg.history) catchUp(msg.history, msg.view);
        if (!get().animating && get().queue.length === 0)
          set({ display: displayFrom(msg.view), downed: downedFrom(msg.view) });
        return;
      }
      case 'events': {
        const before = get().view;
        syncWeather(msg.view);
        set({ view: msg.view, legal: msg.legal, selectedCard: null, hoverCard: null });
        enqueue(msg.events, false, before);
        return;
      }
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
    tour: emptyTour(),
    tutorial: false,
    coach: { queue: [] as string[], seen: [] as string[] },
    replay: null,
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

    startReplay(snapshot, back) {
      const frames = replayFrames(snapshot);
      if (frames.length === 0) return false;
      if (back === 'home') {
        get().session?.close();
        set({ ...reset, session: null, screen: 'race', track: null, layout: null });
      }
      const config = snapshot.gameConfig ?? snapshot.config;
      const room: RoomState = {
        room: snapshot.room,
        config,
        players: snapshot.players.map((p) => ({
          id: p.id,
          name: p.name,
          seat:
            config.seats.find(
              (x) => x.controller.kind === 'human' && x.controller.playerId === p.id,
            )?.seat ?? null,
          connected: false,
          ready: false,
          isHost: false,
        })),
        status: 'finished',
      };
      const { view, legal, display, downed } = get();
      const restore = back === 'race' ? { view, legal, display, downed, room: get().room } : null;
      set({ room, replay: { frames, index: 0, back, restore } });
      get().showFrame(0);
      return true;
    },

    showFrame(index) {
      const replay = get().replay;
      const frame = replay?.frames[index];
      if (!replay || !frame) return;
      const room = get().room;
      if (room) syncStage(room, frame.view.stageNumber);
      syncWeather(frame.view);
      set({
        replay: { ...replay, index },
        view: frame.view,
        legal: [],
        display: displayFrom(frame.view),
        downed: downedFrom(frame.view),
        moveMs: {},
        revealed: null,
      });
    },

    closeReplay() {
      const replay = get().replay;
      if (!replay) return;
      if (replay.back === 'home') return get().leave();
      set({ replay: null, ...(replay.restore ?? {}) });
      const { room, view } = get();
      if (room && view) {
        syncStage(room, view.stageNumber);
        syncWeather(view);
        // Going back to another stage's map clears the board: put the live positions back.
        if (replay.restore) set({ display: replay.restore.display });
      }
    },

    coachTip(id) {
      const { coach, tutorial } = get();
      if (!tutorial || coach.seen.includes(id) || coach.queue.includes(id)) return;
      set({ coach: { ...coach, queue: [...coach.queue, id] } });
    },

    dismissTip(all) {
      const { coach } = get();
      if (all) set({ tutorial: false, coach: { queue: [], seen: coach.seen } });
      else if (coach.queue[0])
        set({ coach: { queue: coach.queue.slice(1), seen: [...coach.seen, coach.queue[0]] } });
    },

    startTutorial(name) {
      get().startSolo({ stage: TUTORIAL_STAGE, opponents: [{ kind: 'ai', level: 'easy' }] }, name);
      set({ tutorial: true, coach: { queue: ['welcome'], seen: [] } });
    },

    startSolo(setup, name) {
      get().session?.close();
      soloSetup = setup;
      set({ ...reset, screen: 'race', track: null, layout: null });
      set({ session: hostSession('solo', withName(name), callbacks) });
    },

    resumeSolo(name, restore) {
      get().session?.close();
      soloSetup = null;
      set({ ...reset, screen: 'race', track: null, layout: null });
      try {
        set({ session: hostSession('solo', withName(name), callbacks, restore) });
      } catch (err) {
        set({ ...reset, session: null, screen: 'home', error: saveError(err) });
      }
    },

    hostOnline(name, restore) {
      get().session?.close();
      soloSetup = null;
      set({ ...reset, screen: 'lobby', track: null, layout: null });
      try {
        set({ session: hostSession('host', withName(name), callbacks, restore) });
      } catch (err) {
        set({ ...reset, session: null, screen: 'home', error: saveError(err) });
      }
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

    setProfile(profile) {
      saveIdentity({ ...loadIdentity(), profile });
      if (get().session) get().send({ type: 'setProfile', profile });
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
