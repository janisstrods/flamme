import { ORIGINAL_STAGES } from '@velo/content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { narrate } from './narrate';
import { useSettings } from './settings';
import { useRace } from './store';

afterEach(() => {
  useRace.getState().leave();
  useSettings.getState().setSpeed('normal');
  vi.useRealTimers();
});

/** Play the human seat with its first legal action until the race ends (solo session). */
async function playSolo(seed: number, opponents = 2, level: 'easy' | 'medium' | 'hard' = 'easy') {
  vi.useFakeTimers();
  useRace.getState().startSolo(
    {
      stage: ORIGINAL_STAGES[seed % ORIGINAL_STAGES.length]!,
      opponents: Array.from({ length: opponents }, () => ({ kind: 'ai' as const, level })),
    },
    'Tester',
  );
  for (let tick = 0; tick < 30_000; tick++) {
    const s = useRace.getState();
    if (s.view?.phase === 'stageEnd' && !s.animating && s.queue.length === 0 && s.result) return;
    if (!s.animating && s.legal.length > 0) s.act(s.legal[0]!);
    await vi.advanceTimersByTimeAsync(200);
  }
  throw new Error('Solo race did not finish');
}

describe('solo session through the room runtime', () => {
  it('plays a full race against bots: the board ends in sync with the view', async () => {
    await playSolo(0, 3);
    const s = useRace.getState();
    expect(s.seat).toBe('seat-0');
    expect(s.result).toHaveLength(8);
    expect(s.error).toBeNull();
    for (const r of s.view!.riders) expect(s.display[r.id]).toEqual(r.position);
    expect(s.log.some((l) => l.text.includes('wins') || l.text.includes('crosses'))).toBe(true);
  });

  it('only ever holds this player’s private cards', async () => {
    await playSolo(1, 1);
    const s = useRace.getState();
    expect(s.view!.own?.team).toBe('seat-0');
    expect(JSON.stringify(s.view!.riders)).not.toContain('#');
  });

  it('skip speed drains animations immediately and still finishes', async () => {
    useSettings.getState().setSpeed('skip');
    await playSolo(2, 1);
    expect(useRace.getState().queue).toHaveLength(0);
    expect(useRace.getState().animating).toBe(false);
  });

  it('replaying the last round restores positions, then catches up again', async () => {
    await playSolo(0, 1);
    const before = useRace.getState().lastRound!.display;
    useRace.getState().replayLastRound();
    expect(useRace.getState().replaying).toBe(true);
    expect(Object.keys(before).length).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(60_000);
    const s = useRace.getState();
    expect(s.animating).toBe(false);
    for (const r of s.view!.riders) expect(s.display[r.id]).toEqual(r.position);
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
      'seat-0',
    );
    expect(line).toBe(
      'Your rouleur moves 3: climb limits 9 to 5; blocked, drops back to a free lane',
    );
  });
});
