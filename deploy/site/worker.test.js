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

describe('ideas and help', () => {
  const ADMIN = 'boss@example.com';
  it('a new idea waits for approval, then shows on the board; hearts count up and down', async () => {
    const { api, grownup } = site({ ADMIN_EMAILS: `someone@else.org, ${ADMIN.toUpperCase()}` });
    const made = await api('/ideas', { method: 'POST', body: { kind: 'game', text: 'A cooking game with fractions', email: 'me@example.com' } });
    expect(made.status).toBe(200);
    expect((await api('/ideas')).json.ideas).toEqual([]);
    const boss = await grownup(ADMIN);
    expect((await api('/me', { cookie: boss })).json.account.admin).toBe(true);
    const list = await api('/admin/ideas', { cookie: boss });
    expect(list.json.ideas[0].email).toBe('me@example.com');
    await api(`/admin/ideas/${made.json.id}`, { method: 'POST', body: { status: 'shown' }, cookie: boss });
    const board = (await api('/ideas')).json.ideas;
    expect(board.map(i => i.text)).toEqual(['A cooking game with fractions']);
    // the board never shows an email
    expect(Object.keys(board[0]).sort()).toEqual(['created', 'id', 'kind', 'status', 'text', 'votes']);
    expect((await api(`/ideas/${made.json.id}/vote`, { method: 'POST', body: { up: true } })).json.votes).toBe(1);
    expect((await api(`/ideas/${made.json.id}/vote`, { method: 'POST', body: { up: true }, ip: '10.0.0.9' })).json.votes).toBe(2);
    expect((await api(`/ideas/${made.json.id}/vote`, { method: 'POST', body: { up: false } })).json.votes).toBe(1);
  });

  it('merging moves the votes; planned and done stay on the board, hidden goes', async () => {
    const { api, grownup } = site({ ADMIN_EMAILS: ADMIN });
    const boss = await grownup(ADMIN);
    const a = (await api('/ideas', { method: 'POST', body: { kind: 'game', text: 'Dinosaur game' } })).json.id;
    const b = (await api('/ideas', { method: 'POST', body: { kind: 'game', text: 'Dinosaurs please' }, ip: '10.0.0.3' })).json.id;
    for (const id of [a, b]) await api(`/admin/ideas/${id}`, { method: 'POST', body: { status: 'shown' }, cookie: boss });
    await api(`/ideas/${b}/vote`, { method: 'POST', body: { up: true } });
    await api(`/ideas/${b}/vote`, { method: 'POST', body: { up: true }, ip: '10.0.0.4' });
    await api(`/admin/ideas/${b}`, { method: 'POST', body: { into: a }, cookie: boss });
    let board = (await api('/ideas')).json.ideas;
    expect(board.map(i => [i.id, i.votes])).toEqual([[a, 2]]);
    await api(`/admin/ideas/${a}`, { method: 'POST', body: { status: 'planned' }, cookie: boss });
    board = (await api('/ideas')).json.ideas;
    expect(board[0].status).toBe('planned');
    await api(`/admin/ideas/${a}`, { method: 'POST', body: { status: 'hidden' }, cookie: boss });
    expect((await api('/ideas')).json.ideas).toEqual([]);
  });

  it('only admins (Google sign-ins on the list) reach the admin side', async () => {
    const { api, grownup } = site({ ADMIN_EMAILS: ADMIN });
    expect((await api('/admin/ideas')).status).toBe(403);
    expect((await api('/admin/problems', { cookie: await grownup('parent@example.com') })).status).toBe(403);
    // the same email through another provider is not enough
    expect((await api('/admin/ideas', { cookie: await grownup(ADMIN, 'microsoft') })).status).toBe(403);
    // and nobody is an admin when the list isn't set
    const s2 = site();
    expect((await s2.api('/admin/ideas', { cookie: await s2.grownup(ADMIN) })).status).toBe(403);
  });

  it('rate limits: 5 ideas, 5 problem messages, 20 automatic reports and 60 hearts an hour from one address', async () => {
    const { api } = site();
    for (let i = 0; i < 5; i++) expect((await api('/ideas', { method: 'POST', body: { kind: 'other', text: `idea ${i}` } })).status).toBe(200);
    expect((await api('/ideas', { method: 'POST', body: { kind: 'other', text: 'one more' } })).status).toBe(429);
    // another address is not held back
    expect((await api('/ideas', { method: 'POST', body: { kind: 'other', text: 'from school' }, ip: '10.9.9.9' })).status).toBe(200);
    for (let i = 0; i < 5; i++) expect((await api('/problems', { method: 'POST', body: { text: `broken ${i}` } })).status).toBe(200);
    expect((await api('/problems', { method: 'POST', body: { text: 'broken again' } })).status).toBe(429);
    for (let i = 0; i < 20; i++) expect((await api('/problems', { method: 'POST', body: { auto: true, message: `E${i}`, stack: '' } })).status).toBe(200);
    expect((await api('/problems', { method: 'POST', body: { auto: true, message: 'E99', stack: '' } })).status).toBe(429);
  });

  it('hearts are limited per address too', async () => {
    const { api, grownup } = site({ ADMIN_EMAILS: ADMIN });
    const boss = await grownup(ADMIN);
    const id = (await api('/ideas', { method: 'POST', body: { kind: 'game', text: 'Space game' } })).json.id;
    await api(`/admin/ideas/${id}`, { method: 'POST', body: { status: 'shown' }, cookie: boss });
    for (let i = 0; i < 60; i++) expect((await api(`/ideas/${id}/vote`, { method: 'POST', body: { up: i % 2 === 0 }, ip: '10.1.1.1' })).status).toBe(200);
    expect((await api(`/ideas/${id}/vote`, { method: 'POST', body: { up: true }, ip: '10.1.1.1' })).status).toBe(429);
  });

  it('the same game error again is counted, not stored twice; a problem arrives in the admin list', async () => {
    const { api, grownup } = site({ ADMIN_EMAILS: ADMIN });
    const err = { auto: true, message: 'TypeError: x is undefined', stack: 'TypeError: x\n at a (index.js:1:2)', screen: 'hub', version: '2.0.0', browser: 'Chrome 141 on macOS', size: '1440x900' };
    await api('/problems', { method: 'POST', body: err });
    await api('/problems', { method: 'POST', body: { ...err, screen: 'map' }, ip: '10.0.0.7' });
    await api('/problems', { method: 'POST', body: { text: 'The music stopped', email: 'not an email' } });
    const boss = await grownup(ADMIN);
    const ps = (await api('/admin/problems', { cookie: boss })).json.problems;
    expect(ps.length).toBe(2);
    const auto = ps.find(p => p.kind === 'auto');
    expect(auto.times).toBe(2);
    expect(auto.screen).toBe('map');
    const told = ps.find(p => p.kind === 'told');
    expect(told.email).toBe(null);
    await api(`/admin/problems/${auto.id}`, { method: 'POST', body: { status: 'done' }, cookie: boss });
    // seen again after it was marked done: it opens again
    await api('/problems', { method: 'POST', body: err, ip: '10.0.0.8' });
    expect((await api('/admin/problems', { cookie: boss })).json.problems.find(p => p.id === auto.id).status).toBe('new');
  });
});

