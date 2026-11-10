/** Race setup helpers shared by the solo screen and the lobby (Peloton options, issues). */
import { TILE_CATALOG, compileStage, generateStage, tourSchedule, tourStages } from '@velo/content';
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

/** Everything that stops this race (or tour) from starting, in words. */
export function setupIssues(config: GameConfig): string[] {
  const out = checkModuleDependencies(config).map((i) => i.message);
  if (config.mode.kind === 'single')
    out.push(...checkStage(config, compileStage(config.mode.stage, TILE_CATALOG)));
  if (config.mode.kind === 'tour') {
    const stages = tourStages(config.mode.schedule);
    stages.forEach((stage, i) => {
      const issue = checkStage(config, compileStage(stage, TILE_CATALOG))[0];
      if (issue && !out.some((o) => o.endsWith(issue)))
        out.push(`Stage ${i + 1}, ${stage.name}: ${issue}`);
    });
  }
  return out;
}

/** Tours need the Grand Tour module (its sub-modules arrive with M9). */
export const GRAND_TOUR = { newTiles: false, specialists: false, specialStages: false };

export interface TourChoice {
  stages: string[];
  restAfter?: number | undefined;
}

/** The game mode for a tour choice (wide finishes, optional rest day). */
export const tourMode = (t: TourChoice): GameConfig['mode'] => ({
  kind: 'tour',
  schedule: tourSchedule(t.stages, t.restAfter),
});

/** Switch a config to a tour (or back to a single race), with the modules that needs. */
export function withMode(config: GameConfig, mode: GameConfig['mode']): GameConfig {
  const modules = { ...config.modules };
  if (mode.kind === 'tour') modules.grandTour = GRAND_TOUR;
  else delete modules.grandTour;
  return { ...config, mode, modules };
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
