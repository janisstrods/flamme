/**
 * Grand Tour specialists: card swaps and powers, transcribed from the Grand Tour rulebook's
 * specialist table (p.12). Display names are generic cycling role names (decision C-004).
 * A power listed on an `adds` entry applies to every card of that entry.
 */
import { Specialist } from '../schema';
import type { DeckEntry, SpecialistPower } from '../schema';

const e = (count: number, value: number, powers: SpecialistPower[] = []): DeckEntry => ({
  kind: 'energy',
  value,
  count,
  powers,
});

const raw: Specialist[] = [
  // Rouleurs
  {
    id: 'r1-baroudeur',
    number: 1,
    name: 'Baroudeur',
    riderType: 'rouleur',
    removes: [e(1, 3), e(1, 5), e(2, 6), e(1, 7)],
    adds: [
      e(1, 5, ['breakaway', 'relentless']),
      e(2, 6, ['breakaway', 'relentless']),
      e(1, 7, ['breakaway', 'relentless']),
    ],
    verified: true,
  },
  {
    id: 'r2-flandrien',
    number: 2,
    name: 'Flandrien',
    riderType: 'rouleur',
    removes: [e(1, 3), e(1, 4), e(1, 5), e(1, 6), e(1, 7)],
    adds: [3, 4, 5, 6, 7].map((v) => e(1, v, ['chase'])),
    verified: true,
  },
  {
    id: 'r3-grimpeur',
    number: 3,
    name: 'Grimpeur',
    riderType: 'rouleur',
    removes: [e(3, 3), e(3, 6)],
    adds: [e(3, 3, ['strongDescents']), e(3, 6, ['strongAscents6'])],
    verified: true,
  },
  {
    id: 'r4-domestique',
    number: 4,
    name: 'Domestique',
    riderType: 'rouleur',
    removes: [e(3, 4)],
    adds: [e(3, 4, ['recovery'])],
    verified: true,
  },
  {
    id: 'r5-super-rouleur',
    number: 5,
    name: 'Super Rouleur',
    riderType: 'rouleur',
    removes: [e(2, 5), e(2, 6)],
    adds: [e(2, 5, ['nimble']), e(2, 6, ['nimble'])],
    verified: true,
  },
  {
    id: 'r6-puncheur',
    number: 6,
    name: 'Puncheur',
    riderType: 'rouleur',
    removes: [e(1, 4), e(1, 6)],
    adds: [e(1, 8, ['relentless'])],
    verified: true,
  },
  // Sprinteurs
  {
    id: 's1-descender',
    number: 1,
    name: 'Descender',
    riderType: 'sprinteur',
    removes: [e(3, 3)],
    adds: [e(3, 3, ['strongDescents', 'recovery'])],
    verified: true,
  },
  {
    id: 's2-polyvalent',
    number: 2,
    name: 'Polyvalent',
    riderType: 'sprinteur',
    removes: [e(3, 4)],
    adds: [e(1, 3), e(2, 6)],
    verified: true,
  },
  {
    id: 's3-mountaineer',
    number: 3,
    name: 'Mountaineer',
    riderType: 'sprinteur',
    removes: [e(1, 2), e(1, 3), e(1, 5), e(1, 9)],
    adds: [e(1, 4), e(2, 7, ['strongAscents7'])],
    verified: true,
  },
  {
    id: 's4-opportunist',
    number: 4,
    name: 'Opportunist',
    riderType: 'sprinteur',
    removes: [e(1, 2), e(1, 9)],
    adds: [e(2, 7, ['breakaway', 'chase'])],
    verified: true,
  },
  {
    id: 's5-super-sprinteur',
    number: 5,
    name: 'Super Sprinteur',
    riderType: 'sprinteur',
    removes: [e(1, 5), e(2, 9)],
    adds: [e(1, 4), e(1, 10), e(1, 11)],
    verified: true,
  },
  {
    id: 's6-flahute',
    number: 6,
    name: 'Flahute',
    riderType: 'sprinteur',
    removes: [e(1, 4), e(2, 9)],
    adds: [e(1, 5, ['nimble']), e(2, 9, ['nimble'])],
    verified: true,
  },
];

export const SPECIALISTS: readonly Specialist[] = raw.map((s) => Specialist.parse(s));
