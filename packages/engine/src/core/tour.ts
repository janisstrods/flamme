/**
 * The tour layer (Grand Tour campaign, docs/RULES_SPEC.md G-TOU-*, G-BTW-*, G-END-*): stage setup,
 * the end of a stage, the between-stages steps and the end of the tour. Racing itself is the
 * normal engine plus the `grandTour.tour` rule module (tokens, finish timing, card disposal).
 *
 * Dummy teams ride tours as pace riders (D-008): they earn no Tour Points, take no tokens and
 * appear in no classification (D-032).
 */
import {
  TILE_CATALOG,
  WEATHER_TOKENS,
  applyWeather,
  compileStage,
  tokenPiles,
  tourStages,
  weatherTiles,
} from '@velo/content';
import type { StageDefinition, TrackGraph, WeatherPlacement } from '@velo/content';
import type { GameConfig, GameEvent, Jersey, RiderId, TeamId } from '@velo/protocol';
import { nextInt, shuffle } from '../rng';
import type { GameState, RiderState, TeamState } from '../state';
import { isDummy, muscleCard, pelotonDeck, placeDummies } from './dummies';
import { startingDeck } from './cards';
import { emit } from './reducer';

export const isTour = (config: GameConfig) => config.mode.kind === 'tour';

/** The definition of stage `n` (1-based). */
export function stageOf(config: GameConfig, n: number): StageDefinition {
  if (config.mode.kind === 'tour') {
    const stage = tourStages(config.mode.schedule)[n - 1];
    if (!stage) throw new Error(`Stage ${n} is not in this tour`);
    return stage;
  }
  return config.mode.stage;
}

/** Compile stage `n` of a config (the host and every client do the same). */
export const stageTrack = (config: GameConfig, n = 1): TrackGraph =>
  compileStage(stageOf(config, n), TILE_CATALOG);

export const stageCount = (config: GameConfig) =>
  config.mode.kind === 'tour' ? tourStages(config.mode.schedule).length : 1;

const scoring = (state: Readonly<GameState>) => state.teams.filter((t) => !t.dummy);
const scoringRiders = (state: Readonly<GameState>) =>
  Object.values(state.riders).filter((r) => !isDummy(state, r.id) && r.tour);

/**
 * Set up the stage whose base track is given: weather (M-SET-1), token piles (G-TOK-2), the
 * placement order and the dummy teams' places. Riders must already be off the track.
 */
export function setupStage(state: GameState, baseTrack: TrackGraph): void {
  const { config } = state;
  const stage = stageOf(config, state.stageNumber);
  let weather: WeatherPlacement[] = [];
  if (config.modules.meteo) {
    if (config.modules.meteo.placements && config.mode.kind === 'single')
      weather = [...config.modules.meteo.placements];
    else {
      const [tokens, next] = shuffle(state.rng, WEATHER_TOKENS);
      state.rng = next;
      weatherTiles(stage, TILE_CATALOG).forEach((tile, i) => {
        const effect = tokens[i];
        if (effect) weather.push({ tile, effect });
      });
    }
  }
  state.weather = weather;
  state.track = applyWeather(baseTrack, weather);

  state.tokens = [];
  if (isTour(config)) {
    const piles = tokenPiles(stage, baseTrack);
    state.tokens = [
      { pile: 'major', ...piles.major, remaining: [5, 3, 1], reached: [] },
      { pile: 'minor', ...piles.minor, remaining: [2, 1], reached: [] },
    ];
  }

  const placing = state.teams.filter((t) => !t.dummy);
  if (isTour(config) && state.stageNumber > 1) {
    // G-TOU-3: fewest Tour Points first; on a tie, the team with the better GC rider goes later.
    const bestTime = (t: TeamState) =>
      Math.min(...t.riders.map((id) => state.riders[id]!.tour?.seconds ?? 0));
    state.placementOrder = [...placing]
      .sort((a, b) => a.tourPoints - b.tourPoints || bestTime(b) - bestTime(a))
      .map((t) => t.team);
  } else if (placing.length > 0) {
    // B-SET-5 / D-007 (and G-TOU-3 for stage 1): a random team first, then clockwise.
    const [first, next] = nextInt(state.rng, placing.length);
    state.rng = next;
    state.placementOrder = placing.map((_, i) => placing[(first + i) % placing.length]!.team);
  } else state.placementOrder = [];
  placeDummies(state);
  if (state.placementOrder.length === 0) {
    state.phase = 'energy';
    state.round = 1;
  } else {
    state.phase = 'placement';
    state.round = 0;
  }
}

// ---------------------------------------------------------------------------
// Rankings (ties: whoever crossed the line first on the latest stage, G-BTW-2, G-END-2)
// ---------------------------------------------------------------------------

