/**
 * Local race store: the engine runs in the browser, seat-0 is the human, other seats are random
 * bots. Every action's events go through an animation queue so players can follow cause and
 * effect; the board shows `display` positions, which catch up with the engine state as the queue
 * plays out. Speed (normal/fast/skip) and reduced motion scale every duration. M4 swaps the local
 * engine for the host runtime (ADR-0001).
 */
import { randomBot } from '@velo/ai';
import type { Bot } from '@velo/ai';
import { TILE_CATALOG, compileStage, layoutStage } from '@velo/content';
import type { StageDefinition, StageLayout } from '@velo/content';
import { apply, createGame, legalActions, viewFor } from '@velo/engine';
import type { GameState } from '@velo/engine';
import type { Action, GameConfig, GameEvent, Position, PublicCard, RiderId } from '@velo/protocol';
import { create } from 'zustand';
import { narrate } from './narrate';
import { timeScale } from './settings';
import { playBell, playCrowd, playFlip, playTired, playWhirr, playWhoosh } from './sound';

export const HUMAN = 'seat-0';
const STEP_MS = 170;

export interface RaceSetup {
  stage: StageDefinition;
  opponents: number;
  seed: string;
}

export interface LogLine {
  id: number;
  text: string;
  round: number;
}

/** Short-lived visual effects on riders; `key` changes restart CSS animations. */
export interface RiderEffect {
  kind: 'slipstream' | 'tired' | 'bump';
  key: number;
}

type Display = Record<RiderId, Position | null>;

interface QueuedEvent {
  event: GameEvent;
  replay: boolean;
}

interface RaceStore {
  screen: 'home' | 'race';
  setup: RaceSetup | null;
  layout: StageLayout | null;
  state: GameState | null;
  /** Positions shown on the board (lag behind `state` while animating). */
  display: Display;
  /** Transition time for each rider's last display change, ms. */
  moveMs: Record<RiderId, number>;
  effects: Record<RiderId, RiderEffect>;
  queue: QueuedEvent[];
  animating: boolean;
  replaying: boolean;
  revealed: Record<RiderId, PublicCard> | null;
  lastRound: { display: Display; events: GameEvent[] } | null;
  log: LogLine[];
  selectedCard: string | null;
  hoverCard: string | null;
  placingRider: RiderId | null;
  /** A square the camera should centre on (stage strip clicks). */
  focus: { square: string; key: number } | null;
  error: string | null;
  start(setup: RaceSetup): void;
  act(action: Action): void;
  replayLastRound(): void;
  goHome(): void;
  select(card: string | null): void;
  hover(card: string | null): void;
  choosePlacingRider(rider: RiderId | null): void;
  focusSquare(square: string): void;
}

let bots = new Map<string, Bot>();
let logId = 0;
let effectKey = 0;
let botTimer: ReturnType<typeof setTimeout> | null = null;

const displayFrom = (state: GameState): Display =>
  Object.fromEntries(
    Object.values(state.riders).map((r) => [r.id, r.position && { ...r.position }]),
  );

