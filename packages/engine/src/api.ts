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
import { afterBid, breakawayEnabled, chooseBidder, startBreakaway } from './core/breakaway';
import { isTour, setupStage, stageOf, stageTrack, startNextStage } from './core/tour';
import { flipDummies, isDummy, muscleCard, pelotonDeck } from './core/dummies';
import { emit } from './core/reducer';
import { endPhase, movementPhase, resolveRound } from './core/round';
import { compareFrontFirst, freeLane, laneSets, occupancy, pathFrom, square } from './core/track';
import type { ModuleId } from './hooks';
import { seedRng, shuffle } from './rng';
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

/**
 * Rule modules for a game. Peloton terrain rules switch on with the Peloton module or whenever the
 * stage has cobblestones or supply zones (they come with the tiles, not with a lobby switch).
 */
function modulesFor(config: GameConfig, track: TrackGraph): ModuleId[] {
  const m = config.modules;
  if (m.grandTour?.newTiles || m.grandTour?.specialists || m.grandTour?.specialStages)
    throw new NotImplementedError('Grand Tour new tiles, specialists and special stages (M9)');
  if (config.mode.kind === 'timeTrial') throw new NotImplementedError('Time trials (M9)');
  const out: ModuleId[] = ['base'];
  const pelotonTerrain = Object.values(track.squares).some(
    (s) => s.terrain === 'cobblestone' || s.terrain === 'supply',
  );
  // Tours change stage, so the (otherwise inert) Peloton terrain rules are always on there.
  if (m.peloton || pelotonTerrain || config.mode.kind === 'tour') out.push('peloton');
  if (config.mode.kind === 'tour') out.push('grandTour.tour');
  if (m.meteo) out.push('meteo', 'crashes');
  if (config.seats.some((s) => s.controller.kind === 'dummy')) out.push('dummies');
  return out;
}

/**
 * Team colours by seat: the seat's own colour, else the next in order. With one rider each, two
 * seats can share a colour when they ride different riders (one colour has a rouleur and a
 * sprinteur), so twelve players fit in six colours.
 */
export function seatColors(config: GameConfig): Record<SeatId, TeamColor> {
  const oneRider = config.modules.peloton?.oneRiderEach === true;
  const taken = new Set<string>();
  const out: Record<SeatId, TeamColor> = {};
  config.seats.forEach((s, i) => {
    const kind = s.singleRider ?? 'rouleur';
    const color =
      s.color ??
      (oneRider
        ? (COLORS.find((c) => !taken.has(`${c}:${kind}`)) ?? COLORS[i % COLORS.length]!)
        : COLORS[i % COLORS.length]!);
    taken.add(`${color}:${kind}`);
    out[s.seat] = color;
  });
  return out;
}

/** Riders that take the start in this config. */
export function ridersInRace(config: GameConfig): number {
  const seats = config.seats.filter((s) => s.controller.kind !== 'open').length;
  return config.modules.peloton?.oneRiderEach ? seats : seats * 2;
}

/**
 * Problems with racing this config on this compiled stage, in words for the lobby. Empty when the
 * race can start. (Module combinations are checked by `checkModuleDependencies` in the protocol.)
 */
export function checkStage(config: GameConfig, track: TrackGraph): string[] {
  const issues: string[] = [];
  const capacity = track.startGrid.reduce((n, id) => n + (track.squares[id]?.lanes ?? 0), 0);
  const riders = ridersInRace(config);
  if (riders > capacity)
    issues.push(
      `This stage's start grid holds ${capacity} riders and this race has ${riders}. Pick a stage with the wide start.`,
    );
  if (
    config.modules.peloton?.breakaway &&
    !Object.values(track.squares).some((s) => s.flags.includes('breakaway'))
  )
    issues.push(
      'The breakaway needs the breakaway tile right after the start. Pick a stage built for it.',
    );
  return issues;
}

