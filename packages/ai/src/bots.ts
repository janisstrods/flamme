/**
 * Easy, Medium and Hard bots (plan M5). Bots see only their redacted view, the compiled track and
 * the room config, and act through legal `Action`s like any human seat.
 *
 * How the stronger bots choose a card:
 *  1. Every rider's remaining deck is public (`remainingValues`, or rebuilt from the starting deck,
 *     the cards played and the exhaustion count when the room hides it).
 *  2. Opponent plays are sampled from those decks: draw four, usually keep one of the best.
 *  3. Each candidate card (or card pair, when both own hands are known) is played out with the
 *     engine's own round simulation against the same samples; Hard rolls one more round on.
 *  4. The resulting position is scored by an estimate of each rider's rounds to the finish from
 *     its terrain-weighted distance and the expected best-of-four draw of its deck. The score is
 *     how far our best rider is ahead of the best opponent, squashed so a bot cares about winning,
 *     not winning by a lot.
 */
import { EXHAUSTION_VALUE, HAND_SIZE, STARTING_DECKS } from '@velo/content';
import type { TrackGraph } from '@velo/content';
import { boardFromView, nextInt, previewFromView, seedRng, simulateRound } from '@velo/engine';
import type { Board, RngState } from '@velo/engine';
import type {
  Action,
  AiLevel,
  AiPersonality,
  Card,
  GameConfig,
  GameView,
  RiderId,
  SeatId,
} from '@velo/protocol';
import type { Bot } from './index';

export interface BotOptions {
  level: AiLevel;
  personality?: AiPersonality | undefined;
  seed: string;
  track: TrackGraph;
  config: GameConfig;
  /** Override some of the level's search settings (tuning experiments). */
  search?: Partial<Search>;
}

interface Style {
  /** Extra cost of taking an exhaustion card, in rounds. */
  exhaustion: number;
  /** Bonus for leading the race after the round. */
  front: number;
  /** Weight of the second rider relative to the first. */
  second: number;
  /** Bonus for each own rider standing on a climb after the round. */
  climb: number;
}

const STYLES: Record<AiPersonality, Style> = {
  balanced: { exhaustion: 0.15, front: 0, second: 0.15, climb: 0 },
  attacker: { exhaustion: 0.05, front: 0.12, second: 0.1, climb: 0 },
  wheelSucker: { exhaustion: 0.35, front: -0.05, second: 0.2, climb: 0 },
  climber: { exhaustion: 0.15, front: 0, second: 0.15, climb: 0.06 },
};

export interface Search {
  samples: number;
  depth: 1 | 2;
  /** Rounds of lead that count as "clearly winning" (the squash in the score). */
  scale: number;
  /** How often a sampled opponent keeps the best card of its four. */
  greed: number;
  /** Cost of a climbing square relative to a flat one. */
  ascent: number;
  /** Cost of one exhaustion card taken, in rounds, on top of what it does to the deck. */
  exhaustion: number;
  /** 1: sampled riders plan their card for their own race; 0: they mostly keep a high card. */
  planner: number;
  /** 1: when choosing the first rider's card, consider the teammate's possible hands. */
  teammate: number;
  /** Play races out to the finish once a rider is this many rounds from the line (0: never). */
  endgame: number;
  /** Chance of taking the second-best card instead of the best (a human-like slip). */
  slip: number;
}

/**
 * Levels differ in how much they look ahead (tuned by self-play, see docs/QA.md M5): Medium
 * samples a few opponent plays; Hard samples more, models opponents as planning their own race,
 * considers its teammate's next hand, and plays the finish out once someone is near the line.
 */
const SEARCH: Record<Exclude<AiLevel, 'easy'>, Search> = {
  medium: {
    samples: 4,
    depth: 1,
    scale: 1.5,
    greed: 0.6,
    ascent: 1.3,
    exhaustion: 0,
    planner: 0,
    teammate: 0,
    endgame: 0,
    slip: 0.2,
  },
  hard: {
    samples: 16,
    depth: 1,
    scale: 1.5,
    greed: 0.6,
    ascent: 1.3,
    exhaustion: -0.05,
    planner: 1,
    teammate: 1,
    endgame: 3,
    slip: 0,
  },
};

