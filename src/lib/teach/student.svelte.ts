// The child's side of classes: logging in with a class code and two pictures, the player's class work
// (fetched by its save code), this week's effort sent for the boards, the world board for the Arcade's
// daily challenge, and "Done for today" on a shared school computer.
import { game } from '../state/game.svelte';
import { cloud } from '../state/cloud.svelte';
import { classHereCodes, isClassLogin, setClassHere } from '../state/classHere';
import { migrate, type Profile } from '../engine/profile';
import { dayKey } from '../engine/profile';
import { api, send } from './api';
import { activityBase, noteActivity, weekKey, weekStats } from './activity';
import { worldEntry, type BoardRow } from './boards';
import type { Assignment } from './assignments';

export type Challenge = { code: string; week: string; ends: number; classes: { id: string; name: string; students: number; avg: number }[] };
export type StudentClass = {
  id: string; name: string; grade: number; teacher: string; home: boolean;
  student: { id: string; name: string };
  board: boolean; goal: number; assignments: Assignment[];
  week: { right: number; ms: number; played: number; students: number };
  rows: BoardRow[]; challenge: Challenge | null;
};
type Mine = { classes: StudentClass[]; pending: { id: string; name: string; teacher: string | null }[]; at: number };

export const classState = $state({
  /** by save code */
  byCode: {} as Record<string, Mine>,
  /** the class login in progress: the code from a link (keypals.org/#class=...) */
  loginCode: null as string | null,
});

// ---------- a player's classes ----------
export const mineOf = (p: Profile | null): Mine | null => (p?.cloud ? classState.byCode[p.cloud.code] ?? null : null);
export const classesOf = (p: Profile | null): StudentClass[] => mineOf(p)?.classes ?? [];

let loading: Record<string, Promise<void>> = {};
/** Fetch the player's classes (again if older than a minute, or when asked). */
export function loadClasses(p: Profile | null, force = false): Promise<void> {
  const code = p?.cloud?.code;
  if (!code || !cloud.online) return Promise.resolve();
  const had = classState.byCode[code];
  if (!force && had && Date.now() - had.at < 60000) return Promise.resolve();
  return (loading[code] ??= api<Omit<Mine, 'at'>>(`/class/student/${encodeURIComponent(code)}?week=${weekKey(Date.now())}`)
    .then(r => { classState.byCode[code] = { ...r, at: Date.now() }; })
    .catch(() => { /* offline: keep what we had */ })
    .finally(() => { delete loading[code]; }));
}

// ---------- logging in ----------
export type ClassLook = { class: { name: string; grade: number; teacher: string }; students: { id: string; name: string; buddy: string | null }[] };
export const lookupClass = (code: string) => api<ClassLook>(`/class/${encodeURIComponent(code)}`);

/** Players who logged in with a class code on this computer (they can go again with "Done for today"). */
// (kept in state/classHere.ts, which saving online reads too: these players are never filed under a
// grown-up's account)
const sharedCodes = classHereCodes, setShared = setClassHere;
export const loggedInHere = (p: Profile | null) => isClassLogin(p);

/** Put a class player on this computer, as saving online does for a save code (its copy is the one both
 *  sides agree on, for combining later; the key is the one state/cloud.svelte.ts uses). */
function place(code: string, raw: Record<string, unknown>, updated: number): Profile {
  const here = game.save.profiles.find(x => x.cloud?.code === code);
  if (here) { game.save.activeId = here.id; game.persist(); return here; }
  const id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const prof = migrate({ version: 1, activeId: null, profiles: [{ ...raw, id }] }).profiles[0];
  prof.cloud = { code, at: updated };
  prof.updatedAt = updated;
  try { localStorage.setItem(`kp-cloud-base:${code}`, JSON.stringify({ ...raw, updatedAt: updated })); } catch { /* combining falls back to "the higher of the two" */ }
  game.save.profiles.push(prof);
  game.save.activeId = prof.id;
  game.persist();
  return prof;
}

/** Log in: the class code, the student, the two pictures in order. Throws with a gentle message. */
export async function loginStudent(classCode: string, student: string, pics: number[]): Promise<Profile> {
  const r = await send<{ code: string; name: string; updated: number; profile: Record<string, unknown> }>(`/class/${encodeURIComponent(classCode)}/login`, 'POST', { student, pics });
  const p = place(r.code, r.profile, r.updated);
  setShared([...sharedCodes(), r.code]);
  void loadClasses(p, true);
  return p;
}

