/** Stages made in the track editor, kept in this browser (and sent with the room config). */
import { ORIGINAL_STAGES, StageDefinition } from '@velo/content';

const KEY = 'tdj.stages.v1';

export function loadCustomStages(): StageDefinition[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown[];
    return raw.flatMap((s) => {
      const parsed = StageDefinition.safeParse(s);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

export function saveCustomStages(stages: readonly StageDefinition[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(stages));
  } catch {
    // The stage still works for this session.
  }
}

/** Our stages, then the player's own. */
export const allStages = (): StageDefinition[] => [...ORIGINAL_STAGES, ...loadCustomStages()];

/** A short code to share a stage: its name and tile list. */
export const stageCode = (s: StageDefinition) =>
  `TDJ1:${encodeURIComponent(s.name)}:${s.tiles.join('.')}`;

export function parseStageCode(code: string): { name: string; tiles: string[] } | null {
  const m = /^TDJ1:([^:]*):([a-zA-Z0-9_.]+)$/.exec(code.trim());
  if (!m) return null;
  try {
    return { name: decodeURIComponent(m[1]!) || 'Shared stage', tiles: m[2]!.split('.') };
  } catch {
    return null;
  }
}