describe('counting visits on the server', () => {
  const today = () => new Date().toISOString().slice(0, 10);
  it('adds counts into daily totals, with the country for each opening and nothing else', async () => {
    const { env, api, grownup } = site({ ADMIN_EMAILS: 'boss@example.com' });
    const batch = { day: today(), counts: [{ e: 'open', k: 'phone', n: 1 }, { e: 'player_day', k: '', n: 1 }, { e: 'screen', k: 'hub', n: 2 }] };
    expect((await api('/count', { method: 'POST', body: batch, headers: { 'cf-ipcountry': 'US' } })).status).toBe(204);
    expect((await api('/count', { method: 'POST', body: batch, headers: { 'cf-ipcountry': 'CA' }, ip: '10.0.0.2' })).status).toBe(204);
    const rows = (await env.DB.prepare('SELECT * FROM counts ORDER BY event, key').all()).results;
    expect(rows.map(r => `${r.event}/${r.key}=${r.n}`)).toEqual(['country/CA=1', 'country/US=1', 'open/phone=2', 'player_day/=2', 'screen/hub=4']);
    // the table holds only day, event, key and n
    expect(Object.keys(rows[0]).sort()).toEqual(['day', 'event', 'key', 'n']);
    // and the admin numbers read them back
    const stats = await api('/admin/stats', { cookie: await grownup('boss@example.com') });
    expect(stats.json.rows.length).toBe(5);
    expect((await api('/admin/stats')).status).toBe(403);
  });

  it('drops anything that is not a plain count: unknown events, long or odd keys, silly numbers, a far-off day', async () => {
    const { env, api } = site();
    const counts = [
      { e: 'name', k: 'mia', n: 1 }, { e: 'screen', k: 'Mia Smith', n: 1 }, { e: 'screen', k: 'x'.repeat(41), n: 1 },
      { e: 'screen', k: 'hub', n: -3 }, { e: 'screen', k: 'hub', n: 1e9 }, { e: 'play_sec', k: '', n: 600 },
    ];
    await api('/count', { method: 'POST', body: { day: '1999-01-01', counts } });
    const rows = (await env.DB.prepare('SELECT * FROM counts').all()).results;
    expect(rows.map(r => [r.event, r.key, r.n])).toEqual([['play_sec', '', 600]]);
    expect(rows[0].day).toBe(today());
    expect((await api('/count', { method: 'POST', body: { day: today(), counts: Array(81).fill({ e: 'screen', k: 'hub', n: 1 }) } })).status).toBe(400);
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