/** A seeded random source over the engine's RNG (bots must stay reproducible). */
class Rand {
  constructor(private s: RngState) {}
  int(n: number): number {
    const [i, next] = nextInt(this.s, n);
    this.s = next;
    return i;
  }
  float(): number {
    return this.int(1_000_000) / 1_000_000;
  }
}

// ---------------------------------------------------------------------------
// Track and deck estimates
// ---------------------------------------------------------------------------

const TERRAIN_COST: Record<string, number> = {
  flat: 1,
  ascent: 1.3,
  descent: 0.85,
  cobblestone: 1.15,
  supply: 0.9,
};

/** Terrain-weighted squares from each square to the finish line (shortest way through splits). */
export function effortToFinish(
  track: TrackGraph,
  ascent = TERRAIN_COST.ascent!,
): Map<string, number> {
  const memo = new Map<string, number>();
  const visit = (id: string): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    const sq = track.squares[id]!;
    let out = 0;
    if (sq.index < track.finishIndex) {
      out = Infinity;
      for (const n of sq.next) {
        const next = track.squares[n]!;
        out = Math.min(
          out,
          (next.terrain === 'ascent' ? ascent : (TERRAIN_COST[next.terrain] ?? 1)) + visit(n),
        );
      }
      if (!Number.isFinite(out)) out = 0;
    }
    memo.set(id, out);
    return out;
  };
  for (const id of Object.keys(track.squares)) visit(id);
  return memo;
}

const binom = (() => {
  const t: number[][] = [];
  for (let n = 0; n <= 64; n++) {
    t[n] = [];
    for (let k = 0; k <= n; k++)
      t[n]![k] = k === 0 || k === n ? 1 : t[n - 1]![k - 1]! + t[n - 1]![k]!;
  }
  return (n: number, k: number) => (k < 0 || k > n || n > 64 ? 0 : t[n]![k]!);
})();

/** Expected best card when drawing `k` cards from `values` (sorted ascending). */
export function expectedBest(values: readonly number[], k: number): number {
  const n = values.length;
  if (n === 0) return EXHAUSTION_VALUE;
  if (k <= 1) return values.reduce((a, b) => a + b, 0) / n;
  if (n <= k) return values[n - 1]!;
  let e = 0;
  const total = binom(n, k);
  for (let i = k - 1; i < n; i++) e += (values[i]! * binom(i, k - 1)) / total;
  return e;
}

/**
 * Estimated rounds to cover `effort` with a deck: each round plays the expected best of `draw`
 * cards and spends the card nearest that value. Fractional in the last round.
 */
export function roundsToFinish(effort: number, deck: readonly number[], draw: number): number {
  const m = [...deck].sort((a, b) => a - b);
  let left = effort;
  let t = 0;
  while (left > 0 && t < 40) {
    const v = Math.max(1, expectedBest(m, draw));
    if (v >= left) return t + left / v;
    left -= v;
    t++;
    if (m.length > 0) {
      let best = 0;
      for (let i = 1; i < m.length; i++)
        if (Math.abs(m[i]! - v) <= Math.abs(m[best]! - v)) best = i;
      m.splice(best, 1);
    }
  }
  return t;
}

// ---------------------------------------------------------------------------
// What the bot knows about every team
// ---------------------------------------------------------------------------

interface RiderInfo {
  id: RiderId;
  team: string;
  /** Remaining deck values; attack cards count as 0 (Peloton dummy team). */
  deck: number[];
  /** Cards it draws each round (1 for dummy teams, which flip). */
  draw: number;
  /** Peloton dummy team: the riders share one flip. */
  shared: string | null;
}

