/**
 * Draft tile catalog.
 * - Base + Peloton: imported from flamme-rouge-tracks.com's tile list by `scripts/import-frt.py`.
 * - Grand Tour: drafted from the Grand Tour rulebook (`tiles.grandtour.ts`).
 * Every square is `verified: false` until checked against the physical tiles (decision C-005).
 */
import { TileCatalog } from '../schema';
import raw from './tiles.json' with { type: 'json' };
import { GRAND_TOUR_TILES } from './tiles.grandtour';

const imported = TileCatalog.parse(raw);

export const TILE_CATALOG: TileCatalog = TileCatalog.parse({
  version: imported.version,
  tiles: [...imported.tiles, ...GRAND_TOUR_TILES],
});