const lastPlace = (r: RiderState) => r.finishPlace ?? Number.MAX_SAFE_INTEGER;

export function rankRiders(
  state: Readonly<GameState>,
  by: 'time' | 'sprint' | 'mountain',
): RiderState[] {
  const value = (r: RiderState) =>
    by === 'time'
      ? r.tour!.seconds
      : -(by === 'sprint' ? r.tour!.sprintPoints : r.tour!.mountainPoints);
  return scoringRiders(state).sort((a, b) => value(a) - value(b) || lastPlace(a) - lastPlace(b));
}

const points = (r: RiderState, by: 'sprint' | 'mountain') =>
  by === 'sprint' ? r.tour!.sprintPoints : r.tour!.mountainPoints;

/** Classification leaders with something to lead (sprint and mountain need points). */
function leaders(state: Readonly<GameState>): RiderState[] {
  const out = [rankRiders(state, 'time')[0]];
  for (const by of ['sprint', 'mountain'] as const) {
    const top = rankRiders(state, by)[0];
    if (top && points(top, by) > 0) out.push(top);
  }
  return out.filter((r): r is RiderState => r !== undefined);
}

/** G-BTW-2: one jersey per rider, yellow > green > polka dot; a displaced jersey goes down the list. */
export function jerseyHolders(state: Readonly<GameState>): Partial<Record<Jersey, RiderId>> {
  const out: Partial<Record<Jersey, RiderId>> = {};
  const taken = new Set<RiderId>();
  const yellow = rankRiders(state, 'time')[0];
  if (yellow) {
    out.yellow = yellow.id;
    taken.add(yellow.id);
  }
  for (const [jersey, by] of [
    ['green', 'sprint'],
    ['polkaDot', 'mountain'],
  ] as const) {
    const r = rankRiders(state, by).find((x) => points(x, by) > 0 && !taken.has(x.id));
    if (r) {
      out[jersey] = r.id;
      taken.add(r.id);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// End of a stage, between stages, end of the tour
// ---------------------------------------------------------------------------

/** Tour finish check: the stage ends once every rider has crossed the line (G-FIN-1). */
export function tourFinishCheck(state: GameState, events: GameEvent[]): boolean {
  if (Object.values(state.riders).some((r) => !r.finished && r.position)) return false;
  endStage(state, events);
  return true;
}

/** G-BTW-1: return half the exhaustion cards (rounded down). Private card moves are direct. */
function returnHalfExhaustion(state: GameState, r: RiderState, events: GameEvent[]): void {
  const count = Math.floor(
    [...r.drawPile, ...r.recycled].filter((c) => c.kind === 'exhaustion').length / 2,
  );
  let left = count;
  const keep = (pile: typeof r.drawPile) =>
    pile.filter((c) => !(c.kind === 'exhaustion' && left-- > 0));
  r.recycled = keep(r.recycled);
  r.drawPile = keep(r.drawPile);
  emit(state, events, { type: 'exhaustionReturned', rider: r.id, count });
}

function endStage(state: GameState, events: GameEvent[]): void {
  const order = Object.values(state.riders)
    .filter((r) => r.finished)
    .sort((a, b) => lastPlace(a) - lastPlace(b));
  emit(state, events, { type: 'stageEnded', order: order.map((r) => r.id) });

  // G-POD-1: 3, 2 and 1 Tour Points for the first three (scoring) riders across the line.
  order
    .filter((r) => !isDummy(state, r.id))
    .slice(0, 3)
    .forEach((r, i) =>
      emit(state, events, {
        type: 'tourPointsAwarded',
        team: r.team,
        points: 3 - i,
        reason: 'podium',
      }),
    );

  // G-BTW-1: energy cards back into the decks, half the exhaustion cards back to the supply.
  for (const r of scoringRiders(state)) {
    r.drawPile.push(...r.setAside);
    r.setAside = [];
    returnHalfExhaustion(state, r, events);
  }

  // G-BTW-2: jerseys.
  const holders = jerseyHolders(state);
  for (const jersey of ['yellow', 'green', 'polkaDot'] as const) {
    const rider = holders[jersey];
    if (rider) emit(state, events, { type: 'jerseyAwarded', jersey, rider });
  }

  // G-BTW-3: a rest day after this stage.
  if (restDayAfter(state.config, state.stageNumber)) {
    const lead = leaders(state);
    for (const r of lead)
      emit(state, events, {
        type: 'tourPointsAwarded',
        team: r.team,
        points: 1,
        reason: 'restDay',
      });
    for (const r of scoringRiders(state))
      if (!lead.includes(r)) returnHalfExhaustion(state, r, events);
  }

  if (state.stageNumber >= stageCount(state.config)) endTour(state, events);
  else emit(state, events, { type: 'phaseChanged', phase: 'betweenStages', round: 0 });
}

/** Is there a rest day right after stage `n`? */
export function restDayAfter(config: GameConfig, n: number): boolean {
  if (config.mode.kind !== 'tour') return false;
  let stage = 0;
  for (const item of config.mode.schedule) {
    if (item === 'rest') {
      if (stage === n) return true;
      continue;
    }
    stage++;
  }
  return false;
}

/** G-END-1: bonus Tour Points by classification and tour length (two players: first column). */
export const BONUS = {
  general: [
    [3, 2, 1],
    [4, 3, 2, 1],
    [5, 4, 3, 2, 1],
  ],
  team: [[1], [2, 1], [3, 2, 1]],
  sprint: [
    [2, 1],
    [3, 2, 1],
    [4, 3, 2, 1],
  ],
  mountain: [
    [2, 1],
    [3, 2, 1],
    [4, 3, 2, 1],
  ],
} as const;

export function bonusColumn(stages: number, players: number): 0 | 1 | 2 {
  if (players <= 2 || stages <= 7) return 0;
  return stages <= 14 ? 1 : 2;
}

function endTour(state: GameState, events: GameEvent[]): void {
  const col = bonusColumn(stageCount(state.config), scoring(state).length);
  const award = (
    team: TeamId,
    points: number,
    reason: 'generalBonus' | 'teamBonus' | 'sprintBonus' | 'mountainBonus',
  ) => emit(state, events, { type: 'tourPointsAwarded', team, points, reason });

  rankRiders(state, 'time').forEach((r, i) => {
    const p = BONUS.general[col][i];
    if (p) award(r.team, p, 'generalBonus');
  });
  const teamTime = (t: TeamState) =>
    t.riders.reduce((s, id) => s + (state.riders[id]!.tour?.seconds ?? 0), 0);
  const bestPlace = (t: TeamState) =>
    Math.min(...t.riders.map((id) => lastPlace(state.riders[id]!)));
  [...scoring(state)]
    .sort((a, b) => teamTime(a) - teamTime(b) || bestPlace(a) - bestPlace(b))
    .forEach((t, i) => {
      const p = BONUS.team[col][i];
      if (p) award(t.team, p, 'teamBonus');
    });
  for (const by of ['sprint', 'mountain'] as const)
    rankRiders(state, by)
      .filter((r) => points(r, by) > 0)
      .forEach((r, i) => {
        const p = BONUS[by][col][i];
        if (p) award(r.team, p, by === 'sprint' ? 'sprintBonus' : 'mountainBonus');
      });

  // G-END-2: most Tour Points wins; ties to whoever crossed first on the last stage.
  const ranking = [...scoring(state)]
    .sort((a, b) => b.tourPoints - a.tourPoints || bestPlace(a) - bestPlace(b))
    .map((t) => t.team);
  emit(state, events, { type: 'tourEnded', ranking });
  emit(state, events, { type: 'phaseChanged', phase: 'tourEnd', round: 0 });
}

/** The `advance` action between stages: set up and start the next stage. */
export function startNextStage(state: GameState, events: GameEvent[]): void {
  const n = state.stageNumber + 1;
  const stage = stageOf(state.config, n);
  for (const t of state.teams) {
    t.firstRider = null;
    if (t.dummy === 'peloton') {
      const [deck, rng] = shuffle(state.rng, pelotonDeck(t.seat));
      state.rng = rng;
      t.sharedDeck = deck;
      t.sharedPlayed = [];
    }
  }
  for (const r of Object.values(state.riders)) {
    r.position = null;
    r.hand = null;
    r.locked = null;
    r.played = [];
    r.crashed = false;
    r.finished = false;
    r.finishPlace = null;
    if (r.tour) r.tour.stageSeconds = 0;
    const team = state.teams.find((t) => t.team === r.team)!;
    let deck = [...r.drawPile, ...r.recycled, ...r.setAside];
    // Dummy teams start every stage with fresh decks; the Peloton team's is shared.
    if (team.dummy === 'peloton') deck = [];
    else if (team.dummy === 'muscle') {
      deck = startingDeck(r.id, r.type);
      if (r.type === 'sprinteur') deck.push(muscleCard(team.seat));
    }
    const [shuffled, rng] = shuffle(state.rng, deck);
    state.rng = rng;
    r.drawPile = shuffled;
    r.recycled = [];
    r.setAside = [];
  }
  state.result = null;
  state.breakaway = null;
  emit(state, events, { type: 'stageStarted', stageId: stage.id, stageNumber: n });
  setupStage(state, compileStage(stage, TILE_CATALOG));
  emit(state, events, { type: 'phaseChanged', phase: state.phase, round: state.round });
}
