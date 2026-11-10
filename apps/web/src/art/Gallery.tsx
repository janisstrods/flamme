/**
 * /#/gallery: the art review surface (plan section 9). Shows every art component in its states.
 * M3 gate: riders, one card of each kind and a short track section in the proposed style.
 */
import { ORIGINAL_STAGES, TILE_CATALOG, compileStage, layoutStage } from '@velo/content';
import type { StageDefinition } from '@velo/content';
import type { Jersey, TeamColor } from '@velo/protocol';
import { useMemo } from 'react';
import { CardArt } from './Card';
import { ICON_NAMES, Icon } from './Icons';
import { RiderArt } from './Rider';
import type { RiderArtProps } from './Rider';
import { TEAM_COLORS, TEAM_STYLES } from './teams';
import { ArtDefs, TrackArt } from './TrackArt';

const SWATCHES: [string, string][] = [
  ['--grass', 'Grass'],
  ['--verge', 'Verge'],
  ['--road', 'Road'],
  ['--ascent', 'Ascent'],
  ['--descent', 'Descent'],
  ['--cobble', 'Cobbles'],
  ['--supply', 'Supply zone'],
  ['--jersey-yellow', 'Yellow jersey'],
  ['--jersey-green', 'Green jersey'],
  ['--jersey-polka', 'Polka dot'],
  ['--ink', 'Ink'],
  ['--accent', 'Accent'],
];

function RiderTile(props: RiderArtProps & { caption: string; size?: number }) {
  const size = props.size ?? 120;
  return (
    <figure className="g-tile">
      <svg viewBox="-0.6 -0.6 1.2 1.2" width={size} height={size}>
        <defs>
          <ArtDefs />
        </defs>
        <rect x={-0.6} y={-0.6} width={1.2} height={1.2} fill="var(--road)" rx={0.08} />
        <RiderArt {...props} />
      </svg>
      <figcaption>{props.caption}</figcaption>
    </figure>
  );
}

const DEMO: StageDefinition = {
  id: 'gallery-section',
  name: 'Gallery section',
  source: 'fixture',
  playerVariant: 'any',
  type: 'normal',
  tiles: ['a_w', 'c_s', 'q_w', 'b_s', 'k_w', '5_w', 's_w', '3_w', 't_w', 'u_w'],
};

function TrackSection() {
  const { layout, track } = useMemo(
    () => ({ layout: layoutStage(DEMO, TILE_CATALOG), track: compileStage(DEMO, TILE_CATALOG) }),
    [],
  );
  const { minX, minY, maxX, maxY } = layout.bounds;
  const riders: [string, number, TeamColor, 'rouleur' | 'sprinteur', Jersey?][] = [
    ['t0.s0.q3', 0, 'red', 'rouleur'],
    ['t0.s0.q3', 1, 'blue', 'sprinteur'],
    ['t1.s0.q4', 0, 'green', 'rouleur', 'yellow'],
    ['t3.s0.q1', 1, 'black', 'sprinteur'],
    ['t5.s0.q2', 0, 'pink', 'rouleur'],
    ['t7.s0.q1', 2, 'white', 'sprinteur', 'polkaDot'],
  ];
  return (
    <svg
      className="g-track"
      viewBox={`${minX - 1.5} ${minY - 1.5} ${maxX - minX + 3} ${maxY - minY + 3}`}
    >
      <defs>
        <ArtDefs />
      </defs>
      <rect x={minX - 50} y={minY - 50} width={200} height={200} fill="var(--grass)" />
      <TrackArt layout={layout} track={track} />
      {riders.map(([sq, lane, team, type, jersey]) => {
        const g = layout.squares[sq]!;
        const p = g.lanes[Math.min(lane, g.lanes.length - 1)]!;
        return (
          <g key={`${team}-${type}`} transform={`translate(${p[0]},${p[1]})`}>
            <RiderArt team={team} type={type} heading={g.heading} jersey={jersey} />
          </g>
        );
      })}
    </svg>
  );
}

