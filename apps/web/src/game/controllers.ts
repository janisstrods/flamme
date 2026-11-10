/** Seat controller choices shared by the solo setup and the lobby. */
import type { AiLevel, SeatConfig } from '@velo/protocol';

export type Controller = SeatConfig['controller'];
export type SeatChoice = 'open' | AiLevel | 'peloton' | 'muscle';

export const BOT_LEVELS: { value: AiLevel; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
];

export const SEAT_CHOICES: { value: SeatChoice; label: string }[] = [
  { value: 'open', label: 'Open for a friend' },
  ...BOT_LEVELS.map((l) => ({ value: l.value, label: `Bot: ${l.label}` })),
  { value: 'peloton', label: 'Peloton team (automatic)' },
  { value: 'muscle', label: 'Muscle team (automatic)' },
];

export function controllerFor(choice: SeatChoice): Controller {
  if (choice === 'open') return { kind: 'open' };
  if (choice === 'peloton' || choice === 'muscle') return { kind: 'dummy', team: choice };
  return { kind: 'ai', level: choice };
}

export function choiceOf(c: Controller): SeatChoice | null {
  if (c.kind === 'open') return 'open';
  if (c.kind === 'ai') return c.level;
  if (c.kind === 'dummy') return c.team;
  return null;
}

export function controllerLabel(c: Controller): string {
  if (c.kind === 'ai')
    return `Bot · ${BOT_LEVELS.find((l) => l.value === c.level)?.label ?? c.level}`;
  if (c.kind === 'dummy') return c.team === 'peloton' ? 'Peloton team' : 'Muscle team';
  if (c.kind === 'open') return 'Open seat';
  return 'Player';
}
