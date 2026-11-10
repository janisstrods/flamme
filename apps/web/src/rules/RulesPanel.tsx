/**
 * Rules panel (plan section 10): searchable help in our own words, organised by module, showing
 * the modules this race uses (or everything, outside a race). Opens with R or the "?" button.
 */
import type { GameConfig } from '@velo/protocol';
import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { Icon } from '../art/Icons';
import { useRace } from '../game/store';
import { MODULE_NAMES, RULES } from './rules';
import type { RulesModule } from './rules';

export const useRulesPanel = create<{ open: boolean; toggle(open?: boolean): void }>((set) => ({
  open: false,
  toggle: (open) => set((s) => ({ open: open ?? !s.open })),
}));

/** The rule modules a race uses. */
export function modulesInPlay(config: GameConfig | null | undefined): Set<RulesModule> {
  const out = new Set<RulesModule>(['basics', 'app']);
  if (!config) return new Set(Object.keys(MODULE_NAMES) as RulesModule[]);
  const m = config.modules;
  const stages =
    config.mode.kind === 'tour'
      ? config.mode.schedule.filter((s) => s !== 'rest')
      : config.mode.kind === 'single'
        ? [config.mode.stage]
        : [];
  const pelotonTiles = stages.some((s) =>
    typeof s === 'string' ? false : s.tiles.some((t) => /^[1-9]_/.test(t)),
  );
  if (m.peloton || pelotonTiles) out.add('peloton');
  if (config.seats.some((s) => s.controller.kind === 'dummy')) out.add('dummies');
  if (m.meteo) out.add('meteo');
  if (config.mode.kind === 'tour') out.add('tour');
  if (m.grandTour?.newTiles) out.add('newTiles').add('meteo');
  if (m.grandTour?.specialists) out.add('specialists');
  if (m.grandTour?.specialStages) out.add('specialStages');
  return out;
}

export function RulesPanel() {
  const { open, toggle } = useRulesPanel();
  const room = useRace((s) => s.room);
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const inPlay = useMemo(() => modulesInPlay(all ? null : room?.config), [room, all]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName);
      if (e.key === 'Escape') toggle(false);
      else if (!typing && (e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault(); // or the R would land in the search box
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);
  useEffect(() => {
    if (!open) return;
    setQuery('');
    search.current?.focus();
  }, [open]);

  if (!open) return null;
  const q = query.trim().toLowerCase();
  const hits = RULES.filter(
    (r) =>
      inPlay.has(r.module) &&
      (!q || `${r.title} ${r.body.join(' ')} ${r.keywords ?? ''}`.toLowerCase().includes(q)),
  );
  const modules = (Object.keys(MODULE_NAMES) as RulesModule[]).filter((m) =>
    hits.some((h) => h.module === m),
  );
  return (
    <aside className="rules-panel" role="dialog" aria-label="Rules">
      <header className="rules-panel__head">
        <h2>Rules</h2>
        <button className="icon-btn" onClick={() => toggle(false)} aria-label="Close the rules">
          <Icon name="close" size={18} />
        </button>
      </header>
      <input
        ref={search}
        className="rules-panel__search"
        placeholder="Search: slipstream, crash, jersey…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {room && (
        <label className="check rules-panel__all">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
          Show rules for everything, not just this race
        </label>
      )}
      <div className="rules-panel__body">
        {modules.map((m) => (
          <section key={m}>
            <h3>{MODULE_NAMES[m]}</h3>
            {hits
              .filter((h) => h.module === m)
              .map((r) => (
                <details key={r.id} open={!!q || hits.length <= 4}>
                  <summary>{r.title}</summary>
                  {r.body.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </details>
              ))}
          </section>
        ))}
        {hits.length === 0 && <p className="note">Nothing found. Try another word.</p>}
      </div>
    </aside>
  );
}
