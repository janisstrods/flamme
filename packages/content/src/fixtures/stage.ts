/** A short test-only stage built from the fixture tiles. */
import type { StageDefinition } from '../schema';

export const FIXTURE_STAGE: StageDefinition = {
  id: 'fixture-sprint',
  name: 'Fixture Sprint',
  source: 'fixture',
  playerVariant: 'any',
  type: 'normal',
  tiles: ['fx-start', 'fx-straight', 'fx-curve', 'fx-climb', 'fx-straight', 'fx-finish'],
  // Main-line squares across all tiles: 6 + 6 + 2 + 6 + 6 + 6 = 32.
  // Compiled: grid squares get indices -4..-1, the start-line square is 0, the finish square is 23.
  expectedLength: 32,
};
