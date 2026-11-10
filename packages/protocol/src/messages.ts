/**
 * Wire protocol: one WebSocket per client, JSON messages validated with these schemas.
 * FROZEN at the end of M0 (lead-owned). Bump PROTOCOL_VERSION on any breaking change.
 */
import { z } from 'zod';
import { AiLevel, GameConfig, SeatController, SeatId } from './config';
import { Action, GameEvent, GameView } from './game';

export const PROTOCOL_VERSION = 1;

const RoomCode = z.string().regex(/^[A-Z0-9]{4,8}$/);
const Text = z.string().min(1).max(500);

export const Emote = z.enum(['wave', 'cheer', 'ouch', 'gg', 'tired', 'fast']);

export const ClientMessage = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('join'),
    room: RoomCode,
    name: z.string().min(1).max(24),
    /** Random token kept in local storage; reclaims a seat after a reconnect. */
    token: z.string().min(16).max(128),
  }),
  z.object({ type: z.literal('configure'), config: GameConfig }),
  z.object({ type: z.literal('takeSeat'), seat: SeatId }),
  z.object({ type: z.literal('leaveSeat') }),
  z.object({ type: z.literal('ready'), ready: z.boolean() }),
  z.object({ type: z.literal('startGame') }),
  z.object({ type: z.literal('intent'), action: Action }),
  z.object({ type: z.literal('chat'), text: Text }),
  z.object({ type: z.literal('emote'), emote: Emote }),
  z.object({ type: z.literal('kick'), playerId: z.string() }),
  z.object({ type: z.literal('assignSeat'), seat: SeatId, controller: SeatController }),
  z.object({ type: z.literal('seatToAi'), seat: SeatId, level: AiLevel }),
  z.object({ type: z.literal('passHost'), playerId: z.string() }),
]);
export type ClientMessage = z.infer<typeof ClientMessage>;

export const Player = z.object({
  id: z.string(),
  name: z.string(),
  seat: SeatId.nullable(),
  connected: z.boolean(),
  ready: z.boolean(),
  isHost: z.boolean(),
});
export type Player = z.infer<typeof Player>;

export const RoomState = z.object({
  room: RoomCode,
  config: GameConfig,
  players: z.array(Player),
  status: z.enum(['lobby', 'playing', 'finished']),
});
export type RoomState = z.infer<typeof RoomState>;

export const ServerMessage = z.discriminatedUnion('type', [
  /** Sent after a join; `seat` is the seat this player holds, if any. */
  z.object({ type: z.literal('welcome'), playerId: z.string(), room: RoomState }),
  z.object({ type: z.literal('room'), room: RoomState }),
  /** Full redacted view, sent on join, reconnect and phase changes. */
  /** Full redacted view plus what this seat may do now; sent on join, reconnect and start. */
  z.object({ type: z.literal('view'), view: GameView, legal: z.array(Action) }),
  /** Events from one resolved action, followed by the view and legal actions after them. */
  z.object({
    type: z.literal('events'),
    events: z.array(GameEvent),
    view: GameView,
    legal: z.array(Action),
  }),
  z.object({ type: z.literal('presence'), playerId: z.string(), connected: z.boolean() }),
  z.object({ type: z.literal('chat'), playerId: z.string(), text: Text, at: z.number().int() }),
  z.object({ type: z.literal('emote'), playerId: z.string(), emote: Emote }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string() }),
]);
export type ServerMessage = z.infer<typeof ServerMessage>;

/** Every message on the wire carries the protocol version. */
export const Envelope = <T extends z.ZodType>(body: T) =>
  z.object({ v: z.literal(PROTOCOL_VERSION), msg: body });
export const ClientEnvelope = Envelope(ClientMessage);
export const ServerEnvelope = Envelope(ServerMessage);
