/**
 * Test helpers: a compact text notation for track and rider positions, so tests read like the
 * rulebook diagrams. Not part of the public API.
 *
 *   const s = scenario(`
 *     terrain  .  .  ^  ^  ^  v  v  v  .
 *     lane 1   .  .  .  .  .  .  .  .  .
 *     lane 0   0S .  1R .  3R 3S .  1S .
 *   `);
 *
 * Terrain: `.` flat, `^` ascent, `v` descent, `#` cobblestone, `=` supply zone, `F` flat finish
 * line square. Optional `lanes` row gives lane counts per square (default 2). Optional `weather`
 * row: `.` none, `c` crosswind, `t` tailwind, `h` headwind, `w` wet (switches Meteo on). Rider cells
 * are `<seat><R|S>`, e.g. `0R` = seat-0's rouleur; a trailing `x` marks a crashed rider. Squares
 * are ids `q0`, `q1`, … in order.
 */
import type { CompiledSquare, Terrain, TrackGraph, WeatherEffect } from '@velo/content';
import type { Card, GameConfig, GameEvent, RiderId } from '@velo/protocol';
import { createGame } from './api';
import { emit } from './core/reducer';
import { endPhase, finishCheck, movementPhase } from './core/round';
import type { GameState } from './state';
import { TILE_CATALOG } from '@velo/content';
import type { StageDefinition } from '@velo/content';
import type { Action, SeatId } from '@velo/protocol';
import { apply as applyAction, legalActions } from './api';
import { nextInt, seedRng, shuffle as shuffleRng } from './rng';
import type { RngState } from './rng';

const TERRAIN: Record<string, Terrain> = {
  '.': 'flat',
  '^': 'ascent',
  v: 'descent',
  '#': 'cobblestone',
  '=': 'supply',
  F: 'flat',
};

const WEATHER: Record<string, WeatherEffect | undefined> = {
  '.': undefined,
  c: 'crosswind',
  t: 'tailwind',
  h: 'headwind',
  w: 'wet',
};

export function straightTrack(terrain: string[], lanes?: number[], weather?: string[]): TrackGraph {
  const n = terrain.length;
  const finishAt = terrain.indexOf('F');
  const squares: Record<string, CompiledSquare> = {};
  for (let i = 0; i < n; i++) {
    const t = terrain[i]!;
    const terr = TERRAIN[t];
    if (!terr) throw new Error(`Unknown terrain "${t}"`);
    squares[`q${i}`] = {
      id: `q${i}`,
      lanes: (lanes?.[i] ?? 2) as 1 | 2 | 3,
      terrain: terr,
      flags: t === 'F' ? ['finishLine'] : [],
      ...(weather?.[i] && WEATHER[weather[i]!] ? { weather: WEATHER[weather[i]!]! } : {}),
      next: i + 1 < n ? [`q${i + 1}`] : [],
      prev: i > 0 ? [`q${i - 1}`] : [],
      index: i,
      ref: { tile: 0, segment: 0, square: i },
    };
  }
  const finishIndex = finishAt === -1 ? n + 100 : finishAt;
  return {
    stageId: 'scenario',
    squares,
    startGrid: ['q0'],
    finishSquare: `q${Math.max(finishAt, 0)}`,
    finishIndex,
  };
}

export interface Scenario {
  state: GameState;
  /** [square index, lane] of a rider, or null if off the track. */
  at(rider: string): [number, number] | null;
}

const riderId = (code: string): RiderId => `seat-${code.slice(0, -1)}:${code.slice(-1)}`;

export function scenario(diagram: string, opts: { seats?: number } = {}): Scenario {
  const rows = diagram
    .trim()
    .split('\n')
    .map((l) => l.trim().split(/\s+/));
  const terrainRow = rows.find((r) => r[0] === 'terrain');
  if (!terrainRow) throw new Error('scenario needs a terrain row');
  const terrain = terrainRow.slice(1);
  const lanesRow = rows.find((r) => r[0] === 'lanes');
  const weatherRow = rows.find((r) => r[0] === 'weather');
  const track = straightTrack(terrain, lanesRow?.slice(1).map(Number), weatherRow?.slice(1));
  const placements: [RiderId, number, number][] = [];
  const crashed = new Set<RiderId>();
  for (const r of rows) {
    if (r[0] !== 'lane') continue;
    const lane = Number(r[1]);
    r.slice(2).forEach((cell, i) => {
      if (cell === '.') return;
      const code = cell.endsWith('x') ? cell.slice(0, -1) : cell;
      if (code !== cell) crashed.add(riderId(code));
      placements.push([riderId(code), i, lane]);
    });
  }
  const maxSeat = Math.max(
    opts.seats ?? 0,
    ...placements.map(([id]) => Number(id.split(':')[0]!.slice(5)) + 1),
  );
  const config: GameConfig = {
    modules: weatherRow || crashed.size > 0 ? { meteo: { placements: [] } } : {},
    mode: {
      kind: 'single',
      stage: {
        id: 'scenario',
        name: 'Scenario',
        source: 'fixture',
        playerVariant: 'any',
        type: 'normal',
        tiles: ['x', 'y'],
      },
    },
    seats: Array.from({ length: maxSeat }, (_, i) => ({
      seat: `seat-${i}`,
      controller: { kind: 'human' as const, playerId: `p${i}` },
    })),
    options: { showRemainingValues: true, allowSpectators: true, turnTimer: 'off' },
  };
  const state = createGame(config, 'scenario', track);
  for (const r of Object.values(state.riders)) r.position = null;
  for (const [id, sq, lane] of placements) {
    const r = state.riders[id];
    if (!r) throw new Error(`Unknown rider ${id}`);
    r.position = { square: `q${sq}`, lane };
    r.crashed = crashed.has(id);
  }
  // Riders not in the diagram are out of this scenario.
  for (const r of Object.values(state.riders)) if (!r.position) r.finished = true;
  state.placementOrder = [];
  state.phase = 'energy';
  state.round = 1;
  return {
    state,
    at(code) {
      const p = state.riders[riderId(code)]?.position;
      return p ? [state.track.squares[p.square]!.index, p.lane] : null;
    },
  };
}

