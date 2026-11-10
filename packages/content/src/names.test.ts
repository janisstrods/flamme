import { describe, expect, it } from 'vitest';
import { generateNames } from './index';

describe('generateNames', () => {
  it('is reproducible and avoids names and first names already in the room', () => {
    expect(generateNames('a')).toEqual(generateNames('a'));
    const taken: string[] = [];
    for (let i = 0; i < 6; i++) {
      const n = generateNames(`seat${i}`, taken);
      taken.push(n.team, n.rouleur, n.sprinteur);
    }
    expect(new Set(taken).size).toBe(18);
    const riders = taken.filter((_, i) => i % 3 !== 0);
    expect(new Set(riders.map((r) => r.split(' ')[0])).size).toBe(12);
  });
});
