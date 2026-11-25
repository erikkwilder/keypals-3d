// The game was updated while this page was open, or just as it opened (a publish takes a minute): the page
// asks for code files that are gone, and a screen says "This part didn't load". A fresh page gets the new
// ones, so load the page again, by itself: only when online (offline, a reload would show the browser's own
// "no internet" page; the screen's message stays instead), and at most once in five minutes, so a page
// that still can't load stops trying and shows the message.
export const KEY = 'keypals-reloaded', WINDOW = 5 * 60_000;

export type ReloadEnv = { online: () => boolean; store: Pick<Storage, 'getItem' | 'setItem'> | null; now: () => number; reload: () => void };

const browser = (): ReloadEnv => ({
  online: () => typeof navigator === 'undefined' || navigator.onLine !== false,
  store: (() => { try { return sessionStorage; } catch { return null; } })(),
  now: () => Date.now(),
  reload: () => location.reload(),
});

/** Reload once for an update; true when it did. */
export function reloadForUpdate(env: ReloadEnv = browser()): boolean {
  if (!env.online() || !env.store) return false;
  try {
    const last = Number(env.store.getItem(KEY));
    if (last && env.now() - last < WINDOW) return false;
    env.store.setItem(KEY, String(env.now()));
  } catch { return false; }
  env.reload();
  return true;
}
