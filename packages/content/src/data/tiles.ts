/**
 * Draft tile catalog (base + Peloton), imported from flamme-rouge-tracks.com's tile list by
 * `scripts/import-frt.py`. Every square is `verified: false` until checked against the rulebook
 * diagrams. Grand Tour tiles (wide finish, sharp corners, roundabouts) are not in that source yet.
 */
import { TileCatalog } from '../schema';
import raw from './tiles.json' with { type: 'json' };

export const TILE_CATALOG: TileCatalog = TileCatalog.parse(raw);
