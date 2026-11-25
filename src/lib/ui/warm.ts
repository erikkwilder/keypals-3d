// The few pictures a lesson or a practice shows that aren't on screen before it: the number pad's erase key,
// and the buddy's portrait and head (the top bar's round face, the speech dock, the Learn board, a caption).
// A picture the page has shown once shows again with no connection (the browser keeps it with the page), but
// one first needed after the connection dropped didn't appear: walk 6 had a broken erase key and no head. So
// they come down once the game is up and the computer is quiet, and are kept with the page. Only these few:
// with the erase key (3,636 bytes), 191,777 to 378,065 bytes, by buddy; the other buddies' portraits stay
// where they are until they're shown.
import { iconUrl } from '../art/icons';
import { FRIEND } from '../art/cast';

const BASE = import.meta.env.BASE_URL;

/** the number pad's own pictures (its other keys are digits and the minus sign) */
export const PAD = [iconUrl('erase')];

/** a buddy's two pictures, as Critter asks for them: the whole one, and its head */
export const buddyPics = (id: string) => {
  const f = FRIEND[id as keyof typeof FRIEND]?.id ?? id;
  return [`${BASE}portraits/${f}.png`, `${BASE}portraits/${f}-head.png`];
};

const kept = new Map<string, HTMLImageElement>();

/** Load these pictures and keep them with the page, each once. Returns the ones it asked for now. */
export function warm(urls: string[], make: () => HTMLImageElement = () => new Image()): string[] {
  const fresh = [...new Set(urls)].filter(u => !kept.has(u));
  for (const u of fresh) { const im = make(); im.decoding = 'async'; im.src = u; kept.set(u, im); }
  return fresh;
}

/** The same, when the computer has a quiet moment (after the next screens' code: ui/lazy.svelte.ts). */
export function warmWhenIdle(urls: string[], after = 2500) {
  setTimeout(() => {
    const w = window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void };
    const go = () => void warm(urls);
    if (w.requestIdleCallback) w.requestIdleCallback(go, { timeout: 5000 }); else setTimeout(go, 200);
  }, after);
}
