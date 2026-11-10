import { describe, expect, it } from 'vitest';
import { SPECIALISTS, STARTING_DECKS, TILE_CATALOG, type DeckEntry } from './index';

const expand = (entries: readonly DeckEntry[]) =>
  entries.flatMap((e) => Array.from({ length: e.count }, () => e.value));

describe('specialists (G-SPC-2)', () => {
  it('has six per rider type, numbered 1–6', () => {
    for (const type of ['rouleur', 'sprinteur'] as const) {
      const nums = SPECIALISTS.filter((s) => s.riderType === type).map((s) => s.number);
      expect(nums.sort()).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it('only removes cards the starting deck actually has', () => {
    for (const s of SPECIALISTS) {
      const deck = expand(STARTING_DECKS[s.riderType]!);
      for (const v of expand(s.removes)) {
        const i = deck.indexOf(v);
        expect(i, `${s.id} removes a ${v} the deck lacks`).toBeGreaterThanOrEqual(0);
        deck.splice(i, 1);
      }
    }
  });

  it('adds 40 cards in total (80 with two copies, as in the box)', () => {
    expect(SPECIALISTS.reduce((n, s) => n + expand(s.adds).length, 0)).toBe(40);
  });
});

describe('grand tour tiles', () => {
  it('adds the wide finish, sharp corner and two roundabouts, both sides', () => {
    expect(TILE_CATALOG.tiles.filter((t) => t.source === 'grandTour')).toHaveLength(8);
  });

  it('wide finish timing strips run from the line outwards to +0:00 (G-FIN-2)', () => {
    const timing = (id: string) =>
      TILE_CATALOG.tiles
        .find((t) => t.id === id)!
        .segments.flatMap((s) => (s.type === 'linear' ? s.squares : []))
        .map((q) => q.timingSeconds);
    expect(timing('v_w')).toEqual([undefined, 40, 30, 20, 10, 0]);
    expect(timing('v_s')).toEqual([undefined, undefined, 30, 20, 10, 0]);
  });

  it('roundabouts split into an inner branch of 3 and an outer branch of 5 (G-RND-1)', () => {
    for (const t of TILE_CATALOG.tiles.filter((t) => t.shape.kind === 'roundabout')) {
      const split = t.segments.find((s) => s.type === 'split');
      expect(split?.type === 'split' && split.branches.map((b) => b.squares.length)).toEqual([
        3, 5,
      ]);
    }
  });
});
