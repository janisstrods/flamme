import { describe, expect, it } from 'vitest';
import { randomBot } from './index';

describe('randomBot', () => {
  it('is reproducible for a seed and only picks legal actions', () => {
    const legal = [0, 1, 2, 3].map((n) => ({ type: 'advance' as const, seat: `seat-${n}` }));
    const pick = (seed: string) => {
      const bot = randomBot(seed);
      return Array.from({ length: 20 }, () => bot.decide({} as never, 'seat-0', legal));
    };
    expect(pick('a')).toEqual(pick('a'));
    for (const a of pick('b')) expect(legal).toContain(a);
  });
});
