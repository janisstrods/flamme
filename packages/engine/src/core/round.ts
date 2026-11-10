/**
 * Round resolution once every rider has a locked card: reveal, movement, end phase, finish.
 * Mutates `state` (a fresh clone) and appends public events.
 */
import type { SquareId } from '@velo/content';
import type { GameEvent, Position, RiderId } from '@velo/protocol';
import type { GameState, RiderState } from '../state';
import { Hooks } from './compose';
import { maybeStartRefresh } from './refresh';
import { tourFinishCheck } from './tour';
import { emit } from './reducer';
import {
  groupOf,
  hasSplits,
  laneSets,
  occupancy,
  onTrack,
  pastTheLine,
  pathsFrom,
  ridersFrontFirst,
  routeOf,
  square,
} from './track';
import type { Occupancy } from './track';

const publicCard = (r: RiderState) => ({ kind: r.locked!.kind, value: r.locked!.value });

/** Movement phase for the given riders (all riders with a locked card in normal play). */
export function movementPhase(state: GameState, events: GameEvent[]): Map<RiderId, SquareId[]> {
  const hooks = new Hooks(state);
  const movers = ridersFrontFirst(state).filter((r) => r.locked !== null);
  emit(state, events, { type: 'phaseChanged', phase: 'movement', round: state.round });
  emit(state, events, {
    type: 'cardsRevealed',
    plays: movers.map((r) => ({ rider: r.id, card: publicCard(r) })),
  });
  for (const r of movers) for (const ev of hooks.onReveal(r.id, r.locked!)) emit(state, events, ev);

  const passed = new Map<RiderId, SquareId[]>();
  // Order is decided once, before anyone moves (B-MOV-2), then modules may reorder it.
  for (const id of hooks.movementOrder(movers.map((r) => r.id))) {
    passed.set(id, moveRider(state, hooks, id, events));
  }
  return passed;
}

function moveRider(state: GameState, hooks: Hooks, id: RiderId, events: GameEvent[]): SquareId[] {
  const r = state.riders[id]!;
  const card = r.locked!;
  const from: Position = { ...r.position! };
  const { value, modifiers } = hooks.effectiveValue(id, card);
  const occ = laneSets(occupancy(state, id, groupOf(state, id)));
  // G-RND-2 / G-RND-3: through a split, take the inner branch if the whole move fits there, else
  // the outer one; if neither fits, the branch that moves furthest (inner on a tie).
  let path: SquareId[] = [];
  let landed: Position = from;
  let best = -1;
  for (const candidate of pathsFrom(state.track, from.square, value)) {
    const at = hooks.landing({ rider: id, from, path: candidate, effectiveValue: value }, occ);
    const moved = at.square === from.square ? 0 : candidate.indexOf(at.square) + 1;
    const score = (at.square === (candidate.at(-1) ?? from.square) ? 1000 : 0) + moved;
    if (score > best) {
      best = score;
      path = candidate;
      landed = at;
    }
  }
  // G-SPC-7 Nimble: the rider always reaches its square (the inner lane on a roundabout) and takes
  // the rightmost lane, pushing others left, or the verge if the square is full. Passing a square
  // where every lane has crashed still stops it behind that square, and it crashes.
  const nimble = card.powers.includes('nimble');
  let nimbleCrash = false;
  const pushes: { rider: RiderId; from: Position; to: Position }[] = [];
  if (nimble) {
    path = pathsFrom(state.track, from.square, value)[0] ?? [];
    const crashedEverywhere = (sq: SquareId) => {
      const lanes = new Set(
        Object.values(state.riders)
          .filter(
            (x) =>
              x.crashed &&
              x.id !== id &&
              x.position?.square === sq &&
              onTrack(x) &&
              // Time trials: other teams' riders are not there at all (G-TTT-1, G-ITT-1).
              groupOf(state, x.id) === groupOf(state, id),
          )
          .map((x) => x.position!.lane),
      );
      return [...Array(square(state.track, sq).lanes).keys()].every((l) => lanes.has(l));
    };
    if (path.some(crashedEverywhere)) {
      nimbleCrash = true;
      landed = hooks.landing({ rider: id, from, path, effectiveValue: value }, occ);
    } else if (path.length > 0) {
      const dest = path.at(-1)!;
      const lanes = square(state.track, dest).lanes;
      const here = Object.values(state.riders).filter(
        (x) =>
          x.id !== id &&
          onTrack(x) &&
          x.position!.square === dest &&
          groupOf(state, x.id) === groupOf(state, id),
      );
      const taken = new Set(here.map((x) => x.position!.lane));
      const free = [...Array(lanes).keys()].find((l) => !taken.has(l));
      if (free === undefined) {
        const verge = here.filter((x) => x.position!.lane < 0).length;
        landed = { square: dest, lane: -1 - verge };
      } else {
        for (const x of here.filter((x) => x.position!.lane >= 0 && x.position!.lane < free))
          pushes.push({
            rider: x.id,
            from: { ...x.position! },
            to: { square: dest, lane: x.position!.lane + 1 },
          });
        landed = { square: dest, lane: 0 };
      }
    }
  }
  for (const p of pushes.sort((a, b) => b.from.lane - a.from.lane))
    emit(state, events, { type: 'riderShifted', ...p, reason: 'nimblePushed' });
  const target = path.at(-1) ?? from.square;
  const blocked = landed.square !== target;
  const landedPath =
    landed.square === from.square ? [] : path.slice(0, path.indexOf(landed.square) + 1);
  const isAscent = (sq: string) => square(state.track, sq).terrain === 'ascent';
  const ascentEdge =
    modifiers.some((m) => m.source === 'ascent' && m.result >= 5) &&
    !isAscent(from.square) &&
    !path.some(isAscent);
  emit(state, events, {
    type: 'riderMoved',
    rider: id,
    from,
    to: landed,
    cardValue: card.value,
    effectiveValue: value,
    modifiers,
    path: landedPath,
    blocked,
    ...(ascentEdge ? { ascentEdge: true } : {}),
  });
  const crash =
    hooks.crashCheck(id, landed, blocked) ??
    (nimbleCrash
      ? square(state.track, landed.square).weather === 'wet'
        ? 'wet'
        : 'sharpCorner'
      : null);
  if (crash)
    emit(state, events, { type: 'riderCrashed', riders: [id], at: landed.square, cause: crash });
  const shifted = hooks.afterMove(
    id,
    card,
    landed,
    laneSets(occupancy(state, id, groupOf(state, id))),
  );
  if (shifted)
    emit(state, events, {
      type: 'riderShifted',
      rider: id,
      from: landed,
      to: shifted,
      reason: 'chase',
    });
  return landedPath;
}

