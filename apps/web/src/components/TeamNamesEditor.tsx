/** Edit your team and rider names (saved in this browser; sent to the room when you are in one). */
import { generateNames } from '@velo/content';
import type { TeamNames } from '@velo/protocol';
import { useState } from 'react';
import { useRace } from '../game/store';
import { loadIdentity, profileOf, randomId } from '../net/session';

export function TeamNamesEditor({ compact = false }: { compact?: boolean }) {
  const setProfile = useRace((s) => s.setProfile);
  const [names, setNames] = useState<TeamNames>(() => profileOf(loadIdentity()));
  const commit = (next: TeamNames) => {
    const clean = {
      team: next.team.trim().slice(0, 32) || names.team,
      rouleur: next.rouleur.trim().slice(0, 32) || names.rouleur,
      sprinteur: next.sprinteur.trim().slice(0, 32) || names.sprinteur,
    };
    setNames(clean);
    setProfile(clean);
  };
  const field = (key: keyof TeamNames, label: string) => (
    <label>
      {label}
      <input
        value={names[key]}
        maxLength={32}
        onChange={(e) => setNames({ ...names, [key]: e.target.value })}
        onBlur={() => commit(names)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
  return (
    <fieldset className={`team-names${compact ? ' team-names--compact' : ''}`}>
      <legend>
        Your team
        <button
          type="button"
          className="btn btn--quiet btn--small"
          title="Pick new names at random"
          onClick={() => commit(generateNames(randomId(8)))}
        >
          New names
        </button>
      </legend>
      {field('team', 'Team')}
      <div className="team-names__riders">
        {field('rouleur', 'Rouleur')}
        {field('sprinteur', 'Sprinteur')}
      </div>
    </fieldset>
  );
}
