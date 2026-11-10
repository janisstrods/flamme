/**
 * The tutorial coach (plan section 10): one short race against an Easy bot, with a tip the first
 * time each idea comes up — drawing, moving, blocking, slipstream, exhaustion and climbs.
 */
import { previewFromView } from '@velo/engine';
import { useEffect } from 'react';
import { useRace } from '../game/store';

const TIPS: Record<string, { title: string; text: string }> = {
  welcome: {
    title: 'Welcome to the Training Ride',
    text: 'You ride for the red team: a rouleur (steady cards, 3 to 7) and a sprinteur (2 to 9, with three 9s). The first rider over the finish line wins. Tips like this one appear as things happen; press R any time for the full rules.',
  },
  place: {
    title: 'The start grid',
    text: 'Pick a rider below, then click a highlighted square. Squares fill from the right-hand lane. Being near the front helps, but the others place in turn too.',
  },
  draw: {
    title: 'Choose who draws first',
    text: 'Each round both riders draw four cards and keep one. Pick which rider draws first; the second draws after you have chosen the first card.',
  },
  cards: {
    title: 'Pick a card',
    text: 'The card is how many squares the rider moves. Hover a card to see a faint rider where it would land. Click it, then click again (or press Enter) to lock it in. Cards you play are gone; the other three go under the deck for later.',
  },
  move: {
    title: 'Everyone moves',
    text: 'All cards flip at once. Riders move one by one from the front of the race to the back, so the leaders go first.',
  },
  blocked: {
    title: 'Blocked',
    text: 'A rider cannot end on a square whose lanes are all taken. It stops on the first free square behind, as you just saw. Plan around the riders ahead.',
  },
  slipstream: {
    title: 'Slipstream',
    text: 'After moving, any group with exactly one empty square in front of the next group moves up to join it. Riding just behind others is free speed.',
  },
  exhaustion: {
    title: 'Exhaustion',
    text: 'A rider with an empty square right in front of it after slipstream takes an exhaustion card (a weak 2) into its deck. Leading alone costs energy; sheltering in a group saves it.',
  },
  climb: {
    title: 'A climb ahead',
    text: 'On a climb any card counts as at most 5, so a 9 is wasted there. Save big cards for the flat or for the sprint, and play low cards uphill. Starting on a descent, cards count as at least 5.',
  },
  finish: {
    title: 'Over the line',
    text: 'That is the whole race. From here: race against more bots, try a tour, or host a room for friends. The rules panel (R) has everything else.',
  },
};

export function Coach() {
  const { tutorial, coach, view, legal, track, room, animating, dismissTip, coachTip } = useRace();

  // Tips that follow what the player can do now.
  useEffect(() => {
    if (!tutorial || !view || animating) return;
    if (legal.some((a) => a.type === 'placeRider')) coachTip('place');
    if (view.phase === 'energy' && legal.some((a) => a.type === 'chooseRider')) coachTip('draw');
    if (legal.some((a) => a.type === 'playCard')) {
      coachTip('cards');
      const dealt = view.own?.riders.find((r) => r.hand);
      if (dealt && track && room) {
        const climbing = dealt.hand!.some((c) =>
          previewFromView(view, track, room.config, dealt.rider, c).hints.some(
            (h) => h === 'cappedByAscent' || h === 'stopsBeforeAscent',
          ),
        );
        if (climbing) coachTip('climb');
      }
    }
  }, [tutorial, view, legal, animating, track, room, coachTip]);

  const id = coach.queue[0];
  if (!tutorial || !id || (animating && id !== 'welcome')) return null;
  const tip = TIPS[id];
  if (!tip) return null;
  return (
    <aside className="coach" role="status" aria-live="polite">
      <p className="eyebrow">Tutorial</p>
      <h3>{tip.title}</h3>
      <p>{tip.text}</p>
      <div className="coach__actions">
        <button className="btn btn--primary btn--small" onClick={() => dismissTip()}>
          Got it
        </button>
        <button className="btn btn--quiet btn--small" onClick={() => dismissTip(true)}>
          No more tips
        </button>
      </div>
    </aside>
  );
}
