/**
 * Seeded, serialisable random number generator (sfc32, seeded from a string with xmur3).
 * The generator state lives inside GameState, so a game is fully reproducible from its seed
 * and action log. All functions are pure: they return the new RNG state alongside the result.
 */

export type RngState = readonly [number, number, number, number];

function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function seedRng(seed: string): RngState {
  const next = xmur3(seed);
  let state: RngState = [next(), next(), next(), next()];
  // Discard the first outputs so similar seeds diverge.
  for (let i = 0; i < 12; i++) state = nextUint32(state)[1];
  return state;
}

/** Returns a uint32 and the next state. */
export function nextUint32(s: RngState): [number, RngState] {
  let [a, b, c, d] = s;
  a >>>= 0;
  b >>>= 0;
  c >>>= 0;
  d >>>= 0;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  return [t >>> 0, [a >>> 0, b >>> 0, c >>> 0, d >>> 0]];
}

/** Uniform integer in [0, n). Rejection sampling avoids modulo bias. */
export function nextInt(s: RngState, n: number): [number, RngState] {
  if (!Number.isInteger(n) || n <= 0)
    throw new RangeError(`nextInt: n must be a positive integer, got ${n}`);
  const limit = 0x1_0000_0000 - (0x1_0000_0000 % n);
  let state = s;
  for (;;) {
    const [x, nextState] = nextUint32(state);
    state = nextState;
    if (x < limit) return [x % n, state];
  }
}

/** Fisher–Yates shuffle. Returns a new array and the next state. */
export function shuffle<T>(s: RngState, items: readonly T[]): [T[], RngState] {
  const out = items.slice();
  let state = s;
  for (let i = out.length - 1; i > 0; i--) {
    const [j, next] = nextInt(state, i + 1);
    state = next;
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return [out, state];
}
