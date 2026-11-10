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
  /** True when the browser asks for reduced motion; animations then become instant. */
  reducedMotion: boolean;
  setSpeed(speed: Speed): void;
  setSound(on: boolean): void;
  setFollow(on: boolean): void;
}

const KEY = 'tdj.settings.v1';

function load(): Partial<Pick<Settings, 'speed' | 'sound' | 'follow'>> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
  } catch {
    return {};
  }
}

function save(s: Pick<Settings, 'speed' | 'sound' | 'follow'>) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
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
}));

/** Multiplier for animation durations; 0 means instant. */
export function timeScale(): number {
  const { speed, reducedMotion } = useSettings.getState();
  if (reducedMotion || speed === 'skip') return 0;
  return speed === 'fast' ? 0.45 : 1;
}
