/**
 * Meteo weather effects (docs/RULES_SPEC.md M-*). Each effect covers every square of its tile
 * (`CompiledSquare.weather`). Crashes caused by the wet tile follow the shared crash rules
 * (modules/crashes.ts).
 */
import type { RuleModule } from '../hooks';

export const meteoModule: RuleModule = {
  id: 'meteo',

  // M-TAI-1 / M-HEA-1: a rider starting its turn on a tailwind tile draws 5, on a headwind tile 3.
  handSize(ctx, riderId, current) {
    const pos = ctx.rider(riderId).position;
    const weather = pos ? ctx.square(pos.square).weather : undefined;
    return weather === 'tailwind' ? 5 : weather === 'headwind' ? 3 : current;
  },

  // M-CRS-1: no slipstream to or from a rider on a crosswind tile.
  slipstreamEligible: (ctx, _role, sq) => ctx.square(sq).weather !== 'crosswind',

  // M-WET-1: a rider that ends its move on the wet tile after losing squares to blocking crashes.
  crashCheck: (ctx, _rider, landed, blocked) =>
    blocked && ctx.square(landed.square).weather === 'wet' ? 'wet' : null,
};
