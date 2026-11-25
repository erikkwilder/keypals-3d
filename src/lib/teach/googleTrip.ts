// What this browser keeps of a pupil's "Sign in with Google" from the class login (screens/ClassLogin.svelte),
// so nothing is lost on the way:
// - the class code she had, in this tab while she's at Google (the server's way back carries only the
//   one-time ticket), so she lands back on her class;
// - that she's waiting for her teacher's yes, by class, with the class code and her first name only (on this
//   computer), so a reload or a later visit to that class says so; forgotten when she gets in, or when the
//   server says she isn't waiting any more;
// - which class this tab's class login showed her waiting in, so a reload goes back there.
// Nothing else: no Google id, no email, no ticket.
import { cleanClassCode } from './names';

export type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const safe = (get: () => Store): Store | null => { try { return get(); } catch { return null; } };
const local = () => safe(() => localStorage), session = () => safe(() => sessionStorage);
function read(s: Store | null, key: string): unknown {
  try { const v = s?.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function write(s: Store | null, key: string, v: unknown) {
  try { if (v === null) s?.removeItem(key); else s?.setItem(key, JSON.stringify(v)); } catch { /* a private window: not kept */ }
}
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// ---------- the class code, while she's at Google ----------
const TRIP = 'kp-class-google', TRIP_MS = 15 * 60000; // as long as a sign-in may take (worker.js)
/** Just before leaving for Google: the class code in the box or from the class link (none: nothing kept). */
export function keepCodeForGoogle(code: string, s = session(), now = Date.now()) {
  const c = cleanClassCode(code);
  write(s, TRIP, c ? { code: c, at: now } : null);
}
/** Back from Google (or back without signing in): the class code kept for the trip, once; null when there
 *  was none, or it's older than a sign-in can take. */
export function codeBackFromGoogle(s = session(), now = Date.now()): string | null {
  const v = read(s, TRIP) as { code?: unknown; at?: unknown } | null;
  write(s, TRIP, null);
  return v && typeof v.code === 'string' && typeof v.at === 'number' && v.at <= now && now - v.at < TRIP_MS ? v.code : null;
}

// ---------- waiting for the teacher's yes ----------
const WAITING = 'kp-class-waiting';
export type Waiting = { code: string; name: string };
/** Everyone this computer knows is waiting for a teacher's yes. */
export function waitingHere(s = local()): Waiting[] {
  const v = read(s, WAITING);
  return Array.isArray(v) ? v.filter((w): w is Waiting => !!w && typeof w.code === 'string' && typeof w.name === 'string' && !!w.code && !!w.name.trim()) : [];
}
/** Those waiting in one class. */
export const waitingIn = (code: string, s = local()): Waiting[] => { const c = cleanClassCode(code); return c ? waitingHere(s).filter(w => w.code === c) : []; };
/** She asked to join this class and the teacher hasn't said yes yet. */
export function noteWaiting(code: string, name: string, s = local()) {
  const c = cleanClassCode(code), n = name.trim();
  if (!c || !n) return;
  write(s, WAITING, [...waitingHere(s).filter(w => !(w.code === c && same(w.name, n))), { code: c, name: n }].slice(-12));
}
/** She got in, or the server says she isn't waiting: forget her by name, in that class (or, with no class,
 *  in any: a Google account is in one class at a time). */
export function forgetWaiting(names: (string | null | undefined)[], code: string | null = null, s = local()) {
  const ns = names.filter((n): n is string => !!n?.trim()), c = code ? cleanClassCode(code) : null;
  if (!ns.length) return;
  const left = waitingHere(s).filter(w => !(ns.some(n => same(n, w.name)) && (!c || w.code === c)));
  write(s, WAITING, left.length ? left : null);
}

// ---------- a reload goes back to her class ----------
const TAB = 'kp-class-waiting-tab';
/** The class this tab's class login shows someone waiting in (null: none now). */
export function showingWaiting(code: string | null, s = session()) { const c = code ? cleanClassCode(code) : ''; write(s, TAB, c || null); }
/** At the start with no link: that class again after a reload, if someone there is still waiting. */
export function backToWaiting(s = session(), l = local()): string | null {
  const c = read(s, TAB);
  return typeof c === 'string' && waitingIn(c, l).length ? c : null;
}
