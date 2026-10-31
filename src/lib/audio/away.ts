// When the game is put away, it goes quiet at once: the tab hidden, a phone locked or switched to another
// app, a laptop lid closed, the page frozen or left. Everything that makes a sound listens here (sound.ts for
// music and effects, voice.svelte.ts for spoken lines, the measuring sounds) and nothing new starts while
// away. It comes back by itself when the page is on screen again. A phone call or a Siri prompt does the same
// through the sound's own "interrupted" state.
//
// A lid can close with no event at all (the machine just stops): a small clock notices the jump in time when
// it wakes up, and the game stays quiet until someone taps or presses a key, because nobody may be there.

type Hooks = { away: () => void; back: () => void };
type Why = 'hidden' | 'slept' | 'interrupted';

/** the clock's tick, and how big a jump in time means the machine slept (longer than the slowest load) */
const TICK_MS = 1000, SLEPT_MS = 12000;

const hooks: Hooks[] = [];
let why: Why | null = null;
let last = 0;

/** Is the game put away now? (nothing should start making a sound) */
export const pageAway = () => why !== null;
/** Be told when the game goes away and comes back. */
export function onPageAway(h: Hooks) { hooks.push(h); if (why) h.away(); }

function goAway(w: Why) {
  if (why) { if (w === 'hidden') why = w; return; }
  why = w;
  hooks.forEach(h => h.away());
}
function comeBack() {
  if (!why) return;
  why = null;
  last = Date.now();
  hooks.forEach(h => h.back());
}
const onScreen = () => document.visibilityState === 'visible';

/** The sound itself was interrupted (a phone call) or let go again (sound.ts). */
export function soundInterrupted(on: boolean) {
  if (on) goAway('interrupted');
  else if (why === 'interrupted' && onScreen()) comeBack();
}

if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (onScreen()) comeBack(); else goAway('hidden'); });
  window.addEventListener('pagehide', () => goAway('hidden'));
  document.addEventListener('freeze', () => goAway('hidden'));
  window.addEventListener('pageshow', () => { if (onScreen()) comeBack(); });
  document.addEventListener('resume', () => { if (onScreen()) comeBack(); });
  // quiet because the machine slept, or a call that has ended without saying so: a tap or a key brings it back
  const tapped = () => { if (why !== 'hidden') comeBack(); };
  for (const ev of ['pointerdown', 'keydown', 'touchend'] as const) window.addEventListener(ev, tapped, { capture: true, passive: true });
  last = Date.now();
  setInterval(() => {
    const now = Date.now(), jumped = now - last > SLEPT_MS;
    last = now;
    if (jumped && onScreen()) goAway('slept');
  }, TICK_MS);
}
