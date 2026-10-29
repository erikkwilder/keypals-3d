// The Worker (worker.js) against a stand-in database (test/d1.js): saves, accounts and tombstones.
import { describe, expect, it } from 'vitest';
import worker from './worker.js';
import { makeD1 } from './test/d1.js';

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sha256 = async (text) => b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

/** a fresh site: the database, and a way to call the API as one computer */
export function site(vars = {}) {
  const env = { DB: makeD1(), ...vars };
  const origin = vars.ORIGIN ?? 'https://fancyant.com';
  const base = env.BASE ?? '/keypals';
  async function api(path, { method = 'GET', body, cookie, ip = '10.0.0.1', headers = {} } = {}) {
    const r = await worker.fetch(new Request(`${origin}${base}/api${path}`, {
      method, body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'cf-connecting-ip': ip, 'content-type': 'application/json', ...(cookie ? { cookie: `kp_session=${cookie}` } : {}), ...headers },
      redirect: 'manual',
    }), env);
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, json, headers: r.headers };
  }
  /** a signed-in grown-up: their session token (as the cookie holds it) */
  async function grownup(email = 'parent@example.com', provider = 'google') {
    const id = `acct-${Math.random().toString(36).slice(2, 8)}`, token = `tok-${id}`;
    await env.DB.prepare('INSERT INTO accounts (id, provider, sub, email, name, created, seen) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, provider, id, email, 'Pat', Date.now(), Date.now()).run();
    await env.DB.prepare('INSERT INTO sessions (hash, account, expires) VALUES (?, ?, ?)').bind(await sha256(token), id, Date.now() + 86400000).run();
    return token;
  }
  return { env, api, grownup };
}
const profile = (name, extra = {}) => ({ name, buddy: 'dino', settings: {}, ...extra });

describe('players follow the grown-up: the server side', () => {
  it('lists the account\'s players and hands them over in full to the signed-in grown-up', async () => {
    const { api, grownup } = site();
    const me = await grownup();
    const made = await api('/players', { method: 'POST', body: { profile: profile('Mia') }, cookie: me });
    expect(made.status).toBe(200);
    const list = await api('/me', { cookie: me });
    expect(list.json.players.map(p => p.name)).toEqual(['Mia']);
    expect(list.json.gone).toEqual([]);
    const full = await api(`/me/players/${made.json.code}`, { cookie: me });
    expect(full.json.profile.name).toBe('Mia');
    // someone else's account can't fetch it this way
    const other = await grownup('other@example.com');
    expect((await api(`/me/players/${made.json.code}`, { cookie: other })).status).toBe(404);
  });

  it('delete everywhere leaves a tombstone: code and time only, and an old copy can never bring it back', async () => {
    const { env, api, grownup } = site();
    const me = await grownup();
    const { json: { code, updated } } = await api('/players', { method: 'POST', body: { profile: profile('Mia') }, cookie: me });
    expect((await api(`/me/players/${code}/everywhere`, { method: 'DELETE', cookie: me })).status).toBe(200);
    // the tombstone holds no player data
    const row = await env.DB.prepare('SELECT * FROM gone WHERE code = ?').bind(code).first();
    expect(Object.keys(row).sort()).toEqual(['account', 'at', 'code']);
    // signed-in computers learn it from /me
    expect((await api('/me', { cookie: me })).json.gone.map(g => g.code)).toEqual([code]);
    // a computer that comes back online (signed in or not) is told it's gone
    const get = await api(`/players/${code}`);
    expect(get.status).toBe(410);
    expect(get.json.gone).toBe(true);
    // an old offline copy trying to save is refused, and nothing is written back
    const put = await api(`/players/${code}`, { method: 'PUT', body: { profile: profile('Mia', { more: 1 }), updated: updated + 5000, base: updated } });
    expect(put.status).toBe(410);
    const old = await api(`/players/${code}`, { method: 'PUT', body: { profile: profile('Mia'), updated: updated + 9000 } });
    expect(old.status).toBe(410);
    expect(await env.DB.prepare('SELECT code FROM players WHERE code = ?').bind(code).first()).toBe(null);
  });

  it('only the grown-up whose account holds the player can delete it everywhere', async () => {
    const { api, grownup } = site();
    const me = await grownup(), other = await grownup('other@example.com');
    const { json: { code } } = await api('/players', { method: 'POST', body: { profile: profile('Mia') }, cookie: me });
    expect((await api(`/me/players/${code}/everywhere`, { method: 'DELETE', cookie: other })).status).toBe(404);
    expect((await api(`/me/players/${code}/everywhere`, { method: 'DELETE' })).status).toBe(401);
    expect((await api(`/players/${code}`)).status).toBe(200);
  });

  it('players saved with a code only keep working as before', async () => {
    const { api } = site();
    const made = await api('/players', { method: 'POST', body: { profile: profile('Sam') } });
    const got = await api(`/players/${made.json.code}`);
    expect(got.json.profile.name).toBe('Sam');
    const saved = await api(`/players/${made.json.code}`, { method: 'PUT', body: { profile: profile('Sam', { x: 1 }), updated: Date.now(), base: made.json.updated } });
    expect(saved.status).toBe(200);
    expect(saved.json.stale).toBeUndefined();
    // stopping saving online is not a delete everywhere: other computers just keep their copy
    expect((await api(`/players/${made.json.code}`, { method: 'DELETE' })).status).toBe(200);
    expect((await api(`/players/${made.json.code}`)).status).toBe(404);
  });
});

