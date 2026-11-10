import { describe, expect, it } from 'vitest';
import { apply } from './api';
import type { GameState } from './state';

describe('engine api (M0 stubs)', () => {
  it('apply returns a typed error instead of throwing', () => {
    const result = apply({} as GameState, { type: 'advance', seat: 'seat-0' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('NOT_IMPLEMENTED');
  });
});
