/**
 * Track editor (plan section 5): build a stage from the tiles, see it laid out live with any
 * problems, generate one with the rulebooks' design advice, save it to "My stages" and share it.
 */
import {
  TILE_CATALOG,
  compileStage,
  generateStage,
  layoutStage,
  validateStage,
} from '@velo/content';
import type { StageDefinition, TileSide } from '@velo/content';
import { useMemo, useState } from 'react';
import { ArtDefs, TrackArt } from '../art/TrackArt';
import {
  loadCustomStages,
  parseStageCode,
  saveCustomStages,
  stageCode,
} from '../game/customStages';
import { randomId } from '../net/session';

const TERRAIN_MARK: Record<string, string> = {
  flat: '·',
  ascent: '▲',
  descent: '▼',
  cobblestone: '#',
  supply: '=',
};

const physical = (id: string) => id.split('_')[0]!;
const byId = new Map(TILE_CATALOG.tiles.map((t) => [t.id, t]));

function describe(t: TileSide): string {
  const squares = t.segments.flatMap((s) =>
    s.type === 'linear' ? s.squares : s.branches[0]!.squares,
  );
  const shape =
    t.shape.kind === 'curve'
      ? `${t.shape.severity} ${t.shape.direction}`
      : t.shape.kind === 'sharpCorner'
        ? `hairpin ${t.shape.direction}`
        : t.shape.kind === 'roundabout'
          ? `roundabout ${t.shape.direction}`
          : t.shape.kind === 'wideFinish'
            ? 'wide finish'
            : t.shape.kind;
  return `${shape} ${squares.map((q) => TERRAIN_MARK[q.terrain] ?? '·').join('')}`;
}

const GROUPS: [string, (t: TileSide) => boolean][] = [
  ['Start and finish', (t) => ['start', 'finish', 'wideFinish'].includes(t.shape.kind)],
  ['Straights', (t) => t.shape.kind === 'straight' && t.source === 'base'],
  ['Turns', (t) => t.shape.kind === 'curve'],
  ['Peloton', (t) => t.source === 'peloton' && t.shape.kind === 'straight'],
  ['Grand Tour', (t) => t.shape.kind === 'sharpCorner' || t.shape.kind === 'roundabout'],
];

