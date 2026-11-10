/**
 * Round resolution once every rider has a locked card: reveal, movement, end phase, finish.
 * Mutates `state` (a fresh clone) and appends public events.
 */
import type { SquareId } from '@velo/content';
import type { GameEvent, Position, RiderId } from '@velo/protocol';
import type { GameState, RiderState } from '../state';
import { Hooks } from './compose';
import { tourFinishCheck } from './tour';
import { emit } from './reducer';
import { laneSets, occupancy, onTrack, pathFrom, ridersFrontFirst, square } from './track';

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
  const path = pathFrom(state.track, from.square, value);
  const occ = laneSets(occupancy(state, id));
  const landed = hooks.landing({ rider: id, from, path, effectiveValue: value }, occ);
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
  const crash = hooks.crashCheck(id, landed, blocked);
  if (crash)
    emit(state, events, { type: 'riderCrashed', riders: [id], at: landed.square, cause: crash });
  const shifted = hooks.afterMove(id, card, landed, laneSets(occupancy(state, id)));
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
  for (const r of Object.values(state.riders)) {
    if (!r.locked) continue;
    const disposal = hooks.cardDisposal(r.id, r.locked);
    if (disposal === 'setAside') r.setAside.push(r.locked);
    r.played.push(r.locked);
    r.locked = null;
  }
  slipstream(state, hooks, events);
  for (const ev of hooks.endOfRound(passed)) emit(state, events, ev);
  const occ = occupancy(state);
  for (const r of ridersFrontFirst(state)) {
    if (r.finished) continue;
    const next = square(state.track, r.position!.square).next[0];
    const base = next !== undefined && !occ.has(next);
    if (hooks.exhaustion(r.id, base)) emit(state, events, { type: 'exhaustionTaken', rider: r.id });
  }
}

function ridersOn(state: GameState, sq: SquareId): RiderState[] {
  return Object.values(state.riders)
    .filter((r) => onTrack(r) && r.position!.square === sq)
    .sort((a, b) => a.position!.lane - b.position!.lane);
}

/** Packs rear first; each pack lists its squares rear to front. */
function packs(state: GameState): SquareId[][] {
  const occ = occupancy(state);
  const squares = [...occ.keys()].sort(
    (a, b) => square(state.track, a).index - square(state.track, b).index,
  );
  const out: SquareId[][] = [];
  for (const sq of squares) {
    const last = out.at(-1);
    if (last && square(state.track, last.at(-1)!).next.includes(sq)) last.push(sq);
    else out.push([sq]);
  }
  return out;
}

/** The occupied run of squares ending at `front`, rear to front. */
function packEndingAt(state: GameState, front: SquareId): SquareId[] {
  const occ = occupancy(state);
  const run = [front];
  let cur = square(state.track, front).prev[0];
  while (cur !== undefined && occ.has(cur)) {
    run.unshift(cur);
    cur = square(state.track, cur).prev[0];
  }
  return run;
}

/**
 * B-END-2 with P-SUP-2: rear pack first; a pack exactly one empty square behind the next moves up
 * one square and merges, then the merged pack is checked against the next one. Within a pack, only
 * the squares in front of the rearmost square that cannot receive slipstream move.
 */
function slipstream(state: GameState, hooks: Hooks, events: GameEvent[]): void {
  const initial = packs(state);
  let current: SquareId[] | undefined = initial[0];
  for (let p = 0; p + 1 < initial.length && current; p++) {
    const nextPack = initial[p + 1]!;
    const front = current.at(-1)!;
    const gap = square(state.track, front).next[0];
    const giver = gap === undefined ? undefined : square(state.track, gap).next[0];
    const ids = (sq: SquareId) => ridersOn(state, sq).map((r) => r.id);
    const gives =
      gap !== undefined &&
      giver !== undefined &&
      giver === nextPack[0] &&
      hooks.slipstreamEligible('give', giver, ids(giver));
    if (gives) {
      const movers: SquareId[] = [];
      for (let i = current.length - 1; i >= 0; i--) {
        const sq = current[i]!;
        if (!hooks.slipstreamEligible('receive', sq, ids(sq))) break;
        movers.unshift(sq);
      }
      // Squares move front first, so each destination is empty when its riders arrive.
      const moves: { rider: RiderId; from: Position; to: Position }[] = [];
      const shifts: { rider: RiderId; from: Position; to: Position }[] = [];
      let dest = gap!;
      for (let i = movers.length - 1; i >= 0; i--) {
        const src = movers[i]!;
        const destLanes = square(state.track, dest).lanes;
        const onSrc = ridersOn(state, src);
        // Keep lanes when everyone fits in their own lane; otherwise fill from the right.
        const keep = onSrc.every((r) => r.position!.lane < destLanes);
        onSrc.slice(0, destLanes).forEach((r, k) => {
          const lane = keep ? r.position!.lane : k;
          moves.push({ rider: r.id, from: { ...r.position! }, to: { square: dest, lane } });
        });
        const stayed = onSrc.slice(destLanes);
        if (stayed.length > 0) {
          // Narrowing (P-SUP-2): riders that do not fit stay and shift right; riders behind stay.
          stayed.forEach((r, k) => {
            if (r.position!.lane !== k)
              shifts.push({ rider: r.id, from: { ...r.position! }, to: { square: src, lane: k } });
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
    current = packEndingAt(state, nextPack.at(-1)!);
  }
}

/** Finish check after the end phase (B-FIN-*). Returns true when the stage has ended. */
export function finishCheck(state: GameState, events: GameEvent[]): boolean {
  if (state.config.mode.kind === 'tour') return tourFinishCheck(state, events);
  const order = ridersFrontFirst(state);
  const crossed = order.filter(
    (r) => square(state.track, r.position!.square).index >= state.track.finishIndex,
  );
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
  if (!finishCheck(state, events))
    emit(state, events, { type: 'phaseChanged', phase: 'energy', round: state.round + 1 });
}
