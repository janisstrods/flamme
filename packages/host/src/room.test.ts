import { ORIGINAL_STAGES, tourSchedule } from '@velo/content';
import { PROTOCOL_VERSION } from '@velo/protocol';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { defaultConfig, Room } from './room';
import { setup } from './testkit';
import type { TestClient } from './testkit';

const HOST_TOKEN = 'host-token-0000000';
const GUEST_TOKEN = 'guest-token-111111';
const GUEST2_TOKEN = 'guest-token-222222';

/** Host + one guest seated, one bot; race started. */
function startedRace(turnTimer: 'off' | 60 = 'off') {
  const env = setup();
  const host = env.client('peer-host', HOST_TOKEN);
  const guest = env.client('peer-guest', GUEST_TOKEN);
  host.join('Host');
  guest.join('Guest');
  host.send({ type: 'takeSeat', seat: 'seat-0' });
  guest.send({ type: 'takeSeat', seat: 'seat-1' });
  host.send({
    type: 'configure',
    config: { ...defaultConfig(), options: { ...defaultConfig().options, turnTimer } },
  });
  host.send({ type: 'startGame' });
  return { ...env, host, guest };
}

/** Let clients play their first legal action whenever they have one, until the race ends. */
function playOut(env: ReturnType<typeof startedRace>, players: TestClient[], steps = 20_000) {
  for (let i = 0; i < steps; i++) {
    if (env.room.roomState().status === 'finished') return;
    let acted = false;
    for (const p of players) {
      if (p.legal.length > 0) {
        p.send({ type: 'intent', action: p.legal[0]! });
        acted = true;
      }
    }
    env.clock.advance(acted ? 0 : 150);
  }
  throw new Error('Race did not finish');
}

describe('room lobby', () => {
  it('welcomes players, marks the host and seats them', () => {
    const { host, guest, room } = startedRace();
    expect(host.playerId).toBeTruthy();
    const state = room.roomState();
    expect(state.players.find((p) => p.id === host.playerId)?.isHost).toBe(true);
    expect(state.players.find((p) => p.id === guest.playerId)?.seat).toBe('seat-1');
    expect(host.view?.viewer).toBe('seat-0');
    expect(guest.view?.viewer).toBe('seat-1');
  });

  it('refuses to start with open seats and refuses host commands from guests', () => {
    const env = setup();
    const host = env.client('h', HOST_TOKEN);
    const guest = env.client('g', GUEST_TOKEN);
    host.join();
    guest.join();
    host.send({ type: 'startGame' });
    expect(host.errors().at(-1)?.code).toBe('SEATS_OPEN');
    guest.send({ type: 'startGame' });
    expect(guest.errors().at(-1)?.code).toBe('HOST_ONLY');
  });

  it('rejects messages before join and from the wrong room', () => {
    const env = setup();
    const stranger = env.client('x', GUEST_TOKEN);
    stranger.send({ type: 'chat', text: 'hi' });
    expect(stranger.errors().at(-1)?.code).toBe('NOT_JOINED');
    stranger.send({ type: 'join', room: 'OTHER1', name: 'X', token: GUEST_TOKEN });
    expect(stranger.errors().at(-1)?.code).toBe('WRONG_ROOM');
  });
});

