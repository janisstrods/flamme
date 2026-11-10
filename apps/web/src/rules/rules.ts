/**
 * The rules panel's text: the game's rules in our own words (C-003), organised by module. Every
 * entry names the rule ids it explains (docs/RULES_SPEC.md) so it stays in step with the engine.
 */

export type RulesModule =
  | 'basics'
  | 'peloton'
  | 'dummies'
  | 'meteo'
  | 'tour'
  | 'newTiles'
  | 'specialists'
  | 'specialStages'
  | 'app';

export interface RuleEntry {
  id: string;
  module: RulesModule;
  title: string;
  /** Paragraphs. */
  body: string[];
  /** Extra words people might search for. */
  keywords?: string;
  /** docs/RULES_SPEC.md ids. */
  refs?: string[];
}

export const MODULE_NAMES: Record<RulesModule, string> = {
  basics: 'The race',
  peloton: 'Peloton: big fields, cobbles, supply zones, breakaway',
  dummies: 'Automatic teams',
  meteo: 'Weather and crashes',
  tour: 'Tours',
  newTiles: 'Hairpins and roundabouts',
  specialists: 'Specialist riders',
  specialStages: 'Time trials and long stages',
  app: 'Using the app',
};

export const RULES: readonly RuleEntry[] = [
  // ---------------------------------------------------------------- basics
  {
    id: 'goal',
    module: 'basics',
    title: 'Winning',
    body: [
      'Each team has two riders: a rouleur (steady, cards 3 to 7) and a sprinteur (cards 2 to 9, with three 9s). The first rider across the finish line wins the race.',
      'If several riders cross in the same round, the one furthest past the line wins; on the same square, the one in the rightmost lane.',
    ],
    keywords: 'win finish line first',
    refs: ['B-FIN-1'],
  },
  {
    id: 'round',
    module: 'basics',
    title: 'A round: energy, movement, end',
    body: [
      'Energy: for each rider, draw four cards, keep one face down and put the other three under the deck (recycled). You choose which rider draws first; the second only draws after the first has picked.',
      'Movement: everyone reveals; riders move one at a time from the front of the race to the back. On the same square, the rightmost lane moves first.',
      'End: played cards leave the game, then slipstream, then exhaustion.',
    ],
    keywords: 'draw hand phase order turn',
    refs: ['B-ENG-1', 'B-MOV-2'],
  },
  {
    id: 'moving',
    module: 'basics',
    title: 'Moving and being blocked',
    body: [
      'A rider moves exactly the value of its card, through other riders if it must. It cannot finish on a square whose lanes are all taken: it stops on the first square behind with a free lane, in the rightmost free lane.',
      'The log says "blocked" when that happens, and the card hints warn when the square you aim for is full right now.',
    ],
    keywords: 'blocked full square lane stop short',
    refs: ['B-MOV-4', 'B-MOV-5'],
  },
  {
    id: 'slipstream',
    module: 'basics',
    title: 'Slipstream',
    body: [
      'After everyone has moved, any group of riders with exactly one empty square in front of the next group moves up one square to join it. Groups are checked from the back of the race forwards, so one group can catch another and then keep going.',
      'Riders on a climb neither give nor get slipstream.',
    ],
    keywords: 'draft pack group close the gap',
    refs: ['B-END-2', 'B-TER-3'],
  },
  {
    id: 'exhaustion',
    module: 'basics',
    title: 'Exhaustion',
    body: [
      'After slipstream, every rider with an empty square right in front of it takes an exhaustion card (value 2) into its deck. An empty lane beside a rider does not count: only an empty square ahead.',
      'Exhaustion cards clog your deck. When you play one it leaves the game like any other card.',
    ],
    keywords: 'tired 2 card wind open road',
    refs: ['B-END-3'],
  },
  {
    id: 'climbs',
    module: 'basics',
    title: 'Climbs and descents',
    body: [
      'Climbs (ascent squares): if your move starts on, enters or crosses a climb, your card counts as at most 5. If only the 6th square or later of your move would reach the climb, you stop just before it.',
      'Descents: starting on a descent, your card counts as at least 5.',
    ],
    keywords: 'ascent mountain hill descent downhill cap 5',
    refs: ['B-TER-1', 'B-TER-2', 'B-TER-4'],
  },
  {
    id: 'decks',
    module: 'basics',
    title: 'Running out of cards',
    body: [
      "When a rider's deck runs out, its recycled cards are shuffled into a new deck. If it has no cards at all, it plays an exhaustion card from the supply.",
      'The panel under each rider shows how many cards are left face down, how many are recycled and which values are still in the deck.',
    ],
    keywords: 'empty deck reshuffle recycle',
    refs: ['D-010'],
  },
  {
    id: 'placement',
    module: 'basics',
    title: 'The start grid',
    body: [
      'Teams take turns placing both their riders on the start grid, filling the rightmost lane of a square first. A random team starts; then it goes round in seat order.',
    ],
    keywords: 'start grid place setup',
    refs: ['B-SET-5', 'D-007'],
  },
  // ---------------------------------------------------------------- peloton
  {
    id: 'cobbles',
    module: 'peloton',
    title: 'Cobblestones',
    body: [
      'Cobbles are narrow (often a single lane). Riders on cobbles neither give nor get slipstream.',
    ],
    keywords: 'cobble cobblestone pave narrow',
    refs: ['P-COB-1'],
  },
  {
    id: 'supply',
    module: 'peloton',
    title: 'Supply zones',
    body: [
      'Supply zones are three lanes wide. A rider starting its move in one counts its card as at least 4. Slipstream works normally.',
      'When three riders side by side slipstream out of a supply zone into a two-lane square, the two rightmost go first; the third stays and moves to the right, and anyone behind it stays too.',
    ],
    keywords: 'supply feed zone 3 lanes minimum 4',
    refs: ['P-SUP-1', 'P-SUP-2'],
  },
  {
    id: 'breakaway',
    module: 'peloton',
    title: 'Breakaway bidding',
    body: [
      'With the breakaway on, after placement each team picks one rider to bid. Over two rounds it draws four cards and bids one face down; the bids are revealed together.',
      'The highest two-card total breaks away (the top two with five or six teams) to the marked square of the breakaway tile, the higher bid in the rightmost lane. Ties go to the rider further back, then further left.',
      'Winners lose their two bid cards and take two exhaustion cards. Everyone else gets their bids back.',
    ],
    keywords: 'breakaway bid bidding auction',
    refs: ['P-BRK-1', 'P-BRK-2', 'P-BRK-3', 'P-BRK-4', 'D-026'],
  },
  {
    id: 'bigfields',
    module: 'peloton',
    title: 'Five to twelve players',
    body: [
      'Five and six teams need a stage with the wide start. With one rider each (7 to 12 players), every seat races a single rider; two seats can share a colour if they ride different rider types.',
    ],
    keywords: '5 6 players one rider each 12',
    refs: ['P-GEN-1', 'P-ONE-1'],
  },
  // ---------------------------------------------------------------- dummies
  {
    id: 'peloton-team',
    module: 'dummies',
    title: 'Peloton team',
    body: [
      'An automatic team whose two riders share one deck: a rouleur deck plus two attack cards. Each round one card is flipped and both riders move by it. On an attack card the front rider moves 2 and the rear rider 9.',
      'Automatic teams place first, as far forward as possible, take slipstream, never take exhaustion and never bid.',
    ],
    keywords: 'dummy automatic peloton attack',
    refs: ['P-PEL-1', 'P-DUM-1'],
  },
  {
    id: 'muscle-team',
    module: 'dummies',
    title: 'Muscle team',
    body: [
      'An automatic team with normal decks; the sprinteur also has a 5. Each rider flips its own top card every round. Like the Peloton team it never takes exhaustion. In tours, automatic teams race but score nothing.',
    ],
    keywords: 'dummy automatic muscle',
    refs: ['P-MUS-1', 'D-032'],
  },
  // ---------------------------------------------------------------- meteo
  {
    id: 'weather',
    module: 'meteo',
    title: 'Weather',
    body: [
      'Some straight tiles get weather, shown with a badge beside the road and a band on the stage strip.',
      'Tailwind: a rider starting there draws 5 cards. Headwind: it draws 3. Crosswind: no slipstream to or from riders on that tile.',
      'Wet road: a rider that ends its move there after being blocked crashes.',
    ],
    keywords: 'wind rain wet tailwind headwind crosswind weather',
    refs: ['M-TAI-1', 'M-HEA-1', 'M-CRS-1', 'M-WET-1'],
  },
  {
    id: 'crashes',
    module: 'meteo',
    title: 'Crashes',
    body: [
      'A crashed rider lies in its lane and still takes up that lane. No slipstream goes to or from a square with a crashed rider.',
      'A square where every lane has crashed cannot be passed: riders stop behind it (and crash too if that square is wet or a hairpin).',
      'On its next move a crashed rider stands up: its card counts 2 less (after descent or supply minimums, before the climb cap). A card that counts 0 just stands it up, in the rightmost free lane.',
    ],
    keywords: 'crash fall stand up minus 2',
    refs: ['C-1', 'C-2', 'C-3', 'C-4'],
  },
  // ---------------------------------------------------------------- tour
  {
    id: 'tour-scoring',
    module: 'tour',
    title: 'Tour Points',
    body: [
      'The team with the most Tour Points at the end wins. Each stage, the first three riders across the line earn their team 3, 2 and 1.',
      'At the end, bonus points go to the best overall times, the best team time, and the most sprint and mountain points; the longer the tour, the more places are paid. With two players the short-tour bonuses always apply.',
    ],
    keywords: 'tour points TP score podium bonus',
    refs: ['G-POD-1', 'G-END-1', 'G-END-2'],
  },
  {
    id: 'tour-finish',
    module: 'tour',
    title: 'Finishing a tour stage',
    body: [
      'Tour stages use the wide finish. The stage goes on until everyone has crossed. At the end of each round in which riders cross: slipstream as usual; each finisher takes the seconds shown beside the square of the front rider of its group; everyone still racing takes a one-minute penalty; then exhaustion for riders still racing; finishers leave the road.',
    ],
    keywords: 'time seconds minute penalty wide finish timing',
    refs: ['G-FIN-1', 'G-FIN-2', 'D-016'],
  },
  {
    id: 'tokens',
    module: 'tour',
    title: 'Sprint and mountain points',
    body: [
      'Two piles of points sit beside the road: a major pile (5, 3, 1) and a minor pile (2, 1), as sprint or mountain points. A rider reaching or passing the pile takes the top token; if several reach it in one round, the one furthest ahead takes the best.',
      'These are classification points, not Tour Points.',
    ],
    keywords: 'token sprint mountain points pile',
    refs: ['G-TOK-1', 'G-TOK-2'],
  },
  {
    id: 'tour-cards',
    module: 'tour',
    title: 'Cards in a tour',
    body: [
      'Played energy cards are set aside and come back after the stage. Played exhaustion cards go back to the supply.',
      'Between stages every rider sheds half its exhaustion cards (rounded down). On a rest day the classification leaders earn a Tour Point each, and everyone else sheds half again.',
    ],
    keywords: 'exhaustion carry rest day between stages',
    refs: ['G-CRD-1', 'G-BTW-1', 'G-BTW-3'],
  },
  {
    id: 'jerseys',
    module: 'tour',
    title: 'Jerseys and start order',
    body: [
      'Yellow: lowest total time. Green: most sprint points. Polka dot: most mountain points. A rider wears one jersey at most (yellow first, then green, then polka dot); a jersey a rider cannot wear goes to the next in line. Ties go to whoever crossed first on the latest stage.',
      'From stage 2, the team with the fewest Tour Points places first on the grid.',
    ],
    keywords: 'jersey yellow green polka dot order',
    refs: ['G-BTW-2', 'G-TOU-3'],
  },
  // ---------------------------------------------------------------- new tiles
  {
    id: 'hairpins',
    module: 'newTiles',
    title: 'Hairpins (sharp corners)',
    body: [
      'The hairpin has three single-lane crash squares (marked with a wavy line). A rider that ends its move on one after being blocked crashes, with the usual crash rules.',
    ],
    keywords: 'sharp corner hairpin crash',
    refs: ['G-TIL-2'],
  },
  {
    id: 'roundabouts',
    module: 'newTiles',
    title: 'Roundabouts',
    body: [
      'After three shared squares the road splits into a short inner lane (3 squares) and a long outer lane (5). A rider takes the inner lane if its whole move fits there, otherwise the outer one; if neither fits, the lane where it gets furthest. Once on a lane it stays on it until the tile ends.',
      'Riders on the split lanes move first, nearest the exit first, inner lane first on a tie. The two lanes never give each other slipstream; riders on the last shared square can slipstream onto either.',
    ],
    keywords: 'roundabout split inner outer lane',
    refs: ['G-RND-1', 'G-RND-2', 'G-RND-3', 'G-RND-4', 'G-RND-5', 'D-036', 'D-037'],
  },
  // ---------------------------------------------------------------- specialists
  {
    id: 'draft',
    module: 'specialists',
    title: 'The specialist draft',
    body: [
      "Before the first stage every team picks a specialist for each rider: once in a random order, then once more in reverse order. With four or more teams there are two of each. A specialist swaps some of the rider's cards for the whole tour.",
    ],
    keywords: 'specialist draft pick',
    refs: ['G-SPC-1', 'G-SPC-2'],
  },
  {
    id: 'powers',
    module: 'specialists',
    title: 'Specialist powers',
    body: [
      'Strong climber: on a climb the card counts up to 6 or 7. Strong descender: starting downhill it counts at least 7 (not in supply zones).',
      'Recovery: playing it sends one recycled exhaustion card back. Relentless: no exhaustion this round.',
      "Breakaway: nobody on this rider's square gives slipstream this round, not even to the rest of its group.",
      'Chase: after moving, if right behind a rider with a free lane beside it, move into that lane; if one empty square behind a group, move up one.',
      'Nimble: ends in the rightmost lane, pushing others one lane left, or on the verge if the square is full. Passing a square where everyone has crashed still crashes it.',
    ],
    keywords: 'power nimble chase relentless recovery breakaway strong',
    refs: ['G-SPC-3', 'G-SPC-4', 'G-SPC-5', 'G-SPC-6', 'G-SPC-7', 'G-SPC-8', 'G-SPC-9'],
  },
  // ---------------------------------------------------------------- special stages
  {
    id: 'ttt',
    module: 'specialStages',
    title: 'Team time trial',
    body: [
      "No token piles. Everyone starts on the front grid square, and teams ignore each other completely: any number of riders can share a square, and slipstream and exhaustion only happen between teammates. Both riders take the slower rider's time, and a team can take only one podium place.",
    ],
    keywords: 'team time trial ttt',
    refs: ['G-TTT-1'],
  },
  {
    id: 'itt',
    module: 'specialStages',
    title: 'Individual time trial',
    body: [
      'Like the team time trial, but every rider is on its own: there is no slipstream at all. Each round, the rouleur and the sprinteur that played the highest card take an exhaustion card (all of them on a tie).',
    ],
    keywords: 'individual time trial itt',
    refs: ['G-ITT-1'],
  },
  {
    id: 'extended',
    module: 'specialStages',
    title: 'Long stages and the refresh',
    body: [
      'Long stages are 24 squares longer and have a refresh token. The first rider to reach it takes it. At the end of that round every rider may take back energy cards it played this stage, worth up to 24 in total (25 for the token holder), and shuffles its deck.',
    ],
    keywords: 'extended long stage refresh token',
    refs: ['G-EXT-1'],
  },
  // ---------------------------------------------------------------- app
  {
    id: 'keys',
    module: 'app',
    title: 'Keys and controls',
    body: [
      '1 to 5 select a card, Enter locks it in; click a card twice to lock it. R opens these rules, T the tour standings. Space switches the follow camera. W A S D or the arrow keys move around the map, + and − zoom; you can also drag and scroll. Click the stage strip to jump there.',
      'Point at a square to see its terrain, weather and what they do; point at a rider for its name, team, standing and cards played.',
      'Speed: normal, fast or skip, in the race panel. "Replay last round" shows the round again.',
    ],
    keywords: 'keyboard shortcuts controls camera zoom',
  },
  {
    id: 'hints',
    module: 'app',
    title: 'Hints and the ghost rider',
    body: [
      'Hovering a card shows a faint rider where it would land if nothing blocked it, with the value it really counts as. The hints beside your hand explain climbs, descents, supply zones, weather, crashes and powers before you commit.',
    ],
    keywords: 'hint ghost preview',
  },
];
