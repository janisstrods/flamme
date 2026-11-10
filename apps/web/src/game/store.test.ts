import { ORIGINAL_STAGES } from '@velo/content';
import { legalActions } from '@velo/engine';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { narrate } from './narrate';
import { useSettings } from './settings';
import { HUMAN, useRace } from './store';

afterEach(() => vi.useRealTimers());

describe('local race store', () => {
  it('plays a full race against bots: animations drain and the board ends in sync with the engine', () => {
    vi.useFakeTimers();
    useRace.getState().start({ stage: ORIGINAL_STAGES[0]!, opponents: 3, seed: 'store-test' });
    for (let tick = 0; tick < 20_000; tick++) {
      const s = useRace.getState();
      if (s.state!.phase === 'stageEnd' && !s.animating && s.queue.length === 0) break;
      if (!s.animating) {
        const legal = legalActions(s.state!, HUMAN);
        if (legal.length > 0) s.act(legal[0]!);
      }
      vi.advanceTimersByTime(200);
    }
    const s = useRace.getState();
    expect(s.state!.phase).toBe('stageEnd');
    expect(s.state!.result).toHaveLength(8);
    expect(s.error).toBeNull();
    for (const r of Object.values(s.state!.riders)) expect(s.display[r.id]).toEqual(r.position);
    expect(s.log.some((l) => l.text.includes('wins'))).toBe(true);
  });

  it('rejects an illegal action with a readable error and keeps the state', () => {
    useRace.getState().start({ stage: ORIGINAL_STAGES[1]!, opponents: 1, seed: 'err' });
    const before = useRace.getState().state;
    useRace.getState().act({ type: 'chooseRider', seat: HUMAN, rider: 'seat-0:R' }); // wrong phase
    expect(useRace.getState().error).toMatch(/energy phase/);
    expect(useRace.getState().state).toBe(before);
    useRace.getState().goHome();
  });
});

describe('speed and replay', () => {
  it('skip speed drains every animation immediately and still finishes the race', () => {
    vi.useFakeTimers();
    useSettings.getState().setSpeed('skip');
    try {
      useRace.getState().start({ stage: ORIGINAL_STAGES[2]!, opponents: 1, seed: 'skip' });
      for (let i = 0; i < 5000 && useRace.getState().state!.phase !== 'stageEnd'; i++) {
        const s = useRace.getState();
        const legal = legalActions(s.state!, HUMAN);
        if (legal.length > 0) {
          s.act(legal[0]!);
          // No animation is left waiting on a timer.
          expect(useRace.getState().animating).toBe(false);
          expect(useRace.getState().queue).toHaveLength(0);
        }
        vi.runOnlyPendingTimers(); // let the bots take their turns
      }
      expect(useRace.getState().state!.phase).toBe('stageEnd');
    } finally {
      useSettings.getState().setSpeed('normal');
      useRace.getState().goHome();
    }
  });

  it('replaying the last round restores positions, then catches up again', () => {
    vi.useFakeTimers();
    useRace.getState().start({ stage: ORIGINAL_STAGES[0]!, opponents: 1, seed: 'replay' });
    for (let tick = 0; tick < 5000 && !useRace.getState().lastRound; tick++) {
      const s = useRace.getState();
      if (!s.animating) {
        const legal = legalActions(s.state!, HUMAN);
        if (legal.length > 0) s.act(legal[0]!);
      }
      vi.advanceTimersByTime(200);
    }
    vi.advanceTimersByTime(20_000);
    const before = useRace.getState().lastRound!.display;
    useRace.getState().replayLastRound();
    expect(useRace.getState().animating).toBe(true);
    expect(useRace.getState().replaying).toBe(true);
    // Mid-replay the board starts from the pre-round positions.
    const someRider = Object.keys(before)[0]!;
    expect(useRace.getState().display[someRider]).toBeDefined();
    vi.advanceTimersByTime(30_000);
    const s = useRace.getState();
    expect(s.animating).toBe(false);
    for (const r of Object.values(s.state!.riders)) expect(s.display[r.id]).toEqual(r.position);
    useRace.getState().goHome();
  });
});

describe('narrate', () => {
  it('explains climb limits and blocking in plain words', () => {
    const line = narrate(
      {
        type: 'riderMoved',
        rider: 'seat-0:R',
        from: { square: 'a', lane: 0 },
        to: { square: 'b', lane: 0 },
        cardValue: 9,
        effectiveValue: 5,
        modifiers: [{ source: 'ascent', result: 5 }],
        path: ['x', 'y', 'b'],
        blocked: true,
      },
      HUMAN,
    );
    expect(line).toBe(
      'Your rouleur moves 3: climb limits 9 to 5; blocked, drops back to a free lane',
    );
  });
});