function knowledge(view: GameView, config: GameConfig): Map<RiderId, RiderInfo> {
  const dummyOf = new Map<string, 'peloton' | 'muscle'>();
  for (const s of config.seats)
    if (s.controller.kind === 'dummy') dummyOf.set(s.seat, s.controller.team);
  const out = new Map<RiderId, RiderInfo>();
  for (const r of view.riders) {
    if (!r.position || r.finished || r.crashed) continue;
    let deck: number[];
    if (r.remainingValues) {
      deck = [];
      for (const [key, count] of Object.entries(r.remainingValues))
        for (let i = 0; i < count; i++) deck.push(key === 'attack' ? 0 : Number(key));
    } else {
      // Rebuild from what is public: starting deck minus revealed energy cards plus exhaustion.
      deck = (STARTING_DECKS[r.type] ?? []).flatMap((e) => Array<number>(e.count).fill(e.value));
      for (const c of r.played) {
        if (c.kind === 'exhaustion') continue;
        const i = deck.indexOf(c.value);
        if (i >= 0) deck.splice(i, 1);
      }
      for (let i = 0; i < r.exhaustionCount; i++) deck.push(EXHAUSTION_VALUE);
    }
    const dummy = dummyOf.get(r.team);
    // The Peloton team's view shows its draw pile only; it reshuffles its flipped cards when the
    // pile runs out (D-025), so pad a short pile with an average rouleur deck.
    if (dummy === 'peloton' && deck.length < 4) deck.push(3, 4, 5, 6, 7);
    out.set(r.id, {
      id: r.id,
      team: r.team,
      deck,
      draw: dummy ? 1 : HAND_SIZE,
      shared: dummy === 'peloton' ? r.team : null,
    });
  }
  return out;
}

const removeOne = (deck: number[], value: number) => {
  const i = deck.indexOf(value);
  if (i >= 0) deck.splice(i, 1);
};

/** A plausible play for a rider: draw four, usually keep one of the best two. */
function samplePlay(info: RiderInfo, rand: Rand, greed = 0.6, effort?: number): number {
  const deck = info.deck;
  if (deck.length === 0) return EXHAUSTION_VALUE;
  if (info.draw === 1) return deck[rand.int(deck.length)]!;
  const pool = [...deck];
  const hand: number[] = [];
  for (let i = 0; i < info.draw && pool.length > 0; i++)
    hand.push(pool.splice(rand.int(pool.length), 1)[0]!);
  hand.sort((a, b) => b - a);
  if (effort !== undefined) {
    // Planner: the card that leaves the fewest rounds to the finish, ignoring everyone else.
    let best = hand[0]!;
    let bestT = Infinity;
    for (const c of new Set(hand)) {
      const rest = [...deck];
      rest.splice(rest.indexOf(c), 1);
      const t = roundsToFinish(Math.max(0, effort - c), rest, info.draw) + rand.float() * 0.05;
      if (t < bestT) {
        bestT = t;
        best = c;
      }
    }
    return best;
  }
  const x = rand.float();
  if (x < greed || hand.length === 1) return hand[0]!;
  if (x < greed + (1 - greed) * 0.6) return hand[1]!;
  return hand[rand.int(hand.length)]!;
}

// ---------------------------------------------------------------------------
// The bot
// ---------------------------------------------------------------------------

