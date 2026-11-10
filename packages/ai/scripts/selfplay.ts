/**
 * Self-play harness: runs many races between bots on random base stages and reports completion,
 * illegal actions, stalls and win rates.
 *   npx -y pnpm@10.34.9 selfplay -- --races 10000 --seed nightly
 */
import { TILE_CATALOG, compileStage } from '@velo/content';
import { apply, createGame, legalActions, viewFor } from '@velo/engine';
import type { GameState } from '@velo/engine';
import { randomBaseStage } from '@velo/engine/testing';
import type { GameConfig, GameEvent } from '@velo/protocol';
import { randomBot } from '../src/index';

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
};
const races = Number(arg('races', '10000'));
const seed = arg('seed', 'selfplay');
const show = process.argv.includes('--show');
const MAX_ACTIONS = 20_000;

let completed = 0;
let illegal = 0;
let stalls = 0;
let totalRounds = 0;
const winsBySeat = new Map<string, number>();
const winsByType = { rouleur: 0, sprinteur: 0 };
const started = performance.now();

for (let n = 0; n < races; n++) {
  const teams = 2 + (n % 3);
  const config: GameConfig = {
    modules: {},
    mode: { kind: 'single', stage: randomBaseStage(`${seed}-${n}`) },
    seats: Array.from({ length: teams }, (_, i) => ({
      seat: `seat-${i}`,
      controller: { kind: 'ai' as const, level: 'easy' as const },
    })),
    options: { showRemainingValues: true, allowSpectators: false, turnTimer: 'off' },
  };
  const track = compileStage(
    config.mode.kind === 'single' ? config.mode.stage : randomBaseStage('x'),
    TILE_CATALOG,
  );
  let state: GameState = createGame(config, `${seed}-${n}`, track);
  const bots = new Map(state.teams.map((t) => [t.seat, randomBot(`${seed}-${n}-${t.seat}`)]));
  let actions = 0;
  while (state.phase !== 'stageEnd' && actions < MAX_ACTIONS) {
    let acted = false;
    for (const team of state.teams) {
      const legal = legalActions(state, team.seat);
      if (legal.length === 0) continue;
      const action = bots.get(team.seat)!.decide(viewFor(state, team.seat), team.seat, legal);
      const res = apply(state, action);
      actions++;
      if (!res.ok) {
        illegal++;
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
    stalls++;
    continue;
  }
  completed++;
  totalRounds += state.round;
  const winner = state.riders[state.result![0]!]!;
  winsBySeat.set(winner.team, (winsBySeat.get(winner.team) ?? 0) + 1);
  winsByType[winner.type]++;
}

const seconds = (performance.now() - started) / 1000;
console.log(
  `Races: ${races}, completed: ${completed}, stalls: ${stalls}, illegal actions: ${illegal}`,
);
console.log(`Average rounds: ${(totalRounds / Math.max(completed, 1)).toFixed(1)}`);
console.log(`Winner type: rouleur ${winsByType.rouleur}, sprinteur ${winsByType.sprinteur}`);
console.log(
  `Wins by seat: ${[...winsBySeat.entries()]
    .sort()
    .map(([s, w]) => `${s} ${w}`)
    .join(', ')}`,
);
console.log(`Time: ${seconds.toFixed(1)} s (${((seconds * 1000) / races).toFixed(1)} ms per race)`);
if (stalls > 0 || illegal > 0 || completed !== races) process.exit(1);

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