export function Editor() {
  const [name, setName] = useState('My stage');
  const [tiles, setTiles] = useState<string[]>(['a_w', 'u_w']);
  const [saved, setSaved] = useState(() => loadCustomStages());
  const [message, setMessage] = useState<string | null>(null);
  /** The saved stage being edited, if any: saving then updates it instead of adding a copy. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [gen, setGen] = useState({
    teams: 4,
    peloton: false,
    newTiles: false,
    breakaway: false,
    extended: false,
    wideFinish: false,
  });

  const stage: StageDefinition = useMemo(
    () => ({
      id: 'editing',
      name,
      source: 'custom',
      playerVariant: 'any',
      type: gen.extended ? 'extended' : 'normal',
      tiles,
    }),
    [name, tiles, gen.extended],
  );
  const issues = useMemo(() => validateStage(stage, TILE_CATALOG).map((i) => i.message), [stage]);
  const layout = useMemo(
    () => (issues.length ? null : layoutStage(stage, TILE_CATALOG)),
    [stage, issues],
  );
  const track = useMemo(
    () => (issues.length ? null : compileStage(stage, TILE_CATALOG)),
    [stage, issues],
  );
  const used = new Set(tiles.map(physical));
  const problems = [
    ...issues,
    ...(layout && layout.overlaps.length ? ['The road crosses itself.'] : []),
  ];
  const climbs = track
    ? Object.values(track.squares).filter((q) => q.terrain === 'ascent' && !q.branch).length
    : 0;

  const add = (id: string) => {
    if (used.has(physical(id))) return;
    const t = byId.get(id)!;
    if (t.shape.kind === 'start')
      return setTiles([id, ...tiles.filter((x) => byId.get(x)?.shape.kind !== 'start')]);
    if (t.shape.kind === 'finish' || t.shape.kind === 'wideFinish')
      return setTiles([
        ...tiles.filter((x) => !['finish', 'wideFinish'].includes(byId.get(x)?.shape.kind ?? '')),
        id,
      ]);
    const end = tiles.findIndex((x) =>
      ['finish', 'wideFinish'].includes(byId.get(x)?.shape.kind ?? ''),
    );
    setTiles(end === -1 ? [...tiles, id] : [...tiles.slice(0, end), id, ...tiles.slice(end)]);
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= tiles.length) return;
    const next = [...tiles];
    [next[i], next[j]] = [next[j]!, next[i]!];
    setTiles(next);
  };
  const flip = (i: number) => {
    const other = byId.get(tiles[i]!)?.flipSide;
    if (other) setTiles(tiles.map((t, k) => (k === i ? other : t)));
  };
  const generate = () => {
    try {
      const s = generateStage(randomId(6), TILE_CATALOG, gen);
      setTiles(s.tiles);
      setMessage(null);
    } catch {
      setMessage('No layout found with those options; try again.');
    }
  };
  const editing = saved.find((x) => x.id === editingId);
  const save = (asNew = false) => {
    if (problems.length) return setMessage('Fix the problems first.');
    const update = !asNew && editing !== undefined;
    const s: StageDefinition = {
      ...stage,
      id: update ? editing.id : `custom-${randomId(8)}`,
      name: name.trim() || 'My stage',
      playerVariant: tiles[0]!.startsWith('1') ? '5-6' : '2-4',
    };
    const next = update ? saved.map((x) => (x.id === s.id ? s : x)) : [...saved, s];
    saveCustomStages(next);
    setSaved(next);
    setEditingId(s.id);
    setMessage(
      update
        ? `Saved your changes to "${s.name}".`
        : `Saved "${s.name}". It is now in the stage lists under My stages.`,
    );
  };

  const pad = 2;
  const box = layout && {
    x: layout.bounds.minX - pad,
    y: layout.bounds.minY - pad,
    w: layout.bounds.maxX - layout.bounds.minX + pad * 2,
    h: layout.bounds.maxY - layout.bounds.minY + pad * 2,
  };

  return (
    <main className="editor">
      <header className="editor__head">
        <div>
          <p className="eyebrow">Track editor</p>
          <input
            className="editor__name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Stage name"
          />
        </div>
        <a className="btn btn--quiet" href="#/">
          Back to home
        </a>
      </header>
      <div className="editor__grid">
        <section className="editor__palette">
          {GROUPS.map(([title, test]) => (
            <div key={title}>
              <h3>{title}</h3>
              <div className="editor__tiles">
                {TILE_CATALOG.tiles
                  .filter((t) => test(t) && t.id.endsWith('_w'))
                  .map((t) => (
                    <button
                      key={t.id}
                      className="editor__tile"
                      disabled={used.has(physical(t.id))}
                      onClick={() => add(t.id)}
                      title={`${describe(t)} (flip it in the list)`}
                    >
                      <b>{physical(t.id)}</b> <small>{describe(t)}</small>
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </section>
        <section className="editor__preview">
          <div className="editor__canvas">
            {layout && track && box ? (
              <svg viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} className="editor__svg">
                <defs>
                  <ArtDefs />
                </defs>
                <TrackArt layout={layout} track={track} />
              </svg>
            ) : (
              <p className="note">Start with a start tile and end with a finish tile.</p>
            )}
          </div>
          <p className="note">
            {track
              ? `${track.finishIndex} squares to the finish · ${climbs} climbing squares · ${tiles.length} tiles`
              : ''}
          </p>
          {problems.map((p) => (
            <p key={p} className="note lobby__issue">
              {p}
            </p>
          ))}
          {message && <p className="note">{message}</p>}
          <div className="results__actions">
            <button
              className="btn btn--primary"
              onClick={() => save()}
              disabled={problems.length > 0}
            >
              {editing ? 'Save changes' : 'Save to My stages'}
            </button>
            {editing && (
              <button className="btn" onClick={() => save(true)} disabled={problems.length > 0}>
                Save as a new stage
              </button>
            )}
            <button
              className="btn"
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(stageCode(stage))
                  .then(() => setMessage('Code copied: send it to a friend.'))
              }
            >
              Copy share code
            </button>
            <button
              className="btn"
              onClick={() => {
                const code = window.prompt('Paste a stage code');
                const parsed = code ? parseStageCode(code) : null;
                if (!parsed) return code && setMessage('That is not a stage code.');
                setName(parsed.name);
                setTiles(parsed.tiles);
                setEditingId(null);
              }}
            >
              Paste a code
            </button>
          </div>
        </section>
        <section className="editor__side">
          <h3>Tiles in order</h3>
          <ol className="editor__list">
            {tiles.map((id, i) => (
              <li key={`${id}-${i}`}>
                <span>
                  <b>{id}</b> <small>{byId.get(id) ? describe(byId.get(id)!) : '?'}</small>
                </span>
                <span className="editor__row">
                  <button
                    className="btn btn--small btn--quiet"
                    onClick={() => move(i, -1)}
                    aria-label="Move up"
                  >
                    ↑
                  </button>
                  <button
                    className="btn btn--small btn--quiet"
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                  >
                    ↓
                  </button>
                  <button
                    className="btn btn--small btn--quiet"
                    onClick={() => flip(i)}
                    title="Turn the tile over"
                  >
                    flip
                  </button>
                  <button
                    className="btn btn--small btn--quiet"
                    onClick={() => setTiles(tiles.filter((_, k) => k !== i))}
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <h3>Generate</h3>
          <label>
            Teams{' '}
            <select
              value={gen.teams}
              onChange={(e) => setGen({ ...gen, teams: Number(e.target.value) })}
            >
              <option value={4}>2 to 4</option>
              <option value={6}>5 or 6</option>
            </select>
          </label>
          {(
            [
              ['peloton', 'Cobbles and supply zones'],
              ['newTiles', 'Hairpin and roundabout'],
              ['breakaway', 'Breakaway tile'],
              ['extended', 'Long stage (+24 squares)'],
              ['wideFinish', 'Wide finish (tours)'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="check">
              <input
                type="checkbox"
                checked={gen[k]}
                onChange={(e) => setGen({ ...gen, [k]: e.target.checked })}
              />
              {label}
            </label>
          ))}
          <button className="btn" onClick={generate}>
            Generate a stage
          </button>
          {saved.length > 0 && (
            <>
              <h3>My stages</h3>
              <ul className="editor__list">
                {saved.map((s) => (
                  <li key={s.id}>
                    <span>{s.name}</span>
                    <span className="editor__row">
                      <button
                        className="btn btn--small btn--quiet"
                        onClick={() => {
                          setName(s.name);
                          setTiles(s.tiles);
                          // The stage keeps its own length setting, whatever Generate last used.
                          setGen((g) => ({ ...g, extended: s.type === 'extended' }));
                          setEditingId(s.id);
                          setMessage(null);
                        }}
                      >
                        edit
                      </button>
                      <button
                        className="btn btn--small btn--quiet"
                        onClick={() => {
                          if (s.id === editingId) setEditingId(null);
                          const next = saved.filter((x) => x.id !== s.id);
                          saveCustomStages(next);
                          setSaved(next);
                        }}
                      >
                        delete
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
