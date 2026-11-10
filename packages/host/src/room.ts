/**
 * Room runtime (ADR-0001): runs in the host's browser (and in Node for tests). It owns the only
 * full game state, validates every client message, applies intents through the engine, and sends
 * each player only their redacted view plus the public events. Everything environmental (sending,
 * time, timers, randomness, saving) is injected so the room is deterministic under test.
 */
import { makeBot, randomBot } from '@velo/ai';
import type { Bot } from '@velo/ai';
import { ORIGINAL_STAGES, TILE_CATALOG, compileStage } from '@velo/content';
import type { StageDefinition } from '@velo/content';
import { apply, checkStage, createGame, legalActions, viewFor } from '@velo/engine';
import type { GameState } from '@velo/engine';
import {
  ClientEnvelope,
  GameConfig,
  PROTOCOL_VERSION,
  checkModuleDependencies,
} from '@velo/protocol';
import type {
  Action,
  ClientMessage,
  GameEvent,
  Player,
  RoomState,
  SeatConfig,
  SeatId,
  ServerMessage,
  TurnTimer,
} from '@velo/protocol';

export interface HostDeps {
  /** Deliver one message to one connected peer. */
  send(peer: string, msg: { v: typeof PROTOCOL_VERSION; msg: ServerMessage }): void;
  now(): number;
  setTimer(ms: number, fn: () => void): unknown;
  clearTimer(handle: unknown): void;
  /** Fresh random string (player ids, game seeds). */
  random(): string;
  /** Persist the room after every change; optional. */
  save?(snapshot: RoomSnapshot): void;
  /** Delay before a bot acts, ms. */
  botDelayMs?: number;
}

interface PlayerRecord {
  id: string;
  name: string;
  token: string;
  peer: string | null;
  ready: boolean;
  isHost: boolean;
}

/** Everything needed to rebuild a room: the game replays from config, seed and action log. */
export interface RoomSnapshot {
  version: 1;
  room: string;
  hostToken: string;
  config: GameConfig;
  status: RoomState['status'];
  seed: string | null;
  actions: Action[];
  players: Omit<PlayerRecord, 'peer'>[];
}

/** Up to 12 seats: four in the base game, six with Peloton, twelve with one rider each. */
const MAX_SEATS = 12;
const SEAT_IDS = Array.from({ length: MAX_SEATS }, (_, i) => `seat-${i}`);

export function defaultConfig(stage: StageDefinition = ORIGINAL_STAGES[0]!): GameConfig {
  return GameConfig.parse({
    modules: {},
    mode: { kind: 'single', stage },
    seats: [
      { seat: 'seat-0', controller: { kind: 'open' } },
      { seat: 'seat-1', controller: { kind: 'open' } },
      { seat: 'seat-2', controller: { kind: 'ai', level: 'medium' } },
    ],
    options: { showRemainingValues: true, allowSpectators: true, turnTimer: 'off' },
  });
}

export class Room {
  readonly code: string;
  private readonly deps: HostDeps;
  private readonly hostToken: string;
  private config: GameConfig;
  private status: RoomState['status'] = 'lobby';
  private players = new Map<string, PlayerRecord>(); // by player id
  private byPeer = new Map<string, string>(); // peer → player id
  private state: GameState | null = null;
  private seed: string | null = null;
  private actions: Action[] = [];
  private bots = new Map<SeatId, Bot>();
  private botTimer: unknown = null;
  private turnTimers = new Map<SeatId, unknown>();

  constructor(code: string, hostToken: string, deps: HostDeps, snapshot?: RoomSnapshot) {
    this.code = code;
    this.hostToken = hostToken;
    this.deps = deps;
    this.config = snapshot?.config ?? defaultConfig();
    if (snapshot) this.restore(snapshot);
  }

  // ---------------------------------------------------------------------------
  // Transport hooks
  // ---------------------------------------------------------------------------

