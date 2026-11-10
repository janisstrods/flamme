/**
 * Specialist draft (docs/RULES_SPEC.md G-SPC-1, G-SPC-2): before stage 1, teams pick one
 * specialist per rider in a random order, then in reverse order for their second rider. With four
 * or more teams there are two copies of each specialist, otherwise one. The pick changes the
 * rider's deck for the whole tour (or race). Dummy teams do not draft.
 */
import { SPECIALISTS } from '@velo/content';
import type { Specialist } from '@velo/content';
import type { Action, Card, GameEvent, RiderId, SeatId } from '@velo/protocol';
import { shuffle } from '../rng';
import type { GameState, RiderState } from '../state';
import { emit } from './reducer';

export const specialistsOn = (state: Readonly<GameState>) =>
  state.config.modules.grandTour?.specialists === true;

export const specialistById = (id: string): Specialist | undefined =>
  SPECIALISTS.find((s) => s.id === id);

/** Copies of each specialist for a field of `teams` drafting teams. */
export const copiesFor = (teams: number) => (teams >= 4 ? 2 : 1);

/** Set up the draft: a random order of drafting teams, snaked for the second pick. */
export function startDraft(state: GameState): void {
  const teams = state.teams.filter((t) => !t.dummy);
  const [order, rng] = shuffle(
    state.rng,
    teams.map((t) => t.team),
  );
  state.rng = rng;
  const twoRiders = teams.some((t) => t.riders.length > 1);
  state.draft = {
    order: twoRiders ? [...order, ...[...order].reverse()] : order,
    pool: Object.fromEntries(SPECIALISTS.map((s) => [s.id, copiesFor(teams.length)])),
  };
  state.phase = 'draft';
  state.round = 0;
}

export function draftActions(state: Readonly<GameState>, seat: SeatId): Action[] {
  const d = state.draft;
  const team = state.teams.find((t) => t.seat === seat);
  if (!d || !team || d.order[0] !== team.team) return [];
  const out: Action[] = [];
  for (const id of team.riders) {
    const r = state.riders[id]!;
    if (r.specialist) continue;
    for (const s of SPECIALISTS)
      if (s.riderType === r.type && (d.pool[s.id] ?? 0) > 0)
        out.push({ type: 'draftSpecialist', seat, rider: id, specialist: s.id });
  }
  return out;
}

/** G-SPC-2: swap the specialist's cards into the rider's deck, then shuffle it. */
function applySwaps(state: GameState, r: RiderState, s: Specialist): void {
  let deck = [...r.drawPile, ...r.recycled];
  for (const e of s.removes)
    for (let i = 0; i < e.count; i++) {
      const at = deck.findIndex(
        (c) => c.kind === e.kind && c.value === e.value && c.powers.length === 0,
      );
      if (at >= 0) deck.splice(at, 1);
    }
  let n = 0;
  for (const e of s.adds)
    for (let i = 0; i < e.count; i++)
      deck.push({
        id: `${r.id}#s${n++}`,
        kind: e.kind,
        value: e.value,
        powers: [...e.powers],
      } as Card);
  const [shuffled, rng] = shuffle(state.rng, deck);
  state.rng = rng;
  deck = shuffled;
  r.drawPile = deck;
  r.recycled = [];
}

/** A team picks a specialist for one of its riders; the draft ends after the last pick. */
export function draftPick(
  state: GameState,
  rider: RiderId,
  specialist: string,
  events: GameEvent[],
  afterDraft: () => void,
): string | null {
  const r = state.riders[rider]!;
  const s = specialistById(specialist);
  if (!state.draft || state.draft.order[0] !== r.team) return 'Another team is picking.';
  if (!s || (state.draft.pool[specialist] ?? 0) <= 0) return 'That specialist is not available.';
  if (r.specialist) return 'That rider already has a specialist.';
  if (s.riderType !== r.type) return `That specialist rides as a ${s.riderType}.`;
  emit(state, events, { type: 'specialistDrafted', team: r.team, rider, specialist });
  applySwaps(state, r, s);
  if (state.draft.order.length === 0) {
    state.draft = null;
    afterDraft();
  }
  return null;
}