/** Build the initial state for a game. `baseTrack` is the compiled stage 1 (no weather). */
export function createGame(
  config: GameConfig,
  seed: string,
  baseTrack: TrackGraph = stageTrack(config, 1),
): GameState {
  const modules = modulesFor(config, baseTrack);
  let rng = seedRng(seed);
  const seats = config.seats.filter((s) => s.controller.kind !== 'open');
  if (seats.length === 0) throw new Error('createGame: no occupied seats');
  const teams: TeamState[] = [];
  const riders: Record<RiderId, RiderState> = {};
  const oneRider = config.modules.peloton?.oneRiderEach === true;
  const colors = seatColors(config);
  seats.forEach((s) => {
    // One rider each (P-ONE-1): the seat's chosen rider only.
    const ids: RiderId[] = oneRider
      ? [`${s.seat}:${s.singleRider === 'sprinteur' ? 'S' : 'R'}`]
      : [`${s.seat}:R`, `${s.seat}:S`];
    const color = colors[s.seat]!;
    const dummy = s.controller.kind === 'dummy' ? s.controller.team : null;
    const team: TeamState = {
      team: s.seat,
      seat: s.seat,
      controller: s.controller.kind === 'open' ? 'human' : s.controller.kind,
      color,
      riders: ids,
      firstRider: null,
      dummy,
      sharedDeck: [],
      sharedPlayed: [],
      tourPoints: 0,
    };
    if (dummy === 'peloton') {
      const [deck, next] = shuffle(rng, pelotonDeck(s.seat));
      rng = next;
      team.sharedDeck = deck;
    }
    teams.push(team);
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
        tour: isTour(config)
          ? { seconds: 0, sprintPoints: 0, mountainPoints: 0, jersey: null, stageSeconds: 0 }
          : null,
      };
      if (dummy === 'peloton') {
        riders[id] = rider; // both riders draw from the team's shared deck
        continue;
      }
      const deck = startingDeck(id, rider.type);
      if (dummy === 'muscle' && rider.type === 'sprinteur') deck.push(muscleCard(s.seat));
      if (!dummy) for (let h = 0; h < (s.handicap ?? 0); h++) deck.push(exhaustionCard(rider));
      const [shuffled, next] = shuffle(rng, deck);
      rng = next;
      rider.drawPile = shuffled;
      riders[id] = rider;
    }
  });
  const state: GameState = {
    schema: 1,
    config,
    modules,
    rng,
    phase: 'placement',
    round: 0,
    stageNumber: 1,
    track: baseTrack,
    teams,
    riders,
    placementOrder: [],
    tokens: [],
    exhaustionSupply: null,
    result: null,
    breakaway: null,
    weather: [],
  };
  // Weather, token piles, placement order and the dummy teams' places (B-SET-5, D-007, G-TOU-3).
  setupStage(state, baseTrack);
  return state;
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
    teams: s.teams.map((t) => ({
      ...t,
      riders: [...t.riders],
      sharedDeck: [...t.sharedDeck],
      sharedPlayed: [...t.sharedPlayed],
    })),
    riders,
    placementOrder: [...s.placementOrder],
    tokens: s.tokens.map((t) => ({ ...t, remaining: [...t.remaining], reached: [...t.reached] })),
    result: s.result && [...s.result],
    weather: s.weather.map((w) => ({ ...w })),
    breakaway: s.breakaway && {
      round: s.breakaway.round,
      bids: Object.fromEntries(Object.entries(s.breakaway.bids).map(([k, v]) => [k, [...v]])),
    },
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
  if (!team || team.dummy) return [];
  if (state.phase === 'placement') {
    if (state.placementOrder[0] !== team.team) return [];
    const unplaced = team.riders.filter((id) => state.riders[id]!.position === null);
    return unplaced.flatMap((rider) =>
      placements(state).map((position) => ({ type: 'placeRider' as const, seat, rider, position })),
    );
  }
  if (state.phase === 'betweenStages') return [{ type: 'advance', seat }];
  if (state.phase === 'breakaway') {
    if (team.firstRider === null)
      return activeRiders(state, team).map((r) => ({
        type: 'chooseRider' as const,
        seat,
        rider: r.id,
      }));
    const bidder = state.riders[team.firstRider]!;
    return (bidder.hand ?? []).map((c) => ({
      type: 'playCard' as const,
      seat,
      rider: bidder.id,
      card: c.id,
    }));
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
      if (next.placementOrder.length === 0) {
        if (breakawayEnabled(next)) startBreakaway(next, events);
        else emit(next, events, { type: 'phaseChanged', phase: 'energy', round: 1 });
      }
      return { ok: true, state: next, events };
    }
    case 'chooseRider': {
      if (state.phase !== 'energy' && state.phase !== 'breakaway')
        return fail('WRONG_PHASE', 'Riders are chosen in the energy phase.');
      if (team.dummy) return fail('NOT_YOUR_TURN', 'Dummy teams play by themselves.');
      if (team.firstRider !== null)
        return fail('ALREADY_LOCKED', 'This team already chose a rider this round.');
      const rider = next.riders[action.rider]!;
      if (rider.finished) return fail('INVALID_ACTION', 'That rider has finished.');
      if (state.phase === 'breakaway') {
        chooseBidder(next, rider, events);
        return { ok: true, state: next, events };
      }
      emit(next, events, { type: 'riderChosen', team: team.team, rider: action.rider });
      deal(next, rider, new Hooks(next).handSize(rider.id), events);
      return { ok: true, state: next, events };
    }
    case 'playCard': {
      if (state.phase !== 'energy' && state.phase !== 'breakaway')
        return fail('WRONG_PHASE', 'Cards are played in the energy phase.');
      const rider = next.riders[action.rider]!;
      if (rider.locked) return fail('ALREADY_LOCKED', 'That rider already has a card locked in.');
      if (!rider.hand?.some((c) => c.id === action.card))
        return fail('CARD_NOT_IN_HAND', 'That card is not in the rider’s hand.');
      lockCard(rider, action.card);
      emit(next, events, { type: 'cardLocked', team: team.team, rider: rider.id });
      if (state.phase === 'breakaway') {
        afterBid(next, events);
        return { ok: true, state: next, events };
      }
      const other = activeRiders(next, nextTeam).find(
        (r) => r.id !== rider.id && !r.locked && !r.hand,
      );
      if (other) deal(next, other, new Hooks(next).handSize(other.id), events);
      const everyoneLocked = Object.values(next.riders).every(
        (r) => r.finished || r.locked !== null || isDummy(next, r.id),
      );
      if (everyoneLocked) {
        flipDummies(next, events);
        resolveRound(next, events);
      }
      return { ok: true, state: next, events };
    }
    case 'advance': {
      if (state.phase !== 'betweenStages')
        return fail('WRONG_PHASE', 'The tour moves on between stages.');
      startNextStage(next, events);
      return { ok: true, state: next, events };
    }
    default:
      return fail('NOT_IMPLEMENTED', `${action.type} arrives with a later milestone.`);
  }
}