/** Wait until the player's newest copy is saved online (the game saves a few seconds after a change). */
async function settled(id: string, ms = 15000): Promise<boolean> {
  game.onProfileChange?.();
  const until = Date.now() + ms;
  for (;;) {
    const live = game.save.profiles.find(x => x.id === id);
    if (!live?.cloud || (live.updatedAt ?? 0) <= live.cloud.at) return true;
    if (Date.now() > until) return false;
    await new Promise(r => setTimeout(r, 400));
  }
}
/** "Done for today": the class player leaves this computer once its progress is safe online. Returns false
 *  (and keeps it here) if it couldn't be saved yet, unless `anyway`. */
export async function doneForToday(p: Profile, anyway = false): Promise<boolean> {
  if (!p.cloud) return false;
  const code = p.cloud.code;
  await reportWeek(p).catch(() => null);
  if (!(await settled(p.id)) && !anyway) return false;
  game.removePlayer(p.id);
  try { localStorage.removeItem(`kp-cloud-base:${code}`); } catch { /* fine */ }
  setShared(sharedCodes().filter(c => c !== code));
  delete classState.byCode[code];
  game.go('players');
  return true;
}

// ---------- this week's effort, for the boards ----------
const sentAt: Record<string, number> = {};
let timer: ReturnType<typeof setTimeout> | undefined;
/** Send this week's right answers, minutes and stars (with the nickname and buddy, for the family board). */
export async function reportWeek(p: Profile): Promise<void> {
  if (!p.cloud || !cloud.online) return;
  const week = weekKey(Date.now()), w = weekStats(p, week);
  sentAt[p.cloud.code] = Date.now();
  await send(`/class/week/${encodeURIComponent(p.cloud.code)}`, 'PUT', { week, right: w.right, ms: w.ms, stars: w.stars, name: p.name, buddy: p.buddy });
}
function soon(id: string) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const p = game.save.profiles.find(x => x.id === id);
    if (p?.cloud && Date.now() - (sentAt[p.cloud.code] ?? 0) > 20000) void reportWeek(p).then(() => loadClasses(p, true)).catch(() => null);
  }, 8000);
}

/** The world board: a new best in today's Arcade challenge, for a player whose grown-up turned it on. */
function worldBest(before: Profile | undefined, after: Profile) {
  const today = dayKey(Date.now());
  for (const [g, rec] of Object.entries(after.arcade ?? {})) {
    const d = rec?.daily, was = before?.arcade?.[g as keyof NonNullable<Profile['arcade']>]?.daily;
    if (!d || d.day !== today || (was && was.day === today && was.best >= d.best)) continue;
    const entry = worldEntry(after, g, today, Math.round(d.best));
    if (entry && cloud.online) void send('/world', 'POST', entry).catch(() => null);
  }
}

/** Every finished activity (game.replaceProfile): note it, and later send the week and any world best. */
export function onActivity(before: Profile | undefined, after: Profile) {
  noteActivity(before, after);
  worldBest(before, after);
  soon(after.id);
}

// ---------- where things start ----------
/** At start: count every activity from now on, and open the teacher area or the class login from a link. */
export function startClasses() {
  game.onActivity = onActivity;
  game.watchActivity = (p) => { const before = activityBase(p); return () => onActivity(before, p); };
  const route = () => {
    const h = location.hash;
    const m = h.match(/^#class=([A-Za-z0-9 %-]+)/);
    if (m) { classState.loginCode = decodeURIComponent(m[1]); history.replaceState(null, '', location.pathname + location.search); game.go('classLogin'); }
    else if (h === '#teach') { history.replaceState(null, '', location.pathname + location.search); game.go('teach'); }
  };
  route();
  window.addEventListener('hashchange', route);
  // back from signing in with Google from the teacher area: the game opens the Grown-ups screen; go on
  // to the teacher area instead
  try {
    if (sessionStorage.getItem('kp-teach-return') && /signin=/.test(location.hash)) {
      sessionStorage.removeItem('kp-teach-return');
      const until = Date.now() + 20000;
      const t = setInterval(() => { if (game.screen === 'grownups' || Date.now() > until) { clearInterval(t); if (game.screen === 'grownups') game.go('teach'); } }, 200);
    }
  } catch { /* no session storage: stay on Grown-ups */ }
}
