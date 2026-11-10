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
  stagesNeedIt = false,
): GameConfig['modules']['peloton'] {
  return teams > 4 || breakaway || oneRiderEach || stagesNeedIt
    ? { breakaway, oneRiderEach }
    : undefined;
}

/**
 * Does this mode need the Peloton expansion? The full 21-stage tour always does (G-TOU-1), and so
 * does any stage built with Peloton tiles (cobbles, supply zones, the wide start, the breakaway
 * and bonus tiles), whose rules apply there anyway.
 */
export function modeNeedsPeloton(mode: GameConfig['mode']): boolean {
  const stages =
    mode.kind === 'tour'
      ? tourStages(mode.schedule)
      : mode.kind === 'single'
        ? [mode.stage]
        : [mode.stage];
  return (
    (mode.kind === 'tour' && stages.length >= 21) ||
    stages.some((s) => s.tiles.some((t) => /^[1-9]_/.test(t)))
  );
}

export function withPeloton(
  config: GameConfig,
  opts: { breakaway?: boolean; oneRiderEach?: boolean } = {},
): GameConfig {
  const breakaway = opts.breakaway ?? config.modules.peloton?.breakaway ?? false;
  const oneRiderEach = opts.oneRiderEach ?? config.modules.peloton?.oneRiderEach ?? false;
  const rest = { ...config.modules };
  delete rest.peloton;
  const peloton = pelotonFor(
    config.seats.length,
    breakaway,
    oneRiderEach,
    modeNeedsPeloton(config.mode),
  );
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

/**
 * The Grand Tour module settings a mode needs: tours always have it; new tiles and special stages
 * switch on when the stages use them; specialists are the players' choice.
 */
export function grandTourFor(
  mode: GameConfig['mode'],
  specialists: boolean,
): GameConfig['modules']['grandTour'] {
  const stages =
    mode.kind === 'tour' ? tourStages(mode.schedule) : mode.kind === 'single' ? [mode.stage] : [];
  const newTiles = stages.some((s) => s.tiles.some((t) => /^[xyz]_/.test(t)));
  const specialStages = stages.some((s) => (s.type ?? 'normal') !== 'normal');
  if (mode.kind !== 'tour' && !newTiles && !specialStages && !specialists) return undefined;
  return { newTiles, specialists, specialStages };
}

/** Set the Grand Tour module for the config's mode (keeping the specialists choice). */
export function withGrandTour(
  config: GameConfig,
  specialists = config.modules.grandTour?.specialists ?? false,
): GameConfig {
  const modules = { ...config.modules };
  const gt = grandTourFor(config.mode, specialists);
  if (gt) modules.grandTour = gt;
  else delete modules.grandTour;
  return { ...config, modules };
}

/** Stages that make sense as a single race (time trials and extended stages are tour stages). */
export const singleStages = (stages: readonly StageDefinition[]) =>
  stages.filter((s) => (s.type ?? 'normal') === 'normal');

export interface TourChoice {
  stages: string[];
  restAfter?: number | number[] | undefined;
}

/** The game mode for a tour choice (wide finishes, optional rest day). */
export const tourMode = (t: TourChoice): GameConfig['mode'] => ({
  kind: 'tour',
  schedule: tourSchedule(t.stages, t.restAfter),
});

/** Switch a config to a tour (or back to a single race), with the modules that needs. */
export function withMode(config: GameConfig, mode: GameConfig['mode']): GameConfig {
  return withGrandTour({ ...config, mode });
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
