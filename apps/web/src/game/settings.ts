/**
 * Per-player settings, remembered in this browser (plan section 10: speed choice is per player).
 * Storage can be unavailable (private windows, blocked site data), so every access is guarded.
 */
import { create } from 'zustand';

export type Speed = 'normal' | 'fast' | 'skip';

interface Settings {
  speed: Speed;
  sound: boolean;
  /** The follow camera is on right now (panning pauses it until the next stage). */
  follow: boolean;
  /** The player's choice for the follow camera (the side panel button and Settings). */
  followPref: boolean;
  /** Show riders' names on the board. */
  labels: boolean;
  /** Show team numbers on riders, so teams can be told apart without colour. */
  teamMarks: boolean;
  /** True when the browser asks for reduced motion; animations then become instant. */
  reducedMotion: boolean;
  setSpeed(speed: Speed): void;
  setSound(on: boolean): void;
  setFollow(on: boolean): void;
  /** Pause the follow camera without changing the player's choice (panning, focusing a square). */
  pauseFollow(): void;
  /** Back to the player's choice (each new stage). */
  resumeFollow(): void;
  setLabels(on: boolean): void;
  setTeamMarks(on: boolean): void;
}

type Saved = Pick<Settings, 'speed' | 'sound' | 'followPref' | 'labels' | 'teamMarks'>;

const KEY = 'tdj.settings.v1';

function load(): Partial<Saved> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved> & {
      followCamera?: boolean;
    };
    const { followCamera, ...rest } = raw;
    return followCamera === undefined ? rest : { ...rest, followPref: followCamera };
  } catch {
    return {};
  }
}

function save(s: Saved) {
  try {
    const { speed, sound, followPref, labels, teamMarks } = s;
    // Saved as followCamera: older saves' "follow" was also switched off by panning, so it is
    // ignored and the camera starts on again.
    localStorage.setItem(
      KEY,
      JSON.stringify({ speed, sound, followCamera: followPref, labels, teamMarks }),
    );
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
  follow: initial.followPref ?? true,
  followPref: initial.followPref ?? true,
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
    set({ follow, followPref: follow });
    save({ ...get(), followPref: follow });
  },
  pauseFollow: () => set({ follow: false }),
  resumeFollow: () => set({ follow: get().followPref }),
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
