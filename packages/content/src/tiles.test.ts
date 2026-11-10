import { describe, expect, it } from 'vitest';
import { TILE_CATALOG } from './index';

const sides = (source: string) => TILE_CATALOG.tiles.filter((t) => t.source === source);

describe('draft tile catalog', () => {
  it('has 21 base tiles and 9 Peloton tiles, two sides each', () => {
    expect(sides('base')).toHaveLength(42);
    expect(sides('peloton')).toHaveLength(18);
  });

  it('pairs every side with its flip side', () => {
    const byId = new Map(TILE_CATALOG.tiles.map((t) => [t.id, t]));
    for (const t of TILE_CATALOG.tiles) expect(byId.get(t.flipSide!)?.flipSide).toBe(t.id);
  });

  it('base set: 1 start, 1 finish, 7 straights, 6 gentle and 6 tight curves (per physical tile)', () => {
    const base = sides('base').filter((t) => t.id.endsWith('_w'));
    const count = (pred: (t: (typeof base)[number]) => boolean) => base.filter(pred).length;
    expect(count((t) => t.shape.kind === 'start')).toBe(1);
    expect(count((t) => t.shape.kind === 'finish')).toBe(1);
    expect(count((t) => t.shape.kind === 'straight')).toBe(7);
    expect(count((t) => t.shape.kind === 'curve' && t.shape.severity === 'gentle')).toBe(6);
    expect(count((t) => t.shape.kind === 'curve' && t.shape.severity === 'tight')).toBe(6);
  });

  it('every start tile has a start line and every finish tile a finish line', () => {
    for (const t of TILE_CATALOG.tiles) {
      const flags = t.segments
        .flatMap((s) => (s.type === 'linear' ? s.squares : []))
        .flatMap((q) => q.flags);
      if (t.shape.kind === 'start') expect(flags).toContain('startLine');
      if (t.shape.kind === 'finish') expect(flags).toContain('finishLine');
    }
  });
});
