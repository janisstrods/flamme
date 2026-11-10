/**
 * Grand Tour stage rules (docs/RULES_SPEC.md G-TOK-1, G-FIN-1, G-FIN-2, G-CRD-1). Dummy teams are
 * pace riders only (D-008, D-032): they take no tokens and earn nothing, but they race and finish.
 */
import type { GameEvent } from '@velo/protocol';
import type { RuleModule } from '../hooks';
import { isDummy } from '../core/dummies';
import { compareFrontFirst, groupOf, onTrack, pastTheLine, raceKey, square } from '../core/track';

const MINUTE = 60;

export const tourModule: RuleModule = {
  id: 'grandTour.tour',

  // G-CRD-1: played exhaustion goes back to the supply; played energy waits for the next stage.
  cardDisposal: (ctx, rider, card, current) =>
    isDummy(ctx.state, rider)
      ? current
      : card.kind === 'exhaustion'
        ? 'returnToSupply'
        : 'setAside',

  endOfRound(ctx) {
    const { state, track } = ctx;
    const events: GameEvent[] = [];
    const racing = Object.values(state.riders)
      .filter((r) => onTrack(r))
      .sort((a, b) => compareFrontFirst(track, a.position!, b.position!));

    // G-TOK-1: riders reaching or passing a pile take its tokens, furthest ahead first.
    for (const pile of state.tokens) {
      const at = raceKey(track, pile.square);
      const reachedPile = (sq: string) => {
        const k = raceKey(track, sq);
        return k[0] > at[0] || (k[0] === at[0] && k[1] >= at[1]);
      };
      const reached = racing.filter(
        (r) =>
          !isDummy(state, r.id) && !pile.reached.includes(r.id) && reachedPile(r.position!.square),
      );
      reached.slice(0, pile.remaining.length).forEach((r, i) =>
        events.push({
          type: 'tokenTaken',
          rider: r.id,
          kind: pile.kind,
          pile: pile.pile,
          value: pile.remaining[i]!,
        }),
      );
    }

    // G-EXT-1: the first rider to reach the refresh token takes it (furthest ahead if several).
    const ref = state.refresh;
    if (ref && !ref.holder) {
      const at = raceKey(track, ref.square);
      const first = racing.find((r) => {
        if (isDummy(state, r.id)) return false;
        const k = raceKey(track, r.position!.square);
        return k[0] > at[0] || (k[0] === at[0] && k[1] >= at[1]);
      });
      if (first) events.push({ type: 'refreshTriggered', rider: first.id });
    }

    // G-FIN-1: riders past the line finish; each takes the timing seconds of its pack's front
    // (in time trials, the front of its own team's pack, or its own).
    const crossed = racing.filter((r) => pastTheLine(track, r.position!.square));
    if (crossed.length === 0) return events;
    const packFront = (sq: string, rider: string): string => {
      const group = groupOf(state, rider);
      const occupied = new Set(
        racing.filter((r) => groupOf(state, r.id) === group).map((r) => r.position!.square),
      );
      let cur = sq;
      for (;;) {
        const next = square(track, cur).next.find((n) => occupied.has(n));
        if (!next) return cur;
        cur = next;
      }
    };
    let place = Object.values(state.riders).filter((r) => r.finished).length;
    for (const r of crossed) {
      const seconds = square(track, packFront(r.position!.square, r.id)).timingSeconds ?? 0;
      events.push({ type: 'riderFinished', rider: r.id, place: ++place, seconds });
    }
    const still = racing.filter((r) => !crossed.includes(r)).map((r) => r.id);
    if (still.length > 0) events.push({ type: 'timePenalty', riders: still, seconds: MINUTE });
    return events;
  },
};
