/**
 * Peloton terrain rules (docs/RULES_SPEC.md P-COB-1, P-SUP-1). Narrowing slipstream (P-SUP-2) is
 * part of the core slipstream, since it follows from lane counts alone. Breakaway bidding and
 * bigger fields live in the phase machine (core/breakaway.ts) and setup.
 */
import type { RuleModule } from '../hooks';

const SUPPLY_MIN = 4;

export const pelotonModule: RuleModule = {
  id: 'peloton',

  // P-SUP-1: starting in a supply zone, the card counts as at least 4.
  valueModifiers(ctx, riderId) {
    const rider = ctx.rider(riderId);
    if (!rider.position) return [];
    const start = ctx.square(rider.position.square);
    return [
      {
        stage: 'minimum',
        source: 'supply',
        apply: (v) => (start.terrain === 'supply' ? Math.max(v, SUPPLY_MIN) : v),
      },
    ];
  },

  // P-COB-1: riders on cobblestones neither give nor receive slipstream.
  slipstreamEligible: (ctx, _role, sq) => ctx.square(sq).terrain !== 'cobblestone',
};
