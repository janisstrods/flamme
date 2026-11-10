/**
 * Stage compiler: stage definition + tile catalog → the directed square graph the engine uses.
 * Geometry for the renderer is a separate step (M2).
 */
import { squareIdOf } from './schema';
import type {
  CompiledSquare,
  SquareSpec,
  StageDefinition,
  TileCatalog,
  TileSide,
  TrackGraph,
} from './schema';

export interface StageIssue {
  message: string;
}

export class StageCompileError extends Error {
  constructor(
    readonly stageId: string,
    readonly issues: StageIssue[],
  ) {
    super(`Stage ${stageId}: ${issues.map((i) => i.message).join('; ')}`);
    this.name = 'StageCompileError';
  }
}

/** Main-line length of a tile: linear squares plus the shortest branch of each split. */
export function tileLength(tile: TileSide): number {
  return tile.segments.reduce(
    (n, seg) =>
      n +
      (seg.type === 'linear'
        ? seg.squares.length
        : Math.min(...seg.branches.map((b) => b.squares.length))),
    0,
  );
}

/** Load-time checks: known tiles, start first, finish last, one start line, one finish line, length. */
export function validateStage(stage: StageDefinition, catalog: TileCatalog): StageIssue[] {
  const issues: StageIssue[] = [];
  const byId = new Map(catalog.tiles.map((t) => [t.id, t]));
  const tiles = stage.tiles.map((id) => byId.get(id));
  stage.tiles.forEach((id, i) => {
    if (!tiles[i]) issues.push({ message: `unknown tile "${id}" at position ${i}` });
  });
  if (issues.length > 0) return issues;
  const known = tiles as TileSide[];
  if (known[0]?.shape.kind !== 'start') issues.push({ message: 'first tile must be a start tile' });
  const last = known.at(-1)?.shape.kind;
  if (last !== 'finish' && last !== 'wideFinish')
    issues.push({ message: 'last tile must be a finish tile' });
  const flags = known.flatMap((t) =>
    t.segments.flatMap((s) =>
      s.type === 'linear' ? s.squares : s.branches.flatMap((b) => b.squares),
    ),
  );
  const count = (f: string) => flags.filter((q) => q.flags.includes(f as never)).length;
  if (count('startLine') !== 1) issues.push({ message: 'stage needs exactly one start line' });
  if (count('finishLine') !== 1) issues.push({ message: 'stage needs exactly one finish line' });
  const seen = new Set<string>();
  for (const t of known) {
    // Only real tiles (with a flip side) exist once; generic fixture pieces may repeat.
    if (t.flipSide === undefined) continue;
    const physical = [t.id, t.flipSide].sort().join('|');
    if (seen.has(physical)) issues.push({ message: `tile "${t.id}" is used twice` });
    seen.add(physical);
  }
  if (stage.expectedLength !== undefined) {
    const total = known.reduce((n, t) => n + tileLength(t), 0);
    if (total !== stage.expectedLength)
      issues.push({ message: `length ${total} differs from expected ${stage.expectedLength}` });
  }
  return issues;
}

interface Draft extends Omit<CompiledSquare, 'index'> {
  raw: number;
}

/**
 * Compile a stage. Square `index` counts from the start-line square (0) along each square's own
 * path; squares after a split continue from the shortest branch.
 * Throws StageCompileError if `validateStage` reports issues.
 */
export function compileStage(stage: StageDefinition, catalog: TileCatalog): TrackGraph {
  const issues = validateStage(stage, catalog);
  if (issues.length > 0) throw new StageCompileError(stage.id, issues);
  const byId = new Map(catalog.tiles.map((t) => [t.id, t]));
  const drafts = new Map<string, Draft>();
  let tails: { id: string; raw: number }[] = [];

  const add = (
    id: string,
    spec: SquareSpec,
    raw: number,
    ref: Draft['ref'],
    prev: string[],
    branch?: string,
  ) => {
    const draft: Draft = {
      id,
      lanes: spec.lanes,
      terrain: spec.terrain,
      flags: [...spec.flags],
      next: [],
      prev,
      ref,
      raw,
      ...(branch !== undefined ? { branch } : {}),
      ...(spec.timingSeconds !== undefined ? { timingSeconds: spec.timingSeconds } : {}),
    };
    drafts.set(id, draft);
    for (const p of prev) drafts.get(p)!.next.push(id);
  };

  stage.tiles.forEach((tileId, tile) => {
    const t = byId.get(tileId)!;
    t.segments.forEach((seg, segment) => {
      if (seg.type === 'linear') {
        seg.squares.forEach((spec, square) => {
          const id = squareIdOf({ tile, segment, square });
          const raw = (tails.length === 0 ? -1 : Math.min(...tails.map((x) => x.raw))) + 1;
          add(
            id,
            spec,
            raw,
            { tile, segment, square },
            tails.map((x) => x.id),
          );
          tails = [{ id, raw }];
        });
      } else {
        const base = tails;
        const baseRaw = Math.min(...base.map((x) => x.raw));
        const shortest = Math.min(...seg.branches.map((b) => b.squares.length));
        const newTails: { id: string; raw: number }[] = [];
        seg.branches.forEach((b, branch) => {
          let prev = base.map((x) => x.id);
          b.squares.forEach((spec, square) => {
            const id = squareIdOf({ tile, segment, branch, square });
            add(id, spec, baseRaw + square + 1, { tile, segment, branch, square }, prev, b.name);
            prev = [id];
          });
          // Squares after the split continue counting from the shortest branch.
          newTails.push({ id: prev[0]!, raw: baseRaw + shortest });
        });
        tails = newTails;
      }
    });
  });

  const all = [...drafts.values()];
  const startLine = all.find((d) => d.flags.includes('startLine'))!;
  const finish = all.find((d) => d.flags.includes('finishLine'))!;
  const offset = startLine.raw;
  const squares: Record<string, CompiledSquare> = {};
  for (const { raw, ...rest } of all) squares[rest.id] = { ...rest, index: raw - offset };
  const startGrid = all
    .filter((d) => d.flags.includes('startGrid'))
    .sort((a, b) => b.raw - a.raw)
    .map((d) => d.id);

  return {
    stageId: stage.id,
    squares,
    startGrid,
    finishSquare: finish.id,
    finishIndex: finish.raw - offset,
  };
}
