// Saving players online. A grown-up turns it on: a save code for a player (three words and a number),
// or signing in with Google to keep all their players together. Typing a code on another computer
// brings that player over, and changes keep flowing both ways. When two computers both played before
// they caught up (a tablet offline in the car), their copies are combined (merge.ts): nothing earned on
// either is lost, nothing is counted twice. Children never give an email or real name. The server is the
// fancyant.com/keypals Worker (deploy/site/worker.js); away from it (the dev server, offline) saving
// online just isn't offered.
import { game } from './game.svelte';
import { migrate, type Profile } from '../engine/profile';
import { mergeProfile } from './merge';

export type CloudPlayer = { code: string; name: string; buddy: string; updated: number };
export const cloud = $state({
  /** the server answered */
  online: false,
  google: false,
  microsoft: false,
  account: null as null | { name: string | null; email: string | null; provider: string },
  /** players saved under the signed-in account */
  players: [] as CloudPlayer[],
  busy: false,
  /** a grown-up was signed in on this computer and isn't any more (the sign-in ran out, or was ended on
   *  another computer): Home says so until they sign in again or choose to stay signed out */
  signedOut: null as null | { name: string },
  /** the next Grown-ups screen opens straight on "Saving online" (from the menu or a save-status chip) */
  focusAccount: false,
});

// ---------- remembering that a grown-up signed in here, so a lost sign-in can be noticed ----------
const SIGNED = 'kp-signed-in';
function rememberSignIn(name: string) { try { localStorage.setItem(SIGNED, name); } catch { /* private window: nothing to remember */ } }
function forgetSignIn() { try { localStorage.removeItem(SIGNED); } catch { /* nothing to do */ } }
function signedInBefore(): string | null { try { return localStorage.getItem(SIGNED); } catch { return null; } }
/** "Stay signed out": the banner goes away (signing in again brings saving back). */
export function staySignedOut() { forgetSignIn(); cloud.signedOut = null; }

/** Where a player's progress is kept, in words for the save chip: online in the grown-up's account, online
 *  with a save code, only on this computer, or here because saving online isn't available here. */
export function saveStatus(p: Profile | null): { kind: 'account' | 'code' | 'local' | 'here'; text: string; short: string } {
  if (!cloud.online) return { kind: 'here', text: 'Saved on this computer', short: 'Saved here' };
  if (p?.cloud && cloud.account) { const who = cloud.account.name?.split(' ')[0] ?? cloud.account.email ?? 'your grown-up'; return { kind: 'account', text: `Saved online as ${who}`, short: 'Saved online' }; }
  if (p?.cloud) return { kind: 'code', text: 'Saved online with a save code', short: 'Saved online' };
  return { kind: 'local', text: 'Only on this computer: keep your progress safe', short: 'Not saved online' };
}
/** Open the grown-ups' "Saving online" (behind the grown-up check). */
export function goSaveOnline() { cloud.focusAccount = true; game.go('grownups'); }

async function call<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`api${path}`, { credentials: 'same-origin', ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((body as { error?: string }).error || 'Saving online is not available right now.');
  return body as T;
}

/** A save code as people might type it ("tiger moon rain 42") in the server's form. */
export const cleanCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
/** A save code to show or print: "tiger moon rain 42". */
export const showCode = (c: string) => c.toLowerCase().replaceAll('-', ' ');
const payload = (p: Profile) => { const { cloud: _c, ...rest } = $state.snapshot(p) as Profile; return rest; };

// ---------- the copy both sides last agreed on (kept on this computer, for combining) ----------
const BASE = 'kp-cloud-base:';
function saveBase(code: string, prof: Omit<Profile, 'cloud'>) { try { localStorage.setItem(BASE + code, JSON.stringify(prof)); } catch { /* full: combining falls back to "the higher of the two" */ } }
function loadBase(code: string): Profile | null { try { const s = localStorage.getItem(BASE + code); return s ? (JSON.parse(s) as Profile) : null; } catch { return null; } }
function dropBase(code: string) { try { localStorage.removeItem(BASE + code); } catch { /* nothing to do */ } }

/** Tidy a profile from the server the way loading a save file does. */
function tidy(raw: Profile, id: string): Profile {
  return migrate({ version: 1, activeId: null, profiles: [{ ...raw, id }] }).profiles[0];
}
/** Put a player into this computer's save (replacing the copy with the same id or code). */
function place(prof: Profile) {
  const i = game.save.profiles.findIndex(x => x.id === prof.id || (prof.cloud && x.cloud?.code === prof.cloud.code));
  if (i >= 0) game.save.profiles[i] = prof; else game.save.profiles.push(prof);
}
/** Changed on this computer since it last agreed with the saved copy? */
const changedHere = (p: Profile) => !!p.cloud && (p.updatedAt ?? 0) > p.cloud.at;

