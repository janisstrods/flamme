/**
 * Sound effects synthesised with the Web Audio API (plan section 9): no audio files.
 * The context starts on the first user gesture, as browsers require.
 */
import { useSettings } from './settings';

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

function audio(): AudioContext | null {
  if (!useSettings.getState().sound) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    if (!noise) {
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      let seed = 1;
      for (let i = 0; i < data.length; i++) {
        seed = (seed * 16807) % 2147483647;
        data[i] = (seed / 2147483647) * 2 - 1;
      }
    }
    return ctx;
  } catch {
    return null;
  }
}

function envelope(a: AudioContext, peak: number, attack: number, release: number): GainNode {
  const g = a.createGain();
  const t = a.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  g.connect(a.destination);
  return g;
}

function burst(
  freq: number,
  q: number,
  peak: number,
  attack: number,
  release: number,
  type: BiquadFilterType = 'bandpass',
) {
  const a = audio();
  if (!a || !noise) return;
  const src = a.createBufferSource();
  src.buffer = noise;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  src.connect(f).connect(envelope(a, peak, attack, release));
  src.start();
  src.stop(a.currentTime + attack + release + 0.05);
}

/** Card flip: a short, bright paper snap. */
export const playFlip = () => burst(2600, 1.2, 0.25, 0.004, 0.07);

/** Wheels on the road: a soft filtered rush. */
export function playWhirr(seconds = 0.5) {
  burst(700, 0.7, 0.07, 0.04, Math.max(0.15, seconds));
}

/** Slipstream: a rising whoosh. */
export function playWhoosh() {
  const a = audio();
  if (!a || !noise) return;
  const src = a.createBufferSource();
  src.buffer = noise;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 2;
  f.frequency.setValueAtTime(400, a.currentTime);
  f.frequency.exponentialRampToValueAtTime(1800, a.currentTime + 0.35);
  src.connect(f).connect(envelope(a, 0.12, 0.05, 0.35));
  src.start();
  src.stop(a.currentTime + 0.5);
}

/** Bicycle bell: two quick metallic pings. */
export function playBell() {
  const a = audio();
  if (!a) return;
  [0, 0.16].forEach((delay) => {
    for (const freq of [2093, 2637, 3520]) {
      const o = a.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      const g = a.createGain();
      const t = a.currentTime + delay;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(a.destination);
      o.start(t);
      o.stop(t + 0.65);
    }
  });
}

/** Crowd swell at the finish. */
export const playCrowd = () => burst(1100, 0.4, 0.16, 0.6, 1.6);

/** A low thud for exhaustion cards. */
export const playTired = () => burst(220, 1.5, 0.12, 0.005, 0.12, 'lowpass');
