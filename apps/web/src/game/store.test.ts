import { ORIGINAL_STAGES } from '@velo/content';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nameBook } from './names';
import { narrate } from './narrate';
import { replayFrames } from './replay';
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

describe('solo tour', () => {
  it('plays a three-stage tour with a rest day through the between-stage screens to the end', async () => {
    vi.useFakeTimers();
    useSettings.getState().setSpeed('skip');
    useRace.getState().startSolo(
      {
        stage: ORIGINAL_STAGES[0]!,
        opponents: [{ kind: 'ai', level: 'easy' }],
        tour: { stages: ['harbour-loop', 'orchard-ring', 'three-hills'], restAfter: 1 },
      },
      'Tester',
    );
    let betweens = 0;
    for (let tick = 0; tick < 60_000; tick++) {
      const s = useRace.getState();
      if (s.view?.phase === 'tourEnd' && !s.animating && s.queue.length === 0) break;
      if (!s.animating && s.legal.length > 0) {
        if (s.legal[0]!.type === 'advance') betweens++;
        s.act(s.legal[0]!);
      }
      await vi.advanceTimersByTimeAsync(100);
    }
    const s = useRace.getState();
    expect(s.view?.phase).toBe('tourEnd');
    expect(betweens).toBe(2);
    expect(s.track?.stageId).toBe('three-hills');
    expect(s.tour.awards.filter((a) => a.reason === 'podium')).toHaveLength(9);
    expect(s.tour.awards.some((a) => a.reason === 'restDay')).toBe(true);
    expect(s.view!.teams.every((t) => t.tourPoints !== undefined)).toBe(true);
  }, 60_000);
});

describe('solo setup options', () => {
  it('a solo tour with specialist riders starts with the draft', async () => {
    vi.useFakeTimers();
    useRace.getState().startSolo(
      {
        stage: ORIGINAL_STAGES[0]!,
        opponents: [{ kind: 'ai', level: 'easy' }],
        tour: { stages: ['harbour-loop', 'orchard-ring', 'three-hills'] },
        specialists: true,
      },
      'Tester',
    );
    await vi.advanceTimersByTimeAsync(50);
    const s = useRace.getState();
    expect(s.room?.config.modules.grandTour?.specialists).toBe(true);
    expect(s.view?.phase).toBe('draft');
  });
});

describe('tutorial', () => {
  it('races the Training Ride against one Easy bot, with coach tips as things happen', async () => {
    vi.useFakeTimers();
    useSettings.getState().setSpeed('skip');
    useRace.getState().startTutorial('Tester');
    for (let tick = 0; tick < 30_000; tick++) {
      const s = useRace.getState();
      if (s.view?.phase === 'stageEnd' && !s.animating && s.queue.length === 0) break;
      while (useRace.getState().coach.queue.length) useRace.getState().dismissTip();
      if (!s.animating && s.legal.length > 0) s.act(s.legal[0]!);
      await vi.advanceTimersByTimeAsync(100);
    }
    const s = useRace.getState();
    expect(s.room?.config.mode.kind === 'single' && s.room.config.mode.stage.id).toBe(
      'training-ride',
    );
    expect(s.room?.config.seats[1]!.controller).toEqual({ kind: 'ai', level: 'easy' });
    // Event tips come from the store; placement, drawing and card tips from the coach on screen.
    const tips = [...s.coach.seen, ...s.coach.queue];
    expect(tips).toEqual(expect.arrayContaining(['welcome', 'move', 'finish']));
    // The race is random: a slipstream or an exhaustion (or both) always happens on the way.
    expect(tips.some((t) => t === 'slipstream' || t === 'exhaustion')).toBe(true);
  }, 60_000);
});

describe('replay viewer', () => {
  it('rebuilds a finished race round by round, ending where the race ended', async () => {
    await playSolo(0, 2);
    const live = useRace.getState();
    const snap = live.session!.snapshot()!;
    const frames = replayFrames(snap);
    expect(frames.length).toBeGreaterThan(4);
    expect(frames[0]!.label).toBe('start');
    expect(frames.at(-1)!.label).toBe('finish');
    expect(frames.at(-1)!.view.riders.map((r) => r.position)).toEqual(
      live.view!.riders.map((r) => r.position),
    );
    // Showing a frame and closing the replay brings the race view back.
    expect(useRace.getState().startReplay(snap, 'race')).toBe(true);
    useRace.getState().showFrame(1);
    expect(useRace.getState().view!.round).toBeGreaterThan(0);
    useRace.getState().closeReplay();
    expect(useRace.getState().replay).toBeNull();
    expect(useRace.getState().view!.phase).toBe('stageEnd');
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
      nameBook({
        seats: [
          {
            seat: 'seat-0',
            controller: { kind: 'open' },
            names: { team: 'Kestrel Racing', rouleur: 'Mila Lindqvist', sprinteur: 'Ivo Strand' },
          },
        ],
      } as never),
    );
    expect(line).toBe(
      'Mila Lindqvist moves 3: climb limits 9 to 5; blocked, drops back to a free lane',
    );
  });
});
