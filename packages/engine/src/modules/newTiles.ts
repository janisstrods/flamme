/**
 * Grand Tour new tiles (docs/RULES_SPEC.md G-TIL-2, G-RND-*). Sharp corners crash blocked riders
 * like the Meteo wet tile (the shared crash rules are in modules/crashes.ts). Roundabout rules
 * live here too.
 */
import type { RuleModule } from '../hooks';

export const newTilesModule: RuleModule = {
  id: 'grandTour.newTiles',

  // G-TIL-2: ending on a crash square after losing at least one square to blocking.
  crashCheck: (ctx, _rider, landed, blocked) =>
    blocked && ctx.square(landed.square).flags.includes('sharpCorner') ? 'sharpCorner' : null,
};
