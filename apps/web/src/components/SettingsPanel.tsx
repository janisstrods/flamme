/** Settings (plan section 10): animation speed, sound, camera, readability aids, keys. */
import { create } from 'zustand';
import { Icon } from '../art/Icons';
import { useSettings } from '../game/settings';
import type { Speed } from '../game/settings';
import { TeamNamesEditor } from './TeamNamesEditor';

export const useSettingsPanel = create<{ open: boolean; toggle(open?: boolean): void }>((set) => ({
  open: false,
  toggle: (open) => set((s) => ({ open: open ?? !s.open })),
}));

const KEYS: [string, string][] = [
  ['1 – 5', 'Select a card'],
  ['Enter', 'Lock in the selected card (or click it again)'],
  ['Tab', 'Go to the rider choice'],
  ['Space', 'Follow camera on or off'],
  ['R', 'Rules'],
  ['Esc', 'Close a panel'],
  ['Drag / scroll', 'Pan and zoom the board'],
];

export function SettingsPanel() {
  const { open, toggle } = useSettingsPanel();
  const s = useSettings();
  if (!open) return null;
  const check = (label: string, on: boolean, set: (v: boolean) => void, note?: string) => (
    <label className="check">
      <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} />
      <span>
        {label}
        {note && <small className="settings__note">{note}</small>}
      </span>
    </label>
  );
  return (
    <div className="overlay" role="dialog" aria-label="Settings" onClick={() => toggle(false)}>
      <div className="results settings" onClick={(e) => e.stopPropagation()}>
        <header className="rules-panel__head">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={() => toggle(false)} aria-label="Close settings">
            <Icon name="close" size={18} />
          </button>
        </header>
        <section>
          <h3>Animation</h3>
          <div className="segmented" role="radiogroup" aria-label="Animation speed">
            {(['normal', 'fast', 'skip'] as Speed[]).map((v) => (
              <button
                key={v}
                role="radio"
                aria-checked={s.speed === v}
                className={s.speed === v ? 'is-on' : ''}
                onClick={() => s.setSpeed(v)}
                disabled={s.reducedMotion}
              >
                {v[0]!.toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
          {s.reducedMotion && (
            <p className="note">Your system asks for reduced motion, so moves are instant.</p>
          )}
          {check('Sound', s.sound, s.setSound)}
          {check('Follow camera', s.follow, s.setFollow, 'Keeps your riders and the race in view.')}
        </section>
        <section>
          <h3>Reading the board</h3>
          {check('Rider names on the board', s.labels, s.setLabels)}
          {check(
            'Team numbers on riders',
            s.teamMarks,
            s.setTeamMarks,
            'Tell teams apart without relying on colour (every team also has its own jersey pattern).',
          )}
        </section>
        <section>
          <TeamNamesEditor compact />
        </section>
        <section>
          <h3>Keys</h3>
          <table className="settings__keys">
            <tbody>
              {KEYS.map(([k, v]) => (
                <tr key={k}>
                  <td>
                    <kbd>{k}</kbd>
                  </td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
