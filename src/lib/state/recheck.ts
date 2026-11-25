// When the game checks its players against their saved copies online again, after the start
// (cloud.svelte.ts): when it comes back into view, and every quarter of an hour while in view; and when the
// browser says it's back online, whether in view or not, so a change made while the connection was down
// is sent then (before, it waited for the next change).
export type Rechecks = { inView: () => void; backOnline: () => void };

export function watchRechecks(r: Rechecks, win: Pick<Window, 'addEventListener'> = window, doc: Pick<Document, 'addEventListener' | 'visibilityState'> = document, every = 15 * 60000) {
  const view = () => { if (doc.visibilityState === 'visible') r.inView(); };
  doc.addEventListener('visibilitychange', view);
  win.addEventListener('online', () => r.backOnline());
  return setInterval(view, every);
}