/** End phase: dispose of played cards, slipstream, end-of-round effects, exhaustion (B-END-*). */
export function endPhase(
  state: GameState,
  events: GameEvent[],
  passed: Map<RiderId, SquareId[]>,
): void {
  const hooks = new Hooks(state);
  emit(state, events, { type: 'phaseChanged', phase: 'end', round: state.round });
  const playedNow = new Map(
    Object.values(state.riders).flatMap((r) => (r.locked ? [[r.id, r.locked.value] as const] : [])),
  );
  for (const r of Object.values(state.riders)) {
    if (!r.locked) continue;
    const disposal = hooks.cardDisposal(r.id, r.locked);
    if (disposal === 'setAside') r.setAside.push(r.locked);
    r.played.push(r.locked);
    r.locked = null;
  }
  slipstream(state, hooks, events);
  // G-FIN-1: exhaustion (step 5) comes before finishers leave the road (step 6), so a rider
  // right behind one who crossed the line this round is still sheltered. Remember who is where
  // before the finishers are taken off.
  const before = new Map<string, Occupancy>();
  for (const r of Object.values(state.riders)) {
    const group = groupOf(state, r.id);
    if (!before.has(group)) before.set(group, occupancy(state, undefined, group));
  }
  for (const ev of hooks.endOfRound(passed)) emit(state, events, ev);
  // G-ITT-1: in an individual time trial the rouleur and the sprinteur that played the highest
  // card this round take exhaustion (all of them on a tie), whatever lies ahead.
  const highest = (type: string) =>
    Math.max(
      -1,
      ...[...playedNow].filter(([id]) => state.riders[id]!.type === type).map(([, v]) => v),
    );
  const top = { rouleur: highest('rouleur'), sprinteur: highest('sprinteur') };
  for (const r of ridersFrontFirst(state)) {
    if (r.finished) continue;
    let base: boolean;
    if (state.stageType === 'individualTimeTrial')
      base = playedNow.has(r.id) && playedNow.get(r.id) === top[r.type];
    else {
      // An empty square directly ahead (on every branch, before a split: G-RND-5) means
      // exhaustion; in a team time trial only teammates count (G-TTT-1).
      const occ =
        before.get(groupOf(state, r.id)) ?? occupancy(state, undefined, groupOf(state, r.id));
      const next = square(state.track, r.position!.square).next;
      base = next.length > 0 && next.every((n) => !occ.has(n));
    }
    if (hooks.exhaustion(r.id, base)) emit(state, events, { type: 'exhaustionTaken', rider: r.id });
  }
}

function ridersOnSquare(state: GameState, sq: SquareId, group?: string): RiderState[] {
  return Object.values(state.riders)
    .filter(
      (r) =>
        onTrack(r) &&
        r.position!.square === sq &&
        (group === undefined || groupOf(state, r.id) === group),
    )
    .sort((a, b) => a.position!.lane - b.position!.lane);
}

/**
 * B-END-2 with P-SUP-2 and G-RND-5: slipstream along the stage. On stages with splits
 * (roundabouts) the inner route is resolved first, then the outer one; each pass sees only its
 * own branch, so the branches never give each other slipstream, while riders on the shared
 * squares before a split take part in both.
 */