export function Gallery() {
  const stageLayout = useMemo(() => layoutStage(ORIGINAL_STAGES[0]!, TILE_CATALOG), []);
  return (
    <main className="gallery">
      <header className="gallery__head">
        <p className="eyebrow">M3 style sheet · proposal for approval</p>
        <h1>Tour de Jour</h1>
        <p className="lede">
          Clean, flat geometric shapes seen from above, soft shadows, rounded corners and a bright
          daytime palette. Every team has a colour and a pattern; every terrain has a tint and a
          symbol.
        </p>
        <a className="btn" href="#/">
          Back to the game
        </a>
      </header>

      <section>
        <h2>Palette</h2>
        <div className="g-swatches">
          {SWATCHES.map(([v, name]) => (
            <figure key={v} className="g-swatch">
              <span style={{ background: `var(${v})` }} />
              <figcaption>{name}</figcaption>
            </figure>
          ))}
        </div>
        <h3>Teams: colour and pattern</h3>
        <div className="g-swatches">
          {TEAM_COLORS.map((t) => (
            <figure key={t} className="g-swatch">
              <svg width={56} height={40} viewBox="0 0 0.56 0.4">
                <defs>
                  <ArtDefs />
                </defs>
                <rect
                  width={0.56}
                  height={0.4}
                  rx={0.06}
                  fill={`url(#pat-${t})`}
                  stroke="rgba(0,0,0,0.15)"
                  strokeWidth={0.01}
                />
              </svg>
              <figcaption>{TEAM_STYLES[t].label}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section>
        <h2>Type</h2>
        <div className="g-type">
          <div className="g-type__display">Barlow Condensed · 0 1 2 3 4 5 6 7 8 9</div>
          <div className="g-type__heading">Stage 4 · Harbour Loop</div>
          <p>
            Inter for body text and hints: “The climb ahead limits this card to 5. Your rouleur
            would stop at the foot of it.”
          </p>
        </div>
      </section>

      <section>
        <h2>Riders</h2>
        <p className="note">
          Rouleur: broad and upright. Sprinteur: long, low and narrow. Both carry a letter badge.
        </p>
        <div className="g-row">
          <RiderTile team="blue" type="rouleur" caption="rouleur, close up" size={260} />
          <RiderTile team="blue" type="sprinteur" caption="sprinteur, close up" size={260} />
        </div>
        <div className="g-row">
          {(['red', 'blue', 'green', 'black'] as TeamColor[]).flatMap((team) =>
            (['rouleur', 'sprinteur'] as const).map((type) => (
              <RiderTile
                key={`${team}-${type}`}
                team={team}
                type={type}
                caption={`${team} ${type}`}
              />
            )),
          )}
        </div>
        <h3>States and jerseys</h3>
        <div className="g-row">
          <RiderTile team="pink" type="rouleur" caption="normal" />
          <RiderTile team="pink" type="rouleur" state="selected" caption="selected" />
          <RiderTile team="pink" type="rouleur" state="crashed" caption="crashed" />
          <RiderTile team="pink" type="rouleur" state="finished" caption="finished" />
          <RiderTile team="white" type="sprinteur" jersey="yellow" caption="yellow jersey" />
          <RiderTile team="white" type="sprinteur" jersey="green" caption="green jersey" />
          <RiderTile team="white" type="sprinteur" jersey="polkaDot" caption="polka dot jersey" />
        </div>
      </section>

      <section>
        <h2>Cards</h2>
        <div className="g-row g-row--cards">
          <figure className="g-tile">
            <CardArt kind="energy" team="red" rider="rouleur" value={5} width={96} />
            <figcaption>Energy, rouleur</figcaption>
          </figure>
          <figure className="g-tile">
            <CardArt kind="energy" team="blue" rider="sprinteur" value={9} width={96} />
            <figcaption>Energy, sprinteur</figcaption>
          </figure>
          <figure className="g-tile">
            <CardArt kind="exhaustion" rider="rouleur" width={96} />
            <figcaption>Exhaustion</figcaption>
          </figure>
          <figure className="g-tile">
            <CardArt kind="attack" team="black" width={96} />
            <figcaption>Attack (Peloton team)</figcaption>
          </figure>
          <figure className="g-tile">
            <CardArt kind="muscle" team="green" width={96} />
            <figcaption>Muscle team</figcaption>
          </figure>
          <figure className="g-tile">
            <CardArt
              kind="energy"
              team="green"
              rider="rouleur"
              value={6}
              powers={['strongAscents6']}
              width={96}
            />
            <figcaption>Specialist power</figcaption>
          </figure>
          <figure className="g-tile">
            <CardArt
              kind="energy"
              team="pink"
              rider="sprinteur"
              value={3}
              powers={['strongDescents', 'recovery']}
              width={96}
            />
            <figcaption>Two powers</figcaption>
          </figure>
          <figure className="g-tile">
            <CardArt kind="back" team="blue" width={96} />
            <figcaption>Card back</figcaption>
          </figure>
          <figure className="g-tile">
            <CardArt kind="back" team="black" width={96} />
            <figcaption>Card back</figcaption>
          </figure>
          <figure className="g-tile">
            <CardArt kind="stage" name="Harbour Loop" layout={stageLayout} width={96} />
            <figcaption>Stage card</figcaption>
          </figure>
        </div>
      </section>

      <section>
        <h2>Track section</h2>
        <p className="note">
          Start grid and chequered line, a climb (rising wedge), bends, a descent (falling wedge),
          single-lane cobbles, a three-lane supply zone and the finish.
        </p>
        <TrackSection />
      </section>

      <section>
        <h2>Icons</h2>
        <div className="g-icons">
          {ICON_NAMES.map((n) => (
            <figure key={n} className="g-icon">
              <Icon name={n} size={28} />
              <figcaption>{n}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}
