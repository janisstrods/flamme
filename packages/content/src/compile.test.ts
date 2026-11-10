import { describe, expect, it } from 'vitest';
import {
  FIXTURE_STAGE,
  FIXTURE_TILES,
  StageCompileError,
  TILE_CATALOG,
  compileStage,
  validateStage,
  type StageDefinition,
} from './index';

describe('compileStage', () => {
  const track = compileStage(FIXTURE_STAGE, FIXTURE_TILES);

  it('numbers squares from the start line', () => {
    expect(track.squares['t0.s0.q4']?.index).toBe(0);
    expect(track.squares['t0.s0.q0']?.index).toBe(-4);
    expect(track.finishSquare).toBe('t5.s0.q1');
    expect(track.finishIndex).toBe(23);
  });

  it('lists the start grid front first', () => {
    expect(track.startGrid).toEqual(['t0.s0.q3', 't0.s0.q2', 't0.s0.q1', 't0.s0.q0']);
  });

  it('links a single chain on linear stages', () => {
    const ids = Object.keys(track.squares);
    expect(ids).toHaveLength(32);
    for (const sq of Object.values(track.squares)) {
      expect(sq.next.length).toBeLessThanOrEqual(1);
      for (const n of sq.next) expect(track.squares[n]?.prev).toContain(sq.id);
    }
  });

  it('carries terrain through', () => {
    expect(track.squares['t3.s0.q0']?.terrain).toBe('ascent');
    expect(track.squares['t3.s0.q3']?.terrain).toBe('descent');
  });

  it('builds parallel branches for a roundabout and rejoins after it', () => {
    const stage: StageDefinition = {
      id: 'rb',
      name: 'Roundabout test',
      source: 'fixture',
      playerVariant: 'any',
      type: 'normal',
      tiles: ['a_w', 'b_w', 'x_w', 'c_w', 'u_w'],
    };
    const t = compileStage(stage, TILE_CATALOG);
    const lastTwoLane = t.squares['t2.s0.q2']!;
    expect(lastTwoLane.next).toEqual(['t2.s1.b0.q0', 't2.s1.b1.q0']);
    const after = t.squares['t3.s0.q0']!;
    expect(after.prev.sort()).toEqual(['t2.s1.b0.q2', 't2.s1.b1.q4']);
    // Index continues from the shortest (inner) branch.
    expect(after.index).toBe(t.squares['t2.s1.b0.q2']!.index + 1);
  });

  it('rejects broken stages', () => {
    const bad: StageDefinition = { ...FIXTURE_STAGE, tiles: ['fx-straight', 'fx-finish'] };
    expect(validateStage(bad, FIXTURE_TILES).map((i) => i.message)).toContain(
      'first tile must be a start tile',
    );
    expect(() => compileStage(bad, FIXTURE_TILES)).toThrow(StageCompileError);
  });

  it('rejects using both sides of one physical tile', () => {
    const stage: StageDefinition = {
      ...FIXTURE_STAGE,
      id: 'dup',
      tiles: ['a_w', 'b_w', 'b_s', 'u_w'],
    };
    delete (stage as { expectedLength?: number }).expectedLength;
    expect(validateStage(stage, TILE_CATALOG).some((i) => i.message.includes('used twice'))).toBe(
      true,
    );
  });
});
