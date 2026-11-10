/**
 * Stage design helper: searches random orders of the base tiles for layouts that do not cross
 * themselves, have 2–3 climbs and fit a wide screen. Prints candidates for a human to curate.
 *   npx tsx packages/content/scripts/design-stages.ts [count] [seed]
 */
import { TILE_CATALOG, compileStage, layoutStage, validateStage } from '../src/index';
import type { StageDefinition } from '../src/index';

const count = Number(process.argv[2] ?? 8);
let s = Number(process.argv[3] ?? 1) >>> 0;
const rand = () => {
  s = (s + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
const letters = 'bcdefghijklmnopqrst'.split('');

const found: { stage: StageDefinition; climbs: number; aspect: number; length: number }[] = [];
for (let attempt = 0; attempt < 200_000 && found.length < count; attempt++) {
  const order = [...letters].sort(() => rand() - 0.5);
  const stage: StageDefinition = {
    id: `cand-${attempt}`,
    name: 'Candidate',
    source: 'original',
    playerVariant: '2-4',
    type: 'normal',
    tiles: [
      `a_${pick(['w', 's'])}`,
      ...order.map((l) => `${l}_${pick(['w', 's'])}`),
      `u_${pick(['w', 's'])}`,
    ],
  };
  if (validateStage(stage, TILE_CATALOG).length) continue;
  const track = compileStage(stage, TILE_CATALOG);
  const sq = Object.values(track.squares).sort((a, b) => a.index - b.index);
  let climbs = 0;
  sq.forEach((q, i) => {
    if (q.terrain === 'ascent' && sq[i - 1]?.terrain !== 'ascent') climbs++;
  });
  if (climbs < 2 || climbs > 3) continue;
  const layout = layoutStage(stage, TILE_CATALOG);
  if (layout.overlaps.length) continue;
  const w = layout.bounds.maxX - layout.bounds.minX;
  const h = layout.bounds.maxY - layout.bounds.minY;
  const aspect = w / h;
  if (aspect < 1.2 || aspect > 2.2 || w > 40) continue;
  found.push({ stage, climbs, aspect, length: track.finishIndex });
}
for (const f of found)
  console.log(
    `${f.stage.tiles.join(' ')} | climbs ${f.climbs} | aspect ${f.aspect.toFixed(2)} | to finish ${f.length}`,
  );
