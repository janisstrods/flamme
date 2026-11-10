/**
 * Per-player settings, remembered in this browser (plan section 10: speed choice is per player).
 * Storage can be unavailable (private windows, blocked site data), so every access is guarded.
 */
import { create } from 'zustand';

export type Speed = 'normal' | 'fast' | 'skip';

interface Settings {
  speed: Speed;
  sound: boolean;
  follow: boolean;
  /** Show riders' names on the board. */
  labels: boolean;
  /** Show team numbers on riders, so teams can be told apart without colour. */
  teamMarks: boolean;
  /** True when the browser asks for reduced motion; animations then become instant. */
  reducedMotion: boolean;
  setSpeed(speed: Speed): void;
  setSound(on: boolean): void;
  setFollow(on: boolean): void;
  setLabels(on: boolean): void;
  setTeamMarks(on: boolean): void;
}

type Saved = Pick<Settings, 'speed' | 'sound' | 'follow' | 'labels' | 'teamMarks'>;

const KEY = 'tdj.settings.v1';

function load(): Partial<Saved> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
  } catch {
    return {};
  }
}

function save(s: Saved) {
  try {
    const { speed, sound, follow, labels, teamMarks } = s;
    localStorage.setItem(KEY, JSON.stringify({ speed, sound, follow, labels, teamMarks }));
  } catch {
    // Settings still work for this session.
  }
}

const prefersReduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const initial = load();

export const useSettings = create<Settings>((set, get) => ({
  speed: initial.speed ?? 'normal',
  sound: initial.sound ?? true,
  follow: initial.follow ?? true,
  labels: initial.labels ?? false,
  teamMarks: initial.teamMarks ?? false,
  reducedMotion: typeof window !== 'undefined' && prefersReduced(),
  setSpeed: (speed) => {
    set({ speed });
    save({ ...get(), speed });
  },
  setSound: (sound) => {
    set({ sound });
    save({ ...get(), sound });
  },
  setFollow: (follow) => {
    set({ follow });
    save({ ...get(), follow });
  },
  setLabels: (labels) => {
    set({ labels });
    save({ ...get(), labels });
  },
  setTeamMarks: (teamMarks) => {
    set({ teamMarks });
    save({ ...get(), teamMarks });
  },
}));

/** Multiplier for animation durations; 0 means instant. */
export function timeScale(): number {
  const { speed, reducedMotion } = useSettings.getState();
  if (reducedMotion || speed === 'skip') return 0;
  return speed === 'fast' ? 0.45 : 1;
}
