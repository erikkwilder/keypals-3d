// Security and children's-privacy checks of the API (worker.js, classes.js) against the stand-in database
// (test/d1.js), from four points of view: an outsider, a child in a class, another teacher, another family.
// Each test states the safe behaviour. `gap(...)` marks one the code does NOT meet today: it runs as
// it.fails, so this file stays green while the gap is there and turns red the day it is fixed (then make it a
// plain `it`). SHOW_GAPS=1 runs the gaps as plain tests, so each one fails and shows what happens instead:
//   npx vitest run deploy/site/security.test.js
//   SHOW_GAPS=1 npx vitest run deploy/site/security.test.js
// (site() is a copy of worker.test.js's: importing that file would run its tests here too.)
import { describe, expect, it, vi } from 'vitest';
import worker from './worker.js';
import { makeD1 } from './test/d1.js';

const gap = process.env.SHOW_GAPS ? it : it.fails;
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sha256 = async (text) => b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
const GOOGLE = { GOOGLE_CLIENT_ID: 'client-id', GOOGLE_CLIENT_SECRET: 'client-secret' };
/** this week's Monday, as the game sends it (the boards take only a week near now) */
const WEEK = (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
const DAY = 86400000;
const ATTACKER = '203.0.113.9', FAMILY = '198.51.100.7';

/** the stand-in database with a short wait before every query, as D1's own round trips have */
function slowD1(ms = 1) {
  const db = makeD1();
  const wait = () => new Promise(r => setTimeout(r, ms));
  const wrap = (st) => ({
    raw: st, sql: st.sql,
    bind: (...a) => wrap(st.bind(...a)),
    first: async (c) => { await wait(); return st.first(c); },
    all: async () => { await wait(); return st.all(); },
    run: async () => { await wait(); return st.run(); },
  });
  return { sqlite: db.sqlite, prepare: (sql) => wrap(db.prepare(sql)), batch: async (list) => { await wait(); return db.batch(list.map(s => s.raw ?? s)); } };
}

/** a fresh site: the database, a way to call the API as one computer, grown-ups, teachers and classes */
function site(vars = {}, DB = makeD1()) {
  const env = { DB, ...vars };
  const origin = vars.ORIGIN ?? 'https://fancyant.com';
  const base = env.BASE ?? '/keypals';
  async function api(path, { method = 'GET', body, raw, cookie, ip = '10.0.0.1', headers = {} } = {}) {
    const h = { 'content-type': 'application/json', ...(ip ? { 'cf-connecting-ip': ip } : {}), ...(cookie ? { cookie: `kp_session=${cookie}` } : {}), ...headers };
    const sent = method === 'GET' || method === 'HEAD' ? undefined : raw ?? (body === undefined ? undefined : JSON.stringify(body));
    const r = await worker.fetch(new Request(`${origin}${base}/api${path}`, { method, body: sent, headers: h, redirect: 'manual' }), env);
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: r.status, json, text, headers: r.headers };
  }
  async function grownup(email = 'parent@example.com', provider = 'google') {
    const id = `acct-${Math.random().toString(36).slice(2, 10)}`, token = `tok-${id}-${Math.random().toString(36).slice(2)}`;
    await env.DB.prepare('INSERT INTO accounts (id, provider, sub, email, name, created, seen) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, provider, id, email, 'Pat', Date.now(), Date.now()).run();
    await env.DB.prepare('INSERT INTO sessions (hash, account, expires) VALUES (?, ?, ?)').bind(await sha256(token), id, Date.now() + DAY).run();
    return { token, id };
  }
  /** an approved teacher (a school Google account: Google gave a domain at sign-in) */
  async function teacher(display = 'Ms. Rivera') {
    const g = await grownup(`${display.replace(/\W/g, '').toLowerCase()}@school.test`);
    await env.DB.prepare('INSERT INTO account_domains (account, hd, updated) VALUES (?, ?, ?)').bind(g.id, 'school.test', Date.now()).run();
    const t = await api('/teach/me', { method: 'POST', body: { display, agree: true }, cookie: g.token });
    expect(t.json?.teacher?.status).toBe('approved');
    return g;
  }
  async function classWith(t, names = 'Maria\nSam\nAna', name = 'Room 12') {
    const c = await api('/teach/classes', { method: 'POST', body: { name, grade: 3 }, cookie: t.token });
    const add = await api(`/teach/classes/${c.json.class.id}/students`, { method: 'POST', body: { text: names }, cookie: t.token });
    expect(add.status).toBe(200);
    const rows = (await env.DB.prepare('SELECT id, name, player, pics FROM students WHERE class = ?').bind(c.json.class.id).all()).results
      .map(r => ({ ...r, pair: r.pics.split(',').map(Number) }));
    return { id: c.json.class.id, code: c.json.class.code, rows };
  }
  const count = (sql, ...a) => env.DB.sqlite.prepare(sql).get(...a).n;
  return { env, api, grownup, teacher, classWith, count };
}

/** Google answers the token and user questions with `me` while `fn` runs; `asked` lists what was fetched */
async function asGoogle(me, fn) {
  const real = globalThis.fetch, asked = [];
  globalThis.fetch = async (u) => { asked.push(String(u)); return new Response(JSON.stringify(String(u).includes('/token') ? { access_token: 'at' } : me)); };
  try { return await fn(asked); } finally { globalThis.fetch = real; }
}
const cookieOf = (r) => (r.headers.get('set-cookie') || '').match(/kp_session=([^;]*)/)?.[1] || null;
const stateOf = (r) => new URL(r.headers.get('location')).searchParams.get('state');
const ticketOf = (r) => new URL(r.headers.get('location')).hash.replace('#classgoogle=', '');
/** the cookie a sign-in's start gave this browser, to bring back with the return from Google */
const signinCookie = (r) => ({ cookie: `kp_signin=${(r.headers.get('set-cookie') || '').match(/kp_signin=([^;]*)/)?.[1] ?? ''}` });
/** a whole sign-in on one computer: start, Google, back (the same browser, so with the start's cookie) */
const signIn = (s, me, ip, kind = 'start') => asGoogle(me, async () => {
  const start = await s.api(`/auth/google/${kind}`, { ip });
  return s.api(`/auth/google/callback?code=c-${Math.random()}&state=${stateOf(start)}`, { ip, headers: signinCookie(start) });
});

// ---------------------------------------------------------------------------------------------------
describe('sign-in and sessions', () => {
  it('the sign-in cookie is HttpOnly, Secure, SameSite=Lax, host-only, at the game path, 180 days; only its hash is kept; signing out ends it on the server', async () => {
    const s = site(GOOGLE);
    const back = await signIn(s, { sub: 'g-1', email: 'pat@example.com', name: 'Pat' }, FAMILY);
    const set = back.headers.get('set-cookie');
    expect(set).toMatch(/; Path=\/keypals; HttpOnly; Secure; SameSite=Lax; Max-Age=15552000$/);
    expect(set).not.toMatch(/Domain=/i);
    const token = cookieOf(back);
    expect(token.length).toBeGreaterThanOrEqual(43); // 32 random bytes
    const rows = s.env.DB.sqlite.prepare('SELECT * FROM sessions').all();
    expect(rows.map(r => r.hash)).toEqual([await sha256(token)]);
    expect(JSON.stringify(rows)).not.toContain(token);
    expect((await s.api('/me', { cookie: token })).status).toBe(200);
    const out = await s.api('/auth/logout', { method: 'POST', cookie: token });
    expect(out.headers.get('set-cookie')).toMatch(/^kp_session=; Path=\/keypals; .*Max-Age=0$/);
    expect((await s.api('/me', { cookie: token })).status).toBe(401);
    expect(s.count('SELECT count(*) AS n FROM sessions')).toBe(0);
  });

  it('a callback whose state was never given out, was used already, or is over 15 minutes old is refused before Google is asked', async () => {
    const s = site(GOOGLE);
    await asGoogle({ sub: 'g-1', email: 'pat@example.com' }, async (asked) => {
      expect((await s.api('/auth/google/callback?code=c&state=made-up')).headers.get('location')).toMatch(/#signin=expired$/);
      expect(asked).toEqual([]);
      const start = await s.api('/auth/google/start'), st = stateOf(start);
      expect((await s.api(`/auth/google/callback?code=c&state=${st}`, { headers: signinCookie(start) })).headers.get('location')).toMatch(/#signin=ok$/);
      const n = asked.length;
      expect((await s.api(`/auth/google/callback?code=c&state=${st}`, { headers: signinCookie(start) })).headers.get('location')).toMatch(/#signin=expired$/);
      await s.env.DB.prepare('INSERT INTO sign_ins (state, verifier, provider, created) VALUES (?, ?, ?, ?)').bind('old-state', 'v', 'google', Date.now() - 16 * 60000).run();
      expect((await s.api('/auth/google/callback?code=c&state=old-state', { headers: { cookie: 'kp_signin=old-state' } })).headers.get('location')).toMatch(/#signin=expired$/);
      expect(asked.length).toBe(n);
    });
  });

  it('[H2] a grown-up sign-in can only be finished by the browser that started it (no login CSRF)', async () => {
    const s = site(GOOGLE);
    const attacker = { sub: 'g-attacker', email: 'attacker@example.com', name: 'Mallory' };
    // the attacker starts a sign-in (their browser gets its state in a cookie: HttpOnly, only for the sign-in's
    // addresses, 15 minutes), signs in at Google, and sends the return link to a parent instead of opening it
    const start = await s.api('/auth/google/start', { ip: ATTACKER });
    expect(start.headers.get('set-cookie')).toBe(`kp_signin=${stateOf(start)}; Path=/keypals/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=900`);
    const link = `/auth/google/callback?code=c1&state=${stateOf(start)}`;
    const victim = await asGoogle(attacker, () => s.api(link, { ip: FAMILY }));
    const victimCookie = cookieOf(victim);
    // the parent, now signed in as the attacker without knowing it, saves their child online
    await s.api('/players', { method: 'POST', body: { profile: { name: 'Mia', buddy: 'dino', settings: {} } }, cookie: victimCookie ?? undefined, ip: FAMILY });
    // the attacker signs in as themselves and looks
    const own = await signIn(s, attacker, ATTACKER);
    const sees = (await s.api('/me', { cookie: cookieOf(own), ip: ATTACKER })).json.players.map(p => p.name);
    expect({ parentSignedInAsAttacker: !!victimCookie, attackerSees: sees }).toEqual({ parentSignedInAsAttacker: false, attackerSees: [] });
  });

  it('[H2] a student Google sign-in can only be finished by the browser that started it', async () => {
    const s = site(GOOGLE);
    const t = await s.teacher();
    const c = await s.classWith(t);
    // (open to any Google account, so it isn't the class's school domain that stops the attacker here)
    await s.api(`/teach/classes/${c.id}`, { method: 'PATCH', body: { settings: { google: 'on', domain: '' } }, cookie: t.token });
    const maria = c.rows.find(r => r.name === 'Maria');
    const attacker = { sub: 'g-attacker', given_name: 'Max' };
    const link = `/auth/google/callback?code=c1&state=${stateOf(await s.api('/auth/google/student', { ip: ATTACKER }))}`;
    // Maria opens the link in her browser, which never started a sign-in: no ticket comes back, so her game
    // can't go on to put the attacker's Google account on her (class code, her name, her two pictures)
    const back = await asGoogle(attacker, () => s.api(link, { ip: FAMILY }));
    const ticket = ticketOf(back);
    if ((await s.api('/class/google', { method: 'POST', body: { ticket }, ip: FAMILY })).json?.status === 'code') {
      await s.api('/class/google/join', { method: 'POST', body: { ticket, code: c.code, student: maria.id, pics: maria.pair }, ip: FAMILY });
    }
    // later, the attacker signs in with Google on their own computer: not into Maria's player
    const mine = ticketOf(await signIn(s, attacker, ATTACKER, 'student'));
    const got = await s.api('/class/google', { method: 'POST', body: { ticket: mine }, ip: ATTACKER });
    expect({ ticketInMariasBrowser: back.headers.get('location').includes('#classgoogle='), attackerGetsMariasPlayer: got.json?.code === maria.player })
      .toEqual({ ticketInMariasBrowser: false, attackerGetsMariasPlayer: false });
  });

  it('[L1] only a verified Google email can make an admin', async () => {
    const s = site({ ...GOOGLE, ADMIN_EMAILS: 'boss@example.com' });
    const back = await signIn(s, { sub: 'g-someone', email: 'boss@example.com', email_verified: false, name: 'Not Boss' }, ATTACKER);
    expect((await s.api('/admin/problems', { cookie: cookieOf(back), ip: ATTACKER })).status).toBe(403);
  });

  it('Microsoft, not set up: nothing starts, its return address asks no one and signs no one in, and there is no Microsoft student sign-in', async () => {
    const s = site(GOOGLE);
    expect((await s.api('/config')).json).toEqual({ google: true, microsoft: false });
    await asGoogle({ sub: 'x' }, async (asked) => {
      expect((await s.api('/auth/microsoft/start')).status).toBe(503);
      const cb = await s.api('/auth/microsoft/callback?code=c&state=s');
      expect([cb.status, cb.headers.get('location'), cb.headers.get('set-cookie')]).toEqual([302, 'https://fancyant.com/keypals/#signin=unavailable', null]);
      expect((await s.api('/auth/microsoft/student')).status).toBe(404);
      expect(asked).toEqual([]);
    });
    expect(s.count('SELECT count(*) AS n FROM sign_ins')).toBe(0);
    // half set up (an id, no secret) is still not set up
    expect((await site({ MS_CLIENT_ID: 'id' }).api('/auth/microsoft/start')).status).toBe(503);
  });

  it('no open redirects: sign-in, the old /keypals2 address and www.keypals.org all land on our own address', async () => {
    const s = site(GOOGLE);
    const to = new URL((await s.api('/auth/google/start')).headers.get('location'));
    expect([to.origin, to.searchParams.get('redirect_uri'), to.searchParams.get('code_challenge_method')])
      .toEqual(['https://accounts.google.com', 'https://fancyant.com/keypals/api/auth/google/callback', 'S256']);
    const cb = await s.api('/auth/google/callback?code=c&state=x&redirect_uri=https://evil.example&next=//evil.example');
    expect(new URL(cb.headers.get('location')).host).toBe('fancyant.com');
    const old = await worker.fetch(new Request('https://fancyant.com/keypals2//evil.example/x?y=1'), s.env);
    expect(new URL(old.headers.get('location')).host).toBe('fancyant.com');
    const www = await worker.fetch(new Request('https://www.keypals.org//evil.example/'), { REDIRECT_TO: 'https://keypals.org' });
    expect(new URL(www.headers.get('location')).host).toBe('keypals.org');
  });

  it('admin needs a Google sign-in on the list: no cookie, a parent, a teacher, or the same email through another sign-in get nothing', async () => {
    const s = site({ ADMIN_EMAILS: 'boss@example.com' });
    const parent = await s.grownup('mum@example.com'), t = await s.teacher(), dev = await s.grownup('boss@example.com', 'dev');
    for (const [path, method] of [['/admin/ideas', 'GET'], ['/admin/problems', 'GET'], ['/admin/stats', 'GET'], ['/admin/teachers', 'GET'], [`/admin/teachers/${t.id}`, 'POST'], ['/admin/ideas/1', 'DELETE'], ['/admin/problems/1', 'POST']]) {
      for (const cookie of [undefined, parent.token, t.token, dev.token]) expect((await s.api(path, { method, body: { status: 'approved' }, cookie })).status).toBe(403);
    }
  });
});

// ---------------------------------------------------------------------------------------------------
describe('one family and another', () => {
  it("another grown-up cannot read, take, unfile, delete everywhere or stop saving a player kept in someone else's account", async () => {
    const s = site();
    const a = await s.grownup('a@example.com'), b = await s.grownup('b@example.com');
    const { json: { code } } = await s.api('/players', { method: 'POST', body: { profile: { name: 'Mia' } }, cookie: a.token });
    expect((await s.api(`/me/players/${code}`, { cookie: b.token })).status).toBe(404);
    expect((await s.api(`/me/players/${code}`, { method: 'PUT', cookie: b.token })).status).toBe(404);
    expect((await s.api(`/me/players/${code}`, { method: 'DELETE', cookie: b.token })).status).toBe(404);
    expect((await s.api(`/me/players/${code}/everywhere`, { method: 'DELETE', cookie: b.token })).status).toBe(404);
    expect((await s.api(`/players/${code}`, { method: 'DELETE', cookie: b.token })).status).toBe(403);
    expect((await s.api('/me', { cookie: b.token })).json.players).toEqual([]);
    expect((await s.api('/me', { cookie: a.token })).json.players.map(p => p.code)).toEqual([code]);
  });

  it("[H1] a grown-up cannot take a family's saved player into their own account by its code alone", async () => {
    const s = site();
    const thief = await s.grownup('thief@example.com');
    // a family saves a player online without signing in (the usual way: the code is on that computer)
    const { json: { code } } = await s.api('/players', { method: 'POST', body: { profile: { name: 'Mia', buddy: 'dino', settings: {} } }, ip: FAMILY });
    const claim = await s.api(`/me/players/${code}`, { method: 'PUT', cookie: thief.token, ip: ATTACKER });
    const listed = (await s.api('/me', { cookie: thief.token, ip: ATTACKER })).json.players.map(p => p.name);
    const full = await s.api(`/me/players/${code}`, { cookie: thief.token, ip: ATTACKER });
    const familyStops = await s.api(`/players/${code}`, { method: 'DELETE', ip: FAMILY });
    await s.api(`/me/players/${code}/everywhere`, { method: 'DELETE', cookie: thief.token, ip: ATTACKER });
    const familyOpens = await s.api(`/players/${code}`, { ip: FAMILY });
    expect({ claim: claim.status, listed, profile: full.json?.profile?.name ?? null, familyStops: familyStops.status, familyOpens: familyOpens.status })
      .toEqual({ claim: 404, listed: [], profile: null, familyStops: 200, familyOpens: 404 });
  });

  it('[H1] taking players by code is limited like opening them (60 an hour), so a signed-in grown-up cannot guess codes faster', async () => {
    const s = site();
    const thief = await s.grownup('thief@example.com');
    const statuses = [];
    for (let i = 0; i < 150; i++) statuses.push((await s.api(`/me/players/NOPE-${i}-ZZ-${10 + (i % 90)}`, { method: 'PUT', cookie: thief.token, ip: ATTACKER })).status);
    expect({ refusedAsTooMany: statuses.filter(x => x === 429).length }).toEqual({ refusedAsTooMany: 90 });
  });

  it("[H1] a family's own computers still file their players: saved with a code and signed in later, or a code typed on a new computer (opening it gives the time)", async () => {
    const s = site();
    const pat = await s.grownup('pat@example.com'), other = await s.grownup('other@example.com');
    const file = (code, updated, who = pat, ip = FAMILY) => s.api(`/me/players/${code}`, { method: 'PUT', body: { updated }, cookie: who.token, ip });
    // saved with a code on this computer, played and saved again; later the grown-up signs in here, and the
    // game sends the time of the copy it has
    const mia = (await s.api('/players', { method: 'POST', body: { profile: { name: 'Mia' } }, ip: FAMILY })).json;
    const saved = (await s.api(`/players/${mia.code}`, { method: 'PUT', body: { profile: { name: 'Mia', stars: 3 }, base: mia.updated }, ip: FAMILY })).json;
    expect((await file(mia.code, mia.updated)).status).toBe(404); // an older copy's time isn't the saved copy's
    expect((await file(mia.code, saved.updated)).status).toBe(200);
    expect((await file(mia.code, saved.updated)).status).toBe(200); // again: it's in the account already
    // a new computer: the grown-up types Leo's code, the game opens it (the player and its time) and files it
    const leo = (await s.api('/players', { method: 'POST', body: { profile: { name: 'Leo' } }, ip: FAMILY })).json.code;
    const opened = await s.api(`/players/${leo}`, { ip: '10.9.9.9' });
    expect((await file(leo, opened.json.updated, pat, '10.9.9.9')).status).toBe(200);
    expect((await s.api('/me', { cookie: pat.token })).json.players.map(p => p.name).sort()).toEqual(['Leo', 'Mia']);
    // in someone's account already: nobody else can file it, even with the right time
    expect((await file(leo, opened.json.updated, other)).status).toBe(404);
    // and only a player in your own account can be taken out of it
    expect((await s.api(`/me/players/${leo}`, { method: 'DELETE', cookie: other.token })).status).toBe(404);
    expect((await s.api(`/me/players/${leo}`, { method: 'DELETE', cookie: pat.token })).status).toBe(200);
  });

  it("[L2] a save must hold a player: a null profile is refused, so whoever has one code cannot break the family's list", async () => {
    const s = site();
    const a = await s.grownup();
    const { json: { code, updated } } = await s.api('/players', { method: 'POST', body: { profile: { name: 'Mia' } }, cookie: a.token });
    const put = await s.api(`/players/${code}`, { method: 'PUT', body: { profile: null, updated: updated + 1000 }, ip: ATTACKER });
    const list = await s.api('/me', { cookie: a.token });
    expect({ put: put.status, familyList: list.status }).toEqual({ put: 400, familyList: 200 });
  });

  it("[L5] the family board answers only the family's own grown-up, signed in: one child's code alone, another family's sign-in or a code in no account get nothing", async () => {
    const s = site();
    const pat = await s.grownup('pat@example.com'), other = await s.grownup('other@example.com');
    const save = async (name, who) => (await s.api('/players', { method: 'POST', body: { profile: { name, buddy: 'dino' } }, cookie: who?.token, ip: FAMILY })).json.code;
    const mia = await save('Mia', pat), leo = await save('Leo', pat), ivy = await save('Ivy'); // Ivy: saved with a code, in no account
    for (const code of [mia, leo, ivy]) expect((await s.api(`/class/week/${code}`, { method: 'PUT', body: { week: WEEK, right: 10, ms: 60000, stars: 3 }, ip: FAMILY })).status).toBe(200);
    const board = (code, who, ip) => s.api(`/family/${code}?week=${WEEK}`, { cookie: who?.token, ip });
    // the family's own computer, where Pat signed in: Pat's players
    const own = await board(mia, pat, FAMILY);
    expect([own.status, own.json.players.map(x => [x.name, x.me]).sort()]).toEqual([200, [['Leo', false], ['Mia', true]]]);
    // anyone else with Mia's code
    const nobody = await board(mia, null, ATTACKER);
    expect([nobody.status, nobody.text]).toEqual([401, JSON.stringify({ error: 'Please sign in first.' })]);
    const missing = await board('NOPE-NOPE-NOPE-1', other, ATTACKER), answer = [missing.status, missing.text];
    expect(answer).toEqual([404, JSON.stringify({ error: 'That save code no longer exists.' })]);
    const stranger = await board(mia, other, ATTACKER), noAccount = await board(ivy, other, ATTACKER), notPats = await board(ivy, pat, FAMILY);
    expect({ stranger: [stranger.status, stranger.text], noAccount: [noAccount.status, noAccount.text], notPats: [notPats.status, notPats.text] })
      .toEqual({ stranger: answer, noAccount: answer, notPats: answer });
  });
});

// ---------------------------------------------------------------------------------------------------
describe('classes: other teachers, children, outsiders', () => {
  it("teacher A cannot read or change teacher B's class, students, class work or challenge", async () => {
    const s = site();
    const a = await s.teacher('Mr. Ames'), b = await s.teacher('Ms. Bell');
    const cb = await s.classWith(b, 'Maria\nSam');
    const st = cb.rows[0];
    const work = await s.api(`/teach/classes/${cb.id}/assignments`, { method: 'POST', body: { data: { what: 'typing', lessons: ['home-row'], goal: { type: 'minutes', n: 10 } } }, cookie: b.token });
    expect(work.status).toBe(200);
    const aid = work.json.assignment.id, job = { data: { what: 'typing', lessons: ['x'], goal: { type: 'minutes', n: 1 } } };
    const asA = (path, method = 'GET', body) => s.api(path, { method, body, cookie: a.token }).then(r => r.status);
    const tries = {
      getClass: await asA(`/teach/classes/${cb.id}?week=${WEEK}`),
      patchClass: await asA(`/teach/classes/${cb.id}`, 'PATCH', { name: 'Mine now', settings: { google: 'on', domain: '' } }),
      addStudent: await asA(`/teach/classes/${cb.id}/students`, 'POST', { text: 'Intruder' }),
      profiles: await asA(`/teach/classes/${cb.id}/profiles`),
      addWork: await asA(`/teach/classes/${cb.id}/assignments`, 'POST', job),
      startChallenge: await asA(`/teach/classes/${cb.id}/challenge`, 'POST', { week: WEEK }),
      leaveChallenge: await asA(`/teach/classes/${cb.id}/challenge`, 'DELETE'),
      deleteClass: await asA(`/teach/classes/${cb.id}`, 'DELETE', { confirm: 'Room 12' }),
      renameStudent: await asA(`/teach/students/${st.id}`, 'PATCH', { name: 'Bob' }),
      newPictures: await asA(`/teach/students/${st.id}/pics`, 'POST'),
      approve: await asA(`/teach/students/${st.id}/approve`, 'POST'),
      removeStudent: await asA(`/teach/students/${st.id}`, 'DELETE'),
      changeWork: await asA(`/teach/assignments/${aid}`, 'PUT', job),
      deleteWork: await asA(`/teach/assignments/${aid}`, 'DELETE'),
    };
    expect(tries).toEqual(Object.fromEntries(Object.keys(tries).map(k => [k, 404])));
    const mine = await s.api(`/teach/classes/${cb.id}`, { cookie: b.token });
    expect([mine.json.class.name, mine.json.students.map(x => x.name).sort(), mine.json.assignments.length]).toEqual(['Room 12', ['Maria', 'Sam'], 1]);
    expect(mine.json.students.find(x => x.id === st.id).pics).toEqual(st.pair);
    expect((await s.api('/teach/classes', { cookie: a.token })).json.classes).toEqual([]);
  });

  it("teacher routes need a signed-in teacher: a student's game or a parent gets nothing", async () => {
    const s = site();
    const t = await s.teacher();
    const c = await s.classWith(t);
    const parent = await s.grownup('mum@example.com');
    for (const [path, method] of [['/teach/classes', 'GET'], [`/teach/classes/${c.id}`, 'GET'], [`/teach/classes/${c.id}/profiles`, 'GET'], [`/teach/students/${c.rows[0].id}/pics`, 'POST']]) {
      expect((await s.api(path, { method })).status).toBe(401);
      expect((await s.api(path, { method, cookie: parent.token })).status).toBe(403);
    }
    expect((await s.api('/teach/me')).json).toEqual({ signedIn: false });
  });

  it("a class code shows first names, buddies and student ids: never pictures, save codes, emails or the school's domain", async () => {
    const s = site();
    const t = await s.teacher();
    const c = await s.classWith(t);
    const page = await s.api(`/class/${c.code}`);
    expect(page.status).toBe(200);
    // (google: whether its students may sign in with Google, true or false: never the school's domain, below)
    expect(Object.keys(page.json.class).sort()).toEqual(['google', 'grade', 'name', 'teacher']);
    expect(typeof page.json.class.google).toBe('boolean');
    expect(page.json.students.map(x => Object.keys(x).sort().join())).toEqual(Array(3).fill('buddy,id,name'));
    for (const r of c.rows) expect(page.text).not.toContain(r.player);
    expect(page.text).not.toMatch(/@|pics|school\.test/);
  });

  it("a student's save code shows only their own class; another class's children can't be reached through it, and the family unlink can't remove a class's own student", async () => {
    const s = site();
    const t1 = await s.teacher('Ms. One'), t2 = await s.teacher('Mr. Two');
    const a = await s.classWith(t1, 'Maria\nSam', 'Room A'), b = await s.classWith(t2, 'Ana\nBen', 'Room B');
    const maria = a.rows.find(r => r.name === 'Maria'), ana = b.rows.find(r => r.name === 'Ana');
    const me = await s.api(`/class/${a.code}/login`, { method: 'POST', body: { student: maria.id, pics: maria.pair } });
    expect(me.json.code).toBe(maria.player);
    const mine = await s.api(`/class/student/${me.json.code}?week=${WEEK}`);
    expect(mine.json.classes.map(x => x.name)).toEqual(['Room A']);
    expect(JSON.stringify(mine.json)).not.toMatch(/Room B|Ana|Ben/);
    expect((await s.api(`/class/${a.code}/login`, { method: 'POST', body: { student: ana.id, pics: ana.pair } })).status).toBe(404);
    expect((await s.api(`/class/${b.code}/login`, { method: 'POST', body: { student: maria.id, pics: maria.pair } })).status).toBe(404);
    expect((await s.api(`/class/${b.code}`)).text).not.toContain(ana.player);
    expect((await s.api('/class/link', { method: 'DELETE', body: { player: maria.player, class: a.id } })).status).toBe(404);
  });

  it("[H3] a stranger's Google account cannot put itself on a class roster without the teacher saying yes", async () => {
    const s = site(GOOGLE);
    const t = await s.teacher();
    const c = await s.classWith(t); // the class as made: its settings untouched
    const ticket = ticketOf(await signIn(s, { sub: 'g-stranger', given_name: 'Zed', email: 'zed@gmail.com' }, ATTACKER, 'student'));
    const join = await s.api('/class/google/join', { method: 'POST', body: { ticket, code: c.code }, ip: ATTACKER });
    const roster = (await s.api(`/class/${c.code}`)).json.students.map(x => x.name).sort();
    const sees = join.json?.code ? (await s.api(`/class/student/${join.json.code}?week=${WEEK}`, { ip: ATTACKER })).json.classes[0]?.rows.map(r => r.name).sort() : [];
    expect({ join: join.status, roster, strangerSeesBoard: sees }).toEqual({ join: 403, roster: ['Ana', 'Maria', 'Sam'], strangerSeesBoard: [] });
  });

  it("[H3] a teacher with no school domain: students' Google sign-in starts off; turned on, a new name from Google waits for the teacher's yes", async () => {
    const s = site(GOOGLE);
    const lee = await s.grownup('mr.lee@gmail.com'); // a plain Gmail account: no school domain
    await s.api('/teach/me', { method: 'POST', body: { display: 'Mr. Lee', agree: true }, cookie: lee.token });
    await s.env.DB.prepare("UPDATE teacher_status SET status = 'approved' WHERE account = ?").bind(lee.id).run(); // an admin said yes
    const c = await s.classWith(lee);
    const zed = async () => ticketOf(await signIn(s, { sub: 'g-zed', given_name: 'Zed', email: 'zed@gmail.com' }, ATTACKER, 'student'));
    const join = async () => s.api('/class/google/join', { method: 'POST', body: { ticket: await zed(), code: c.code }, ip: ATTACKER });
    expect((await join()).json.error).toMatch(/hasn't turned on Google sign-in/);
    await s.api(`/teach/classes/${c.id}`, { method: 'PATCH', body: { settings: { google: 'on' } }, cookie: lee.token });
    const asked = await join(), again = await join();
    expect([asked.status, asked.json.pending, asked.json.code, again.json.pending]).toEqual([403, true, undefined, true]);
    expect((await s.api(`/class/${c.code}`)).json.students.map(x => x.name).sort()).toEqual(['Ana', 'Maria', 'Sam']);
    const waiting = (await s.api(`/teach/classes/${c.id}`, { cookie: lee.token })).json.students.filter(x => x.status === 'pending');
    expect(waiting.map(x => [x.name, x.google])).toEqual([['Zed', true]]); // one request, on the Students tab
    // the teacher says yes: from then on Google alone takes Zed in
    await s.api(`/teach/students/${waiting[0].id}/approve`, { method: 'POST', body: {}, cookie: lee.token });
    expect((await s.api('/class/google', { method: 'POST', body: { ticket: await zed() }, ip: ATTACKER })).json).toMatchObject({ status: 'in', name: 'Zed' });
  });

  it('[H4] picture passwords hold when all 240 guesses arrive at once (database with D1-like round trips)', async () => {
    const s = site({}, slowD1());
    const t = await s.teacher();
    const c = await s.classWith(t, 'Maria');
    const maria = c.rows[0];
    // (her pair is the last one guessed, so the few guesses that get looked at are wrong whatever her pictures)
    await s.env.DB.prepare("UPDATE students SET pics = '15,14' WHERE id = ?").bind(maria.id).run();
    const all = [];
    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) if (x !== y) all.push([x, y]);
    const answers = await Promise.all(all.map((pics, i) => s.api(`/class/${c.code}/login`, { method: 'POST', body: { student: maria.id, pics }, ip: `10.1.0.${i % 8}` })));
    const inAs = answers.filter(r => r.status === 200).map(r => (r.json.code === maria.player ? 'Maria' : r.json.code));
    // eight addresses get five tries each, but all of them together only PIC_TRIES_ALL (10): the rest are told to rest
    expect({ guesses: all.length, loggedInAs: inAs, looked: answers.filter(r => r.status === 403).length, rests: answers.filter(r => r.status === 429).length })
      .toEqual({ guesses: 240, loggedInAs: [], looked: 10, rests: 230 });
  });

  it("one guess at a time, five wrong pictures earn that child a ten-minute rest: any student's pair (240 possible) still falls within 8 hours, from any address", async () => {
    const s = site();
    const t = await s.teacher();
    const c = await s.classWith(t, 'Maria');
    const maria = c.rows[0];
    let clock = Date.now();
    const start = clock, spy = vi.spyOn(Date, 'now').mockImplementation(() => clock);
    try {
      let tries = 0, rests = 0, found = null;
      outer: for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) {
        if (x === y) continue;
        for (;;) {
          tries++;
          const r = await s.api(`/class/${c.code}/login`, { method: 'POST', body: { student: maria.id, pics: [x, y] }, ip: `10.2.0.${tries % 250}` });
          if (r.status === 429) { rests++; clock += 10 * 60000 + 1; continue; }
          if (r.status === 200) { found = r.json.code; break outer; }
          break;
        }
      }
      const hours = (clock - start) / 3600000;
      console.log(`pictures ${maria.pics}: found after ${tries} tries and ${rests} rests, ${hours.toFixed(2)} hours`);
      expect(found).toBe(maria.player);
      expect(hours).toBeLessThanOrEqual(8.01);
    } finally { spy.mockRestore(); }
  });

  it("[L3] a child cannot be locked out of their pictures by someone else's wrong guesses", async () => {
    const s = site();
    const t = await s.teacher();
    const c = await s.classWith(t, 'Maria');
    const maria = c.rows[0], wrong = [(maria.pair[0] + 1) % 16, (maria.pair[0] + 2) % 16];
    for (let i = 0; i < 5; i++) await s.api(`/class/${c.code}/login`, { method: 'POST', body: { student: maria.id, pics: wrong }, ip: ATTACKER });
    expect((await s.api(`/class/${c.code}/login`, { method: 'POST', body: { student: maria.id, pics: maria.pair }, ip: FAMILY })).status).toBe(200);
  });

  it("[L9] challenge codes can't be found by trying: a wrong code and one that's over get one answer, a teacher's tries are limited, and another class's id is never shown", async () => {
    const s = site();
    const a = await s.teacher('Ms. Ames'), b = await s.teacher('Mr. Bell');
    const ca = await s.classWith(a, 'Maria', 'Room A'), cb = await s.classWith(b, 'Sam', 'Room B');
    const code = (await s.api(`/teach/classes/${ca.id}/challenge`, { method: 'POST', body: { week: WEEK }, cookie: a.token })).json.challenge.code;
    await s.env.DB.prepare("INSERT INTO challenges (id, code, week, created, owner) VALUES ('ch-old', 'OWL-FERN-12', '2026-01-05', 0, ?)").bind(ca.id).run();
    const join = (c) => s.api(`/teach/classes/${cb.id}/challenge/join`, { method: 'POST', body: { code: c }, cookie: b.token });
    const wrong = await join('NOPE-NOPE-11'), over = await join('OWL-FERN-12');
    expect([over.status, over.json.error]).toEqual([wrong.status, wrong.json.error]);
    const ok = await join(code);
    expect(ok.json.challenge.classes.map(x => x.name).sort()).toEqual(['Room A', 'Room B']);
    expect(ok.json.challenge.classes.find(x => x.name === 'Room B').id).toBe(cb.id); // its own, to show which is theirs
    expect(JSON.stringify(ok.json)).not.toContain(ca.id);
    let n = 3;
    while ((await join('NOPE-NOPE-11')).status !== 429) n++;
    expect(n).toBe(20);
  });

  it("[L7] a family must show it really is a classmate (the child's two pictures) before that classmate's player is swapped for theirs", async () => {
    const s = site();
    const t = await s.teacher();
    const c = await s.classWith(t);
    const maria = c.rows.find(r => r.name === 'Maria');
    // anyone with a saved player and the class code says "this is Maria"; no pictures are asked
    const { json: { code: theirs } } = await s.api('/players', { method: 'POST', body: { profile: { name: 'Not Maria', buddy: 'dino' } }, ip: ATTACKER });
    const link = await s.api('/class/link', { method: 'POST', body: { player: theirs, code: c.code, claims: maria.id }, ip: ATTACKER });
    // the teacher sees a request from home named "Maria" and says yes
    const ask = (await s.api(`/teach/classes/${c.id}`, { cookie: t.token })).json.students.find(x => x.status === 'pending');
    if (ask) await s.api(`/teach/students/${ask.id}/approve`, { method: 'POST', body: {}, cookie: t.token });
    const login = await s.api(`/class/${c.code}/login`, { method: 'POST', body: { student: maria.id, pics: maria.pair } });
    const requester = (await s.api(`/class/student/${theirs}?week=${WEEK}`, { ip: ATTACKER })).json.classes.map(x => x.name);
    expect({ link: link.status, teacherSaw: ask?.name ?? null, mariaPlaysAs: login.json?.code === theirs ? "the requester's player" : 'her own', requesterSeesClass: requester })
      .toEqual({ link: 403, teacherSaw: null, mariaPlaysAs: 'her own', requesterSeesClass: [] });
  });

  it("[L7] with the classmate's two pictures a family's link asks the teacher as before; a wrong pair is refused like a wrong login and counts with the login's tries", async () => {
    const s = site();
    const t = await s.teacher();
    const c = await s.classWith(t);
    const maria = c.rows.find(r => r.name === 'Maria'), backwards = [maria.pair[1], maria.pair[0]];
    const save = async (name, ip) => (await s.api('/players', { method: 'POST', body: { profile: { name, buddy: 'dino' } }, ip })).json.code;
    const home = await save('Mimi', FAMILY), theirs = await save('Not Maria', ATTACKER);
    const link = (player, pics, ip) => s.api('/class/link', { method: 'POST', body: { player, code: c.code, claims: maria.id, pics }, ip });
    // her two pictures the wrong way round: the class login's answer, and a try counted for Maria
    const wrong = await link(home, backwards, FAMILY);
    expect([wrong.status, wrong.json]).toEqual([403, { error: 'Not quite! Try your two pictures again.', wrong: true }]);
    expect(s.count('SELECT n FROM limits WHERE key = ?', `pics:${maria.id}`)).toBe(1);
    // the right pair: a request from home, waiting for the teacher's yes
    expect((await link(home, maria.pair, FAMILY)).json).toEqual({ ok: true, status: 'pending', class: { name: 'Room 12' } });
    const asks = (await s.api(`/teach/classes/${c.id}`, { cookie: t.token })).json.students.filter(x => x.status === 'pending');
    expect(asks.map(x => [x.name, x.claims])).toEqual([['Maria', maria.id]]);
    // someone guessing: after five wrong pairs that address rests, for the link and for Maria's login alike
    for (let i = 0; i < 5; i++) expect((await link(theirs, backwards, ATTACKER)).status).toBe(403);
    expect((await link(theirs, maria.pair, ATTACKER)).status).toBe(429);
    expect((await s.api(`/class/${c.code}/login`, { method: 'POST', body: { student: maria.id, pics: maria.pair }, ip: ATTACKER })).status).toBe(429);
    // Maria herself still logs in at school, and nobody else's request is waiting
    expect((await s.api(`/class/${c.code}/login`, { method: 'POST', body: { student: maria.id, pics: maria.pair } })).json.code).toBe(maria.player);
    expect(s.count("SELECT count(*) AS n FROM students WHERE status = 'pending'")).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------
describe('rate limits and code guessing', () => {
  it("the limit goes by Cloudflare's cf-connecting-ip only: X-Forwarded-For, X-Real-IP, True-Client-IP or Forwarded give no fresh budget", async () => {
    const s = site();
    for (let i = 0; i < 60; i++) await s.api(`/players/NOPE-NOPE-NOPE-${i}`, { ip: ATTACKER });
    for (const h of ['x-forwarded-for', 'x-real-ip', 'true-client-ip', 'forwarded']) {
      expect((await s.api('/players/NOPE-NOPE-NOPE-99', { ip: ATTACKER, headers: { [h]: '198.51.100.1' } })).status).toBe(429);
    }
  });

  it('[M1] addresses in one IPv6 /64 (one home, one cheap server) share one limit', async () => {
    const s = site();
    for (let i = 0; i < 60; i++) await s.api(`/players/NOPE-NOPE-NOPE-${i}`, { ip: '2001:db8:1:2::1' });
    expect((await s.api('/players/NOPE-NOPE-NOPE-99', { ip: '2001:db8:1:2::1' })).status).toBe(429);
    expect((await s.api('/players/NOPE-NOPE-NOPE-99', { ip: '2001:db8:1:2::2' })).status).toBe(429);
  });

  it('[H4] an address cannot get past a limit by sending its requests all at once (database with D1-like round trips)', async () => {
    const s = site({}, slowD1());
    const answers = await Promise.all(Array.from({ length: 200 }, (_, i) => s.api(`/players/NOPE-NOPE-NOPE-${i}`, { ip: ATTACKER })));
    expect({ answeredOf200: answers.filter(r => r.status !== 429).length }).toEqual({ answeredOf200: 60 });
  });

  it('[M1] once an address has used its 60 save-code tries for the hour, no other route will check a save code for it', async () => {
    const s = site();
    const nope = (i) => `NOPE-NOPE-NOPE-${i}`;
    // (the family board looks a code up only for a signed-in grown-up)
    const signedIn = await s.grownup('someone@example.com');
    let n = 0;
    while ((await s.api(`/players/${nope(n)}`, { ip: ATTACKER })).status !== 429) n++;
    const other = {
      savePlayer: (await s.api(`/players/${nope(n + 1)}`, { method: 'PUT', body: { profile: {}, base: 1 }, ip: ATTACKER })).status,
      saveWeek: (await s.api(`/class/week/${nope(n + 2)}`, { method: 'PUT', body: { week: WEEK, right: 1 }, ip: ATTACKER })).status,
      familyBoard: (await s.api(`/family/${nope(n + 3)}?week=${WEEK}`, { cookie: signedIn.token, ip: ATTACKER })).status,
      stopSaving: (await s.api(`/players/${nope(n + 4)}`, { method: 'DELETE', ip: ATTACKER })).status,
    };
    expect({ opensBefore429: n, ...other }).toEqual({ opensBefore429: 60, savePlayer: 429, saveWeek: 429, familyBoard: 429, stopSaving: 429 });
  });

  it('[M1] once an address has used its 600 class-code tries for the hour, every route that looks up a class code says "too many"', async () => {
    const s = site(GOOGLE);
    const nope = (i) => `NOPE-ZZ-${10 + (i % 90)}-${i}`;
    let n = 0;
    while ((await s.api(`/class/${nope(n)}`, { ip: ATTACKER })).status !== 429) n++;
    const ticket = ticketOf(await signIn(s, { sub: 'g-x', given_name: 'Zed' }, ATTACKER, 'student'));
    const login = await s.api(`/class/${nope(n + 1)}/login`, { method: 'POST', body: { student: 'x', pics: [0, 1] }, ip: ATTACKER });
    const google = await s.api('/class/google/join', { method: 'POST', body: { ticket, code: nope(n + 2) }, ip: ATTACKER });
    expect({ opensBefore429: n, login: login.status, googleJoin: google.status }).toEqual({ opensBefore429: 600, login: 429, googleJoin: 429 });
  });
});

// ---------------------------------------------------------------------------------------------------
describe('what is kept about a child, and for how long', () => {
  it("a student's school Google sign-in keeps a hash of the Google id and the first name: never the id, email, last name or photo, and no grown-up account", async () => {
    const s = site(GOOGLE);
    const t = await s.teacher();
    const c = await s.classWith(t);
    await s.api(`/teach/classes/${c.id}`, { method: 'PATCH', body: { settings: { google: 'on', domain: 'school.test' } }, cookie: t.token });
    const me = { sub: 'google-sub-1234567890', given_name: 'Lena', family_name: 'Okafor', name: 'Lena Okafor', email: 'lena.okafor@school.test', email_verified: true, hd: 'school.test', picture: 'https://example.com/p.jpg' };
    const back = await signIn(s, me, FAMILY, 'student');
    expect(cookieOf(back)).toBeNull();
    const join = await s.api('/class/google/join', { method: 'POST', body: { ticket: ticketOf(back), code: c.code }, ip: FAMILY });
    expect(join.status).toBe(200);
    const all = JSON.stringify(Object.fromEntries(['accounts', 'sessions', 'students', 'players', 'student_google', 'google_tickets', 'account_domains', 'limits'].map(x => [x, s.env.DB.sqlite.prepare(`SELECT * FROM ${x}`).all()])));
    for (const bad of ['google-sub-1234567890', 'Okafor', 'lena.okafor', 'example.com/p.jpg']) expect(all).not.toContain(bad);
    expect(all).toContain('Lena');
    expect(s.count('SELECT count(*) AS n FROM google_tickets')).toBe(0);
    expect(s.count('SELECT count(*) AS n FROM accounts')).toBe(1); // the teacher's only
    // a school account from another domain is turned away when the class is kept to its school
    const other = await signIn(s, { sub: 'g-other', given_name: 'Kai', hd: 'other.test' }, FAMILY, 'student');
    expect((await s.api('/class/google/join', { method: 'POST', body: { ticket: ticketOf(other), code: c.code }, ip: FAMILY })).status).toBe(403);
  });

  it("the daily tidy-up keeps the notice's clocks: 18 months, 180 days, 3 years, 2 years, 30 and 60 days", async () => {
    const s = site();
    const db = s.env.DB.sqlite, now = Date.now(), day = (t) => new Date(t).toISOString().slice(0, 10);
    const keep = await s.grownup('keep@example.com');
    const player = db.prepare('INSERT INTO players (code, data, updated, created, opened, account) VALUES (?, ?, 0, 0, ?, ?)');
    player.run('OLD-FREE', '{}', now - 549 * DAY, null); player.run('OLD-KEPT', '{}', now - 549 * DAY, keep.id); player.run('RECENT', '{}', now - 500 * DAY, null);
    db.prepare('INSERT INTO sessions (hash, account, expires) VALUES (?, ?, ?)').run('h-old', keep.id, now - 1);
    db.prepare("INSERT INTO accounts (id, provider, sub, email, name, created, seen) VALUES ('old-acct', 'google', 'x', 'old@example.com', 'Old', 0, ?)").run(now - 3 * 365 * DAY - DAY);
    db.prepare("INSERT INTO gone (code, account, at) VALUES ('G-OLD', NULL, ?)").run(now - 3 * 365 * DAY - DAY);
    db.prepare("INSERT INTO ideas (kind, text, email, status, votes, created, updated) VALUES ('game', 'x', 'a@b.co', 'new', 0, ?, ?)").run(now - 181 * DAY, now);
    const problem = db.prepare("INSERT INTO problems (kind, text, email, sig, times, status, created, lastseen) VALUES (?, ?, ?, ?, 1, 'new', ?, ?)");
    problem.run('told', 'not seen for 181 days', 'a@b.co', null, now - 181 * DAY, now - 181 * DAY);
    problem.run('told', 'seen lately', 'c@d.co', null, now - 181 * DAY, now - DAY);
    problem.run('auto', 'old error seen lately', null, 'sig1', now - 400 * DAY, now - DAY);
    db.prepare("INSERT INTO counts (day, event, key, n) VALUES (?, 'open', 'phone', 1)").run(day(now - 731 * DAY));
    db.prepare("INSERT INTO world_scores (id, game, day, who, alias, buddy, score, at) VALUES ('w1', 'slalom', ?, 'h', 'Brave Otter', 'dino', 5, 0)").run(day(now - 31 * DAY));
    db.prepare("INSERT INTO students (id, class, name, player, pics, home, status, created) VALUES ('s-pend', 'c-x', 'Kim', 'P-X', '0,1', 1, 'pending', ?)").run(now - 61 * DAY);
    db.prepare("INSERT INTO google_tickets (hash, gid, name, hd, expires) VALUES ('t', 'g', 'Kim', NULL, ?)").run(now - 1);
    db.prepare("INSERT INTO limits (key, n, reset) VALUES ('open:x', 1, ?)").run(now - 1);
    await worker.scheduled({}, s.env);
    const col = (sql) => db.prepare(sql).all().map(r => Object.values(r).join('|'));
    expect({
      players: col('SELECT code FROM players ORDER BY code'), sessions: s.count('SELECT count(*) AS n FROM sessions'), accounts: col('SELECT id FROM accounts'),
      gone: col('SELECT code FROM gone'), ideaEmails: col('SELECT email FROM ideas'), problems: col('SELECT text, email FROM problems ORDER BY text'),
      counts: col('SELECT day FROM counts'), world: col('SELECT id FROM world_scores'), pending: col('SELECT id FROM students'), tickets: col('SELECT hash FROM google_tickets'), limits: col('SELECT key FROM limits'),
    }).toEqual({
      players: ['OLD-KEPT', 'RECENT'], sessions: 1, accounts: [keep.id], gone: [], ideaEmails: [''], problems: ['old error seen lately|', 'seen lately|'],
      counts: [], world: [], pending: [], tickets: [], limits: [],
    });
  });

  it('[M4] deleting a player deletes its weekly records (nickname, buddy, right answers, minutes, stars) too', async () => {
    const s = site();
    const a = await s.grownup();
    const make = async (name, cookie) => (await s.api('/players', { method: 'POST', body: { profile: { name, buddy: 'dino' } }, cookie })).json.code;
    const week = (code, name) => s.api(`/class/week/${code}`, { method: 'PUT', body: { week: WEEK, right: 40, ms: 600000, stars: 3, name, buddy: 'dino' } });
    const mia = await make('Mia'), leo = await make('Leo', a.token), ivy = await make('Ivy', a.token);
    for (const [c, n] of [[mia, 'Mia'], [leo, 'Leo'], [ivy, 'Ivy']]) expect((await week(c, n)).status).toBe(200);
    await s.api(`/players/${mia}`, { method: 'DELETE' }); // "Stop saving online"
    await s.api(`/me/players/${leo}/everywhere`, { method: 'DELETE', cookie: a.token }); // "Delete this player"
    await s.api('/me', { method: 'DELETE', body: { players: true }, cookie: a.token }); // "Delete my account", players too
    expect({ playersLeft: s.count('SELECT count(*) AS n FROM players'), weeksLeft: s.env.DB.sqlite.prepare('SELECT name FROM player_week ORDER BY name').all().map(r => r.name) })
      .toEqual({ playersLeft: 0, weeksLeft: [] });
  });

  it("[M2] deleting a teacher's account removes their classes and the children on them, and closes the class code", async () => {
    const s = site();
    const t = await s.teacher();
    const c = await s.classWith(t);
    expect((await s.api('/me', { method: 'DELETE', body: { players: true }, cookie: t.token })).status).toBe(200);
    const after = {
      classes: s.count('SELECT count(*) AS n FROM classes WHERE teacher = ?', t.id), students: s.count('SELECT count(*) AS n FROM students WHERE class = ?', c.id),
      teacher: s.count('SELECT count(*) AS n FROM teachers WHERE account = ?', t.id), teacherStatus: s.count('SELECT count(*) AS n FROM teacher_status WHERE account = ?', t.id),
      schoolDomain: s.count('SELECT count(*) AS n FROM account_domains WHERE account = ?', t.id),
      classPage: (await s.api(`/class/${c.code}`)).status,
      studentLogin: (await s.api(`/class/${c.code}/login`, { method: 'POST', body: { student: c.rows[0].id, pics: c.rows[0].pair } })).status,
    };
    expect(after).toEqual({ classes: 0, students: 0, teacher: 0, teacherStatus: 0, schoolDomain: 0, classPage: 404, studentLogin: 404 });
  });

  it("[M2] the 3-year tidy-up of an unused account takes the teacher's classes and rosters with it", async () => {
    const s = site();
    const t = await s.teacher();
    const c = await s.classWith(t);
    await s.env.DB.prepare('UPDATE accounts SET seen = ? WHERE id = ?').bind(Date.now() - 4 * 365 * DAY, t.id).run();
    await worker.scheduled({}, s.env);
    expect(s.count('SELECT count(*) AS n FROM accounts WHERE id = ?', t.id)).toBe(0);
    const names = s.env.DB.sqlite.prepare('SELECT name FROM students WHERE class = ?').all(c.id).map(r => r.name);
    expect({ namesKept: names, classPage: (await s.api(`/class/${c.code}`)).status }).toEqual({ namesKept: [], classPage: 404 });
  });

  gap("[M3] a class nobody has used for 18 months goes, the children's names and pictures with it", async () => {
    const s = site();
    const t = await s.teacher();
    const c = await s.classWith(t);
    const old = Date.now() - 19 * 30 * DAY;
    for (const sql of ['UPDATE players SET opened = ?, updated = ?, created = ?', 'UPDATE students SET created = ?, created = ?, created = ?', 'UPDATE classes SET created = ?, created = ?, created = ?', 'UPDATE accounts SET seen = ?, seen = ?, seen = ?']) {
      await s.env.DB.prepare(sql).bind(old, old, old).run();
    }
    await worker.scheduled({}, s.env);
    expect({ players: s.count('SELECT count(*) AS n FROM players'), students: s.env.DB.sqlite.prepare('SELECT name, pics FROM students WHERE class = ?').all(c.id).map(r => r.name) })
      .toEqual({ players: 0, students: [] });
  });

  it('[M5] a week far in the future is refused (or tidied away), so the boards\' records cannot pile up for ever', async () => {
    const s = site();
    const { json: { code } } = await s.api('/players', { method: 'POST', body: { profile: { name: 'Mia' } } });
    const put = await s.api(`/class/week/${code}`, { method: 'PUT', body: { week: '9999-12-27', right: 5, name: 'Mia' } });
    await worker.scheduled({}, s.env);
    expect({ put: put.status, left: s.count("SELECT count(*) AS n FROM player_week WHERE week = '9999-12-27'") }).toEqual({ put: 400, left: 0 });
  });

  it('[L4] the limits table holds no network address that can be worked back out', async () => {
    const s = site();
    await s.api('/players/NOPE-NOPE-NOPE-1', { ip: '192.0.2.77' });
    const keys = s.env.DB.sqlite.prepare('SELECT key FROM limits').all().map(r => r.key);
    let recovered = null; // a /24 here; all of IPv4 is 2^32 hashes: seconds on one graphics card
    for (let i = 0; i < 256 && !recovered; i++) if (keys.includes(`open:${await sha256(`192.0.2.${i}open`)}`)) recovered = `192.0.2.${i}`;
    expect({ recovered }).toEqual({ recovered: null });
  });
});

// ---------------------------------------------------------------------------------------------------
describe('input limits and headers', () => {
  it('bodies over the limit are refused and nothing is stored; deep JSON, a broken %-escape and SQL-looking codes get a plain error, not a crash', async () => {
    const s = site();
    expect((await s.api('/players', { method: 'POST', raw: JSON.stringify({ profile: { name: 'Mia', note: 'x'.repeat(400000) } }) })).status).toBe(400);
    const deep = await s.api('/players', { method: 'POST', raw: `{"profile":{"a":${'['.repeat(100000)}${']'.repeat(100000)}}}` });
    expect([400, 500]).toContain(deep.status);
    expect(deep.json.error).toBeTruthy();
    const bad = await s.api('/players/%E0%A4%A');
    expect([bad.status, typeof bad.json.error]).toEqual([500, 'string']);
    const sql = await s.api(`/players/${encodeURIComponent("x' OR '1'='1")}`);
    expect([sql.status, sql.json.missing]).toEqual([404, true]);
    expect(s.count('SELECT count(*) AS n FROM players')).toBe(0);
  });

  it('[M6] visit counts take only the kinds of keys the game sends, so one address cannot add thousands of made-up rows an hour', async () => {
    const s = site();
    const counts = Array.from({ length: 80 }, (_, i) => ({ e: 'screen', k: `made-up-${i}-${Math.random().toString(36).slice(2, 10)}`, n: 1 }));
    expect((await s.api('/count', { method: 'POST', body: { day: new Date().toISOString().slice(0, 10), counts } })).status).toBe(204);
    expect({ newRows: s.count('SELECT count(*) AS n FROM counts') }).toEqual({ newRows: 0 });
  });

  it('no CORS: no answer lets another site read it, a preflight finds nothing, and every answer is JSON that is not cached', async () => {
    const s = site();
    const me = await s.grownup();
    const evil = { origin: 'https://evil.example' };
    const pre = await s.api('/me', { method: 'OPTIONS', headers: { ...evil, 'access-control-request-method': 'DELETE' } });
    expect(pre.status).toBe(404);
    for (const r of [pre, await s.api('/me', { cookie: me.token, headers: evil }), await s.api('/players/NOPE-NOPE-NOPE-1', { headers: evil })]) {
      expect([r.headers.get('access-control-allow-origin'), r.headers.get('access-control-allow-credentials'), r.headers.get('content-type'), r.headers.get('cache-control')])
        .toEqual([null, null, 'application/json', 'no-store']);
    }
  });

  it('[L6] a write from another site (a text/plain POST, which a browser sends without asking first) is refused', async () => {
    const s = site();
    const r = await s.api('/ideas', { method: 'POST', raw: JSON.stringify({ kind: 'game', text: 'sent from evil.example' }), headers: { origin: 'https://evil.example', 'content-type': 'text/plain;charset=UTF-8' } });
    expect(r.status).toBe(403);
  });
});
