// Ideas and help: the Ideas board (vote with a heart), suggesting an idea, telling us about a problem, and
// problems the game reports by itself when something breaks. The server side is in deploy/site/worker.js
// ("ideas and help"). Nothing here carries player data: no names, save codes or progress.

export type IdeaKind = 'game' | 'better' | 'other';
export type IdeaStatus = 'new' | 'shown' | 'planned' | 'done' | 'hidden' | 'merged';
export type Idea = { id: number; kind: IdeaKind; text: string; status: IdeaStatus; votes: number; created: number };
export const IDEA_KINDS: { id: IdeaKind; name: string }[] = [
  { id: 'game', name: 'A new game' },
  { id: 'better', name: 'Make something better' },
  { id: 'other', name: 'Something else' },
];

// ---------- hearts: once per idea per computer, remembered here ----------
const VOTES = 'kp-votes';
export function votedIds(): number[] {
  try { const v = JSON.parse(localStorage.getItem(VOTES) ?? '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'number') : []; } catch { return []; }
}
export function setVoted(id: number, on: boolean) {
  const now = new Set(votedIds());
  if (on) now.add(id); else now.delete(id);
  try { localStorage.setItem(VOTES, JSON.stringify([...now].slice(-500))); } catch { /* private window: forgotten after a restart */ }
}

// ---------- what a report says about where it happened (no player data) ----------
/** The browser and system in a few words ("Chrome 141 on macOS"), not the full browser string. */
export function browserName(ua: string): string {
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /CrOS/.test(ua) ? 'Chromebook'
    : /Windows/.test(ua) ? 'Windows' : /Mac OS X|Macintosh/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'other';
  // the first of these the browser string names (Edge and Opera also say "Chrome"; Chrome also says "Safari")
  const KNOWN: [string, string][] = [['Edg', 'Edge'], ['OPR', 'Opera'], ['Firefox', 'Firefox'], ['FxiOS', 'Firefox'], ['CriOS', 'Chrome'], ['Chrome', 'Chrome'], ['Version', 'Safari']];
  for (const [token, name] of KNOWN) {
    const m = ua.match(new RegExp(`\\b${token}/(\\d+)`));
    if (m) return `${name} ${m[1]} on ${os}`;
  }
  return `browser on ${os}`;
}
export type Where = { screen: string; version: string; browser: string; size: string };

/** A stack, trimmed: at most 12 lines, addresses cut down to the file name (an address could hold a
 *  save code after a #), nothing longer than 1500 characters. */
export function trimStack(stack: string | undefined): string {
  if (!stack) return '';
  return stack.split('\n').slice(0, 12)
    .map(l => l.replace(/\b(?:https?|file|blob):\/\/[^\s)]*\/([^/\s)?#]*)(?:[?#][^\s):]*)?/g, '$1').trim())
    .join('\n').slice(0, 1500);
}

/** What an automatic problem report sends: exactly these keys. */
export function problemPayload(message: string, stack: string | undefined, where: Where) {
  return { auto: true as const, message: String(message).slice(0, 300), stack: trimStack(stack), screen: where.screen, version: where.version, browser: where.browser, size: where.size };
}

/** Errors that aren't the game's: browser add-ons, cross-origin "Script error.", a harmless layout notice. */
export function ignorable(message: string, stack = ''): boolean {
  return !message || message === 'Script error.' || /ResizeObserver loop/.test(message) || /(chrome|moz|safari(-web)?)-extension:\/\//.test(stack);
}

/** Sending automatic reports: each error once per session, at most `max` a session, and not more than one
 *  every `gapMs`. */
export class Reporter {
  private seen = new Set<string>();
  private sent = 0;
  private last = -Infinity;
  constructor(private send: (body: ReturnType<typeof problemPayload>) => void, private max = 3, private gapMs = 5000) {}
  report(message: string, stack: string | undefined, where: Where, now = Date.now()): boolean {
    if (ignorable(message, stack)) return false;
    const body = problemPayload(message, stack, where);
    const sig = `${body.message}|${body.stack.split('\n').find(l => /:\d+:\d+/.test(l)) ?? ''}`;
    if (this.seen.has(sig) || this.sent >= this.max || now - this.last < this.gapMs) return false;
    this.seen.add(sig); this.sent++; this.last = now;
    this.send(body);
    return true;
  }
}
