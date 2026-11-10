/**
 * Public engine API (plan section 4). Pure and deterministic: no I/O, no clock, no Math.random.
 * State changes only through `apply`. The same config, seed and actions always give the same
 * states and events.
 */
import type { TrackGraph } from '@velo/content';
import type {
  Action,
  Card,
  GameConfig,
  GameEvent,
  GameView,
  Position,
  PublicRider,
  RiderId,
  SeatId,
  TeamColor,
  TeamStatus,
} from '@velo/protocol';
import { cardsInDeck, deal, exhaustionCard, lockCard, startingDeck } from './core/cards';
import { Hooks } from './core/compose';
import { emit } from './core/reducer';
import { resolveRound } from './core/round';
import { freeLane, laneSets, occupancy, pathFrom, square } from './core/track';
import type { ModuleId } from './hooks';
import { nextInt, seedRng, shuffle } from './rng';
import type { GameState, RiderState, TeamState } from './state';

export type EngineErrorCode =
  | 'NOT_YOUR_TURN'
  | 'WRONG_PHASE'
  | 'UNKNOWN_RIDER'
  | 'NOT_YOUR_RIDER'
  | 'CARD_NOT_IN_HAND'
  | 'ALREADY_LOCKED'
  | 'ILLEGAL_POSITION'
  | 'INVALID_ACTION'
  | 'NOT_IMPLEMENTED';

export interface EngineError {
  code: EngineErrorCode;
  message: string;
}

export type ApplyResult =
  { ok: true; state: GameState; events: GameEvent[] } | { ok: false; error: EngineError };

export interface MovePreview {
  rider: RiderId;
  cardValue: number;
  /** Value after terrain, weather and specialist modifiers. */
  effectiveValue: number;
  /** Where the rider would land if nothing blocked it. */
  unobstructed: Position;
  /** Squares between the start and the unobstructed landing square. */
  path: string[];
  /** Short machine-readable hint keys for the UI (e.g. 'cappedByAscent', 'narrowAhead'). */
  hints: string[];
}

export type Viewer = SeatId | 'spectator';

export class NotImplementedError extends Error {
  constructor(what: string) {
    super(`${what} is not implemented yet.`);
    this.name = 'NotImplementedError';
  }
}

const COLORS: TeamColor[] = ['red', 'blue', 'green', 'black', 'pink', 'white'];

function modulesFor(config: GameConfig): ModuleId[] {
  const m = config.modules;
  if (m.peloton) throw new NotImplementedError('The Peloton module (M6)');
  if (m.meteo) throw new NotImplementedError('The Meteo module (M7)');
  if (m.grandTour) throw new NotImplementedError('The Grand Tour modules (M8, M9)');
  if (config.mode.kind !== 'single') throw new NotImplementedError(`The ${config.mode.kind} mode`);
  return ['base'];
}

/** Build the initial state for a game. `track` is the compiled stage for stage 1. */
export function createGame(config: GameConfig, seed: string, track: TrackGraph): GameState {
  const modules = modulesFor(config);
  let rng = seedRng(seed);
  const seats = config.seats.filter((s) => s.controller.kind !== 'open');
  if (seats.length === 0) throw new Error('createGame: no occupied seats');
  const teams: TeamState[] = [];
  const riders: Record<RiderId, RiderState> = {};
  seats.forEach((s, i) => {
    const ids: RiderId[] = [`${s.seat}:R`, `${s.seat}:S`];
    teams.push({
      team: s.seat,
      seat: s.seat,
      controller: s.controller.kind === 'open' ? 'human' : s.controller.kind,
      color: s.color ?? COLORS[i % COLORS.length]!,
      riders: ids,
      firstRider: null,
      tourPoints: 0,
    });
    for (const id of ids) {
      const rider: RiderState = {
        id,
        team: s.seat,
        type: id.endsWith(':R') ? 'rouleur' : 'sprinteur',
        position: null,
        drawPile: [],
        recycled: [],
        hand: null,
        locked: null,
        played: [],
        setAside: [],
        exhaustionReceived: 0,
        crashed: false,
        finished: false,
        finishPlace: null,
        specialist: null,
        tour: null,
      };
      const deck = startingDeck(id, rider.type);
      for (let h = 0; h < (s.handicap ?? 0); h++) deck.push(exhaustionCard(rider));
      const [shuffled, next] = shuffle(rng, deck);
      rng = next;
      rider.drawPile = shuffled;
      riders[id] = rider;
    }
  });
  // B-SET-5 / D-007: a random team places first, then clockwise (seat order).
  const [first, afterFirst] = nextInt(rng, teams.length);
  rng = afterFirst;
  const order = teams.map((_, i) => teams[(first + i) % teams.length]!.team);
  return {
    schema: 1,
    config,
    modules,
    rng,
    phase: 'placement',
    round: 0,
    stageNumber: 1,
    track,
    teams,
    riders,
    placementOrder: order,
    tokens: [],
    exhaustionSupply: null,
    result: null,
  };
}