  /** A peer's connection dropped. Their seat is kept; they can rejoin with their token. */
  disconnect(peer: string): void {
    const id = this.byPeer.get(peer);
    this.byPeer.delete(peer);
    if (!id) return;
    const p = this.players.get(id);
    if (!p || p.peer !== peer) return;
    p.peer = null;
    this.broadcast({ type: 'presence', playerId: id, connected: false });
  }

  /** Handle one raw message from a peer. Never throws on bad input. */
  receive(peer: string, raw: unknown): void {
    const parsed = ClientEnvelope.safeParse(raw);
    if (!parsed.success)
      return this.error(peer, 'BAD_MESSAGE', 'That message could not be understood.');
    const msg = parsed.data.msg;
    if (msg.type === 'join') return this.join(peer, msg);
    const player = this.playerFor(peer);
    if (!player) return this.error(peer, 'NOT_JOINED', 'Join the room first.');
    this.handle(player, peer, msg);
  }

  // ---------------------------------------------------------------------------
  // Message handling
  // ---------------------------------------------------------------------------

  private join(peer: string, msg: Extract<ClientMessage, { type: 'join' }>): void {
    if (msg.room !== this.code)
      return this.error(peer, 'WRONG_ROOM', 'This invite is for a different room.');
    let player = [...this.players.values()].find((p) => p.token === msg.token);
    if (!player) {
      player = {
        id: `p-${this.deps.random()}`,
        name: msg.name,
        token: msg.token,
        peer: null,
        ready: false,
        isHost: msg.token === this.hostToken,
      };
      this.players.set(player.id, player);
    }
    if (player.peer && player.peer !== peer) this.byPeer.delete(player.peer);
    player.peer = peer;
    player.name = msg.name;
    this.byPeer.set(peer, player.id);
    this.sendTo(peer, { type: 'welcome', playerId: player.id, room: this.roomState() });
    this.broadcast({ type: 'presence', playerId: player.id, connected: true }, peer);
    this.broadcastRoom();
    if (this.state)
      this.sendTo(peer, { type: 'view', view: this.viewFor(player), legal: this.legalFor(player) });
    this.persist();
  }

  private handle(player: PlayerRecord, peer: string, msg: ClientMessage): void {
    switch (msg.type) {
      case 'join':
        return;
      case 'chat':
        return this.broadcast({
          type: 'chat',
          playerId: player.id,
          text: msg.text,
          at: this.deps.now(),
        });
      case 'emote':
        return this.broadcast({ type: 'emote', playerId: player.id, emote: msg.emote });
      case 'ready':
        player.ready = msg.ready;
        return this.changed();
      case 'takeSeat':
        return this.takeSeat(player, peer, msg.seat);
      case 'leaveSeat':
        return this.leaveSeat(player);
      case 'intent':
        return this.intent(player, peer, msg.action);
      default:
        break;
    }
    // Host-only commands.
    if (!player.isHost) return this.error(peer, 'HOST_ONLY', 'Only the host can do that.');
    switch (msg.type) {
      case 'configure':
        return this.configure(peer, msg.config);
      case 'startGame':
        return this.start(peer);
      case 'kick': {
        const target = this.players.get(msg.playerId);
        if (!target || target.isHost)
          return this.error(peer, 'INVALID', 'That player cannot be removed.');
        this.leaveSeat(target);
        if (target.peer) {
          this.sendTo(target.peer, {
            type: 'error',
            code: 'KICKED',
            message: 'The host removed you from the room.',
          });
          this.byPeer.delete(target.peer);
        }
        this.players.delete(target.id);
        return this.changed();
      }
      case 'assignSeat':
        return this.setController(peer, msg.seat, msg.controller);
      case 'seatToAi':
        return this.setController(peer, msg.seat, { kind: 'ai', level: msg.level });
      case 'passHost':
        return this.error(
          peer,
          'UNSUPPORTED',
          'The host runs the room in their browser. Export the save to let someone else host.',
        );
    }
  }

