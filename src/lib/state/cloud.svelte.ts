// Saving players online. A grown-up turns it on: a save code for a player (three words and a number),
// or signing in with Google to keep all their players together. Typing a code on another computer
// brings that player over, and changes keep flowing both ways. When two computers both played before
// they caught up (a tablet offline in the car), their copies are combined (merge.ts): nothing earned on
// either is lost, nothing is counted twice. Children never give an email or real name. The server is the
// fancyant.com/keypals Worker (deploy/site/worker.js); away from it (the dev server, offline) saving
// online just isn't offered.
//
// Signed in, a grown-up's players are the same on every computer: every player in the account comes to
// each computer by itself (at start, right after signing in, and on the regular check), and a player made
// here is filed under the account straight away. Deleting a player can be "everywhere" (the server keeps
// a tombstone, so other computers remove their copies, even ones played offline) or "just this computer"
// (it stays in the account and isn't brought back here). The decisions are in sync.ts.
import { game } from './game.svelte';
import { migrate, type Profile } from '../engine/profile';
import { mergeProfile } from './merge';
import { isClassLogin } from './classHere';
import { planSync, goneNote, notHereCodes, markNotHere, clearNotHere, localOnlyIds, markLocalOnly, clearLocalOnly, type Tombstone } from './sync';
import { movedCodes, moveUrl } from './move';
import { count, startCounting } from './counting';

