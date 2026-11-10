/** Shared guards for the window-level keyboard shortcuts. */

/** The key press belongs to a text field or other form control, so shortcuts must not take it. */
export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.isContentEditable === true;
}

/** A modal screen (results, settings, standings, draft) covers the board. */
export function modalOpen(): boolean {
  return document.querySelector('.overlay[role="dialog"]') !== null;
}