function teamStatus(state: GameState, team: TeamState): TeamStatus {
  if (state.phase === 'breakaway') {
    if (team.dummy) return 'idle';
    if (team.firstRider === null) return 'choosingFirst';
    return state.riders[team.firstRider]!.locked ? 'locked' : 'choosingSecond';
  }
  if (state.phase !== 'energy') return 'idle';
  if (team.dummy) return 'locked';
  const riders = activeRiders(state, team);
  const locked = riders.filter((r) => r.locked).length;
  if (locked === riders.length) return 'locked';
  return locked === 0 ? 'choosingFirst' : 'choosingSecond';
}

/** The cards a rider can still draw: its own deck, or the Peloton team's shared deck. */
function deckOf(state: GameState, r: RiderState) {
  const team = state.teams.find((t) => t.team === r.team);
  return team?.dummy === 'peloton' ? team.sharedDeck : cardsInDeck(r);
}

function remainingValues(state: GameState, r: RiderState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of deckOf(state, r)) {
    const key = c.kind === 'attack' ? 'attack' : String(c.value);
    out[key] = (out[key] ?? 0) + 1;
  }
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
    drawPileCount:
      state.teams.find((t) => t.team === r.team)?.dummy === 'peloton'
        ? (state.teams.find((t) => t.team === r.team)?.sharedDeck.length ?? 0)
        : r.drawPile.length,
    exhaustionCount: cardsInDeck(r).filter((c) => c.kind === 'exhaustion').length,
    played: r.played.map((c) => ({ kind: c.kind, value: c.value })),
    ...(state.config.options.showRemainingValues
      ? { remainingValues: remainingValues(state, r) }
      : {}),
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
    stageId: stageOf(state.config, state.stageNumber).id,
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
    weather: state.weather.map((w) => ({ ...w })),
    tokens: state.tokens.map((t) => ({
      pile: t.pile,
      kind: t.kind,
      square: t.square,
      remaining: [...t.remaining],
    })),
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
    if (m.source === 'supply' && m.result > card.value) hints.push('boostedBySupply');
    if (m.source === 'crashRecovery') hints.push('standsUp');
  }
  if (path.some((id) => square(state.track, id).lanes === 1)) hints.push('narrowAhead');
  const end = path.at(-1);
  if (end !== undefined && square(state.track, end).terrain === 'cobblestone')
    hints.push('endsOnCobbles');
  const endWeather = end !== undefined ? square(state.track, end).weather : undefined;
  if (endWeather === 'wet') hints.push('wetLanding');
  if (endWeather === 'crosswind') hints.push('crosswindLanding');
  const occ = laneSets(occupancy(state, rider));
  const target = path.at(-1);
  if (target !== undefined && freeLane(state.track, occ.get(target), target) === undefined)
    hints.push('targetFull');
  const unobstructed: Position =
    target === undefined ? { ...r.position } : { square: target, lane: 0 };
  return { rider, cardValue: card.value, effectiveValue: value, unobstructed, path, hints };
}

