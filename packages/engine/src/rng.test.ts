import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { nextInt, seedRng, shuffle } from './rng';

describe('seeded rng', () => {
  it('is deterministic for a seed', () => {
    const a = shuffle(seedRng('alpe'), [...Array(15).keys()])[0];
    const b = shuffle(seedRng('alpe'), [...Array(15).keys()])[0];
    expect(a).toEqual(b);
  });

  it('different seeds give different orders', () => {
    const a = shuffle(seedRng('alpe'), [...Array(15).keys()])[0];
    const b = shuffle(seedRng('alpf'), [...Array(15).keys()])[0];
    expect(a).not.toEqual(b);
  });

  it('state survives a JSON round trip', () => {
    const s = seedRng('ventoux');
    const restored = JSON.parse(JSON.stringify(s));
    expect(nextInt(restored, 1000)).toEqual(nextInt(s, 1000));
  });

  it('nextInt stays in range', () => {
    fc.assert(
      fc.property(fc.string(), fc.integer({ min: 1, max: 1_000_000 }), (seed, n) => {
        const [x] = nextInt(seedRng(seed), n);
        return Number.isInteger(x) && x >= 0 && x < n;
      }),
    );
  });

  it('shuffle is a permutation', () => {
    fc.assert(
      fc.property(fc.string(), fc.array(fc.integer()), (seed, xs) => {
        const [out] = shuffle(seedRng(seed), xs);
        return JSON.stringify([...out].sort()) === JSON.stringify([...xs].sort());
      }),
    );
  });
});
