/** Grand Tour special stages: team and individual time trials, extended stages (G-TTT-1, G-ITT-1, G-EXT-1). */
import { ORIGINAL_STAGES, withWideFinish } from '@velo/content';
import type { StageDefinition } from '@velo/content';
import type { GameConfig, GameEvent } from '@velo/protocol';
import { describe, expect, it } from 'vitest';
import { apply, createGame, legalActions } from './api';
import { REFRESH_LIMIT } from './core/refresh';
import type { GameState } from './state';
import { playRandom, runRound } from './testing';

const stage = (id: string, type: StageDefinition['type']): StageDefinition => ({
  ...withWideFinish(ORIGINAL_STAGES.find((s) => s.id === id)!),
  type,
});

function tour(types: StageDefinition['type'][], teams = 3): GameConfig {
  const ids = ['orchard-ring', 'harbour-loop', 'three-hills', 'cobble-coast'];
  return {
    modules: { grandTour: { newTiles: true, specialists: false, specialStages: true } },
    mode: { kind: 'tour', schedule: types.map((t, i) => stage(ids[i]!, t)) },
    seats: Array.from({ length: teams }, (_, i) => ({
      seat: `seat-${i}`,
      controller: { kind: 'human' as const, playerId: `p${i}` },
    })),
    options: { showRemainingValues: true, allowSpectators: true, turnTimer: 'off' },
  };
}

const at = (s: GameState, index: number) =>
  Object.values(s.track.squares).find((q) => q.index === index && q.branch === undefined)!.id;

describe('team time trial (G-TTT-1)', () => {
  it('everyone starts on the front grid square, with no token piles, straight into the race', () => {
    const s = createGame(tour(['teamTimeTrial', 'normal', 'normal']), 'ttt');
    expect(s.phase).toBe('energy');
    expect(s.tokens).toEqual([]);
    const front = s.track.startGrid[0];
    for (const t of s.teams)
      t.riders.forEach((id, lane) =>
        expect(s.riders[id]!.position).toEqual({ square: front, lane }),
      );
  });

  it('teams ignore each other: shared squares, slipstream and exhaustion only among teammates', () => {
    const s = createGame(tour(['teamTimeTrial', 'normal', 'normal']), 'ttt2');
    const put = (id: string, index: number, lane: number) =>
      (s.riders[id]!.position = { square: at(s, index), lane });
    put('seat-0:R', 3, 0);
    put('seat-0:S', 3, 1);
    put('seat-1:R', 8, 0);
    put('seat-1:S', 8, 1);
    put('seat-2:R', 1, 0);
    put('seat-2:S', 6, 0);
    const events = runRound(s, { '0R': 5, '0S': 5, '1R': 2, '1S': 2, '2R': 5, '2S': 2 });
    // seat-0's riders land on square 8 alongside seat-1's (other teams do not block).
    expect(s.riders['seat-0:R']!.position).toEqual({ square: at(s, 8), lane: 0 });
    expect(s.riders['seat-1:R']!.position).toEqual({ square: at(s, 10), lane: 0 });
    // seat-2: 2R ends one empty square behind its teammate (6, 8) and slipstreams up to 7.
    expect(s.riders['seat-2:R']!.position!.square).toBe(at(s, 7));
    // Exhaustion counts teammates only: seat-0's front rider is tired even with seat-1 two ahead.
    const tired = events.flatMap((e) => (e.type === 'exhaustionTaken' ? [e.rider] : []));
    expect(tired).toContain('seat-0:R');
    expect(tired).toContain('seat-0:S');
    expect(tired).not.toContain('seat-2:R');
  });

  it('a whole team time trial: both riders take the slower time; one podium place per team', () => {
    let stageEnd: GameEvent[] = [];
    let after: GameState | null = null;
    playRandom(createGame(tour(['teamTimeTrial', 'normal', 'normal']), 'ttt3'), 'ttt3', (step) => {
      if (step.events.some((e) => e.type === 'stageEnded') && !after) {
        stageEnd = step.events;
        after = step.after;
      }
    });
    const s = after!;
    for (const t of s.teams) {
      const [a, b] = t.riders.map((id) => s.riders[id]!.tour!.seconds);
      expect(a).toBe(b);
    }
    const podium = stageEnd.filter((e) => e.type === 'tourPointsAwarded' && e.reason === 'podium');
    expect(new Set(podium.map((e) => e.type === 'tourPointsAwarded' && e.team)).size).toBe(
      podium.length,
    );
  });
});

