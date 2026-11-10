import { describe, expect, it } from 'vitest';
import {
  FIXTURE_STAGE,
  FIXTURE_TILES,
  STARTING_DECKS,
  StageDefinition,
  TileCatalog,
  squareIdOf,
  type TileSide,
} from './index';

const mainLineLength = (tile: TileSide) =>
  tile.segments.reduce(
    (n, seg) =>
      n +
      (seg.type === 'linear'
        ? seg.squares.length
        : Math.min(...seg.branches.map((b) => b.squares.length))),
    0,
  );

describe('content contracts', () => {
  it('fixture tile catalog matches its schema', () => {
    expect(() => TileCatalog.parse(FIXTURE_TILES)).not.toThrow();
  });

  it('fixture stage matches its schema and references known tiles', () => {
    const stage = StageDefinition.parse(FIXTURE_STAGE);
    const byId = new Map(FIXTURE_TILES.tiles.map((t) => [t.id, t]));
    for (const id of stage.tiles) expect(byId.has(id), `unknown tile ${id}`).toBe(true);
    expect(byId.get(stage.tiles[0]!)?.shape.kind).toBe('start');
    expect(byId.get(stage.tiles.at(-1)!)?.shape.kind).toBe('finish');
    const total = stage.tiles.reduce((n, id) => n + mainLineLength(byId.get(id)!), 0);
    expect(total).toBe(stage.expectedLength);
  });

  it('square ids are canonical', () => {
    expect(squareIdOf({ tile: 3, square: 2 })).toBe('t3.s0.q2');
    expect(squareIdOf({ tile: 3, segment: 1, branch: 0, square: 2 })).toBe('t3.s1.b0.q2');
  });

  it('starting decks have 15 cards each', () => {
    for (const deck of Object.values(STARTING_DECKS)) {
      expect(deck.reduce((n, e) => n + e.count, 0)).toBe(15);
    }
  });
});
