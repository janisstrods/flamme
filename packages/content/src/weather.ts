/**
 * Meteo weather on tiles (docs/RULES_SPEC.md M-SET-1, D-013). Weather sits on a whole tile, so it
 * is described by tile index (position in the stage's tile list) and stamped onto the compiled
 * squares of that tile.
 */
import type { StageDefinition, TileCatalog, TrackGraph, WeatherEffect } from './schema';

export interface WeatherPlacement {
  tile: number;
  effect: WeatherEffect;
}

/** The 13 Meteo tokens: four weather effects and nine fair-weather tokens (null). */
export const WEATHER_TOKENS: readonly (WeatherEffect | null)[] = [
  'crosswind',
  'tailwind',
  'headwind',
  'wet',
  ...Array<null>(9).fill(null),
];

/** Tile indexes that take a weather token: every straight tile except the start and finish. */
export function weatherTiles(stage: StageDefinition, catalog: TileCatalog): number[] {
  const byId = new Map(catalog.tiles.map((t) => [t.id, t]));
  const out: number[] = [];
  stage.tiles.forEach((id, i) => {
    if (i === 0 || i === stage.tiles.length - 1) return;
    if (byId.get(id)?.shape.kind === 'straight') out.push(i);
  });
  return out;
}

/** A copy of the track with each placement's effect on every square of its tile. */
export function applyWeather(
  track: TrackGraph,
  placements: readonly WeatherPlacement[],
): TrackGraph {
  if (placements.length === 0) return track;
  const byTile = new Map(placements.map((p) => [p.tile, p.effect]));
  const squares: TrackGraph['squares'] = {};
  for (const [id, sq] of Object.entries(track.squares)) {
    const effect = byTile.get(sq.ref.tile);
    squares[id] = effect ? { ...sq, weather: effect } : sq;
  }
  return { ...track, squares };
}