export async function refreshAccount() {
  try { const me = await call<{ account: typeof cloud.account; players: CloudPlayer[] }>('/me'); cloud.account = me.account; cloud.players = me.players; }
  catch { cloud.account = null; cloud.players = []; }
  // signed in: remember it; was signed in here and isn't now: say so
  if (cloud.account) { rememberSignIn(cloud.account.name ?? cloud.account.email ?? 'you'); cloud.signedOut = null; }
  else { const was = signedInBefore(); cloud.signedOut = was ? { name: was } : null; }
}

/** Give a player a save code (and file it under the signed-in grown-up, if any). */
export async function makeCode(id: string) {
  const p = game.save.profiles.find(x => x.id === id);
  if (!p) return null;
  if (p.cloud) return p.cloud.code;
  const body = payload(p);
  const r = await call<{ code: string; updated: number }>('/players', { method: 'POST', body: JSON.stringify({ profile: body }) });
  p.cloud = { code: r.code, at: r.updated };
  p.updatedAt = r.updated;
  saveBase(r.code, { ...body, updatedAt: r.updated });
  game.persist();
  if (cloud.account) await refreshAccount();
  return r.code;
}

/** Send a player's copy. The server takes it only if nobody else saved since our last copy (`base`); if
 *  someone did, combine the two and send that instead. */
async function send(p: Profile): Promise<void> {
  if (!p.cloud) return;
  let cur = p;
  for (let tries = 0; tries < 3; tries++) {
    const body = payload(cur);
    const r = await call<{ updated: number; stale?: boolean }>(`/players/${cur.cloud!.code}`, { method: 'PUT', body: JSON.stringify({ profile: body, updated: cur.updatedAt ?? Date.now(), base: cur.cloud!.at }) });
    if (!r.stale) {
      const live = game.save.profiles.find(x => x.id === cur.id);
      if (live?.cloud) live.cloud.at = r.updated;
      saveBase(cur.cloud!.code, body);
      return;
    }
    // another computer saved first: combine its copy with ours
    const there = await call<{ code: string; profile: Profile; updated: number }>(`/players/${encodeURIComponent(cur.cloud!.code)}`);
    const merged = mergeProfile(cur, tidy(there.profile, cur.id), loadBase(cur.cloud!.code));
    merged.cloud = { code: there.code, at: there.updated };
    merged.updatedAt = Math.max(Date.now(), there.updated + 1);
    place(merged);
    cur = merged;
  }
}

/** Bring a saved player onto this computer by their code. If they're here already, the two copies are
 *  combined (nothing played here is lost). */
