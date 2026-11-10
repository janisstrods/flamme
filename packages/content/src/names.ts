/**
 * Names for teams and riders: our own invented combinations (C-003), never real riders or teams.
 * Seeded, so a room gives the same names on every screen and after a reload.
 */

export interface GeneratedNames {
  team: string;
  rouleur: string;
  sprinteur: string;
}

const FIRST = [
  'Ada',
  'Aino',
  'Alba',
  'Anouk',
  'Arvid',
  'Bas',
  'Bruno',
  'Calla',
  'Ciro',
  'Dagny',
  'Dario',
  'Edda',
  'Elio',
  'Emil',
  'Enzo',
  'Fenna',
  'Filip',
  'Greta',
  'Gus',
  'Hanne',
  'Ilse',
  'Inès',
  'Ivo',
  'Jonas',
  'Juno',
  'Kai',
  'Kasper',
  'Lea',
  'Levi',
  'Linnea',
  'Lior',
  'Lotte',
  'Luca',
  'Maren',
  'Matteo',
  'Mila',
  'Nico',
  'Nils',
  'Noor',
  'Oda',
  'Olek',
  'Paz',
  'Pim',
  'Rafa',
  'Rhea',
  'Rosa',
  'Rune',
  'Saga',
  'Sander',
  'Sol',
  'Teo',
  'Thea',
  'Timo',
  'Ulla',
  'Vera',
  'Vito',
  'Wren',
  'Yara',
  'Yves',
  'Zeno',
];

const LAST = [
  'Achterberg',
  'Albrecht',
  'Arrieta',
  'Bakkum',
  'Barrow',
  'Bellamy',
  'Brandvold',
  'Castellan',
  'Corbet',
  'Dalgaard',
  'Delacourt',
  'Duvenage',
  'Eskelinen',
  'Falkner',
  'Ferreira',
  'Galloway',
  'Gerritsen',
  'Halvorsen',
  'Hartigan',
  'Ibarra',
  'Jansma',
  'Kallio',
  'Kerrigan',
  'Lachance',
  'Lindqvist',
  'Lomax',
  'Marchetti',
  'Moravec',
  'Nakamura',
  'Nyberg',
  'Okafor',
  'Ostrowski',
  'Pellegrin',
  'Quist',
  'Rasmussen',
  'Renaud',
  'Saltmarsh',
  'Santangelo',
  'Sjöberg',
  'Strand',
  'Tamsin',
  'Thorvald',
  'Urquhart',
  'Valcourt',
  'Vermeulen',
  'Wainwright',
  'Westerholm',
  'Ybarra',
  'Zaragoza',
  'Zeller',
];

const TEAM_WORD = [
  'Amberline',
  'Blackthorn',
  'Bramble',
  'Copperleaf',
  'Driftwood',
  'Edelweiss',
  'Fernhill',
  'Foxglove',
  'Granite',
  'Harbourlight',
  'Juniper',
  'Kestrel',
  'Larkspur',
  'Lavande',
  'Marigold',
  'Meridian',
  'Northwind',
  'Oakmoss',
  'Orchard',
  'Pinecrest',
  'Quarry',
  'Rosehip',
  'Saffron',
  'Saltmarsh',
  'Silverbirch',
  'Stonebridge',
  'Thistle',
  'Tidewater',
  'Vineyard',
  'Wildflower',
];

const TEAM_STYLE = [
  (w: string) => `${w} Cycling`,
  (w: string) => `${w} Velo Club`,
  (w: string) => `${w} Racing`,
  (w: string) => `${w} Wheelers`,
  (w: string) => `Équipe ${w}`,
  (w: string) => `${w} Road Team`,
];

function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A team name and two rider names from a seed. `avoid` lists names already used in the room. */
export function generateNames(seed: string, avoid: readonly string[] = []): GeneratedNames {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const used = new Set(avoid);
  // First names too: two riders called Hanne in one race would be hard to tell apart.
  const firsts = new Set(avoid.map((n) => n.split(' ')[0]!));
  const fresh = (make: () => string, distinctFirst = false) => {
    let name = make();
    for (
      let i = 0;
      i < 40 && (used.has(name) || (distinctFirst && firsts.has(name.split(' ')[0]!)));
      i++
    )
      name = make();
    used.add(name);
    firsts.add(name.split(' ')[0]!);
    return name;
  };
  const team = fresh(() => pick(TEAM_STYLE)(pick(TEAM_WORD)));
  const rider = () => `${pick(FIRST)} ${pick(LAST)}`;
  return { team, rouleur: fresh(rider, true), sprinteur: fresh(rider, true) };
}