function cloneState(s: GameState): GameState {
  const riders: Record<RiderId, RiderState> = {};
  for (const [id, r] of Object.entries(s.riders)) {
    riders[id] = {
      ...r,
      position: r.position && { ...r.position },
      drawPile: [...r.drawPile],
      recycled: [...r.recycled],
      hand: r.hand && [...r.hand],
      played: [...r.played],
      setAside: [...r.setAside],
      tour: r.tour && { ...r.tour },
    };
  }
  return {
    ...s,
    rng: [...s.rng] as unknown as GameState['rng'],
    teams: s.teams.map((t) => ({ ...t, riders: [...t.riders] })),
    riders,
    placementOrder: [...s.placementOrder],
    tokens: s.tokens.map((t) => ({ ...t, remaining: [...t.remaining] })),
    result: s.result && [...s.result],
  };
}

const teamOf = (state: GameState, seat: SeatId) => state.teams.find((t) => t.seat === seat);
const activeRiders = (state: GameState, team: TeamState) =>
  team.riders.map((id) => state.riders[id]!).filter((r) => !r.finished);

/** Grid squares with a free lane, and the lane a rider placed there would take. */
function placements(state: GameState): Position[] {
  const occ = laneSets(occupancy(state));
  const out: Position[] = [];
  for (const sq of state.track.startGrid) {
    const lane = freeLane(state.track, occ.get(sq), sq);
    if (lane !== undefined) out.push({ square: sq, lane });
  }
  return out;
}

/** Everything a seat may do right now. Empty if the seat has nothing to do. */
export function legalActions(state: GameState, seat: SeatId): Action[] {
  const team = teamOf(state, seat);
  if (!team) return [];
  if (state.phase === 'placement') {
    if (state.placementOrder[0] !== team.team) return [];
    const unplaced = team.riders.filter((id) => state.riders[id]!.position === null);
    return unplaced.flatMap((rider) =>
      placements(state).map((position) => ({ type: 'placeRider' as const, seat, rider, position })),
    );
  }
  if (state.phase === 'energy') {
    if (team.firstRider === null)
      return activeRiders(state, team).map((r) => ({
        type: 'chooseRider' as const,
        seat,
        rider: r.id,
      }));
    const dealt = activeRiders(state, team).find((r) => r.hand !== null);
    return (dealt?.hand ?? []).map((c) => ({
      type: 'playCard' as const,
      seat,
      rider: dealt!.id,
      card: c.id,
    }));
  }
  return [];
}

const fail = (code: EngineErrorCode, message: string): ApplyResult => ({
  ok: false,
  error: { code, message },
});