/** The public part of a race that bots and clients can simulate from. */
export interface Board {
  riders: {
    id: RiderId;
    team: string;
    type: 'rouleur' | 'sprinteur';
    position: Position | null;
    finished: boolean;
    crashed: boolean;
  }[];
}

export const boardFromView = (view: GameView): Board => ({
  riders: view.riders.map((r) => ({
    id: r.id,
    team: r.team,
    type: r.type,
    // In tours, finished riders have left the road (G-FIN-1).
    position: r.finished && r.tour ? null : r.position && { ...r.position },
    finished: r.finished,
    crashed: r.crashed,
  })),
});

/** A minimal state with public positions only: enough for previews and round simulation. */
function liteState(
  board: Board,
  track: TrackGraph,
  config: GameConfig,
  phase: GameView['phase'] = 'energy',
): GameState {
  const riders: Record<RiderId, RiderState> = {};
  for (const r of board.riders) {
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
      specialist: null,
      tour: null,
    };
  }
  const teams: TeamState[] = config.seats
    .filter((s) => s.controller.kind !== 'open')
    .map((s) => ({
      team: s.seat,
      seat: s.seat,
      controller: s.controller.kind === 'dummy' ? 'dummy' : 'ai',
      color: 'red',
      riders: board.riders.filter((r) => r.team === s.seat).map((r) => r.id),
      firstRider: null,
      dummy: s.controller.kind === 'dummy' ? s.controller.team : null,
      sharedDeck: [],
      sharedPlayed: [],
      tourPoints: 0,
    }));
  return {
    schema: 1,
    config,
    modules: modulesFor(config, track),
    rng: [0, 0, 0, 0],
    phase,
    round: 1,
    stageNumber: 1,
    track,
    teams,
    riders,
    placementOrder: [],
    tokens: [],
    exhaustionSupply: null,
    result: null,
    breakaway: null,
    weather: [],
  };
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
  return previewMove(liteState(boardFromView(view), track, config, view.phase), rider, card);
}

export interface SimResult {
  board: Board;
  /** Riders that took an exhaustion card this round. */
  exhausted: RiderId[];
  /** Riders past the finish line after the round, front first. */
  crossed: RiderId[];
}

/**
 * Play one round from public positions with the given card values (movement, slipstream,
 * exhaustion), exactly as the engine would. Riders without a value do not move. For bots.
 */
export function simulateRound(
  board: Board,
  track: TrackGraph,
  config: GameConfig,
  plays: Readonly<Record<RiderId, number>>,
): SimResult {
  const state = liteState(board, track, config);
  for (const [id, value] of Object.entries(plays)) {
    const r = state.riders[id];
    if (r?.position && !r.finished)
      r.locked = { id: `sim:${id}`, kind: 'energy', value, powers: [] };
  }
  const events: GameEvent[] = [];
  const passed = movementPhase(state, events);
  endPhase(state, events, passed);
  const exhausted = events.flatMap((e) => (e.type === 'exhaustionTaken' ? [e.rider] : []));
  const ordered = Object.values(state.riders)
    .filter((r) => r.position)
    .sort((a, b) => compareFrontFirst(track, a.position!, b.position!));
  const crossed = ordered
    .filter((r) => square(track, r.position!.square).index >= track.finishIndex)
    .map((r) => r.id);
  return {
    board: {
      riders: board.riders.map((r) => ({
        ...r,
        position: state.riders[r.id]!.position && { ...state.riders[r.id]!.position! },
        crashed: state.riders[r.id]!.crashed,
      })),
    },
    exhausted,
    crossed,
  };
}