describe('one Worker script, two addresses (fancyant.com/keypals and keypals.org)', () => {
  const google = { GOOGLE_CLIENT_ID: 'client-id', GOOGLE_CLIENT_SECRET: 'client-secret' };
  async function signInThrough(s) {
    const start = await s.api('/auth/google/start');
    expect(start.status).toBe(302);
    const to = new URL(start.headers.get('location'));
    expect(to.origin).toBe('https://accounts.google.com');
    const state = to.searchParams.get('state');
    // Google answers the token and user questions
    const real = globalThis.fetch;
    globalThis.fetch = async (u) => new Response(JSON.stringify(String(u).includes('token') ? { access_token: 'at' } : { sub: 'g-1', email: 'parent@example.com', name: 'Pat' }));
    try {
      const back = await s.api(`/auth/google/callback?code=abc&state=${state}`);
      return { redirectUri: to.searchParams.get('redirect_uri'), back };
    } finally { globalThis.fetch = real; }
  }

  it('fancyant.com: the API, sign-in return addresses and cookie live under /keypals', async () => {
    const s = site({ ...google, BASE: '/keypals' });
    expect((await s.api('/config')).json.google).toBe(true);
    const { redirectUri, back } = await signInThrough(s);
    expect(redirectUri).toBe('https://fancyant.com/keypals/api/auth/google/callback');
    expect(back.status).toBe(302);
    expect(back.headers.get('location')).toBe('https://fancyant.com/keypals/#signin=ok');
    expect(back.headers.get('set-cookie')).toMatch(/; Path=\/keypals;/);
  });

  it('keypals.org: the same at the root, exactly /api/auth/google/callback', async () => {
    const s = site({ ...google, BASE: '', ORIGIN: 'https://keypals.org' });
    const { redirectUri, back } = await signInThrough(s);
    expect(redirectUri).toBe('https://keypals.org/api/auth/google/callback');
    expect(back.headers.get('location')).toBe('https://keypals.org/#signin=ok');
    expect(back.headers.get('set-cookie')).toMatch(/; Path=\/;/);
    // signing out clears the cookie at the same path
    expect((await s.api('/auth/logout', { method: 'POST' })).headers.get('set-cookie')).toMatch(/kp_session=; Path=\/;/);
  });

  it('with no BASE set it behaves as fancyant.com/keypals always did', async () => {
    const { redirectUri } = await signInThrough(site(google));
    expect(redirectUri).toBe('https://fancyant.com/keypals/api/auth/google/callback');
  });

  it('a save code made on one address opens on the other (one shared database)', async () => {
    const fa = site({ BASE: '/keypals' });
    const made = await fa.api('/players', { method: 'POST', body: { profile: profile('Mia') } });
    const r = await worker.fetch(new Request(`https://keypals.org/api/players/${made.json.code}`, { headers: { 'cf-connecting-ip': '10.0.0.2' } }), { ...fa.env, BASE: '' });
    expect(r.status).toBe(200);
    expect((await r.json()).profile.name).toBe('Mia');
  });

  it('keypals.org does not answer the old /keypals paths, and www.keypals.org sends people to keypals.org', async () => {
    const env = { DB: makeD1(), BASE: '' };
    expect((await worker.fetch(new Request('https://keypals.org/keypals/api/config'), env)).status).toBe(404);
    expect((await worker.fetch(new Request('https://keypals.org/keypals2/'), env)).status).toBe(404);
    const www = await worker.fetch(new Request('https://www.keypals.org/privacy?x=1'), { REDIRECT_TO: 'https://keypals.org' });
    expect(www.status).toBe(301);
    expect(www.headers.get('location')).toBe('https://keypals.org/privacy?x=1');
  });
});
