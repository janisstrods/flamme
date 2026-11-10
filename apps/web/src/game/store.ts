/**
 * Local race store (M2): the engine runs in the browser, seat-0 is the human, other seats are
 * random bots. Every action's events go through an animation queue so players can follow cause
 * and effect; the board shows `display` positions, which catch up with the engine state as the
 * queue plays out. M4 swaps the local engine for the host runtime (ADR-0001).
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

export const HUMAN = 'seat-0';
const STEP_MS = 150;

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

interface RaceStore {
  screen: 'home' | 'race';
  setup: RaceSetup | null;
  layout: StageLayout | null;
  state: GameState | null;
  /** Positions shown on the board (lag behind `state` while animating). */
  display: Record<RiderId, Position | null>;
  /** Transition time for each rider's last display change, ms. */
  moveMs: Record<RiderId, number>;
  queue: GameEvent[];
  animating: boolean;
  revealed: Record<RiderId, PublicCard> | null;
  tired: Record<RiderId, number>;
  log: LogLine[];
  selectedCard: string | null;
  hoverCard: string | null;
  placingRider: RiderId | null;
  error: string | null;
  start(setup: RaceSetup): void;
  act(action: Action): void;
  goHome(): void;
  select(card: string | null): void;
  hover(card: string | null): void;
  choosePlacingRider(rider: RiderId | null): void;
}

let bots = new Map<string, Bot>();
let logId = 0;
let botTimer: ReturnType<typeof setTimeout> | null = null;

const displayFrom = (state: GameState) =>
  Object.fromEntries(
    Object.values(state.riders).map((r) => [r.id, r.position && { ...r.position }]),
  );

export const useRace = create<RaceStore>((set, get) => {
  /** Push events into the animation queue and the log, then start playing them. */
  const enqueue = (events: GameEvent[]) => {
    const round = get().state?.round ?? 0;
    const lines = events
      .map((e) => narrate(e, HUMAN))
      .filter((t): t is string => t !== null)
      .map((text) => ({ id: logId++, text, round }));
    set((s) => ({ queue: [...s.queue, ...events], log: [...s.log, ...lines].slice(-200) }));
    if (!get().animating) pump();
  };

  /** Play the next queued event, then schedule the one after it. */
  const pump = () => {
    const [ev, ...rest] = get().queue;
    if (!ev) {
      set({ animating: false, display: get().state ? displayFrom(get().state!) : {} });
      scheduleBots();
      return;
    }
    set({ animating: true, queue: rest });
    const next = (ms: number) => setTimeout(pump, ms);
    switch (ev.type) {
      case 'riderPlaced':
        set((s) => ({
          display: { ...s.display, [ev.rider]: ev.at },
          moveMs: { ...s.moveMs, [ev.rider]: 200 },
        }));
        return void next(220);
      case 'cardsRevealed':
        set({ revealed: Object.fromEntries(ev.plays.map((p) => [p.rider, p.card])) });
        return void next(900);
      case 'riderMoved': {
        // Step through each square of the path so blocked riders visibly drop back.
        const steps =
          ev.path.length === 0
            ? [ev.to]
            : ev.path.map((sq, i) => (i === ev.path.length - 1 ? ev.to : { square: sq, lane: 0 }));
        let i = 0;
        const step = () => {
          const pos = steps[i++];
          if (!pos) return void next(120);
          set((s) => ({
            display: { ...s.display, [ev.rider]: pos },
            moveMs: { ...s.moveMs, [ev.rider]: STEP_MS },
          }));
          setTimeout(step, STEP_MS);
        };
        return step();
      }
      case 'slipstream':
        set((s) => {
          const display = { ...s.display };
          const moveMs = { ...s.moveMs };
          for (const m of ev.moves) {
            display[m.rider] = m.to;
            moveMs[m.rider] = 450;
          }
          return { display, moveMs };
        });
        return void next(550);
      case 'riderShifted':
        set((s) => ({
          display: { ...s.display, [ev.rider]: ev.to },
          moveMs: { ...s.moveMs, [ev.rider]: 250 },
        }));
        return void next(300);
      case 'exhaustionTaken':
        set((s) => ({ tired: { ...s.tired, [ev.rider]: (s.tired[ev.rider] ?? 0) + 1 } }));
        return void next(350);
      case 'phaseChanged':
        if (ev.phase === 'energy') set({ revealed: null });
        return void next(ev.phase === 'end' ? 250 : 0);
      default:
        return void next(0);
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
    botTimer = setTimeout(() => {
      botTimer = null;
      const s = get().state;
      if (!s) return;
      const legal = legalActions(s, seat);
      if (legal.length === 0) return scheduleBots();
      get().act(bots.get(seat)!.decide(viewFor(s, seat), seat, legal));
    }, 180);
  };

  return {
    screen: 'home',
    setup: null,
    layout: null,
    state: null,
    display: {},
    moveMs: {},
    queue: [],
    animating: false,
    revealed: null,
    tired: {},
    log: [],
    selectedCard: null,
    hoverCard: null,
    placingRider: null,
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
        queue: [],
        animating: false,
        revealed: null,
        tired: {},
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

    goHome() {
      if (botTimer) clearTimeout(botTimer);
      botTimer = null;
      set({ screen: 'home', state: null, layout: null, queue: [], animating: false });
    },

    select: (card) => set({ selectedCard: card }),
    hover: (card) => set({ hoverCard: card }),
    choosePlacingRider: (rider) => set({ placingRider: rider }),
  };
});
