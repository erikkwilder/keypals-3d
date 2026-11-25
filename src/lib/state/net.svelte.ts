// Whether this computer can reach the internet right now, as far as the game can tell: the browser's own
// offline and online, and the requests the game makes anyway (saving online: cloud.svelte.ts; a Learn
// lesson's clips: audio/keep.ts), which fail on the way when the connection is gone and get an answer when
// it's there (the browser can think it's online on wifi that reaches nothing). While it's gone a small note
// says so (ui/NetNote.svelte) and the save chip says the progress is kept on this computer for now.

export const net = $state({ down: false });

/** Listen for the browser's offline and online (NetNote.svelte, once); returns what stops listening. */
export function watchNet(win: Pick<Window, 'addEventListener' | 'removeEventListener'> = window, nav: { onLine?: boolean } = navigator) {
  const off = () => { net.down = true; }, on = () => { net.down = false; };
  net.down = nav.onLine === false;
  win.addEventListener('offline', off);
  win.addEventListener('online', on);
  return () => { win.removeEventListener('offline', off); win.removeEventListener('online', on); };
}

/** a request the game made got an answer (any answer: the connection is there) */
export function requestAnswered() { net.down = false; }
/** a request the game made failed on the way (not one stopped on purpose): the connection is gone */
export function requestFailed(e: unknown) {
  if (!(e instanceof DOMException && e.name === 'AbortError')) net.down = true;
}