/** Validate and apply one action. Never throws for a bad action: returns a typed error instead. */
export function apply(state: GameState, action: Action): ApplyResult {
  const team = teamOf(state, action.seat);
  if (!team) return fail('NOT_YOUR_TURN', `${action.seat} has no team in this game.`);
  if ('rider' in action && !team.riders.includes(action.rider))
    return state.riders[action.rider]
      ? fail('NOT_YOUR_RIDER', `${action.rider} does not belong to ${action.seat}.`)
      : fail('UNKNOWN_RIDER', `Unknown rider ${action.rider}.`);
  const next = cloneState(state);
  const events: GameEvent[] = [];
  const nextTeam = teamOf(next, action.seat)!;

  switch (action.type) {
    case 'placeRider': {
      if (state.phase !== 'placement')
        return fail('WRONG_PHASE', 'Riders are placed before the race.');
      if (state.placementOrder[0] !== team.team)
        return fail('NOT_YOUR_TURN', 'Another team is placing.');
      if (state.riders[action.rider]!.position)
        return fail('ILLEGAL_POSITION', 'That rider is already placed.');
      const legal = placements(state).some(
        (p) => p.square === action.position.square && p.lane === action.position.lane,
      );
      if (!legal)
        return fail(
          'ILLEGAL_POSITION',
          'Place riders on a free lane of the start grid, rightmost first.',
        );
      emit(next, events, { type: 'riderPlaced', rider: action.rider, at: action.position });
      if (next.placementOrder.length === 0)
        emit(next, events, { type: 'phaseChanged', phase: 'energy', round: 1 });
      return { ok: true, state: next, events };
    }
    case 'chooseRider': {
      if (state.phase !== 'energy')
        return fail('WRONG_PHASE', 'Riders are chosen in the energy phase.');
      if (team.firstRider !== null)
        return fail('ALREADY_LOCKED', 'This team already chose a rider this round.');
      const rider = next.riders[action.rider]!;
      if (rider.finished) return fail('INVALID_ACTION', 'That rider has finished.');
      emit(next, events, { type: 'riderChosen', team: team.team, rider: action.rider });
      deal(next, rider, new Hooks(next).handSize(rider.id), events);
      return { ok: true, state: next, events };
    }
    case 'playCard': {
      if (state.phase !== 'energy')
        return fail('WRONG_PHASE', 'Cards are played in the energy phase.');
      const rider = next.riders[action.rider]!;
      if (rider.locked) return fail('ALREADY_LOCKED', 'That rider already has a card locked in.');
      if (!rider.hand?.some((c) => c.id === action.card))
        return fail('CARD_NOT_IN_HAND', 'That card is not in the rider’s hand.');
      lockCard(rider, action.card);
      emit(next, events, { type: 'cardLocked', team: team.team, rider: rider.id });
      const other = activeRiders(next, nextTeam).find(
        (r) => r.id !== rider.id && !r.locked && !r.hand,
      );
      if (other) deal(next, other, new Hooks(next).handSize(other.id), events);
      const everyoneLocked = Object.values(next.riders).every(
        (r) => r.finished || r.locked !== null,
      );
      if (everyoneLocked) resolveRound(next, events);
      return { ok: true, state: next, events };
    }
    default:
      return fail('NOT_IMPLEMENTED', `${action.type} arrives with a later milestone.`);
  }
}

function teamStatus(state: GameState, team: TeamState): TeamStatus {
  if (state.phase !== 'energy') return 'idle';
  const riders = activeRiders(state, team);
  const locked = riders.filter((r) => r.locked).length;
  if (locked === riders.length) return 'locked';
  return locked === 0 ? 'choosingFirst' : 'choosingSecond';
}

function remainingValues(r: RiderState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of cardsInDeck(r)) out[String(c.value)] = (out[String(c.value)] ?? 0) + 1;
  return out;
}

