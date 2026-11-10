/**
 * Self-play harness: runs races between bots on random base stages and reports completion,
 * illegal actions, stalls, win rates and decision times.
 *   npx -y pnpm@10.34.9 selfplay -- --races 10000 --seed nightly        (random bots, 2-4 teams)
 *   npx -y pnpm@10.34.9 selfplay -- --bots hard,medium,easy --races 200   (a line-up; seats rotate)
 *   npx -y pnpm@10.34.9 selfplay -- --ladder --races 100                  (difficulty ladder)
 * A line-up entry is random, easy, medium or hard (optionally :personality), or peloton / muscle
 * for a dummy team.
 */
import { TILE_CATALOG, compileStage } from '@velo/content';
import { apply, createGame, legalActions, viewFor } from '@velo/engine';
import type { GameState } from '@velo/engine';
import { randomBaseStage } from '@velo/engine/testing';
import type { AiPersonality, GameConfig, GameEvent, SeatConfig } from '@velo/protocol';
import { makeBot, randomBot } from '../src/index';
import type { Bot } from '../src/index';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
};
const show = process.argv.includes('--show');
const seed = arg('seed', 'selfplay');
const MAX_ACTIONS = 20_000;

interface Tally {
  races: number;
  completed: number;
  stalls: number;
  illegal: number;
  rounds: number;
  wins: Map<string, number>;
  winsByType: { rouleur: number; sprinteur: number };
  decisions: Map<string, { n: number; ms: number; max: number }>;
}

/** `hard/depth=1/samples=40/scale=1`: tuning syntax for the search settings. */
function searchOverride(entry: string) {
  const search: Record<string, number> = {};
  for (const part of entry.split('/').slice(1)) {
    const [k, v] = part.split('=');
    if (k && v) search[k] = Number(v);
  }
  return Object.keys(search).length ? { search } : {};
}

function seatFor(entry: string, seat: string): SeatConfig {
  const [kind, personality] = entry.split('/')[0]!.split(':');
  if (kind === 'peloton' || kind === 'muscle')
    return { seat, controller: { kind: 'dummy', team: kind } };
  const level = kind === 'medium' || kind === 'hard' ? kind : 'easy';
  return {
    seat,
    controller: {
      kind: 'ai',
      level,
      ...(personality ? { personality: personality as AiPersonality } : {}),
    },
  };
}

/** Run `races` races of a line-up (null: 2-4 random bots). Seats rotate so no entry keeps seat 0. */
function run(lineup: string[] | null, races: number, label: string): Tally {
  const t: Tally = {
    races,
    completed: 0,
    stalls: 0,
    illegal: 0,
    rounds: 0,
    wins: new Map(),
    winsByType: { rouleur: 0, sprinteur: 0 },
    decisions: new Map(),
  };
  for (let n = 0; n < races; n++) {
    const entries = lineup
      ? lineup.map((_, i) => lineup[(i + n) % lineup.length]!)
      : Array.from({ length: 2 + (n % 3) }, () => 'random');
    const stage = randomBaseStage(`${seed}-${label}-${n}`);
    const config: GameConfig = {
      modules: {},
      mode: { kind: 'single', stage },
      seats: entries.map((e, i) => seatFor(e, `seat-${i}`)),
      options: { showRemainingValues: true, allowSpectators: false, turnTimer: 'off' },
    };
    const track = compileStage(stage, TILE_CATALOG);
    let state: GameState = createGame(config, `${seed}-${label}-${n}`, track);
    const bots = new Map<string, { bot: Bot; entry: string }>();
    entries.forEach((entry, i) => {
      const s = `seat-${i}`;
      const [kind, personality] = entry.split('/')[0]!.split(':');
      if (kind === 'peloton' || kind === 'muscle') return;
      const botSeed = `${seed}-${label}-${n}-${s}`;
      const bot =
        kind === 'random'
          ? randomBot(botSeed)
          : makeBot({
              level: kind === 'medium' || kind === 'hard' ? kind : 'easy',
              personality: personality as AiPersonality | undefined,
              seed: botSeed,
              track,
              config,
              ...searchOverride(entry),
            });
      bots.set(s, { bot, entry });
    });
    let actions = 0;
    while (state.phase !== 'stageEnd' && actions < MAX_ACTIONS) {
      let acted = false;
      for (const team of state.teams) {
        const legal = legalActions(state, team.seat);
        if (legal.length === 0) continue;
        const b = bots.get(team.seat);
        if (!b) continue;
        const t0 = performance.now();
        const action = b.bot.decide(viewFor(state, team.seat), team.seat, legal);
        const ms = performance.now() - t0;
        const d = t.decisions.get(b.entry) ?? { n: 0, ms: 0, max: 0 };
        d.n++;
        d.ms += ms;
        d.max = Math.max(d.max, ms);
        t.decisions.set(b.entry, d);
        const res = apply(state, action);
        actions++;
        if (!res.ok) {
          t.illegal++;
          continue;
        }
        state = res.state;
        acted = true;
        if (show && n === 0) for (const ev of res.events) describe(state, ev);
        if (state.phase === 'stageEnd') break;
      }
      if (!acted) break;
    }
    if (state.phase !== 'stageEnd') {
      t.stalls++;
      continue;
    }
    t.completed++;
    t.rounds += state.round;
    const winner = state.riders[state.result![0]!]!;
    const key = lineup ? entries[Number(winner.team.split('-')[1])]! : winner.team;
    t.wins.set(key, (t.wins.get(key) ?? 0) + 1);
    t.winsByType[winner.type]++;
  }
  return t;
}