let cardSeq = 0;
/** Lock a card of the given value for each listed rider (others do not move). */
export function lock(
  state: GameState,
  plays: Record<string, number>,
  kind: Card['kind'] = 'energy',
): void {
  for (const [code, value] of Object.entries(plays)) {
    const r = state.riders[riderId(code)];
    if (!r) throw new Error(`Unknown rider ${code}`);
    r.locked = { id: `${r.id}#t${cardSeq++}`, kind, value, powers: [] };
  }
}

/** Movement phase only. */
export function runMovement(state: GameState, plays: Record<string, number>): GameEvent[] {
  lock(state, plays);
  const events: GameEvent[] = [];
  movementPhase(state, events);
  return events;
}

/** End phase only (slipstream, exhaustion), as if no rider had moved. */
export function runEnd(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];
  endPhase(state, events, new Map());
  return events;
}

/** Movement, end phase and finish check for the listed plays. */
export function runRound(state: GameState, plays: Record<string, number>): GameEvent[] {
  lock(state, plays);
  const events: GameEvent[] = [];
  const passed = movementPhase(state, events);
  endPhase(state, events, passed);
  if (!finishCheck(state, events))
    emit(state, events, { type: 'phaseChanged', phase: 'energy', round: state.round + 1 });
  return events;
}

// ---------------------------------------------------------------------------
// Random stages and random play (property tests, self-play harness)
// ---------------------------------------------------------------------------

/** A random legal base-game stage: start, a shuffled run of base tiles (random sides), finish. */
export function randomBaseStage(seed: string): StageDefinition {
  let rng: RngState = seedRng(`stage:${seed}`);
  const pick = <T>(xs: readonly T[]): T => {
    const [i, next] = nextInt(rng, xs.length);
    rng = next;
    return xs[i]!;
  };
  const letters = 'bcdefghijklmnopqrst'.split('');
  const [order, afterShuffle] = shuffleRng(rng, letters);
  rng = afterShuffle;
  const [extra, afterCount] = nextInt(rng, letters.length - 7);
  rng = afterCount;
  const middle = order.slice(0, 8 + extra).map((l) => `${l}_${pick(['w', 's'])}`);
  const known = new Set(TILE_CATALOG.tiles.map((t) => t.id));
  for (const id of middle)
    if (!known.has(id)) throw new Error(`randomBaseStage: unknown tile ${id}`);
  return {
    id: `random-${seed}`,
    name: `Random ${seed}`,
    source: 'generated',
    playerVariant: '2-4',
    type: 'normal',
    tiles: [`a_${pick(['w', 's'])}`, ...middle, `u_${pick(['w', 's'])}`],
  };
}

export interface PlayStep {
  before: GameState;
  action: Action;
  after: GameState;
  events: GameEvent[];
}

/**
 * Play a game to the end with uniformly random legal actions (any seat with something to do).
 * Calls `onStep` after every action. Throws if an action the engine offered is rejected.
 */
export function playRandom(
  state: GameState,
  seed: string,
  onStep?: (step: PlayStep) => void,
  maxActions = 20_000,
): { state: GameState; actions: Action[]; events: GameEvent[] } {
  let rng: RngState = seedRng(`play:${seed}`);
  let s = state;
  const actions: Action[] = [];
  const events: GameEvent[] = [];
  for (let n = 0; n < maxActions; n++) {
    if (s.phase === 'stageEnd' || s.phase === 'tourEnd') return { state: s, actions, events };
    const options = s.teams
      .map((t) => [t.seat, legalActions(s, t.seat)] as [SeatId, Action[]])
      .filter(([, a]) => a.length > 0);
    if (options.length === 0)
      throw new Error(`No legal actions in phase ${s.phase}, round ${s.round}`);
    const [i, r1] = nextInt(rng, options.length);
    const choices = options[i]![1];
    const [j, r2] = nextInt(r1, choices.length);
    rng = r2;
    const action = choices[j]!;
    const res = applyAction(s, action);
    if (!res.ok)
      throw new Error(
        `Engine rejected its own legal action ${JSON.stringify(action)}: ${res.error.message}`,
      );
    onStep?.({ before: s, action, after: res.state, events: res.events });
    actions.push(action);
    events.push(...res.events);
    s = res.state;
  }
  throw new Error(`Game did not end within ${maxActions} actions (round ${s.round})`);
}