export type CloudPlayer = { code: string; name: string; buddy: string; updated: number };
export const cloud = $state({
  /** the server answered */
  online: false,
  google: false,
  microsoft: false,
  account: null as null | { name: string | null; email: string | null; provider: string; admin?: boolean },
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
export function saveStatus(p: Profile | null): { kind: 'account' | 'code' | 'class' | 'local' | 'here'; text: string; short: string } {
  if (!cloud.online) return { kind: 'here', text: 'Saved on this computer', short: 'Saved here' };
  // logged in with a class code and pictures: saved with the class, whoever is signed in here
  if (p?.cloud && isClassLogin(p)) return { kind: 'class', text: 'Saved with your class', short: 'Saved with your class' };
  // signed in: it says who, so nobody has to wonder whether their progress is safe
  const who = cloud.account ? cloud.account.name?.split(' ')[0] ?? cloud.account.email ?? 'your grown-up' : null;
  if (p?.cloud && who) return { kind: 'account', text: `Signed in as ${who}: saved online`, short: `Signed in as ${who}` };
  if (p?.cloud) return { kind: 'code', text: 'Saved online with a save code', short: 'Saved online' };
  if (who) return { kind: 'local', text: `Signed in as ${who}: not saved online yet`, short: `Signed in as ${who}` };
  return { kind: 'local', text: 'Only on this computer: keep your progress safe', short: 'Not saved online' };
}
/** Open the grown-ups' "Saving online" (behind the grown-up check). */
export function goSaveOnline() { cloud.focusAccount = true; game.guSection = 'players'; game.visit('grownups'); }

/** A server answer that wasn't "ok", with its status (410: a grown-up deleted that player everywhere). */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
const isGone = (e: unknown) => e instanceof ApiError && e.status === 410;
export async function call<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`api${path}`, { credentials: 'same-origin', ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError((body as { error?: string }).error || 'Saving online is not available right now.', r.status);
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

/** the account's tombstones: players its grown-up deleted everywhere */
let accountGone: Tombstone[] = [];
export async function refreshAccount() {
  try { const me = await call<{ account: typeof cloud.account; players: CloudPlayer[]; gone?: Tombstone[] }>('/me'); cloud.account = me.account; cloud.players = me.players; accountGone = me.gone ?? []; }
  catch { cloud.account = null; cloud.players = []; accountGone = []; }
  // signed in: remember it; was signed in here and isn't now: say so
  if (cloud.account) { rememberSignIn(cloud.account.name ?? cloud.account.email ?? 'you'); cloud.signedOut = null; }
  else { const was = signedInBefore(); cloud.signedOut = was ? { name: was } : null; }
}

/** Give a player a save code (and file it under the signed-in grown-up, if any). Asked twice at once (a
 *  catch-up and a save), the player still gets one code. */
const making = new Map<string, Promise<string | null>>();
export function makeCode(id: string, refresh = true): Promise<string | null> {
  const now = making.get(id);
  if (now) return now;
  const run = newCode(id, refresh).finally(() => making.delete(id));
  making.set(id, run);
  return run;
}
async function newCode(id: string, refresh: boolean) {
  const p = game.save.profiles.find(x => x.id === id);
  if (!p) return null;
  clearLocalOnly(id);
  if (p.cloud) return p.cloud.code;
  const body = payload(p);
  const r = await call<{ code: string; updated: number }>('/players', { method: 'POST', body: JSON.stringify({ profile: body }) });
  p.cloud = { code: r.code, at: r.updated };
  p.updatedAt = r.updated;
  saveBase(r.code, { ...body, updatedAt: r.updated });
  game.persist();
  if (cloud.account && refresh) await refreshAccount();
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
    const there = await fetchPlayer(cur.cloud!.code);
    const merged = mergeProfile(cur, tidy(there.profile, cur.id), loadBase(cur.cloud!.code));
    merged.cloud = { code: there.code, at: there.updated };
    merged.updatedAt = Math.max(Date.now(), there.updated + 1);
    place(merged);
    cur = merged;
  }
}

/** in the signed-in grown-up's account? (then it's fetched through the account, not by guessing-limited code) */
const viaAccount = (code: string) => !!cloud.account && cloud.players.some(x => x.code === code);
type Fetched = { code: string; profile: Profile; updated: number };
const fetchPlayer = (code: string) => call<Fetched>(viaAccount(code) ? `/me/players/${encodeURIComponent(code)}` : `/players/${encodeURIComponent(code)}`);

/** Bring a saved player onto this computer by their code. If they're here already, the two copies are
 *  combined (nothing played here is lost). A grown-up signed in here keeps them in the account too. */
export async function openCode(raw: string, activate = true) {
  const code = cleanCode(raw);
  clearNotHere(code);
  const prof = await bring(code, activate);
  if (cloud.account && prof.cloud && !viaAccount(prof.cloud.code) && !isClassLogin(prof)) {
    await call(`/me/players/${prof.cloud.code}`, { method: 'PUT' }).catch(() => null);
    await refreshAccount();
  }
  return prof;
}
async function bring(code: string, activate: boolean) {
  const r = await fetchPlayer(code);
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
  if (activate) game.save.activeId = prof.id;
  game.persist();
  return prof;
}

// ---------- taking players off this computer ----------
/** Remove players from this computer. If the one playing goes, back to choosing a player. */
function removeHere(ids: string[]) {
  const active = game.save.activeId;
  for (const id of ids) {
    const p = game.save.profiles.find(x => x.id === id);
    if (p?.cloud) dropBase(p.cloud.code);
    game.removePlayer(id);
  }
  if (active && ids.includes(active) && !['title', 'players', 'newPlayer'].includes(game.screen)) {
    game.closeSettings(); game.closeMenu();
    game.go(game.save.profiles.length ? 'players' : 'newPlayer');
  }
}
/** Players a grown-up deleted everywhere: remove them here, with a gentle note. */
function takeGone(list: { id: string; name: string }[]) {
  const seen = new Set<string>(), names: string[] = [];
  for (const g of list) if (!seen.has(g.id)) { seen.add(g.id); names.push(g.name); }
  if (!seen.size) return;
  removeHere([...seen]);
  game.say(goneNote(names), 7000);
}
/** in the signed-in grown-up's account (so deleting asks "everywhere or just this computer?") */
export const inAccount = (p: Profile | null | undefined) => !!(p?.cloud && viaAccount(p.cloud.code));
/** Delete a player everywhere: from the account, and (through its tombstone) from every computer. */
export async function deleteEverywhere(id: string) {
  const p = game.save.profiles.find(x => x.id === id);
  if (!p?.cloud) return;
  await call(`/me/players/${encodeURIComponent(p.cloud.code)}/everywhere`, { method: 'DELETE' });
  removeHere([id]);
  await refreshAccount();
}
/** Delete a player from this computer only: it stays in the account and isn't brought back here. */
export function deleteHereOnly(id: string) {
  const p = game.save.profiles.find(x => x.id === id);
  if (p?.cloud) markNotHere(p.cloud.code);
  removeHere([id]);
}

// ---------- keeping saved copies in step ----------
let timer: ReturnType<typeof setTimeout> | undefined;
let pushing = false;
function schedulePush() { clearTimeout(timer); timer = setTimeout(pushAll, 4000); }
/** kept on this computer only: test players, and ones a grown-up stopped saving online here */
const keepLocal = (p: Profile) => !!p.allBuddies || localOnlyIds().includes(p.id);
async function pushAll() {
  if (pushing || !cloud.online) return;
  pushing = true;
  const gone: { id: string; name: string }[] = [];
  try {
    for (const p of [...game.save.profiles]) {
      // signed in: a new player is filed under the account straight away
      if (!p.cloud) { if (cloud.account && !keepLocal(p)) await makeCode(p.id, false).catch(() => null); continue; }
      if (!changedHere(p)) continue;
      try { await send(p); } catch (e) { if (isGone(e)) gone.push(p); /* else: try again after the next change */ }
    }
    game.persist();
  } finally { pushing = false; }
  takeGone(gone);
}
/** Catch one player up with its saved copy. Nothing changed here: take theirs. Both changed: combine. */
async function pullOne(p: Profile) {
  if (!p.cloud) return;
  const r = await fetchPlayer(p.cloud.code);
  if (r.updated === p.cloud.at) return;
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
}

/** Catch up with other computers: players deleted everywhere go, the account's players come, changed
 *  copies are combined, and (signed in) this computer's players are filed under the account. `everyCode`
 *  also checks players saved with a code only (at start). */
let catching: Promise<void> | null = null;
export function catchUp(everyCode = false): Promise<void> {
  if (!cloud.online) return Promise.resolve();
  catching ??= doCatchUp(everyCode).finally(() => (catching = null));
  return catching;
}
let lastCatch = 0;
/** Catch up now unless that was done in the last minute (opening the players screen). */
export function catchUpSoon() { if (Date.now() - lastCatch > 60000) void catchUp(); }
const linkTried = new Set<string>();
async function doCatchUp(everyCode: boolean) {
  lastCatch = Date.now();
  await refreshAccount();
  // (a player who logged in through a class belongs to the class: never filed under whoever is signed in here)
  const local = game.save.profiles.map(p => ({ id: p.id, name: p.name, code: p.cloud?.code, at: p.cloud?.at, localOnly: keepLocal(p) || isClassLogin(p) }));
  const plan = planSync(local, cloud.account ? cloud.players : null, accountGone, notHereCodes(), everyCode);
  const gone: { id: string; name: string }[] = [...plan.remove];
  for (const code of plan.pull) {
    const p = game.save.profiles.find(x => x.cloud?.code === code);
    if (!p) continue;
    try { await pullOne(p); } catch (e) { if (isGone(e)) gone.push(p); /* missing or offline: keep this copy */ }
  }
  for (const code of plan.add) await bring(code, false).catch(() => null);
  if (cloud.account) {
    let filed = 0;
    for (const id of plan.file) if (await makeCode(id, false).catch(() => null)) filed++;
    for (const code of plan.link) {
      if (linkTried.has(code)) continue;
      linkTried.add(code);
      if (await call(`/me/players/${code}`, { method: 'PUT' }).then(() => true, () => false)) filed++;
    }
    if (filed) await refreshAccount();
  }
  game.persist();
  takeGone(gone);
}

// ---------- grown-up sign-in ----------
export function signIn(provider: 'google' | 'microsoft') { location.href = `api/auth/${provider}/start`; }
const TEACH_RETURN = 'kp-teach-return';
/** Sign in from the teachers' page, and come back to it. */
export function signInForTeach() { try { sessionStorage.setItem(TEACH_RETURN, '1'); } catch { /* it comes back to Grown-ups instead */ } signIn('google'); }
export async function signOut() { await call('/auth/logout', { method: 'POST' }).catch(() => null); cloud.account = null; cloud.players = []; forgetSignIn(); cloud.signedOut = null; }
export async function deleteAccount(withPlayers: boolean) {
  await call('/me', { method: 'DELETE', body: JSON.stringify({ players: withPlayers }) });
  // (only the players the account held lost their online copies: a class player here, or one saved with
  // just a code, keeps its save)
  if (withPlayers) for (const p of game.save.profiles) { if (p.cloud && viaAccount(p.cloud.code) && !isClassLogin(p)) { dropBase(p.cloud.code); delete p.cloud; } }
  game.persist();
  cloud.account = null; cloud.players = [];
  forgetSignIn(); cloud.signedOut = null;
}
/** Bring every player in the grown-up's account onto this computer (the ones removed from here only,
 *  too). Returns how many came. */
export async function addAllFromAccount(): Promise<number> {
  const here = new Set(game.save.profiles.map(x => x.cloud?.code).filter(Boolean));
  let n = 0;
  for (const cp of cloud.players) { if (here.has(cp.code)) continue; clearNotHere(cp.code); await bring(cp.code, false); n++; }
  return n;
}
/** fancyant.com/keypals → keypals.org: give every player a save code if needed, then open keypals.org with
 *  the codes, which adds them there (move.ts). */
export async function moveToOrg() {
  const codes: string[] = [];
  for (const p of [...game.save.profiles]) {
    if (p.allBuddies) continue;
    const code = p.cloud?.code ?? await makeCode(p.id, false);
    if (code) codes.push(code);
  }
  if (!codes.length) throw new Error('There are no players to move yet.');
  game.persist();
  location.assign(moveUrl(codes));
}
/** Bring one account player back to this computer (after "just this computer"). */
export async function addFromAccount(code: string) { clearNotHere(code); return bring(code, false); }
/** Stop saving a player online: their saved copy is deleted (progress stays on this computer, and it isn't
 *  filed under the account again by itself here). A player kept in a grown-up's account can only be
 *  deleted by that grown-up, signed in. */
export async function forgetCode(id: string) {
  const p = game.save.profiles.find(x => x.id === id);
  // (a class player's copy is the class's: it's not deleted from here, and the server refuses too)
  if (!p?.cloud || isClassLogin(p)) return;
  await call(`/players/${p.cloud.code}`, { method: 'DELETE' });
  dropBase(p.cloud.code);
  delete p.cloud;
  markLocalOnly(id);
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
  startCounting();
  game.onProfileChange = schedulePush;
  game.onPlayerAdded = schedulePush;
  const m = location.hash.match(/signin=(\w+)/);
  if (m) history.replaceState(null, '', location.pathname + location.search);
  const before = new Set(game.save.profiles.map(p => p.id));
  await catchUp(true);
  // a sign-in can run out while the game is open, and other computers add and delete players: check again
  // when the game comes back into view, and every quarter of an hour
  const recheck = () => { if (document.visibilityState === 'visible') void catchUp(); };
  document.addEventListener('visibilitychange', recheck);
  setInterval(recheck, 15 * 60000);
  // players moved here from fancyant.com/keypals (move.ts): add them, then clear the address
  const moving = movedCodes(location.hash);
  if (moving.length) {
    history.replaceState(null, '', location.pathname + location.search);
    const came: string[] = [];
    for (const code of moving) { try { came.push((await openCode(code, false)).name); } catch { /* deleted, or offline: skip it */ } }
    game.say(came.length ? `Moved ${came.length === 1 ? came[0] : `${came.slice(0, -1).join(', ')} and ${came[came.length - 1]}`} here. Welcome to keypals.org!` : 'Those players could not be moved. Try again, or type their save codes.', 7000);
    if (came.length && game.screen === 'title') game.go('players');
  }
  if (m) {
    const fromTeach = teachReturn();
    if (m[1] === 'ok' && cloud.account) {
      count('signin', cloud.account.provider);
      const came = game.save.profiles.filter(p => !before.has(p.id)).map(p => p.name);
      game.say(came.length ? `Signed in. Your players are saved to your account, and ${came.length === 1 ? came[0] : `${came.slice(0, -1).join(', ')} and ${came[came.length - 1]}`} came from it.` : 'Signed in. Your players are saved to your account.', 6000);
      grownupOpenUntil = Date.now() + 10 * 60000;
      landSignedIn(fromTeach);
    } else {
      game.say(m[1] === 'cancelled' ? 'Sign-in was cancelled.' : 'Sign-in did not work. Please try again.', 5000);
      if (fromTeach) game.go('teach');
    }
  }
}

/** Signing in from the teachers' page? (it marks that before going to Google; asked once) */
function teachReturn(): boolean {
  try { const t = !!sessionStorage.getItem(TEACH_RETURN); sessionStorage.removeItem(TEACH_RETURN); return t; } catch { return false; }
}
/** Back from signing in: the game has just restarted, so this picks the first place. From the teachers'
 *  page, that page again. With a player playing, Grown-ups' saving online. On a new phone nobody is picked
 *  yet: choose who's playing (their players have just come from the account), or make the first one. */
export function landSignedIn(fromTeach: boolean) {
  if (fromTeach) game.go('teach');
  else if (game.profile) { game.guSection = 'players'; game.go('grownups'); }
  else game.go(game.save.profiles.length ? 'players' : 'newPlayer');
}

// ---------- the grown-up check: open for ten minutes once passed ----------
export let grownupOpenUntil = 0;
export const grownupOpen = () => Date.now() < grownupOpenUntil;
export function passGrownupCheck() { grownupOpenUntil = Date.now() + 10 * 60000; }
