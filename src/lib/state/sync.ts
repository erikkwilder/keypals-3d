// Keeping a grown-up's players the same on every computer they're signed in on (cloud.svelte.ts does the
// talking to the server; this file only decides what to do, so it can be tested on its own).
//
// - Every player in the account comes to this computer, unless a grown-up removed it from this computer
//   only ("just this computer": its code is remembered here as not wanted).
// - A player deleted everywhere leaves a tombstone on the server (its code and when, nothing else). A
//   computer that still has a copy removes it, even a copy played offline since: the delete wins, so an
//   old copy can never bring the player back.
// - Players made here while signed in are filed under the account; so are players brought here by code.
// - Players saved with a code only (no account) keep working as before: they're caught up by their code.

/** A player on this computer, as far as syncing cares. */
export type LocalPlayer = {
  id: string;
  name: string;
  /** its save code, if it's saved online */
  code?: string;
  /** the server's time for the copy this computer last agreed with */
  at?: number;
  /** kept on this computer only: a test player (Grown-ups → Try every level), or one a grown-up stopped
   *  saving online here. Never filed under the account by itself. */
  localOnly?: boolean;
};
/** A player in the signed-in grown-up's account (from GET /me). */
export type AccountPlayer = { code: string; name: string; updated: number };
/** A player deleted everywhere: just its code and when. */
export type Tombstone = { code: string; at: number };

export type SyncPlan = {
  /** players to take off this computer, because a grown-up deleted them everywhere */
  remove: { id: string; name: string; code: string }[];
  /** account players to bring here (codes) */
  add: string[];
  /** players here whose saved copy changed elsewhere (codes): fetch and combine */
  pull: string[];
  /** players here with no save code yet (ids): give them one, filed under the account */
  file: string[];
  /** players here with a code that isn't in the account yet (codes): file them under it */
  link: string[];
};

/**
 * What to do to catch up. `account` is null when nobody is signed in. `notHere` is the codes removed from
 * this computer only. `everyCode` also checks players saved with a code only (at start: those are caught
 * up by their code, which is rate-limited, so the regular refresh leaves them to the next start).
 */
export function planSync(local: LocalPlayer[], account: AccountPlayer[] | null, gone: Tombstone[], notHere: Iterable<string>, everyCode = false): SyncPlan {
  const dead = new Set(gone.map(g => g.code));
  const skip = new Set(notHere);
  const plan: SyncPlan = { remove: [], add: [], pull: [], file: [], link: [] };
  const inAcct = new Map((account ?? []).map(a => [a.code, a]));
  const here = new Set<string>();
  for (const p of local) {
    if (!p.code) {
      if (account && !p.localOnly) plan.file.push(p.id);
      continue;
    }
    here.add(p.code);
    // the tombstone wins over any copy here, changed offline or not
    if (dead.has(p.code)) { plan.remove.push({ id: p.id, name: p.name, code: p.code }); continue; }
    const a = inAcct.get(p.code);
    if (a) { if (a.updated !== p.at) plan.pull.push(p.code); continue; }
    if (account && !p.localOnly) plan.link.push(p.code);
    if (everyCode) plan.pull.push(p.code);
  }
  for (const a of account ?? []) if (!here.has(a.code) && !dead.has(a.code) && !skip.has(a.code)) plan.add.push(a.code);
  return plan;
}

/** "Mia's player was deleted by a grown-up." (or "Mia's and Sam's players were ...") */
export function goneNote(names: string[]): string {
  const n = names.filter(Boolean);
  if (!n.length) return '';
  const who = n.length === 1 ? `${n[0]}'s` : `${n.slice(0, -1).map(x => `${x}'s`).join(', ')} and ${n[n.length - 1]}'s`;
  return `${who} player${n.length === 1 ? ' was' : 's were'} deleted by a grown-up.`;
}

// ---------- "just this computer": the codes not wanted here (kept per computer) ----------
const NOT_HERE = 'kp-not-here';
export function notHereCodes(): string[] {
  try { const v = JSON.parse(localStorage.getItem(NOT_HERE) ?? '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch { return []; }
}
function saveNotHere(codes: string[]) { try { localStorage.setItem(NOT_HERE, JSON.stringify([...new Set(codes)].slice(-200))); } catch { /* private window: it may come back after a restart */ } }
export function markNotHere(code: string) { saveNotHere([...notHereCodes(), code]); }
export function clearNotHere(code: string) { saveNotHere(notHereCodes().filter(c => c !== code)); }

// ---------- players a grown-up stopped saving online on this computer (ids, kept per computer) ----------
const LOCAL_ONLY = 'kp-local-only';
export function localOnlyIds(): string[] {
  try { const v = JSON.parse(localStorage.getItem(LOCAL_ONLY) ?? '[]'); return Array.isArray(v) ? v.filter(x => typeof x === 'string') : []; } catch { return []; }
}
function saveLocalOnly(ids: string[]) { try { localStorage.setItem(LOCAL_ONLY, JSON.stringify([...new Set(ids)].slice(-50))); } catch { /* nothing to do */ } }
export function markLocalOnly(id: string) { saveLocalOnly([...localOnlyIds(), id]); }
export function clearLocalOnly(id: string) { saveLocalOnly(localOnlyIds().filter(x => x !== id)); }