  private configure(peer: string, next: GameConfig): void {
    if (this.status === 'playing')
      return this.error(peer, 'IN_PROGRESS', 'Change the setup between races.');
    if (next.seats.length < 1 || next.seats.length > MAX_SEATS)
      return this.error(peer, 'INVALID', `Choose between 1 and ${MAX_SEATS} teams.`);
    // Keep humans in the seats they hold; the host controls bots and open seats only.
    const seats: SeatConfig[] = next.seats.map((s, i) => {
      const prev = this.config.seats.find((p) => p.seat === SEAT_IDS[i]);
      const seat = SEAT_IDS[i]!;
      if (prev?.controller.kind === 'human') return { ...s, seat, controller: prev.controller };
      return {
        ...s,
        seat,
        controller: s.controller.kind === 'human' ? { kind: 'open' } : s.controller,
      };
    });
    this.config = { ...next, seats };
    this.changed();
  }

  private setController(peer: string, seat: SeatId, controller: SeatConfig['controller']): void {
    const s = this.config.seats.find((x) => x.seat === seat);
    if (!s) return this.error(peer, 'INVALID', 'No such seat.');
    if (controller.kind === 'human' && !this.players.has(controller.playerId))
      return this.error(peer, 'INVALID', 'No such player.');
    // Mid-race a seat can only change between players and bots: an open seat would stall the
    // race, and dummy teams are set up when the race starts.
    if (
      this.status === 'playing' &&
      (controller.kind === 'open' || controller.kind === 'dummy' || s.controller.kind === 'dummy')
    )
      return this.error(peer, 'IN_PROGRESS', 'Change that between races.');
    s.controller = controller;
    this.bots.delete(seat);
    if (this.state) this.scheduleBots();
    this.changed();
  }

  private takeSeat(player: PlayerRecord, peer: string, seat: SeatId): void {
    const s = this.config.seats.find((x) => x.seat === seat);
    if (!s) return this.error(peer, 'INVALID', 'No such seat.');
    const holder = s.controller.kind === 'human' ? s.controller.playerId : null;
    if (holder && holder !== player.id)
      return this.error(peer, 'SEAT_TAKEN', 'That seat is taken.');
    if (this.status === 'playing' && s.controller.kind !== 'ai' && !holder)
      return this.error(peer, 'IN_PROGRESS', 'Seats can be taken between races.');
    this.leaveSeat(player);
    s.controller = { kind: 'human', playerId: player.id };
    this.bots.delete(seat);
    this.changed();
    if (this.state && player.peer)
      this.sendTo(player.peer, {
        type: 'view',
        view: this.viewFor(player),
        legal: this.legalFor(player),
      });
  }

  private leaveSeat(player: PlayerRecord): void {
    const s = this.seatOf(player);
    if (!s) return;
    // Mid-race the seat passes to a bot so the race can go on; in the lobby it opens up.
    s.controller = this.status === 'playing' ? { kind: 'ai', level: 'medium' } : { kind: 'open' };
    this.bots.delete(s.seat);
    if (this.state) this.scheduleBots();
    this.changed();
  }

  private start(peer: string): void {
    if (this.status === 'playing')
      return this.error(peer, 'IN_PROGRESS', 'A race is already running.');
    if (this.config.seats.some((s) => s.controller.kind === 'open'))
      return this.error(peer, 'SEATS_OPEN', 'Fill every seat with a player or a bot first.');
    const issues = checkModuleDependencies(this.config);
    if (issues.length) return this.error(peer, 'CONFIG', issues[0]!.message);
    if (this.config.mode.kind !== 'single')
      return this.error(peer, 'UNSUPPORTED', 'Only single races so far.');
    const track = compileStage(this.config.mode.stage, TILE_CATALOG);
    const stageIssues = checkStage(this.config, track);
    if (stageIssues.length) return this.error(peer, 'CONFIG', stageIssues[0]!);
    this.seed = this.deps.random();
    this.actions = [];
    this.state = createGame(this.config, this.seed, track);
    this.status = 'playing';
    this.bots.clear();
    this.broadcastRoom();
    for (const p of this.players.values())
      if (p.peer)
        this.sendTo(p.peer, { type: 'view', view: this.viewFor(p), legal: this.legalFor(p) });
    this.persist();
    this.scheduleBots();
    this.armTimers();
  }