/** The redacted view for one seat or a spectator. Never includes another team's private data. */
export function viewFor(state: GameState, viewer: Viewer): GameView {
  const own = viewer === 'spectator' ? undefined : teamOf(state, viewer);
  const riders: PublicRider[] = Object.values(state.riders).map((r) => ({
    id: r.id,
    team: r.team,
    type: r.type,
    position: r.position && { ...r.position },
    crashed: r.crashed,
    finished: r.finished,
    drawPileCount: r.drawPile.length,
    exhaustionCount: cardsInDeck(r).filter((c) => c.kind === 'exhaustion').length,
    played: r.played.map((c) => ({ kind: c.kind, value: c.value })),
    ...(state.config.options.showRemainingValues ? { remainingValues: remainingValues(r) } : {}),
    ...(r.specialist ? { specialist: r.specialist } : {}),
    ...(r.tour?.jersey ? { jersey: r.tour.jersey } : {}),
    ...(r.tour
      ? {
          tour: {
            seconds: r.tour.seconds,
            sprintPoints: r.tour.sprintPoints,
            mountainPoints: r.tour.mountainPoints,
          },
        }
      : {}),
  }));
  return {
    viewer,
    stageId: state.track.stageId,
    stageNumber: state.stageNumber,
    phase: state.phase,
    round: state.round,
    teams: state.teams.map((t) => ({
      team: t.team,
      color: t.color as TeamColor,
      status: teamStatus(state, t),
      ...(state.config.mode.kind === 'tour' ? { tourPoints: t.tourPoints } : {}),
    })),
    riders,
    weather: [],
    tokens: state.tokens.map((t) => ({ ...t, remaining: [...t.remaining] })),
    own: own
      ? {
          team: own.team,
          firstRider: own.firstRider,
          riders: own.riders.map((id) => {
            const r = state.riders[id]!;
            return {
              rider: id,
              hand: r.hand && [...r.hand],
              recycled: [...r.recycled],
              locked: r.locked,
            };
          }),
        }
      : null,
  };
}

/** Terrain-adjusted value and unobstructed landing square, for UI hints and AI. */
export function previewMove(state: GameState, rider: RiderId, card: Card): MovePreview {
  const r = state.riders[rider];
  if (!r?.position) throw new Error(`previewMove: ${rider} is not on the track`);
  const hooks = new Hooks(state);
  const { value, modifiers } = hooks.effectiveValue(rider, card);
  const path = pathFrom(state.track, r.position.square, value);
  const hints: string[] = [];
  for (const m of modifiers) {
    if (m.source === 'ascent')
      hints.push(m.result < card.value && m.result <= 5 ? 'cappedByAscent' : 'stopsBeforeAscent');
    if (m.source === 'descent') hints.push('boostedByDescent');
  }
  if (path.some((id) => square(state.track, id).lanes === 1)) hints.push('narrowAhead');
  const occ = laneSets(occupancy(state, rider));
  const target = path.at(-1);
  if (target !== undefined && freeLane(state.track, occ.get(target), target) === undefined)
    hints.push('targetFull');
  const unobstructed: Position =
    target === undefined ? { ...r.position } : { square: target, lane: 0 };
  return { rider, cardValue: card.value, effectiveValue: value, unobstructed, path, hints };
}

/**
 * Preview a move from a redacted view (clients have no full state). Uses only public positions,
 * the compiled track and the enabled modules, so the result matches `previewMove` on the host.
 */
export function previewFromView(
  view: GameView,
  track: TrackGraph,
  config: GameConfig,
  rider: RiderId,
  card: Card,
): MovePreview {
  const riders: Record<RiderId, RiderState> = {};
  for (const r of view.riders) {
    riders[r.id] = {
      id: r.id,
      team: r.team,
      type: r.type,
      position: r.position && { ...r.position },
      drawPile: [],
      recycled: [],
      hand: null,
      locked: null,
      played: [],
      setAside: [],
      exhaustionReceived: 0,
      crashed: r.crashed,
      finished: r.finished,
      finishPlace: null,
      specialist: r.specialist ?? null,
      tour: null,
    };
  }
  const lite = {
    schema: 1,
    config,
    modules: modulesFor(config),
    rng: [0, 0, 0, 0],
    phase: view.phase,
    round: view.round,
    stageNumber: view.stageNumber,
    track,
    teams: [],
    riders,
    placementOrder: [],
    tokens: [],
    exhaustionSupply: null,
    result: null,
  } satisfies GameState;
  return previewMove(lite, rider, card);
}