describe('room race', () => {
  it('plays a full race with two humans and a bot', () => {
    const env = startedRace();
    playOut(env, [env.host, env.guest]);
    expect(env.room.roomState().status).toBe('finished');
    expect(
      env.host.inbox.some(
        (m) => m.type === 'events' && m.events.some((e) => e.type === 'stageEnded'),
      ),
    ).toBe(true);
  });

  it('never sends a player another team’s cards (redaction)', () => {
    const env = startedRace();
    playOut(env, [env.host, env.guest]);
    for (const [client, mine] of [
      [env.host, 'seat-0'],
      [env.guest, 'seat-1'],
    ] as const) {
      for (const raw of client.raw) {
        const ids = raw.match(/seat-\d:[RS]#\w+/g) ?? [];
        for (const id of ids)
          expect(id.startsWith(`${mine}:`), `${client.peer} saw ${id}`).toBe(true);
        expect(raw).not.toMatch(/"drawPile"|"seed"|"rng"/);
      }
    }
  });

  it('rejects intents for another seat', () => {
    const env = startedRace();
    env.guest.send({
      type: 'intent',
      action: { type: 'chooseRider', seat: 'seat-0', rider: 'seat-0:R' },
    });
    expect(env.guest.errors().at(-1)?.code).toBe('NOT_YOUR_SEAT');
  });

  it('a reconnecting player gets their seat and private view back', () => {
    const env = startedRace();
    for (let i = 0; i < 30; i++) {
      for (const p of [env.host, env.guest])
        if (p.legal.length) p.send({ type: 'intent', action: p.legal[0]! });
      env.clock.advance(150);
    }
    env.room.disconnect('peer-guest');
    expect(env.host.inbox.some((m) => m.type === 'presence' && !m.connected)).toBe(true);
    const back = env.client('peer-guest-2', GUEST_TOKEN);
    back.join('Guest');
    expect(back.playerId).toBe(env.guest.playerId);
    expect(back.view?.viewer).toBe('seat-1');
    expect(back.view?.own?.team).toBe('seat-1');
    playOut({ ...env, guest: back }, [env.host, back]);
  });

  it('a turn timer lets a bot act for a player who does not', () => {
    const env = startedRace(60);
    // Nobody acts: the timer must keep the race going.
    for (let i = 0; i < 400 && env.room.roomState().status !== 'finished'; i++)
      env.clock.advance(61_000);
    expect(env.room.roomState().status).toBe('finished');
  });

  it('a host refresh resumes from the save with identical state', () => {
    const env = startedRace();
    for (let i = 0; i < 40; i++) {
      for (const p of [env.host, env.guest])
        if (p.legal.length) p.send({ type: 'intent', action: p.legal[0]! });
      env.clock.advance(150);
    }
    const snap = env.saves.at(-1)!;
    const again = setup(snap);
    expect(JSON.stringify(again.room.debugState())).toBe(JSON.stringify(env.room.debugState()));
    const host = again.client('h2', HOST_TOKEN);
    host.join('Host');
    expect(host.view?.viewer).toBe('seat-0');
    expect(again.room.roomState().players.find((p) => p.isHost)?.id).toBe(env.host.playerId);
  });

  it('mid-race, a leaving player is replaced by a bot so the race finishes', () => {
    const env = startedRace();
    env.guest.send({ type: 'leaveSeat' });
    playOut(env, [env.host]);
    expect(env.room.roomState().status).toBe('finished');
  });

  it('chat reaches everyone', () => {
    const env = startedRace();
    const third = env.client('peer-3', GUEST2_TOKEN);
    third.join('Watcher');
    env.guest.send({ type: 'chat', text: 'go go go' });
    for (const c of [env.host, env.guest, third])
      expect(c.inbox.some((m) => m.type === 'chat' && m.text === 'go go go')).toBe(true);
    expect(third.view?.viewer).toBe('spectator');
    expect(third.view?.own).toBeNull();
  });
});

describe('protocol fuzz', () => {
  it('never throws on junk or out-of-turn messages', () => {
    const env = startedRace();
    const anything = fc.oneof(
      fc.anything(),
      fc.record({
        v: fc.constant(PROTOCOL_VERSION),
        msg: fc.record(
          { type: fc.constantFrom('intent', 'chat', 'takeSeat', 'configure', 'kick') },
          { requiredKeys: [] },
        ),
      }),
      fc.record({
        v: fc.constant(PROTOCOL_VERSION),
        msg: fc.record({
          type: fc.constant('intent'),
          action: fc.record({
            type: fc.constantFrom('playCard', 'chooseRider', 'placeRider'),
            seat: fc.constantFrom('seat-0', 'seat-1', 'seat-9'),
            rider: fc.constantFrom('seat-0:R', 'seat-1:S'),
            card: fc.string(),
          }),
        }),
      }),
    );
    fc.assert(
      fc.property(anything, (raw) => {
        expect(() => env.room.receive('peer-guest', raw)).not.toThrow();
        expect(() => env.room.receive('nobody', raw)).not.toThrow();
      }),
      { numRuns: 300 },
    );
  });
});

describe('Room construction', () => {
  it('exports a default config with open human seats and a bot', () => {
    const c = defaultConfig();
    expect(c.seats.map((s) => s.controller.kind)).toEqual(['open', 'open', 'ai']);
    expect(Room).toBeDefined();
  });
});

describe('Peloton rooms', () => {
  const sixBots = (stageId: string, breakaway: boolean) => {
    const stage = ORIGINAL_STAGES.find((s) => s.id === stageId)!;
    return {
      ...defaultConfig(stage),
      modules: { peloton: { breakaway, oneRiderEach: false } },
      seats: Array.from({ length: 6 }, (_, i) => ({
        seat: `seat-${i}`,
        controller:
          i === 0 ? { kind: 'open' as const } : { kind: 'ai' as const, level: 'easy' as const },
      })),
    };
  };

  it('refuses a six-team start on a stage whose grid is too small', () => {
    const env = setup();
    const host = env.client('peer-host', HOST_TOKEN);
    host.join('Host');
    host.send({ type: 'configure', config: sixBots('harbour-loop', false) });
    host.send({ type: 'takeSeat', seat: 'seat-0' });
    host.send({ type: 'startGame' });
    expect(env.room.roomState().status).toBe('lobby');
    expect(host.inbox.some((m) => m.type === 'error' && m.message.includes('start grid'))).toBe(
      true,
    );
  });

  it('plays a six-team race with the breakaway', () => {
    const env = setup();
    const host = env.client('peer-host', HOST_TOKEN);
    host.join('Host');
    host.send({ type: 'configure', config: sixBots('grand-peloton', true) });
    host.send({ type: 'takeSeat', seat: 'seat-0' });
    host.send({ type: 'startGame' });
    expect(env.room.roomState().status).toBe('playing');
    playOut({ ...env, host, guest: host }, [host]);
    expect(
      host.inbox.some(
        (m) => m.type === 'events' && m.events.some((e) => e.type === 'breakawayWon'),
      ),
    ).toBe(true);
  });
});

describe('tour rooms', () => {
  it('plays a three-stage tour across two sessions: save between stages, resume, finish', () => {
    const env = setup();
    const host = env.client('peer-host', HOST_TOKEN);
    host.join('Host');
    host.send({
      type: 'configure',
      config: {
        ...defaultConfig(),
        modules: { grandTour: { newTiles: false, specialists: false, specialStages: false } },
        mode: {
          kind: 'tour',
          schedule: tourSchedule(['harbour-loop', 'orchard-ring', 'three-hills'], 1),
        },
        seats: [
          { seat: 'seat-0', controller: { kind: 'open' } },
          { seat: 'seat-1', controller: { kind: 'ai', level: 'medium' } },
          { seat: 'seat-2', controller: { kind: 'ai', level: 'easy' } },
        ],
      },
    });
    host.send({ type: 'takeSeat', seat: 'seat-0' });
    host.send({ type: 'startGame' });
    expect(env.room.roomState().status).toBe('playing');
    // Session 1: race stage 1; the room then waits for the host.
    for (let i = 0; i < 20_000 && host.view?.phase !== 'betweenStages'; i++) {
      if (host.legal.length) host.send({ type: 'intent', action: host.legal[0]! });
      env.clock.advance(150);
    }
    expect(host.view?.phase).toBe('betweenStages');
    expect(host.legal).toEqual([{ type: 'advance', seat: 'seat-0' }]);
    env.clock.advance(5_000);
    expect(host.view?.phase).toBe('betweenStages'); // bots do not move the tour on

    // Session 2: a new room from the save.
    const again = setup(env.saves.at(-1)!);
    const host2 = again.client('h2', HOST_TOKEN);
    host2.join('Host');
    again.room.resume();
    expect(host2.view?.phase).toBe('betweenStages');
    expect(host2.view?.teams.some((t) => (t.tourPoints ?? 0) > 0)).toBe(true);
    for (let i = 0; i < 60_000 && again.room.roomState().status !== 'finished'; i++) {
      if (host2.legal.length) host2.send({ type: 'intent', action: host2.legal[0]! });
      again.clock.advance(150);
    }
    expect(again.room.roomState().status).toBe('finished');
    expect(host2.view?.phase).toBe('tourEnd');
    expect(
      host2.inbox.some((m) => m.type === 'events' && m.events.some((e) => e.type === 'tourEnded')),
    ).toBe(true);
  });
});
