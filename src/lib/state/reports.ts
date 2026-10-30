// Problems the game reports by itself: when something breaks (an error, or a promise that failed with no one
// to catch it), the message, a trimmed stack, the screen, the game version, the browser in a few words and
// the window size go to the server's problem list (feedback.ts builds it; nothing about the players). Each
// error once per session, at most three a session; the server limits them per address and counts repeats.
// Not from the dev server, and not when "Don't count my visits" (or Do Not Track) is on.
import { game } from './game.svelte';
import { browserName, Reporter, type Where } from './feedback';
import { mayCount } from './privacy';

const where = (): Where => ({
  screen: game.screen,
  version: __APP_VERSION__,
  browser: browserName(navigator.userAgent),
  size: `${window.innerWidth}x${window.innerHeight}`,
});

let installed = false;
export function installProblemReports() {
  if (installed || import.meta.env.DEV) return;
  installed = true;
  const reporter = new Reporter(body => {
    void fetch('api/problems', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => null);
  });
  const report = (message: string, stack?: string) => { if (mayCount()) reporter.report(message, stack, where()); };
  window.addEventListener('error', e => report(e.message || String(e.error ?? ''), (e.error as Error | undefined)?.stack));
  window.addEventListener('unhandledrejection', e => {
    const r = e.reason as Error | string | undefined;
    report(typeof r === 'string' ? r : r?.message ?? 'A promise failed', typeof r === 'object' ? r?.stack : undefined);
  });
}
