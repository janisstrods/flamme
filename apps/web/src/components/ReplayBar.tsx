/** Replay viewer controls: scrub through a finished race round by round (plan section 10). */
import { useEffect, useState } from 'react';
import { Icon } from '../art/Icons';
import { useRace } from '../game/store';

export function ReplayBar() {
  const { replay, showFrame, closeReplay } = useRace();
  const [playing, setPlaying] = useState(false);
  const index = replay?.index ?? 0;
  const last = (replay?.frames.length ?? 1) - 1;

  useEffect(() => {
    if (!playing || !replay) return;
    if (index >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => showFrame(index + 1), 900);
    return () => clearTimeout(t);
  }, [playing, index, last, replay, showFrame]);
  // Each replay opens paused, also after one was closed mid-play.
  const open = replay !== null;
  useEffect(() => {
    if (!open) setPlaying(false);
  }, [open]);
  useEffect(() => {
    if (!replay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') showFrame(Math.min(last, index + 1));
      if (e.key === 'ArrowLeft') showFrame(Math.max(0, index - 1));
      if (e.key === 'Escape') closeReplay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [replay, index, last, showFrame, closeReplay]);

  if (!replay) return null;
  const frame = replay.frames[index]!;
  return (
    <div className="replay-bar" role="region" aria-label="Replay">
      <b>Replay</b>
      <span className="replay-bar__label">{frame.label}</span>
      <button
        className="btn btn--small"
        onClick={() => showFrame(Math.max(0, index - 1))}
        aria-label="Previous round"
      >
        ◀
      </button>
      <button className="btn btn--small" onClick={() => setPlaying(!playing)}>
        {playing ? 'Pause' : 'Play'}
      </button>
      <button
        className="btn btn--small"
        onClick={() => showFrame(Math.min(last, index + 1))}
        aria-label="Next round"
      >
        ▶
      </button>
      <input
        type="range"
        min={0}
        max={last}
        value={index}
        onChange={(e) => showFrame(Number(e.target.value))}
        aria-label="Round"
      />
      <span className="replay-bar__count">
        {index + 1} / {last + 1}
      </span>
      <button className="icon-btn" onClick={closeReplay} aria-label="Close the replay">
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}