export const useRace = create<RaceStore>((set, get) => {
  const effect = (rider: RiderId, kind: RiderEffect['kind']) =>
    set((s) => ({ effects: { ...s.effects, [rider]: { kind, key: effectKey++ } } }));

  /** Push events into the animation queue (and the log), then start playing them. */
  const enqueue = (events: GameEvent[], replay = false) => {
    if (!replay) {
      const round = get().state?.round ?? 0;
      const lines = events
        .map((e) => narrate(e, HUMAN))
        .filter((t): t is string => t !== null)
        .map((text) => ({ id: logId++, text, round }));
      if (events.some((e) => e.type === 'cardsRevealed')) {
        set({ lastRound: { display: { ...get().display }, events } });
      }
      set((s) => ({ log: [...s.log, ...lines].slice(-300) }));
    }
    set((s) => ({ queue: [...s.queue, ...events.map((event) => ({ event, replay }))] }));
    if (!get().animating) pump();
  };

  /** Play the next queued event, then schedule the one after it. */
  const pump = (): void => {
    const [item, ...rest] = get().queue;
    if (!item) {
      set({
        animating: false,
        replaying: false,
        display: get().state ? displayFrom(get().state!) : {},
      });
      scheduleBots();
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
      case 'riderMoved': {
        if (k === 0) {
          moveTo(ev.rider, ev.to, 0);
          return next(0);
        }
        // Step through each square of the path so blocked riders visibly drop back.
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

  /** Bots act one at a time, with a short pause, whenever nothing is animating. */
  const scheduleBots = () => {
    if (botTimer) return;
    const { state, animating } = get();
    if (!state || animating || state.phase === 'stageEnd') return;
    const seat = state.teams
      .map((t) => t.seat)
      .find((s) => s !== HUMAN && legalActions(state, s).length > 0);
    if (!seat) return;
    botTimer = setTimeout(
      () => {
        botTimer = null;
        const s = get().state;
        if (!s) return;
        const legal = legalActions(s, seat);
        if (legal.length === 0) return scheduleBots();
        get().act(bots.get(seat)!.decide(viewFor(s, seat), seat, legal));
      },
      timeScale() === 0 ? 0 : 180,
    );
  };

  return {
    screen: 'home',
    setup: null,
    layout: null,
    state: null,
    display: {},
    moveMs: {},
    effects: {},
    queue: [],
    animating: false,
    replaying: false,
    revealed: null,
    lastRound: null,
    log: [],
    selectedCard: null,
    hoverCard: null,
    placingRider: null,
    focus: null,
    error: null,

    start(setup) {
      const config: GameConfig = {
        modules: {},
        mode: { kind: 'single', stage: setup.stage },
        seats: Array.from({ length: setup.opponents + 1 }, (_, i) => ({
          seat: `seat-${i}`,
          controller:
            i === 0
              ? { kind: 'human' as const, playerId: 'local' }
              : { kind: 'ai' as const, level: 'easy' as const },
        })),
        options: { showRemainingValues: true, allowSpectators: false, turnTimer: 'off' },
      };
      const state = createGame(config, setup.seed, compileStage(setup.stage, TILE_CATALOG));
      bots = new Map(
        state.teams
          .filter((t) => t.seat !== HUMAN)
          .map((t) => [t.seat, randomBot(`${setup.seed}:${t.seat}`)]),
      );
      if (botTimer) clearTimeout(botTimer);
      botTimer = null;
      set({
        screen: 'race',
        setup,
        layout: layoutStage(setup.stage, TILE_CATALOG),
        state,
        display: displayFrom(state),
        moveMs: {},
        effects: {},
        queue: [],
        animating: false,
        replaying: false,
        revealed: null,
        lastRound: null,
        log: [
          {
            id: logId++,
            text: `${setup.stage.name}: place your riders on the start grid.`,
            round: 0,
          },
        ],
        selectedCard: null,
        hoverCard: null,
        placingRider: null,
        focus: null,
        error: null,
      });
      scheduleBots();
    },

    act(action) {
      const state = get().state;
      if (!state) return;
      const res = apply(state, action);
      if (!res.ok) {
        set({ error: res.error.message });
        return;
      }
      set({
        state: res.state,
        error: null,
        selectedCard: null,
        hoverCard: null,
        ...(action.type === 'placeRider' ? { placingRider: null } : {}),
      });
      enqueue(res.events);
      scheduleBots();
    },

    replayLastRound() {
      const { lastRound, animating } = get();
      if (!lastRound || animating) return;
      set({ display: { ...lastRound.display }, moveMs: {} });
      enqueue(lastRound.events, true);
    },

    goHome() {
      if (botTimer) clearTimeout(botTimer);
      botTimer = null;
      set({ screen: 'home', state: null, layout: null, queue: [], animating: false });
    },

    select: (card) => set({ selectedCard: card }),
    hover: (card) => set({ hoverCard: card }),
    choosePlacingRider: (rider) => set({ placingRider: rider }),
    focusSquare: (square) => set({ focus: { square, key: effectKey++ } }),
  };
});
