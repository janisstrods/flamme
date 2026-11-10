import { describe, expect, it } from 'vitest';
import { FIXTURE_STAGE } from '@velo/content';
import events from './fixtures/round1.events.json' with { type: 'json' };
import seat0View from './fixtures/seat0.view.json' with { type: 'json' };
import {
  ClientEnvelope,
  GameConfig,
  GameEvent,
  GameView,
  PROTOCOL_VERSION,
  ServerEnvelope,
  checkModuleDependencies,
  type SeatConfig,
} from './index';

const humans = (n: number): SeatConfig[] =>
  Array.from({ length: n }, (_, i) => ({
    seat: `seat-${i}`,
    controller: { kind: 'human', playerId: `p${i}` },
  }));

const baseConfig = (seats: SeatConfig[], extra: Partial<GameConfig> = {}): GameConfig =>
  GameConfig.parse({
    modules: {},
    mode: { kind: 'single', stage: FIXTURE_STAGE },
    seats,
    options: {},
    ...extra,
  });

describe('event log fixture', () => {
  it('every event matches the schema', () => {
    const parsed = GameEvent.array().parse(events);
    expect(parsed.length).toBe(events.length);
  });

  it('events carry no private fields', () => {
    const text = JSON.stringify(events);
    for (const forbidden of ['"hand"', '"recycled"', '"drawPile"', '"seed"', '"rng"', '#']) {
      expect(text, `found ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe('redacted view fixture', () => {
  const view = GameView.parse(seat0View);

  it('matches the schema', () => {
    expect(view.viewer).toBe('seat-0');
  });

  it('only contains private data for the viewer', () => {
    expect(view.own?.team).toBe(view.viewer);
    for (const r of view.own?.riders ?? [])
      expect(r.rider.startsWith(`${view.viewer}:`)).toBe(true);
    const othersPrivate = JSON.stringify(seat0View).match(/seat-1:[RS]#/g);
    expect(othersPrivate).toBeNull();
  });

  it('conserves cards: draw pile + recycled + played = 15 + exhaustion', () => {
    for (const own of view.own?.riders ?? []) {
      const pub = view.riders.find((r) => r.id === own.rider)!;
      expect(pub.drawPileCount + own.recycled.length + pub.played.length).toBe(
        15 + pub.exhaustionCount,
      );
    }
  });
});

describe('module dependencies', () => {
  it('accepts a plain base game for 2–4 teams', () => {
    expect(checkModuleDependencies(baseConfig(humans(4)))).toEqual([]);
  });

  it('requires Peloton for five teams', () => {
    const issues = checkModuleDependencies(baseConfig(humans(5)));
    expect(issues.map((i) => i.message)).toContain('Five or six teams needs the Peloton module.');
  });

  it('requires one-rider-each above six teams', () => {
    const cfg = baseConfig(humans(8), {
      modules: { peloton: { breakaway: false, oneRiderEach: false } },
    });
    expect(checkModuleDependencies(cfg).some((i) => i.path === 'seats')).toBe(true);
  });

  it('requires Grand Tour for tours and Peloton for 21 stages', () => {
    const schedule = Array.from({ length: 21 }, () => FIXTURE_STAGE);
    const noGt = baseConfig(humans(3), { mode: { kind: 'tour', schedule } });
    const msgs = checkModuleDependencies(noGt).map((i) => i.message);
    expect(msgs).toContain('Tours need the Grand Tour module.');
    expect(msgs).toContain('The full 21-stage tour needs the Peloton module.');
  });

  it('rejects dummy teams without Peloton and more than one Peloton dummy', () => {
    const seats: SeatConfig[] = [
      ...humans(1),
      { seat: 'seat-1', controller: { kind: 'dummy', team: 'peloton' } },
      { seat: 'seat-2', controller: { kind: 'dummy', team: 'peloton' } },
    ];
    const msgs = checkModuleDependencies(baseConfig(seats)).map((i) => i.message);
    expect(msgs).toContain('Dummy teams come with the Peloton module.');
    expect(msgs).toContain('Only one Peloton dummy team per race.');
  });
});

describe('wire envelopes', () => {
  it('accepts a versioned client intent and rejects a wrong version', () => {
    const msg = {
      type: 'intent',
      action: { type: 'playCard', seat: 'seat-0', rider: 'seat-0:R', card: 'seat-0:R#3' },
    };
    expect(ClientEnvelope.safeParse({ v: PROTOCOL_VERSION, msg }).success).toBe(true);
    expect(ClientEnvelope.safeParse({ v: 999, msg }).success).toBe(false);
  });

  it('accepts a server event batch built from the fixtures', () => {
    const msg = { type: 'events', events, view: seat0View, legal: [] };
    expect(ServerEnvelope.safeParse({ v: PROTOCOL_VERSION, msg }).success).toBe(true);
  });

  it('rejects malformed rider ids', () => {
    const msg = {
      type: 'intent',
      action: { type: 'chooseFirstRider', seat: 'seat-0', rider: 'seat-1:X' },
    };
    expect(ClientEnvelope.safeParse({ v: PROTOCOL_VERSION, msg }).success).toBe(false);
  });
});
