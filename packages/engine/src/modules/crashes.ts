/**
 * Crash rules shared by the Meteo wet tile and Grand Tour sharp corners (docs/RULES_SPEC.md C-1..4,
 * D-014, D-015). What makes a rider crash is decided by the module that owns the cause
 * (`crashCheck`); this module covers what a crash does.
 */
import type { RuleModule } from '../hooks';
import { freeLane } from '../core/track';

const PENALTY = 2;

export const crashesModule: RuleModule = {
  id: 'crashes',

  // C-4: standing up costs 2, after minimums (descent, supply) and before the ascent cap.
  valueModifiers(ctx, riderId) {
    if (!ctx.rider(riderId).crashed) return [];
    return [{ stage: 'penalty', source: 'crashRecovery', apply: (v) => Math.max(0, v - PENALTY) }];
  },

  landing(ctx, move, occ) {
    const rider = ctx.rider(move.rider);
    // C-4: a rider that only stands up moves to the rightmost free lane of its square.
    if (rider.crashed && move.path.length === 0) {
      const lane = freeLane(ctx.track, occ.get(move.from.square), move.from.square);
      return { square: move.from.square, lane: lane ?? move.from.lane };
    }
    // C-3: a square with every lane crashed cannot be passed: stop on the closest free lane behind.
    const crashedLanes = (sq: string) => {
      const lanes = new Set<number>();
      for (const r of Object.values(ctx.state.riders))
        if (r.crashed && r.position?.square === sq && r.id !== move.rider)
          lanes.add(r.position.lane);
      return lanes;
    };
    const wall = move.path.findIndex((sq) => crashedLanes(sq).size >= ctx.square(sq).lanes);
    if (wall === -1) return undefined;
    const route = [move.from.square, ...move.path.slice(0, wall)];
    for (let i = route.length - 1; i >= 0; i--) {
      const id = route[i]!;
      const lane = freeLane(ctx.track, occ.get(id), id);
      if (lane !== undefined) return { square: id, lane };
    }
    return move.from;
  },

  // C-2: no slipstream to or from a square holding a crashed rider.
  slipstreamEligible: (ctx, _role, _sq, riders) => !riders.some((id) => ctx.rider(id).crashed),
};