export async function openCode(raw: string) {
  const code = cleanCode(raw);
  const r = await call<{ code: string; profile: Profile; updated: number }>(`/players/${encodeURIComponent(code)}`);
  const here = game.save.profiles.find(x => x.cloud?.code === r.code);
  const id = here?.id ?? `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const there = tidy(r.profile, id);
  let prof: Profile;
  if (here && changedHere(here)) {
    prof = mergeProfile(here, there, loadBase(r.code));
    prof.cloud = { code: r.code, at: r.updated };
    prof.updatedAt = Math.max(Date.now(), r.updated + 1);
    place(prof);
    await send(prof).catch(() => null);
  } else {
    prof = there;
    prof.cloud = { code: r.code, at: r.updated };
    prof.updatedAt = r.updated;
    saveBase(r.code, { ...r.profile, updatedAt: r.updated });
    place(prof);
  }
  game.save.activeId = prof.id;
  game.persist();
  return prof;
}

// ---------- keeping saved copies in step ----------
let timer: ReturnType<typeof setTimeout> | undefined;
let pushing = false;
function schedulePush() { clearTimeout(timer); timer = setTimeout(pushAll, 4000); }
async function pushAll() {
  if (pushing || !cloud.online) return;
  pushing = true;
  try {
    for (const p of [...game.save.profiles]) {
      if (!changedHere(p)) continue;
      try { await send(p); } catch { /* try again after the next change */ }
    }
    game.persist();
  } finally { pushing = false; }
}
/** On start: catch up with other computers. Nothing changed here: take theirs. Both changed: combine. */
async function pullAll() {
  for (const p of [...game.save.profiles]) {
    if (!p.cloud) continue;
    try {
      const r = await call<{ updated: number; code: string; profile: Profile }>(`/players/${p.cloud.code}`);
      if (r.updated === p.cloud.at) continue;
      if (changedHere(p)) {
        const merged = mergeProfile(p, tidy(r.profile, p.id), loadBase(p.cloud.code));
        merged.cloud = { code: r.code, at: r.updated };
        merged.updatedAt = Math.max(Date.now(), r.updated + 1);
        place(merged);
        await send(merged);
      } else {
        const there = tidy(r.profile, p.id);
        there.cloud = { code: r.code, at: r.updated };
        there.updatedAt = r.updated;
        saveBase(r.code, { ...r.profile, updatedAt: r.updated });
        place(there);
      }
    } catch { /* missing or offline: keep this copy */ }
  }
  game.persist();
}

// ---------- grown-up sign-in ----------
export function signIn(provider: 'google' | 'microsoft') { location.href = `api/auth/${provider}/start`; }
export async function signOut() { await call('/auth/logout', { method: 'POST' }).catch(() => null); cloud.account = null; cloud.players = []; forgetSignIn(); cloud.signedOut = null; }
export async function deleteAccount(withPlayers: boolean) {
  await call('/me', { method: 'DELETE', body: JSON.stringify({ players: withPlayers }) });
  if (withPlayers) for (const p of game.save.profiles) { if (p.cloud) dropBase(p.cloud.code); delete p.cloud; }
  game.persist();
  cloud.account = null; cloud.players = [];
  forgetSignIn(); cloud.signedOut = null;
}
/** File every player on this computer under the signed-in grown-up (giving codes where needed). */
export async function keepAllInAccount() {
  for (const p of game.save.profiles) {
    const code = p.cloud?.code ?? await makeCode(p.id);
    if (code) await call(`/me/players/${code}`, { method: 'PUT' }).catch(() => null);
  }
  await refreshAccount();
}
/** Bring every player in the grown-up's account onto this computer. Returns how many came. */
export async function addAllFromAccount(): Promise<number> {
  const here = new Set(game.save.profiles.map(x => x.cloud?.code).filter(Boolean));
  let n = 0;
  for (const cp of cloud.players) { if (here.has(cp.code)) continue; await openCode(cp.code); n++; }
  return n;
}
/** Stop saving a player online: their saved copy is deleted (progress stays on this computer). A player
 *  kept in a grown-up's account can only be deleted by that grown-up, signed in. */
export async function forgetCode(id: string) {
  const p = game.save.profiles.find(x => x.id === id);
  if (!p?.cloud) return;
  await call(`/players/${p.cloud.code}`, { method: 'DELETE' });
  dropBase(p.cloud.code);
  delete p.cloud;
  game.persist();
  if (cloud.account) await refreshAccount();
}

// ---------- a gentle reminder to keep progress safe ----------
const LATER = 'kp-safe-later:';
/** Days this player has played. */
export const playDays = (p: Profile) => Object.values(p.days ?? {}).filter(d => d.ms > 0).length;
/** A player worth keeping safe: played on 3 or more days, not saved online, and not "remind me later"
 *  in the last week. (Only where saving online works.) */
export function needsSafety(p: Profile, now = Date.now()): boolean {
  if (!cloud.online || p.cloud || playDays(p) < 3) return false;
  try { const t = Number(localStorage.getItem(LATER + p.id) ?? 0); return now - t > 7 * 86400000; } catch { return true; }
}
export function remindLater(p: Profile) { try { localStorage.setItem(LATER + p.id, String(Date.now())); } catch { /* shows again next time */ } }

/** Once, at start: find the server, catch up with other computers, finish a sign-in that just came back. */
export async function startCloud() {
  // (development: the save chips and the signed-out banner can be checked by setting this)
  if (import.meta.env.DEV) (window as unknown as { __cloud: typeof cloud }).__cloud = cloud;
  try {
    const c = await call<{ google: boolean; microsoft: boolean }>('/config');
    cloud.online = true; cloud.google = c.google; cloud.microsoft = c.microsoft;
  } catch { cloud.online = false; return; }
  game.onProfileChange = schedulePush;
  await refreshAccount();
  await pullAll();
  // a sign-in can run out while the game is open: check again when the game comes back into view, and
  // every quarter of an hour
  const recheck = () => { if (document.visibilityState === 'visible') void refreshAccount(); };
  document.addEventListener('visibilitychange', recheck);
  setInterval(recheck, 15 * 60000);
  const m = location.hash.match(/signin=(\w+)/);
  if (m) {
    history.replaceState(null, '', location.pathname + location.search);
    if (m[1] === 'ok' && cloud.account) {
      await keepAllInAccount();
      const waiting = cloud.players.filter(cp => !game.save.profiles.some(p => p.cloud?.code === cp.code)).length;
      game.say(waiting ? `Signed in. ${waiting} more player${waiting === 1 ? ' is' : 's are'} in your account: add them on the Grown-ups screen.` : 'Signed in. Your players are saved to your account.', 6000);
      grownupOpenUntil = Date.now() + 10 * 60000;
      game.go('grownups');
    } else if (m[1] !== 'ok') game.say(m[1] === 'cancelled' ? 'Sign-in was cancelled.' : 'Sign-in did not work. Please try again.', 5000);
  }
}

// ---------- the grown-up check: open for ten minutes once passed ----------
export let grownupOpenUntil = 0;
export const grownupOpen = () => Date.now() < grownupOpenUntil;
export function passGrownupCheck() { grownupOpenUntil = Date.now() + 10 * 60000; }
