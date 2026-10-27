// Saving players online. Each player can get a save code (three words and a number): typing it on
// another computer brings their progress over, and changes keep flowing to the saved copy. Grown-ups
// (parents, teachers) can sign in with Google or Microsoft to keep all their players together.
// Children never give an email or real name. The server is the fancyant.com/keypals Worker
// (deploy/site/worker.js); away from it (the dev server, offline) saving online just isn't offered.
import { game } from './game.svelte';
import { migrate, type Profile } from '../engine/profile';

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
});

async function call<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(`api${path}`, { credentials: 'same-origin', ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((body as { error?: string }).error || 'Saving online is not available right now.');
  return body as T;
}

/** A save code as people might type it ("tiger moon rain 42") in the server's form. */
export const cleanCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const payload = (p: Profile) => { const { cloud: _c, ...rest } = $state.snapshot(p) as Profile; return rest; };

export async function refreshAccount() {
  try { const me = await call<{ account: typeof cloud.account; players: CloudPlayer[] }>('/me'); cloud.account = me.account; cloud.players = me.players; }
  catch { cloud.account = null; cloud.players = []; }
}

/** Give a player a save code (and file it under the signed-in grown-up, if any). */
export async function makeCode(id: string) {
  const p = game.save.profiles.find(x => x.id === id);
  if (!p) return null;
  if (p.cloud) return p.cloud.code;
  const r = await call<{ code: string; updated: number }>('/players', { method: 'POST', body: JSON.stringify({ profile: payload(p) }) });
  p.cloud = { code: r.code, at: r.updated };
  p.updatedAt = r.updated;
  game.persist();
  if (cloud.account) await refreshAccount();
  return r.code;
}

/** Bring a saved player onto this computer by their code (or update them if they're already here). */
export async function openCode(raw: string) {
  const code = cleanCode(raw);
  const r = await call<{ code: string; profile: Profile; updated: number }>(`/players/${encodeURIComponent(code)}`);
  const here = game.save.profiles.find(x => x.cloud?.code === r.code);
  // the same tidy-up as loading a save file, for this one player
  const prof = migrate({ version: 1, activeId: null, profiles: [{ ...r.profile, id: here?.id ?? `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` }] }).profiles[0];
  prof.cloud = { code: r.code, at: r.updated };
  prof.updatedAt = r.updated;
  if (here) game.save.profiles[game.save.profiles.indexOf(here)] = prof;
  else game.save.profiles.push(prof);
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
    for (const p of game.save.profiles) {
      if (!p.cloud || (p.updatedAt ?? 0) <= p.cloud.at) continue;
      try {
        const r = await call<{ updated: number; stale?: boolean }>(`/players/${p.cloud.code}`, { method: 'PUT', body: JSON.stringify({ profile: payload(p), updated: p.updatedAt }) });
        // another computer saved a newer copy: take it
        if (r.stale) await openCode(p.cloud.code);
        else p.cloud.at = r.updated;
      } catch { /* try again after the next change */ }
    }
    game.persist();
  } finally { pushing = false; }
}
/** On start: copies saved from other computers since we last looked replace the ones here. */
async function pullAll() {
  for (const p of [...game.save.profiles]) {
    if (!p.cloud) continue;
    try {
      const r = await call<{ updated: number }>(`/players/${p.cloud.code}`);
      if (r.updated > Math.max(p.updatedAt ?? 0, p.cloud.at)) await openCode(p.cloud.code);
    } catch { /* missing or offline: keep this copy */ }
  }
}

// ---------- grown-up sign-in ----------
export function signIn(provider: 'google' | 'microsoft') { location.href = `api/auth/${provider}/start`; }
export async function signOut() { await call('/auth/logout', { method: 'POST' }).catch(() => null); cloud.account = null; cloud.players = []; }
export async function deleteAccount(withPlayers: boolean) {
  await call('/me', { method: 'DELETE', body: JSON.stringify({ players: withPlayers }) });
  if (withPlayers) for (const p of game.save.profiles) delete p.cloud;
  game.persist();
  cloud.account = null; cloud.players = [];
}
/** File every player on this computer under the signed-in grown-up (giving codes where needed). */
export async function keepAllInAccount() {
  for (const p of game.save.profiles) {
    const code = p.cloud?.code ?? await makeCode(p.id);
    if (code) await call(`/me/players/${code}`, { method: 'PUT' }).catch(() => null);
  }
  await refreshAccount();
}
export async function forgetCode(id: string) {
  const p = game.save.profiles.find(x => x.id === id);
  if (!p?.cloud) return;
  await call(`/players/${p.cloud.code}`, { method: 'DELETE' }).catch(() => null);
  delete p.cloud;
  game.persist();
  if (cloud.account) await refreshAccount();
}

/** Once, at start: find the server, catch up with other computers, finish a sign-in that just came back. */
export async function startCloud() {
  try {
    const c = await call<{ google: boolean; microsoft: boolean }>('/config');
    cloud.online = true; cloud.google = c.google; cloud.microsoft = c.microsoft;
  } catch { cloud.online = false; return; }
  game.onProfileChange = schedulePush;
  await refreshAccount();
  await pullAll();
  const m = location.hash.match(/signin=(\w+)/);
  if (m) {
    history.replaceState(null, '', location.pathname + location.search);
    if (m[1] === 'ok' && cloud.account) {
      await keepAllInAccount();
      game.say(`Signed in. Your players are saved to your account.`, 5000);
      game.go('grownups');
    } else if (m[1] !== 'ok') game.say(m[1] === 'cancelled' ? 'Sign-in was cancelled.' : 'Sign-in did not work. Please try again.', 5000);
  }
}
