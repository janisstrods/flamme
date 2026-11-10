/**
 * Specialist card powers (docs/RULES_SPEC.md G-SPC-5, -6, -8, -9). Strong Ascents and Strong
 * Descents are part of the base value modifiers (they change its cap and minimum for that card);
 * Nimble changes where a rider lands, so the core movement handles it (core/round.ts).
 */
import type { Card } from '@velo/protocol';
import type { HookContext, RuleModule } from '../hooks';
import { freeLane } from '../core/track';

/** The card a rider played this round: locked during movement, the last played card after it. */
function cardThisRound(ctx: HookContext, rider: string): Card | undefined {
  const r = ctx.rider(rider);
  return r.locked ?? (ctx.state.phase === 'end' ? r.played.at(-1) : undefined);
}
const has = (card: Card | undefined, power: string) =>
  (card?.powers as readonly string[] | undefined)?.includes(power) ?? false;

export const specialistsModule: RuleModule = {
  id: 'grandTour.specialists',

  // G-SPC-5 Recovery: playing it returns one recycled exhaustion card to the supply.
  onReveal(ctx, rider, card) {
    if (!has(card, 'recovery')) return [];
    if (!ctx.rider(rider).recycled.some((c) => c.kind === 'exhaustion')) return [];
    return [{ type: 'exhaustionReturned', rider, count: 1 }];
  },

  // G-SPC-6 Relentless: no exhaustion this round.
  exhaustion: (ctx, rider, current) =>
    has(cardThisRound(ctx, rider), 'relentless') ? false : current,

  // G-SPC-8 Breakaway: nobody on this rider's square gives slipstream this round.
  slipstreamEligible: (ctx, role, _sq, riders) =>
    role !== 'give' || !riders.some((id) => has(cardThisRound(ctx, id), 'breakaway')),

  // G-SPC-9 Chase: right after moving, close up beside the rider ahead, or jump a one-square gap.
  afterMove(ctx, rider, card, landed, occ) {
    if (!has(card, 'chase')) return undefined;
    const ahead = ctx.square(landed.square).next.find((n) => occ.has(n));
    if (ahead) {
      const lane = freeLane(ctx.track, occ.get(ahead), ahead);
      return lane === undefined ? undefined : { square: ahead, lane };
    }
    for (const gap of ctx.square(landed.square).next) {
      const beyond = ctx.square(gap).next.some((n) => occ.has(n));
      const lane = freeLane(ctx.track, occ.get(gap), gap);
      if (beyond && lane !== undefined) return { square: gap, lane };
    }
    return undefined;
  },
};