  private intent(player: PlayerRecord, peer: string, action: Action): void {
    if (!this.state) return this.error(peer, 'NO_GAME', 'No race is running.');
    const seat = this.seatOf(player);
    if (!seat || seat.seat !== action.seat)
      return this.error(peer, 'NOT_YOUR_SEAT', 'You can only act for your own seat.');
    this.applyAction(action);
  }

  /** Apply an action for any seat (human, bot or timer) and broadcast the results. */
  private applyAction(action: Action): void {
    if (!this.state) return;
    const res = apply(this.state, action);
    if (!res.ok) {
      const holder = this.holderOf(action.seat);
      if (holder?.peer) this.error(holder.peer, res.error.code, res.error.message);
      return;
    }
    this.clearTimer(action.seat);
    this.state = res.state;
    this.actions.push(action);
    this.broadcastEvents(res.events);
    if (this.state.phase === 'stageEnd') {
      this.status = 'finished';
      this.broadcastRoom();
    }
    this.persist();
    this.scheduleBots();
    this.armTimers();
  }

  // ---------------------------------------------------------------------------
  // Bots and turn timers
  // ---------------------------------------------------------------------------

  private scheduleBots(): void {
    if (this.botTimer || !this.state || this.state.phase === 'stageEnd') return;
    const seat = this.config.seats.find(
      (s) =>
        (s.controller.kind === 'ai' || s.controller.kind === 'dummy') &&
        legalActions(this.state!, s.seat).length > 0,
    );
    if (!seat) return;
    this.botTimer = this.deps.setTimer(this.deps.botDelayMs ?? 250, () => {
      this.botTimer = null;
      if (!this.state) return;
      const legal = legalActions(this.state, seat.seat);
      if (legal.length === 0) return this.scheduleBots();
      this.applyAction(
        this.botFor(seat.seat).decide(viewFor(this.state, seat.seat), seat.seat, legal),
      );
    });
  }

  private botFor(seat: SeatId): Bot {
    let bot = this.bots.get(seat);
    if (!bot) {
      const controller = this.config.seats.find((s) => s.seat === seat)?.controller;
      // Bot seats play at their level; a human whose turn timer runs out gets an Easy move.
      bot = this.state
        ? makeBot({
            level: controller?.kind === 'ai' ? controller.level : 'easy',
            personality: controller?.kind === 'ai' ? controller.personality : undefined,
            seed: `${this.seed}:${seat}`,
            track: this.state.track,
            config: this.config,
          })
        : randomBot(`${this.seed}:${seat}`);
      this.bots.set(seat, bot);
    }
    return bot;
  }

  /** Start a turn timer for every human seat that has something to do (if timers are on). */
  private armTimers(): void {
    const limit: TurnTimer = this.config.options.turnTimer;
    if (limit === 'off' || !this.state || this.state.phase === 'stageEnd') return;
    for (const s of this.config.seats) {
      if (s.controller.kind !== 'human' || this.turnTimers.has(s.seat)) continue;
      if (legalActions(this.state, s.seat).length === 0) continue;
      this.turnTimers.set(
        s.seat,
        this.deps.setTimer(limit * 1000, () => {
          this.turnTimers.delete(s.seat);
          if (!this.state) return;
          const legal = legalActions(this.state, s.seat);
          if (legal.length > 0)
            this.applyAction(
              this.botFor(s.seat).decide(viewFor(this.state, s.seat), s.seat, legal),
            );
        }),
      );
    }
  }

  private clearTimer(seat: SeatId): void {
    const t = this.turnTimers.get(seat);
    if (t !== undefined) this.deps.clearTimer(t);
    this.turnTimers.delete(seat);
  }

  // ---------------------------------------------------------------------------
  // Views and sending
  // ---------------------------------------------------------------------------

