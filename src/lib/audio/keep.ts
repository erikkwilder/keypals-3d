// A Learn lesson's spoken lines, kept on this computer while it plays, so the narrator still speaks when the
// connection drops partway (school wifi does; before, the lines went on as words only, and a child who
// can't read them yet was left in silence). When a lesson starts, its player keeps the clips it can say
// (voice.svelte.ts keepLesson, with lessonClips below): they are fetched in the background, two at a time,
// so the start and the first line (said over the network as before) aren't held up. say() plays the kept
// copy when there is one and the network when there isn't. They are let go when the lesson ends.
// Blobs in this page's memory, not the Cache API: an <audio> can't play a Cache API copy without a service
// worker (each clip would be read back out into a blob anyway), the Cache API is missing on plain-http
// pages, and nothing here is meant to outlive the lesson. Count On keeps 24 clips (about 0.4 MB); the
// longest, Layers of Cubes, 66 (about 2.7 MB).

export type ClipLine = { id: string; voice: string };

/** the lines played out loud (voice.svelte.ts allowed): the coach's and the buddies' Learn voices */
export const speaksAloud = (l: ClipLine) => l.voice === 'coach' || l.voice.startsWith('kid-');

/** The clips a lesson can say: its own lines (`ep.<key>.…`) and its buddy's for it (`bv.<voice>.<key>.…`),
 *  then with `shared` the ones every classic episode says (`ep.teach`, `ep.fix`…) and the buddy's own
 *  (`bv.<voice>.praise0`…, `miss`, `show`). `voice` is the buddy's voice (kid-a, kid-b, kid-c). */
export function lessonClips(lines: readonly ClipLine[], o: { keys: string[]; voice?: string; shared?: boolean }): string[] {
  const own: string[] = [], rest: string[] = [];
  const mine = (id: string, pre: string) => o.keys.some(k => id.startsWith(`${pre}${k}.`));
  for (const l of lines) {
    if (!speaksAloud(l)) continue;
    const p = l.id.split('.');
    if (p[0] === 'ep' && mine(l.id, 'ep.')) own.push(l.id);
    else if (o.voice && p[0] === 'bv' && p[1] === o.voice && mine(l.id, `bv.${o.voice}.`)) own.push(l.id);
    else if (o.shared && p[0] === 'ep' && p.length === 2) rest.push(l.id);
    else if (o.shared && o.voice && p[0] === 'bv' && p[1] === o.voice && p.length === 3) rest.push(l.id);
  }
  return [...new Set([...own, ...rest])];
}

/** the lessons keeping clips now, newest last (one at a time, but a lesson can open as another closes) */
const keeps: Map<string, string>[] = [];

/** the kept copy of a clip (a blob: address), if a lesson playing now has it */
export function keptUrl(id: string): string | null {
  for (let i = keeps.length - 1; i >= 0; i--) { const u = keeps[i].get(id); if (u) return u; }
  return null;
}

export type KeepOpts = {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  toUrl: (b: Blob) => string;
  revoke: (url: string) => void;
  /** where it hears the connection come back ('online'): the clips that failed are fetched again */
  win: Pick<Window, 'addEventListener' | 'removeEventListener'> | null;
  base: string;
  /** how many at once */
  at: number;
};
export type Kept = { release(): void; readonly settled: Promise<void> };

/** Keep these clips while a lesson plays: call release() when it ends. `settled`: the fetching so far is over. */
export function keepClips(ids: readonly string[], opts: Partial<KeepOpts> = {}): Kept {
  const o: KeepOpts = {
    fetch: (u, i) => fetch(u, i), toUrl: b => URL.createObjectURL(b), revoke: u => URL.revokeObjectURL(u),
    win: typeof window === 'undefined' ? null : window, base: 'voice/', at: 2, ...opts,
  };
  const stop = new AbortController();
  const urls = new Map<string, string>();
  keeps.push(urls);
  let failed: string[] = [];

  async function one(id: string) {
    try {
      const r = await o.fetch(`${o.base}${id}.mp3`, { signal: stop.signal });
      // not there (a 404): say() finds that out for itself, as before
      if (!r.ok) return;
      const b = await r.blob();
      if (!stop.signal.aborted) urls.set(id, o.toUrl(b));
    } catch {
      // the connection is gone (or the lesson ended): tried again when it's back
      if (!stop.signal.aborted) failed.push(id);
    }
  }
  function fetchAll(list: string[]) {
    const queue = list.filter(id => !urls.has(id));
    const worker = async () => { for (let id = queue.shift(); id !== undefined && !stop.signal.aborted; id = queue.shift()) await one(id); };
    return Promise.all(Array.from({ length: Math.min(Math.max(1, o.at), queue.length) }, worker)).then(() => {});
  }
  let settled = fetchAll([...new Set(ids)]);
  const back = () => {
    if (stop.signal.aborted || !failed.length) return;
    const list = failed; failed = [];
    settled = settled.then(() => fetchAll(list));
  };
  o.win?.addEventListener('online', back);
  return {
    get settled() { return settled; },
    release() {
      if (stop.signal.aborted) return;
      stop.abort();
      o.win?.removeEventListener('online', back);
      keeps.splice(keeps.indexOf(urls), 1);
      for (const u of urls.values()) o.revoke(u);
      urls.clear();
    },
  };
}