function report(t: Tally): void {
  console.log(
    `Races: ${t.races}, completed: ${t.completed}, stalls: ${t.stalls}, illegal actions: ${t.illegal}`,
  );
  console.log(`Average rounds: ${(t.rounds / Math.max(t.completed, 1)).toFixed(1)}`);
  console.log(`Winner type: rouleur ${t.winsByType.rouleur}, sprinteur ${t.winsByType.sprinteur}`);
  console.log(
    `Wins: ${[...t.wins.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([k, w]) => `${k} ${w} (${((100 * w) / Math.max(t.completed, 1)).toFixed(0)}%)`)
      .join(', ')}`,
  );
  for (const [k, d] of t.decisions)
    if (k !== 'random')
      console.log(
        `Decision time ${k}: mean ${(d.ms / d.n).toFixed(2)} ms, max ${d.max.toFixed(1)} ms`,
      );
}

const started = performance.now();
let failed = false;
if (process.argv.includes('--ladder')) {
  const races = Number(arg('races', '100'));
  // Each rung: [line-up, entry that should win more than its share].
  const rungs: [string[], string][] = [
    [['easy', 'random'], 'easy'],
    [['medium', 'easy'], 'medium'],
    [['hard', 'medium'], 'hard'],
    [['medium', 'muscle'], 'medium'],
    [['hard', 'medium', 'easy'], 'hard'],
  ];
  for (const [lineup, favourite] of rungs) {
    console.log(`\n== ${lineup.join(' vs ')} ==`);
    const t = run(lineup, races, lineup.join('-'));
    report(t);
    const share = (t.wins.get(favourite) ?? 0) / Math.max(t.completed, 1);
    const ok = share > 1 / lineup.length && t.stalls === 0 && t.illegal === 0;
    console.log(`${ok ? 'PASS' : 'FAIL'}: ${favourite} wins ${(100 * share).toFixed(0)}%`);
    failed ||= !ok;
  }
} else {
  const bots = process.argv.includes('--bots') ? arg('bots', 'easy,easy').split(',') : null;
  const races = Number(arg('races', bots ? '200' : '10000'));
  const t = run(bots, races, bots ? bots.join('-') : 'random');
  report(t);
  failed = t.stalls > 0 || t.illegal > 0 || t.completed !== races;
}
const seconds = (performance.now() - started) / 1000;
console.log(`\nTime: ${seconds.toFixed(1)} s`);
if (failed) process.exit(1);

/** Plain-text narration of one race, for `--show`. */
function describe(state: GameState, ev: GameEvent): void {
  const at = (sq: string) => state.track.squares[sq]?.index ?? '?';
  switch (ev.type) {
    case 'phaseChanged':
      if (ev.phase === 'energy') console.log(`\n— Round ${ev.round} —`);
      break;
    case 'riderPlaced':
      console.log(`${ev.rider} placed on square ${at(ev.at.square)}, lane ${ev.at.lane}`);
      break;
    case 'cardsRevealed':
      console.log(
        `Revealed: ${ev.plays.map((p) => `${p.rider} ${p.card.value}${p.card.kind === 'exhaustion' ? 'x' : ''}`).join(', ')}`,
      );
      break;
    case 'riderMoved': {
      const notes = [
        ev.effectiveValue !== ev.cardValue
          ? `card ${ev.cardValue} counts as ${ev.effectiveValue}`
          : '',
        ev.blocked ? 'blocked' : '',
        ev.ascentEdge ? 'stops before the climb' : '',
      ].filter(Boolean);
      console.log(
        `  ${ev.rider} ${at(ev.from.square)} → ${at(ev.to.square)}${notes.length ? ` (${notes.join(', ')})` : ''}`,
      );
      break;
    }
    case 'slipstream':
      console.log(`  slipstream: ${ev.riders.join(', ')} move up one`);
      break;
    case 'exhaustionTaken':
      console.log(`  ${ev.rider} takes an exhaustion card`);
      break;
    case 'stageEnded':
      console.log(`\nFinish order: ${ev.order.join(', ')}`);
      break;
  }
}