  private seatOf(player: PlayerRecord): SeatConfig | undefined {
    return this.config.seats.find(
      (s) => s.controller.kind === 'human' && s.controller.playerId === player.id,
    );
  }

  private holderOf(seat: SeatId): PlayerRecord | undefined {
    const s = this.config.seats.find((x) => x.seat === seat);
    return s?.controller.kind === 'human' ? this.players.get(s.controller.playerId) : undefined;
  }

  private playerFor(peer: string): PlayerRecord | undefined {
    const id = this.byPeer.get(peer);
    return id ? this.players.get(id) : undefined;
  }

  private viewFor(player: PlayerRecord) {
    const seat = this.seatOf(player);
    return viewFor(
      this.state!,
      seat && this.state!.teams.some((t) => t.seat === seat.seat) ? seat.seat : 'spectator',
    );
  }

  private legalFor(player: PlayerRecord): Action[] {
    const seat = this.seatOf(player);
    return seat && this.state ? legalActions(this.state, seat.seat) : [];
  }

  roomState(): RoomState {
    const players: Player[] = [...this.players.values()].map((p) => ({
      id: p.id,
      name: p.name,
      seat: this.seatOf(p)?.seat ?? null,
      connected: p.peer !== null,
      ready: p.ready,
      isHost: p.isHost,
    }));
    return { room: this.code, config: this.config, players, status: this.status };
  }

  private broadcastEvents(events: GameEvent[]): void {
    for (const p of this.players.values())
      if (p.peer)
        this.sendTo(p.peer, {
          type: 'events',
          events,
          view: this.viewFor(p),
          legal: this.legalFor(p),
        });
  }

  private broadcastRoom(): void {
    this.broadcast({ type: 'room', room: this.roomState() });
  }

  private broadcast(msg: ServerMessage, except?: string): void {
    for (const p of this.players.values())
      if (p.peer && p.peer !== except) this.sendTo(p.peer, msg);
  }

  private sendTo(peer: string, msg: ServerMessage): void {
    this.deps.send(peer, { v: PROTOCOL_VERSION, msg });
  }

  private error(peer: string, code: string, message: string): void {
    this.sendTo(peer, { type: 'error', code, message });
  }

  private changed(): void {
    this.broadcastRoom();
    if (this.state)
      for (const p of this.players.values())
        if (p.peer)
          this.sendTo(p.peer, { type: 'view', view: this.viewFor(p), legal: this.legalFor(p) });
    this.persist();
  }

  // ---------------------------------------------------------------------------
  // Persistence
  // ---------------------------------------------------------------------------

  snapshot(): RoomSnapshot {
    return {
      version: 1,
      room: this.code,
      hostToken: this.hostToken,
      config: this.config,
      status: this.status,
      seed: this.seed,
      actions: [...this.actions],
      players: [...this.players.values()].map(({ peer: _peer, ...rest }) => rest),
    };
  }

  private persist(): void {
    this.deps.save?.(this.snapshot());
  }

  private restore(s: RoomSnapshot): void {
    this.status = s.status;
    this.seed = s.seed;
    // Whoever restores the save is the host (their token decides), so a save can change hands.
    for (const p of s.players)
      this.players.set(p.id, { ...p, peer: null, isHost: p.token === this.hostToken });
    if (s.seed && s.status !== 'lobby') {
      let state = createGame(
        s.config,
        s.seed,
        compileStage((s.config.mode as { stage: StageDefinition }).stage, TILE_CATALOG),
      );
      for (const a of s.actions) {
        const res = apply(state, a);
        if (!res.ok) throw new Error(`Save is corrupt: ${res.error.message}`);
        state = res.state;
      }
      this.state = state;
      this.actions = [...s.actions];
    }
  }

  /** Resume bots and timers after restoring from a snapshot. */
  resume(): void {
    this.scheduleBots();
    this.armTimers();
  }

  /** Current full state, for host-side debugging and tests only. Never send this to a client. */
  debugState(): GameState | null {
    return this.state;
  }
}
