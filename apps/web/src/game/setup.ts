/** Race setup helpers shared by the solo screen and the lobby (Peloton options, issues). */
import { TILE_CATALOG, compileStage, generateStage } from '@velo/content';
import type { StageDefinition } from '@velo/content';
import { checkStage } from '@velo/engine';
import { checkModuleDependencies } from '@velo/protocol';
import type { GameConfig } from '@velo/protocol';

/** The Peloton module settings for a race, or undefined when the base game is enough. */
export function pelotonFor(
  teams: number,
  breakaway: boolean,
  oneRiderEach: boolean,
): GameConfig['modules']['peloton'] {
  return teams > 4 || breakaway || oneRiderEach ? { breakaway, oneRiderEach } : undefined;
}

export function withPeloton(
  config: GameConfig,
  opts: { breakaway?: boolean; oneRiderEach?: boolean } = {},
): GameConfig {
  const breakaway = opts.breakaway ?? config.modules.peloton?.breakaway ?? false;
  const oneRiderEach = opts.oneRiderEach ?? config.modules.peloton?.oneRiderEach ?? false;
  const rest = { ...config.modules };
  delete rest.peloton;
  const peloton = pelotonFor(config.seats.length, breakaway, oneRiderEach);
  return { ...config, modules: peloton ? { ...rest, peloton } : rest };
}

/** Everything that stops this race from starting, in words. */
export function setupIssues(config: GameConfig): string[] {
  const out = checkModuleDependencies(config).map((i) => i.message);
  if (config.mode.kind === 'single')
    out.push(...checkStage(config, compileStage(config.mode.stage, TILE_CATALOG)));
  return out;
}

export function randomStage(teams: number, breakaway: boolean): StageDefinition {
  const seed = Math.random().toString(36).slice(2, 8);
  return {
    ...generateStage(seed, TILE_CATALOG, { teams, breakaway, peloton: teams > 4 || breakaway }),
    name: `Random stage ${seed}`,
  };
}

export const stageLabel = (s: StageDefinition) =>
  s.playerVariant === '5-6' ? `${s.name} (up to 6 teams)` : s.name;

/** Does this stage have the breakaway tile after the start? */
export const hasBreakawayTile = (s: StageDefinition) => s.tiles[1]?.startsWith('2_') ?? false;