function slipstream(state: GameState, hooks: Hooks, events: GameEvent[]): void {
  // Time trials: each team (or rider) slipstreams on its own; an individual one has none.
  const groups =
    state.stageType === 'individualTimeTrial'
      ? []
      : state.stageType === 'teamTimeTrial'
        ? state.teams.map((t) => t.team)
        : [undefined];
  for (const group of groups) {
    slipstreamAlong(state, hooks, events, routeOf(state.track, 'inner'), group);
    if (hasSplits(state.track))
      slipstreamAlong(state, hooks, events, routeOf(state.track, 'outer'), group);
  }
}

/**
 * Rear pack first: a pack exactly one empty square behind the next moves up one square and
 * merges, then the merged pack is checked against the next one. Within a pack, only the squares
 * in front of the rearmost square that cannot receive slipstream move.
 */
function slipstreamAlong(
  state: GameState,
  hooks: Hooks,
  events: GameEvent[],
  line: readonly SquareId[],
  group?: string,
): void {
  const ridersOn = (st: GameState, sq: SquareId) => ridersOnSquare(st, sq, group);
  const occupied = (sq: SquareId | undefined) => sq !== undefined && ridersOn(state, sq).length > 0;
  /** The occupied run of squares ending at line position `front`, rear to front. */
  const packEnding = (front: number): number[] => {
    const run = [front];
    while (run[0]! > 0 && occupied(line[run[0]! - 1])) run.unshift(run[0]! - 1);
    return run;
  };
  const initial: number[][] = [];
  line.forEach((sq, i) => {
    if (!occupied(sq)) return;
    const last = initial.at(-1);
    if (last && last.at(-1) === i - 1) last.push(i);
    else initial.push([i]);
  });
  const ids = (sq: SquareId) => ridersOn(state, sq).map((r) => r.id);
  let current: number[] | undefined = initial[0];
  for (let p = 0; p + 1 < initial.length && current; p++) {
    const nextPack = initial[p + 1]!;
    const gap = current.at(-1)! + 1;
    const giver = gap + 1;
    const gives =
      giver === nextPack[0] &&
      !occupied(line[gap]) &&
      hooks.slipstreamEligible('give', line[giver]!, ids(line[giver]!));
    if (gives) {
      const movers: number[] = [];
      for (let k = current.length - 1; k >= 0; k--) {
        const sq = line[current[k]!]!;
        if (!hooks.slipstreamEligible('receive', sq, ids(sq))) break;
        movers.unshift(current[k]!);
        // A square that gives no slipstream (Breakaway, G-SPC-8) holds back the riders behind it.
        if (!hooks.slipstreamEligible('give', sq, ids(sq))) break;
      }
      // Squares move front first, so each destination is empty when its riders arrive.
      const moves: { rider: RiderId; from: Position; to: Position }[] = [];
      const shifts: { rider: RiderId; from: Position; to: Position }[] = [];
      let dest = line[gap]!;
      for (let k = movers.length - 1; k >= 0; k--) {
        const src = line[movers[k]!]!;
        const destLanes = square(state.track, dest).lanes;
        const onSrc = ridersOn(state, src);
        // Keep lanes when everyone fits in their own lane; otherwise fill from the right.
        // (Riders on the verge, Nimble, are placed like anyone else: G-SPC-7.)
        const keep = onSrc.every((r) => r.position!.lane >= 0 && r.position!.lane < destLanes);
        onSrc.slice(0, destLanes).forEach((r, n) => {
          const lane = keep ? r.position!.lane : n;
          moves.push({ rider: r.id, from: { ...r.position! }, to: { square: dest, lane } });
        });
        const stayed = onSrc.slice(destLanes);
        if (stayed.length > 0) {
          // Narrowing (P-SUP-2): riders that do not fit stay and shift right; riders behind stay.
          stayed.forEach((r, n) => {
            if (r.position!.lane !== n)
              shifts.push({ rider: r.id, from: { ...r.position! }, to: { square: src, lane: n } });
          });
          break;
        }
        dest = src;
      }
      if (moves.length > 0)
        emit(state, events, { type: 'slipstream', riders: moves.map((m) => m.rider), moves });
      for (const sh of shifts)
        emit(state, events, { type: 'riderShifted', ...sh, reason: 'narrowing' });
    }
    current = packEnding(nextPack.at(-1)!);
  }
}

/** Finish check after the end phase (B-FIN-*). Returns true when the stage has ended. */
export function finishCheck(state: GameState, events: GameEvent[]): boolean {
  if (state.config.mode.kind === 'tour') return tourFinishCheck(state, events);
  const order = ridersFrontFirst(state);
  const crossed = order.filter((r) => pastTheLine(state.track, r.position!.square));
  if (crossed.length === 0) return false;
  crossed.forEach((r, i) =>
    emit(state, events, { type: 'riderFinished', rider: r.id, place: i + 1 }),
  );
  emit(state, events, { type: 'stageEnded', order: order.map((r) => r.id) });
  emit(state, events, { type: 'phaseChanged', phase: 'stageEnd', round: state.round });
  return true;
}

export function resolveRound(state: GameState, events: GameEvent[]): void {
  const passed = movementPhase(state, events);
  endPhase(state, events, passed);
  if (!finishCheck(state, events) && !maybeStartRefresh(state, events))
    emit(state, events, { type: 'phaseChanged', phase: 'energy', round: state.round + 1 });
}