export function makeBot(opts: BotOptions): Bot {
  const rand = new Rand(seedRng(`bot:${opts.seed}`));
  const style = STYLES[opts.personality ?? 'balanced'];
  const search: Search = {
    ...(opts.level === 'easy' ? SEARCH.medium : SEARCH[opts.level]),
    ...opts.search,
  };
  const effort = effortToFinish(opts.track, search.ascent);
  const { track, config } = opts;
  const effortOf = (square: string) => effort.get(square) ?? 0;
  const name = `${opts.level}${opts.personality ? ` ${opts.personality}` : ''}`;

  /** Score a board for `seat`: positive when our best rider is ahead of the best opponent. */
  function score(
    board: Board,
    decks: Map<RiderId, RiderInfo>,
    seat: SeatId,
    crossed: readonly RiderId[],
    exhaustedOwn: number,
  ): number {
    const times = new Map<RiderId, number>();
    for (const r of board.riders) {
      if (!r.position || r.finished || r.crashed) continue;
      const info = decks.get(r.id);
      const rank = crossed.indexOf(r.id);
      times.set(
        r.id,
        rank >= 0
          ? -1 - (crossed.length - rank) * 0.1
          : roundsToFinish(effortOf(r.position.square), info?.deck ?? [], info?.draw ?? HAND_SIZE),
      );
    }
    const own = [...times.entries()].filter(
      ([id]) => board.riders.find((r) => r.id === id)!.team === seat,
    );
    const others = [...times.entries()].filter(
      ([id]) => board.riders.find((r) => r.id === id)!.team !== seat,
    );
    if (own.length === 0) return -10;
    const ownT = own.map(([, t]) => t).sort((a, b) => a - b);
    const oppBest = others.length ? Math.min(...others.map(([, t]) => t)) : ownT[0]! + 3;
    let s = Math.tanh((oppBest - ownT[0]!) / search.scale);
    if (ownT[1] !== undefined) s += style.second * Math.tanh((oppBest - ownT[1]) / 2.5);
    // A small linear term breaks ties between equally winning (or losing) lines.
    s += 0.02 * (oppBest - ownT[0]!);
    s -= (style.exhaustion * 0.3 + search.exhaustion) * exhaustedOwn;
    if (style.front !== 0) {
      const leader = [...times.entries()].sort((a, b) => a[1] - b[1])[0];
      if (leader && own.some(([id]) => id === leader[0])) s += style.front;
    }
    if (style.climb !== 0)
      for (const r of board.riders)
        if (r.team === seat && r.position && track.squares[r.position.square]?.terrain === 'ascent')
          s += style.climb;
    return s;
  }

  /** Sampled plays for every rider not fixed by `fixed`. */
  function sampleRound(
    infos: Map<RiderId, RiderInfo>,
    fixed: Record<RiderId, number>,
    board: Board,
    plan = false,
  ) {
    const plays: Record<RiderId, number> = { ...fixed };
    const sharedDone = new Set<string>();
    for (const info of infos.values()) {
      if (info.id in plays) continue;
      if (info.shared) {
        if (sharedDone.has(info.shared)) continue;
        sharedDone.add(info.shared);
        const v = samplePlay(info, rand, search.greed);
        const mates = [...infos.values()].filter((i) => i.shared === info.shared);
        if (v === 0 && mates.length > 1) {
          // Attack card: the front rider moves 2, the rear rider 9 (P-PEL-1).
          const pos = (id: RiderId) => board.riders.find((r) => r.id === id)!.position!.square;
          mates.sort((a, b) => effortOf(pos(a.id)) - effortOf(pos(b.id)));
          plays[mates[0]!.id] = 2;
          plays[mates[1]!.id] = 9;
        } else for (const m of mates) plays[m.id] = v === 0 ? 9 : v;
        continue;
      }
      const pos = board.riders.find((r) => r.id === info.id)?.position;
      plays[info.id] = samplePlay(
        info,
        rand,
        search.greed,
        (plan || search.planner) && pos ? effortOf(pos.square) : undefined,
      );
    }
    return plays;
  }

  /** Decks after a round: spent cards out, exhaustion cards in. */
  function afterRound(
    infos: Map<RiderId, RiderInfo>,
    plays: Record<RiderId, number>,
    exhausted: readonly RiderId[],
  ): Map<RiderId, RiderInfo> {
    const out = new Map<RiderId, RiderInfo>();
    const sharedDecks = new Map<string, number[]>();
    for (const info of infos.values()) {
      let deck: number[];
      if (info.shared) {
        deck = sharedDecks.get(info.shared) ?? [...info.deck];
        if (!sharedDecks.has(info.shared)) {
          const p = plays[info.id];
          removeOne(deck, p === 2 || p === 9 ? (deck.includes(0) ? 0 : p) : (p ?? -1));
          sharedDecks.set(info.shared, deck);
        }
      } else {
        deck = [...info.deck];
        const p = plays[info.id];
        if (p !== undefined) removeOne(deck, p);
        if (exhausted.includes(info.id)) deck.push(EXHAUSTION_VALUE);
      }
      out.set(info.id, { ...info, deck });
    }
    return out;
  }

  /** One sampled round: everyone else's plays, and the teammate's next hand when it is unknown. */
  interface Sample {
    plays: Record<RiderId, number>;
    mate?: { id: RiderId; hand: number[] };
  }

  /** Score after one round (and a sampled second one for depth 2) with these plays. */
  function playOut(
    board: Board,
    seat: SeatId,
    infos: Map<RiderId, RiderInfo>,
    plays: Record<RiderId, number>,
    depth: 1 | 2,
    endgame = false,
  ): number {
    const sim = simulateRound(board, track, config, plays);
    let decks = afterRound(infos, plays, sim.exhausted);
    let exhaustedOwn = sim.exhausted.filter((id) => decks.get(id)?.team === seat).length;
    let result = sim;
    if (endgame && sim.crossed.length === 0) {
      // Near the line: play the race out with every rider planning its own cards, and score who
      // actually crosses first (furthest past the line wins).
      let b = sim.board;
      let live = decks;
      for (let round = 0; round < 6 && result.crossed.length === 0; round++) {
        live = new Map([...live].filter(([id]) => b.riders.find((r) => r.id === id)?.position));
        const next = sampleRound(live, {}, b, true);
        result = simulateRound(b, track, config, next);
        live = afterRound(live, next, result.exhausted);
        b = result.board;
      }
      if (result.crossed.length > 0) {
        const ownRank = result.crossed.findIndex((id) => id.startsWith(`${seat}:`));
        return ownRank === 0 ? 1 : ownRank > 0 ? -0.6 - 0.1 * Math.min(ownRank, 4) : -1;
      }
      decks = live;
    } else if (depth === 2 && sim.crossed.length === 0) {
      const live = new Map(
        [...decks].filter(([id]) => sim.board.riders.find((r) => r.id === id)?.position),
      );
      const next = sampleRound(live, {}, sim.board);
      result = simulateRound(sim.board, track, config, next);
      decks = afterRound(live, next, result.exhausted);
      exhaustedOwn += result.exhausted.filter((id) => decks.get(id)?.team === seat).length * 0.5;
    }
    return score(result.board, decks, seat, result.crossed, exhaustedOwn);
  }

  /**
   * Average score of a fixed set of own plays over shared samples. When the teammate's hand is
   * sampled, it is assumed to answer with its best card from that hand.
   */
  function evaluate(
    board: Board,
    seat: SeatId,
    infos: Map<RiderId, RiderInfo>,
    ownPlays: Record<RiderId, number>,
    samples: Sample[],
    depth: 1 | 2,
    endgame: boolean,
  ): number {
    let total = 0;
    for (const sample of samples) {
      const plays = { ...sample.plays, ...ownPlays };
      if (!sample.mate) {
        total += playOut(board, seat, infos, plays, depth, endgame);
        continue;
      }
      let best = -Infinity;
      for (const v of new Set(sample.mate.hand))
        best = Math.max(
          best,
          playOut(board, seat, infos, { ...plays, [sample.mate.id]: v }, depth, endgame),
        );
      total += best;
    }
    return total / samples.length;
  }

  function chooseCard(view: GameView, seat: SeatId, legal: readonly Action[]): Action {
    const plays = legal.filter(
      (a): a is Extract<Action, { type: 'playCard' }> => a.type === 'playCard',
    );
    const own = view.own!;
    const handOf = (rider: RiderId) => own.riders.find((r) => r.rider === rider)?.hand ?? [];
    const cardOf = (a: Extract<Action, { type: 'playCard' }>): Card | undefined =>
      handOf(a.rider).find((c) => c.id === a.card);

    if (opts.level === 'easy') {
      if (rand.float() < 0.3) return plays[rand.int(plays.length)]!;
      // Plays the card that moves furthest this round, keeping the bigger card on a tie.
      let best = plays[0]!;
      let bestKey = -Infinity;
      for (const a of plays) {
        const card = cardOf(a);
        if (!card) continue;
        const p = previewFromView(view, track, config, a.rider, card);
        const key = p.path.length * 10 + card.value;
        if (key > bestKey) {
          bestKey = key;
          best = a;
        }
      }
      return best;
    }

    const infos = knowledge(view, config);
    // Own riders: fixed values for locked cards; the rider(s) with hands are what we choose.
    const fixed: Record<RiderId, number> = {};
    for (const r of own.riders) if (r.locked) fixed[r.rider] = r.locked.value;
    const deciding = [...new Set(plays.map((a) => a.rider))];
    // Own riders not yet dealt are sampled like opponents (from our own known deck).
    const board = boardFromView(view);
    // The teammate still to be dealt: Hard looks at its possible hands and best answers.
    const mate =
      search.teammate && deciding.length === 1
        ? own.riders.find((r) => r.rider !== deciding[0] && !r.locked && infos.has(r.rider))
        : undefined;
    const samples: Sample[] = Array.from({ length: search.samples }, () => {
      const plays = sampleRound(infos, fixed, board);
      for (const id of deciding) delete plays[id];
      if (!mate) return { plays };
      delete plays[mate.rider];
      const pool = [...infos.get(mate.rider)!.deck];
      const hand: number[] = [];
      for (let i = 0; i < HAND_SIZE && pool.length > 0; i++)
        hand.push(pool.splice(rand.int(pool.length), 1)[0]!);
      return { plays, mate: { id: mate.rider, hand: hand.length ? hand : [EXHAUSTION_VALUE] } };
    });

    type Option = { action: Extract<Action, { type: 'playCard' }>; plays: Record<RiderId, number> };
    const options: Option[] = [];
    if (deciding.length >= 2) {
      const [a, b] = deciding;
      for (const pa of plays.filter((x) => x.rider === a))
        for (const pb of plays.filter((x) => x.rider === b))
          options.push({
            action: pa,
            plays: { ...fixed, [a!]: cardOf(pa)?.value ?? 0, [b!]: cardOf(pb)?.value ?? 0 },
          });
    } else {
      for (const p of plays)
        options.push({ action: p, plays: { ...fixed, [p.rider]: cardOf(p)?.value ?? 0 } });
    }
    // Endgame: someone is within a few rounds of the line.
    const endgame =
      search.endgame > 0 &&
      board.riders.some((r) => {
        const info = infos.get(r.id);
        return (
          r.position &&
          info &&
          roundsToFinish(effortOf(r.position.square), info.deck, info.draw) <= search.endgame
        );
      });
    const ranked = options
      .map((o, i) => ({
        o,
        i,
        s: evaluate(board, seat, infos, o.plays, samples, search.depth, endgame),
      }))
      .sort((a, b) => b.s - a.s || a.i - b.i);
    const distinct = ranked.filter(
      (r, i) => i === 0 || r.o.action.card !== ranked[0]!.o.action.card,
    );
    const pick = distinct.length > 1 && rand.float() < search.slip ? distinct[1]! : distinct[0]!;
    return pick.o.action;
  }

  function choosePlacement(view: GameView, legal: readonly Action[]): Action {
    const places = legal.filter(
      (a): a is Extract<Action, { type: 'placeRider' }> => a.type === 'placeRider',
    );
    if (opts.level === 'easy') {
      // Somewhere in the front half of what is free.
      const sorted = [...places].sort(
        (a, b) => effortOf(a.position.square) - effortOf(b.position.square),
      );
      return sorted[rand.int(Math.max(1, Math.ceil(sorted.length / 2)))]!;
    }
    const riderType = (id: RiderId) => view.riders.find((r) => r.id === id)?.type;
    let best = places[0]!;
    let bestKey = Infinity;
    for (const a of places) {
      // As far forward as possible; rightmost lane (lane 0) first. Sprinteurs place before
      // rouleurs only when nothing better is left, so prefer placing the rouleur first.
      const key =
        effortOf(a.position.square) * 10 +
        a.position.lane +
        (riderType(a.rider) === 'sprinteur' ? 1 : 0);
      if (key < bestKey) {
        bestKey = key;
        best = a;
      }
    }
    return best;
  }

  function chooseFirstRider(view: GameView, legal: readonly Action[]): Action {
    const choices = legal.filter(
      (a): a is Extract<Action, { type: 'chooseRider' }> => a.type === 'chooseRider',
    );
    if (opts.level === 'easy' || view.phase !== 'energy') return choices[rand.int(choices.length)]!;
    // Deal first for the rider further back: the leader then chooses knowing its teammate's card.
    const at = (id: RiderId) => {
      const p = view.riders.find((r) => r.id === id)?.position;
      return p ? effortOf(p.square) : -1;
    };
    return [...choices].sort((a, b) => at(b.rider) - at(a.rider))[0]!;
  }

  /**
   * Breakaway (P-BRK-*): how many rounds sooner a rider would finish from the breakaway square,
   * after losing its two best cards and taking two exhaustion cards.
   */
  const breakawaySq = Object.values(track.squares).find((q) => q.flags.includes('breakaway'));
  function breakawayGain(view: GameView, rider: RiderId): number {
    const r = view.riders.find((x) => x.id === rider);
    const info = knowledge(view, config).get(rider);
    if (!r?.position || !info || !breakawaySq) return 0;
    const deck = [...info.deck].sort((a, b) => a - b);
    const stay = roundsToFinish(effortOf(r.position.square), deck, info.draw);
    const after = [...deck.slice(0, -2), EXHAUSTION_VALUE, EXHAUSTION_VALUE];
    const go = roundsToFinish(effortOf(breakawaySq.id), after, info.draw);
    return stay - go;
  }

  function chooseBreakaway(view: GameView, legal: readonly Action[]): Action {
    if (opts.level === 'easy') return legal[rand.int(legal.length)]!;
    const choose = legal.filter((a) => a.type === 'chooseRider');
    if (choose.length > 0) {
      return [...choose].sort(
        (a, b) => breakawayGain(view, b.rider) - breakawayGain(view, a.rider),
      )[0]!;
    }
    // Bid high when the breakaway is worth it; otherwise bid the lowest card (losers keep it).
    const plays = legal.filter(
      (a): a is Extract<Action, { type: 'playCard' }> => a.type === 'playCard',
    );
    const rider = plays[0]!.rider;
    const hand = view.own?.riders.find((r) => r.rider === rider)?.hand ?? [];
    const value = (a: (typeof plays)[number]) => hand.find((c) => c.id === a.card)?.value ?? 0;
    const worth = breakawayGain(view, rider) > (opts.level === 'hard' ? 0.15 : 0.3);
    return [...plays].sort((a, b) => (worth ? value(b) - value(a) : value(a) - value(b)))[0]!;
  }

  return {
    name,
    decide(view, seat, legal) {
      if (legal.length === 0) throw new Error(`${name} bot: no legal actions`);
      const has = (t: Action['type']) => legal.some((a) => a.type === t);
      if (view.phase === 'breakaway') return chooseBreakaway(view, legal);
      if (has('playCard') && view.own) return chooseCard(view, seat, legal);
      if (has('placeRider')) return choosePlacement(view, legal);
      if (has('chooseRider')) return chooseFirstRider(view, legal);
      return legal[0]!;
    },
  };
}