describe('individual time trial (G-ITT-1)', () => {
  it('no slipstream at all; the top rouleur and sprinteur cards of the round take exhaustion', () => {
    const s = createGame(tour(['individualTimeTrial', 'normal', 'normal']), 'itt');
    const put = (id: string, index: number) =>
      (s.riders[id]!.position = { square: at(s, index), lane: 0 });
    put('seat-0:R', 2);
    put('seat-0:S', 6);
    put('seat-1:R', 1);
    put('seat-1:S', 4);
    put('seat-2:R', 0);
    put('seat-2:S', 9);
    const events = runRound(s, { '0R': 3, '0S': 3, '1R': 6, '1S': 4, '2R': 6, '2S': 2 });
    // 0R ends on 5 with a gap to 1S on 8; 0S ends beside 2S on 9: nobody slipstreams.
    expect(events.some((e) => e.type === 'slipstream')).toBe(false);
    const tired = events.flatMap((e) => (e.type === 'exhaustionTaken' ? [e.rider] : [])).sort();
    // Highest rouleur cards: 1R and 2R (6, tied); highest sprinteur: 1S (4).
    expect(tired).toEqual(['seat-1:R', 'seat-1:S', 'seat-2:R']);
  });
});

describe('extended stages (G-EXT-1)', () => {
  function reachRefresh() {
    const s = createGame(tour(['extended', 'normal', 'normal']), 'ext');
    expect(s.refresh).not.toBeNull();
    const r = s.track.squares[s.refresh!.square]!.index;
    let k = 0;
    for (const rider of Object.values(s.riders)) {
      rider.position = { square: at(s, 1 + Math.floor(k / 2)), lane: k++ % 2 };
      // Some energy cards played earlier this stage.
      const played = rider.drawPile.splice(0, 4).filter((c) => c.kind === 'energy');
      rider.setAside.push(...played);
      rider.played.push(...played);
    }
    s.riders['seat-0:R']!.position = { square: at(s, r - 2), lane: 0 };
    s.placementOrder = [];
    s.phase = 'energy';
    s.round = 3;
    const events = runRound(s, { '0R': 4 });
    return { s, events };
  }

  it('the first rider to reach the token takes it; a refresh phase follows the round', () => {
    const { s, events } = reachRefresh();
    expect(events).toContainEqual({ type: 'refreshTriggered', rider: 'seat-0:R' });
    expect(s.phase).toBe('refresh');
    expect(s.refresh!.pending).toHaveLength(6);
    expect(legalActions(s, 'seat-0')[0]).toMatchObject({
      type: 'refreshChoice',
      rider: 'seat-0:R',
    });
  });

  it('riders take back played energy up to 24 (25 for the holder), then the next round starts', () => {
    const { s } = reachRefresh();
    const r0 = s.riders['seat-0:R']!;
    const tooMuch = r0.setAside.map((c) => c.id);
    const total = r0.setAside.reduce((n, c) => n + c.value, 0);
    let st = s;
    if (total > REFRESH_LIMIT + 1) {
      const bad = apply(st, {
        type: 'refreshChoice',
        seat: 'seat-0',
        rider: 'seat-0:R',
        cards: tooMuch,
      });
      expect(bad.ok).toBe(false);
    }
    // Everyone takes the engine's best offer.
    while (st.phase === 'refresh') {
      const seat = st.teams.find((t) => legalActions(st, t.seat).length)!.seat;
      const res = apply(st, legalActions(st, seat)[0]!);
      if (!res.ok) throw new Error(res.error.message);
      st = res.state;
      for (const e of res.events)
        if (e.type === 'cardsRetrieved')
          expect(e.cards.reduce((n, c) => n + c.value, 0)).toBeLessThanOrEqual(
            REFRESH_LIMIT + (e.rider === 'seat-0:R' ? 1 : 0),
          );
    }
    expect(st.phase).toBe('energy');
    expect(st.round).toBe(4);
    expect(st.refresh!.used).toBe(true);
    for (const r of Object.values(st.riders)) expect(r.recycled).toEqual([]);
  });
});

describe('a tour with every special stage and the new tiles', () => {
  it('plays to the end with random play', () => {
    const cfg = tour(['teamTimeTrial', 'individualTimeTrial', 'extended', 'normal'], 4);
    const { state, events } = playRandom(createGame(cfg, 'special'), 'special', undefined, 200_000);
    expect(state.phase).toBe('tourEnd');
    expect(events.some((e) => e.type === 'refreshTriggered')).toBe(true);
  });
});
