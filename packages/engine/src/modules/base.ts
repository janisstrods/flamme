/**
 * Base-game rules as a rule module (docs/RULES_SPEC.md, B-*). Expansions plug in beside it;
 * the core never checks which expansions are on.
 */
import { HAND_SIZE } from '@velo/content';
import type { RuleModule } from '../hooks';
import { freeLane, pathFrom } from '../core/track';

const ASCENT_CAP = 5;
const DESCENT_MIN = 5;
const STRONG_DESCENT_MIN = 7;

export const baseModule: RuleModule = {
  id: 'base',

  handSize: () => HAND_SIZE,

  valueModifiers(ctx, riderId, card) {
    const rider = ctx.rider(riderId);
    // Specialist cards (G-SPC-3, G-SPC-4) raise the climb cap or the descent minimum for that card.
    const powers = card.powers ?? [];
    const cap = powers.includes('strongAscents7')
      ? 7
      : powers.includes('strongAscents6')
        ? 6
        : ASCENT_CAP;
    const descentMin = powers.includes('strongDescents') ? STRONG_DESCENT_MIN : DESCENT_MIN;
    if (!rider.position) return [];
    const from = rider.position.square;
    const start = ctx.square(from);
    return [
      // B-TER-4: starting on a descent, the card counts as at least 5.
      {
        stage: 'minimum',
        source: descentMin === DESCENT_MIN ? 'descent' : 'strongDescents',
        apply: (v) => (start.terrain === 'descent' ? Math.max(v, descentMin) : v),
      },
      // B-TER-1 / B-TER-2: ascent cap, and stopping short of an ascent reached only on step 6+.
      {
        stage: 'cap',
        source: cap === ASCENT_CAP ? 'ascent' : 'strongAscents',
        apply: (v) => {
          const path = pathFrom(ctx.track, from, v);
          const isAscent = (id: string) => ctx.square(id).terrain === 'ascent';
          if (start.terrain === 'ascent' || path.slice(0, cap).some(isAscent))
            return Math.min(v, cap);
          const firstAscent = path.findIndex(isAscent);
          return firstAscent === -1 ? v : firstAscent;
        },
      },
    ];
  },

  // B-MOV-4 / B-MOV-5: end on the target, or on the first square behind it with a free lane.
  landing(ctx, move, occ) {
    const route = [move.from.square, ...move.path];
    for (let i = route.length - 1; i >= 0; i--) {
      const id = route[i]!;
      const lane = freeLane(ctx.track, occ.get(id), id);
      if (lane !== undefined) return { square: id, lane };
    }
    // The rider's own starting lane is always free (it is excluded from occupancy).
    return move.from;
  },

  // B-TER-3: riders on an ascent neither give nor receive slipstream.
  slipstreamEligible: (ctx, _role, sq) => ctx.square(sq).terrain !== 'ascent',

  cardDisposal: () => 'remove',
};
