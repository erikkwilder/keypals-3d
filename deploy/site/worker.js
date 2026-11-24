// fancyant.com/keypals and keypals.org: files are served straight from storage before this ever runs. This
// script only sees what isn't a file. The same script runs as three Workers:
//   fancyant-keypals (wrangler.toml, BASE "/keypals"): fancyant.com/keypals/api/... and /keypals2 (the 3D
//     game's old test address, forwarded to /keypals); it also runs the daily tidy-up and weekly backup
//   keypals-org (wrangler-org.toml, BASE ""): keypals.org/api/..., the game at the root of the address
//   keypals-www (wrangler-www.toml, REDIRECT_TO): www.keypals.org sends everyone to keypals.org
// Both game addresses share one database (D1, bound as DB), so a save code or a grown-up's account works on
// either. BASE sets where the API lives, the sign-in cookie's Path and the sign-in return addresses.
//
// Saves: any player can get a save code (three words and a number). The code holds the game's own
// profile: a nickname, the chosen buddy, progress and settings. No emails or real names from
// children. Grown-ups (parents, teachers) can sign in with Google or Microsoft to keep several
// players together; that stores their email and name from the provider, nothing else.
//
// Two computers playing the same player: a save says which copy it was made from (`base`, the copy's
// `updated` time); if another computer saved since, the server answers "stale" and the game combines
// the two copies and saves again (src/lib/state/merge.ts). Nothing is overwritten blindly.
//
// Once a week (from the daily tidy-up) the players and accounts are copied to the R2 bucket bound as
// BACKUPS, kept 90 days by the bucket's own rule (restore: deploy/site/RESTORE.md).

import { classApi, classPlayerLimited, madeByClass, tidyClasses, CLASS_TABLES, noteSignIn, studentGoogleBack, hit, giveBack, deleteTeacher } from './classes.js'; // classes for teachers, and the boards

const WORDS = ('apple acorn anchor arrow badger bamboo banana basket beach beaver berry bird biscuit blossom boat bramble breeze brick bubble bucket bunny cactus camel candle canoe canyon carrot castle cedar cherry cloud clover coconut comet coral cotton crab crayon cricket crystal daisy desert dingo dolphin donut dragon drum duck eagle earth echo elm ember fable falcon feather fern fiddle finch flame flower forest fossil fox frog galaxy garden gecko ginger glacier globe goose grape gull hammock harbor harp hazel hedge heron hill honey hoop iceberg igloo island ivy jelly jungle kayak kettle kite kiwi koala ladder lagoon lake lantern lark leaf lemon lilac lily lime llama lotus lunar maple marble meadow melon meteor mint mitten moon moose moss mountain mouse muffin nectar nest noodle nutmeg oak oasis ocean olive orbit orchid otter owl paddle panda parrot peach peanut pear pebble pelican pepper petal piano pickle pine pixel planet plum pond poppy prairie pretzel puffin pumpkin quail quartz rabbit radish rain rainbow raven reef ribbon river robin rocket rose ruby saddle sail salmon sandal sapphire scarf seal seed shell sky sloth snail snow sparrow spruce squid star stone storm sugar summer sun swan taco tide tiger toad topaz tortoise trail tulip tuna turnip turtle tulip umbrella valley velvet violet volcano waffle walnut walrus water wave whale willow wind wombat yak yarn zebra zinnia').split(' ').filter((w, i, a) => a.indexOf(w) === i);
const DAY = 86400000;
const SESSION_DAYS = 180;

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });
const fail = (status, message) => json({ error: message }, status);

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const randomToken = (n = 32) => b64url(crypto.getRandomValues(new Uint8Array(n)));
const sha256 = async (text) => b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
function newCode() {
  const r = crypto.getRandomValues(new Uint32Array(4));
  const w = (i) => WORDS[r[i] % WORDS.length].toUpperCase();
  return `${w(0)}-${w(1)}-${w(2)}-${10 + (r[3] % 90)}`;
}
const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The address a limit goes by. An IPv6 address goes by its first 64 bits: a home, a phone or a rented server
 *  is given a whole /64, and each of its 2^64 addresses would otherwise get a limit of its own. */
function addressOf(request) {
  const ip = String(request.headers.get('cf-connecting-ip') || 'unknown').toLowerCase();
  const v4 = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4 || !ip.includes(':')) return v4 ? v4[1] : ip;
  const [head, tail] = ip.split('::'), a = head ? head.split(':') : [], b = tail ? tail.split(':') : [];
  const groups = tail === undefined ? a : [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b];
  return `${groups.slice(0, 4).map(g => (parseInt(g, 16) || 0).toString(16)).join(':')}::/64`;
}
/** Today's random value for scrambling addresses: a limits row of its own (`salt:` and the day), made by the
 *  first request of the day (UTC), the same for both game addresses (one database), and deleted once the day
 *  is over (classes.js hit). It's never in the code, so the limits table can't be worked back to addresses. */
let salt = { day: '', value: 0 };
async function todaysSalt(env) {
  const day = isoDay(Date.now());
  if (salt.day === day) return salt.value;
  const key = `salt:${day}`, r = crypto.getRandomValues(new Uint32Array(2));
  await env.DB.prepare('INSERT OR IGNORE INTO limits (key, n, reset) VALUES (?, ?, ?)').bind(key, (r[0] % 2 ** 21) * 2 ** 32 + r[1], Date.parse(day) + DAY).run();
  const row = await env.DB.prepare('SELECT n FROM limits WHERE key = ?').bind(key).first();
  salt = { day, value: row.n };
  return row.n;
}
/** An address as the limits table keeps it: scrambled with today's random value, never the address itself. */
const addressHash = async (env, request, what) => sha256(`${await todaysSalt(env)}:${addressOf(request)}:${what}`);

/** At most `max` calls per `minutes` from one address (only its scrambled hash is kept). Counted and checked
 *  in one statement (classes.js hit), so calls sent all at once can't all slip in under the limit. */
async function limited(env, request, what, max, minutes) {
  return hit(env, `${what}:${await addressHash(env, request, what)}`, max, minutes);
}

/** Every route that looks up a save code draws on one budget per address, the one opening a player uses
 *  (`open`, 60 an hour), and every route that looks up a class code on another (`cls-code`, 600 an hour), so
 *  no route is a faster way to guess codes than another. A try is counted before the code is looked up (tries
 *  sent all at once can't slip in under it) and given back when the code is found: call the answer then. So a
 *  family's or a class's own use never spends it, only codes that aren't there do. null: none left this hour. */
const CODE_TRIES = { open: 60, 'cls-code': 600 };
async function codeTry(env, request, what = 'open') {
  const key = `${what}:${await addressHash(env, request, what)}`;
  return (await hit(env, key, CODE_TRIES[what], 60)) ? null : () => giveBack(env, key);
}

/** Opening or saving a player: a class player counts by its code and class (a whole class shares one school
 *  address: classes.js), everyone else by address, saving on the save-code budget too (codeTry: opening is
 *  that budget). null when over a limit, else what to call once the code is found. */
async function playerTry(env, request, what, max, code) {
  const cls = await classPlayerLimited(env, what, code, sha256);
  if (cls !== null) return cls ? null : async () => {};
  if (await limited(env, request, what, max, 60)) return null;
  return what === 'open' ? async () => {} : codeTry(env, request);
}

// ---------- sign-in providers ----------
const PROVIDERS = {
  google: {
    id: (env) => env.GOOGLE_CLIENT_ID, secret: (env) => env.GOOGLE_CLIENT_SECRET,
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    userinfo: 'https://openidconnect.googleapis.com/v1/userinfo',
    extra: { prompt: 'select_account' },
  },
  microsoft: {
    id: (env) => env.MS_CLIENT_ID, secret: (env) => env.MS_CLIENT_SECRET,
    authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userinfo: 'https://graph.microsoft.com/oidc/userinfo',
    extra: { prompt: 'select_account' },
  },
};
const ready = (env, p) => !!(PROVIDERS[p] && PROVIDERS[p].id(env) && PROVIDERS[p].secret(env));
/** where this Worker's game lives: "/keypals" on fancyant.com, "" (the root) on keypals.org */
const baseOf = (env) => String(env.BASE ?? '/keypals').replace(/\/+$/, '');
const callbackUrl = (url, p, base) => `${url.origin}${base}/api/auth/${p}/callback`;

function cookie(name, value, maxAgeS, base) {
  return `${name}=${value}; Path=${base || '/'}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeS}`;
}
async function currentAccount(env, request) {
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)kp_session=([^;]+)/);
  if (!m) return null;
  const row = await env.DB.prepare('SELECT a.id, a.email, a.name, a.provider, s.expires FROM sessions s JOIN accounts a ON a.id = s.account WHERE s.hash = ?')
    .bind(await sha256(m[1])).first();
  if (!row || row.expires < Date.now()) return null;
  return row;
}

/** `student`: a student signing in with a school Google account (classes.js): the same return address, but
 *  it never becomes a grown-up's account */
async function startSignIn(env, url, p, base, student = false) {
  if (!ready(env, p)) return fail(503, 'This sign-in is not set up yet.');
  const P = PROVIDERS[p], state = randomToken(18), verifier = randomToken(48);
  await env.DB.prepare('DELETE FROM sign_ins WHERE created < ?').bind(Date.now() - 15 * 60000).run();
  await env.DB.prepare('INSERT INTO sign_ins (state, verifier, provider, created) VALUES (?, ?, ?, ?)').bind(state, verifier, student ? `${p}:student` : p, Date.now()).run();
  const q = new URLSearchParams({
    client_id: P.id(env), redirect_uri: callbackUrl(url, p, base), response_type: 'code', scope: 'openid email profile',
    state, code_challenge: await sha256(verifier), code_challenge_method: 'S256', ...P.extra,
  });
  // the state goes in a short-lived cookie too, for the sign-in's own addresses only: the return is taken only
  // in the browser that started it (finishSignIn)
  return new Response(null, { status: 302, headers: { location: `${P.authorize}?${q}`, 'set-cookie': cookie('kp_signin', state, 15 * 60, `${base}/api/auth`) } });
}

/** Back from the provider. Only the browser that started the sign-in can finish it (its cookie holds the
 *  state): a return link someone made at Google and then sent on, to a parent, a teacher or a child, signs
 *  nobody in as them. The cookie is cleared either way. */
async function finishSignIn(env, request, url, p, base) {
  if (!ready(env, p)) return Response.redirect(`${url.origin}${base}/#signin=unavailable`, 302);
  const state = url.searchParams.get('state');
  const mine = (request.headers.get('cookie') || '').match(/(?:^|;\s*)kp_signin=([^;]+)/)?.[1];
  const r = state && mine === state ? await signInBack(env, url, p, base) : Response.redirect(`${url.origin}${base}/#signin=${state ? 'expired' : 'cancelled'}`, 302);
  const out = new Response(null, { status: r.status, headers: { location: r.headers.get('location') } });
  out.headers.append('set-cookie', cookie('kp_signin', '', 0, `${base}/api/auth`));
  if (r.headers.get('set-cookie')) out.headers.append('set-cookie', r.headers.get('set-cookie'));
  return out;
}

async function signInBack(env, url, p, base) {
  const back = (msg) => Response.redirect(`${url.origin}${base}/#signin=${msg}`, 302);
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  if (!code || !state) return back('cancelled');
  const si = await env.DB.prepare('SELECT verifier, provider, created FROM sign_ins WHERE state = ?').bind(state).first();
  await env.DB.prepare('DELETE FROM sign_ins WHERE state = ?').bind(state).run();
  const student = !!si && si.provider === `${p}:student`;
  if (!si || (si.provider !== p && !student) || si.created < Date.now() - 15 * 60000) return back('expired');
  const P = PROVIDERS[p];
  const tok = await fetch(P.token, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: P.id(env), client_secret: P.secret(env), code, code_verifier: si.verifier, grant_type: 'authorization_code', redirect_uri: callbackUrl(url, p, base) }),
  }).then(r => r.json()).catch(() => null);
  if (!tok || !tok.access_token) return back('failed');
  const me = await fetch(P.userinfo, { headers: { authorization: `Bearer ${tok.access_token}` } }).then(r => r.json()).catch(() => null);
  // a student's school Google account: a one-time ticket back to the game; nothing is kept but a hash of the
  // account's id and the first name (classes.js), and there's no sign-in cookie
  if (student) return studentGoogleBack(env, url, base, me, { sha256, randomToken });
  if (!me || !me.sub) return back('failed');
  const now = Date.now();
  // a Google email is kept only when Google says it checked that it's this person's: an unchecked one could
  // be anyone's, an admin's too (isAdmin goes by the email)
  const email = p === 'google' && me.email_verified !== true && me.email_verified !== 'true' ? null : me.email || null;
  let acct = await env.DB.prepare('SELECT id FROM accounts WHERE provider = ? AND sub = ?').bind(p, me.sub).first();
  if (acct) await env.DB.prepare('UPDATE accounts SET email = ?, name = ?, seen = ? WHERE id = ?').bind(email, me.name || null, now, acct.id).run();
  else {
    acct = { id: randomToken(12) };
    await env.DB.prepare('INSERT INTO accounts (id, provider, sub, email, name, created, seen) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(acct.id, p, me.sub, email, me.name || null, now, now).run();
  }
  // the school domain Google gives a school or company account (classes.js: a teacher from a school is
  // approved straight away)
  await noteSignIn(env, acct.id, p, me);
  const token = randomToken(32);
  await env.DB.prepare('INSERT INTO sessions (hash, account, expires) VALUES (?, ?, ?)').bind(await sha256(token), acct.id, now + SESSION_DAYS * DAY).run();
  return new Response(null, { status: 302, headers: { location: `${url.origin}${base}/#signin=ok`, 'set-cookie': cookie('kp_session', token, SESSION_DAYS * 86400, base) } });
}

// ---------- players (save codes) ----------
/** A player deleted everywhere by a grown-up answers "gone" (410) with when, so a computer that still has
 *  a copy removes it instead of keeping or re-sending it. */
// no saved copy under that code (never was, or someone stopped saving it online): `missing` tells the game
// it's this code that's missing, not the whole server, so a computer that still has the player stops sending it
const missingAnswer = (message) => json({ error: message, missing: true }, 404);
async function goneAnswer(env, code) {
  const g = await env.DB.prepare('SELECT at FROM gone WHERE code = ?').bind(code).first();
  return g ? json({ code, gone: true, at: g.at, error: 'A grown-up deleted this player.' }, 410) : null;
}
/** A request's JSON, or null. Its size is counted in bytes as it arrives: a body that says it's too big isn't
 *  read at all, and reading stops as soon as one is over (a huge body is never held whole). */
async function readBody(request, maxBytes = 400000) {
  if (Number(request.headers.get('content-length')) > maxBytes || !request.body) return null;
  const reader = request.body.getReader(), parts = [];
  for (let size = 0; ;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel().catch(() => {}); return null; }
    parts.push(value);
  }
  try { return JSON.parse(await new Blob(parts).text()); } catch { return null; }
}
/** A saved player is an object (a nickname, a buddy, progress): never null, a list or a bare value, which
 *  would break the list of players for the whole family's account. */
const isProfile = (p) => !!p && typeof p === 'object' && !Array.isArray(p);

async function api(request, env, url, base) {
  const path = url.pathname.slice(`${base}/api`.length);
  const method = request.method;
  // a change asked for by another site's page is refused: a browser says which site a request comes from
  // (Origin), and the game's own come from this address (fancyant.com/keypals shares fancyant.com's). A
  // request without one isn't from another site's page. (Asking and preflights change nothing.)
  const from = request.headers.get('origin');
  if (from && from !== url.origin && !['GET', 'HEAD', 'OPTIONS'].includes(method)) return fail(403, 'This can only be done from Keypals itself.');
  // classes, class work and the boards (classes.js): its own paths, null for everything else
  const cls = await classApi(request, env, url, path, { json, fail, currentAccount, limited, codeTry, playerTry, addressHash, readBody, sha256, randomToken, cookie, cleanCode, newCode, base, isAdmin }); if (cls) return cls;
  // which sign-ins are available
  if (path === '/config' && method === 'GET') return json({ google: ready(env, 'google'), microsoft: ready(env, 'microsoft') });

  // sign in and out
  let m = path.match(/^\/auth\/(google|microsoft)\/(start|callback|student)$/);
  if (m && method === 'GET') {
    if (m[2] === 'student' && m[1] !== 'google') return fail(404, 'Not found.');
    return m[2] === 'callback' ? finishSignIn(env, request, url, m[1], base) : startSignIn(env, url, m[1], base, m[2] === 'student');
  }
  if (path === '/auth/logout' && method === 'POST') {
    const c = (request.headers.get('cookie') || '').match(/(?:^|;\s*)kp_session=([^;]+)/);
    if (c) await env.DB.prepare('DELETE FROM sessions WHERE hash = ?').bind(await sha256(c[1])).run();
    return json({ ok: true }, 200, { 'set-cookie': cookie('kp_session', '', 0, base) });
  }

  // a new save code for a player
  if (path === '/players' && method === 'POST') {
    if (await limited(env, request, 'create', 30, 60)) return fail(429, 'Too many new save codes from here. Try again later.');
    const body = await readBody(request);
    if (!isProfile(body?.profile)) return fail(400, 'No player to save.');
    const now = Date.now();
    for (let tries = 0; tries < 5; tries++) {
      const code = newCode();
      // (never a code that was deleted everywhere: computers may still be told it's gone)
      const r = await env.DB.prepare('INSERT OR IGNORE INTO players (code, data, updated, created, opened) SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM gone WHERE code = ?)').bind(code, JSON.stringify(body.profile), now, now, now, code).run();
      if (r.meta.changes) {
        const acct = await currentAccount(env, request);
        if (acct) await env.DB.prepare('UPDATE players SET account = ? WHERE code = ?').bind(acct.id, code).run();
        return json({ code, updated: now });
      }
    }
    return fail(500, 'Could not make a code. Try again.');
  }

  m = path.match(/^\/players\/([^/]+)$/);
  if (m) {
    const code = cleanCode(decodeURIComponent(m[1]));
    if (method === 'GET') {
      // guessing codes is slow: a few dozen tries an hour from one address
      if (!(await playerTry(env, request, 'open', 60, code))) return fail(429, 'Too many tries from here. Try again later.');
      const row = await env.DB.prepare('SELECT data, updated FROM players WHERE code = ?').bind(code).first();
      if (!row) return (await goneAnswer(env, code)) ?? missingAnswer("That save code wasn't found. Check the words and number.");
      await env.DB.prepare('UPDATE players SET opened = ? WHERE code = ?').bind(Date.now(), code).run();
      return json({ code, profile: JSON.parse(row.data), updated: row.updated });
    }
    if (method === 'PUT') {
      const found = await playerTry(env, request, 'save', 600, code);
      if (!found) return fail(429, 'Saving too often. It will catch up.');
      const body = await readBody(request);
      if (!isProfile(body?.profile)) return fail(400, 'No player to save.');
      const row = await env.DB.prepare('SELECT updated FROM players WHERE code = ?').bind(code).first();
      // deleted everywhere by a grown-up: an old copy can't bring it back
      if (!row) return (await goneAnswer(env, code)) ?? missingAnswer('That save code no longer exists.');
      await found();
      // always later than the copy it replaces, so the next save's `base` is unique
      const at = Math.max(Number(body.updated) || Date.now(), row.updated + 1);
      const data = JSON.stringify(body.profile);
      if (body.base !== undefined) {
        // made from the copy that's saved now? Only then replace it (in one step, so two saves at once
        // can't both win); otherwise the game combines the copies and tries again
        if (Number(body.base) !== row.updated) return json({ code, updated: row.updated, stale: true });
        const r = await env.DB.prepare('UPDATE players SET data = ?, updated = ?, opened = ? WHERE code = ? AND updated = ?').bind(data, at, Date.now(), code, row.updated).run();
        if (!r.meta.changes) return json({ code, updated: row.updated, stale: true });
        return json({ code, updated: at });
      }
      // (older games that don't send a base: an older copy never overwrites a newer one)
      if (Number(body.updated) < row.updated) return json({ code, updated: row.updated, stale: true });
      await env.DB.prepare('UPDATE players SET data = ?, updated = ?, opened = ? WHERE code = ?').bind(data, at, Date.now(), code).run();
      return json({ code, updated: at });
    }
    if (method === 'DELETE') {
      // deleting is limited like opening (codes can't be guessed by deleting), and a player kept in a
      // grown-up's account can only be deleted by that grown-up, signed in
      if (await limited(env, request, 'delete', 20, 60)) return fail(429, 'Too many tries from here. Try again later.');
      const found = await codeTry(env, request);
      if (!found) return fail(429, 'Too many tries from here. Try again later.');
      const row = await env.DB.prepare('SELECT account FROM players WHERE code = ?').bind(code).first();
      if (!row) return fail(404, "That save code wasn't found.");
      await found();
      if (row.account) {
        const acct = await currentAccount(env, request);
        if (!acct || acct.id !== row.account) return fail(403, "This player is kept in a grown-up's account. Sign in as that grown-up to stop saving it online.");
      }
      // a player a class made belongs to the class: the teacher's reports read this copy
      if (await madeByClass(env, code)) return fail(403, 'This player belongs to a class. Only the teacher can remove them.');
      // its weekly records for the boards (nickname, buddy, each week's effort) go with it
      await env.DB.batch([env.DB.prepare('DELETE FROM players WHERE code = ?').bind(code), env.DB.prepare('DELETE FROM player_week WHERE player = ?').bind(code)]);
      return json({ ok: true });
    }
  }

  // the signed-in grown-up and their players
  if (path === '/me' && method === 'GET') {
    const acct = await currentAccount(env, request);
    if (!acct) return fail(401, 'Not signed in.');
    const rows = await env.DB.prepare('SELECT code, data, updated FROM players WHERE account = ? ORDER BY updated DESC').bind(acct.id).all();
    // (a broken copy is listed by its code, and never keeps the others from showing)
    const players = rows.results.map(r => { let d = null; try { d = JSON.parse(r.data); } catch { /* no name to show */ } return { code: r.code, name: d?.name, buddy: d?.buddy, updated: r.updated }; });
    // players this grown-up deleted everywhere: every computer signed in removes its copy
    const gone = (await env.DB.prepare('SELECT code, at FROM gone WHERE account = ? ORDER BY at DESC LIMIT 500').bind(acct.id).all()).results;
    return json({ account: { name: acct.name, email: acct.email, provider: acct.provider, admin: isAdmin(env, acct) }, players, gone });
  }
  if (path === '/me' && method === 'DELETE') {
    const acct = await currentAccount(env, request);
    if (!acct) return fail(401, 'Not signed in.');
    const body = await readBody(request) || {};
    // (with the players, their weekly records for the boards)
    if (body.players) await env.DB.batch([env.DB.prepare('DELETE FROM player_week WHERE player IN (SELECT code FROM players WHERE account = ?)').bind(acct.id), env.DB.prepare('DELETE FROM players WHERE account = ?').bind(acct.id)]);
    else await env.DB.prepare('UPDATE players SET account = NULL WHERE account = ?').bind(acct.id).run();
    // a teacher's classes and the children on them, and the school domain Google gave (classes.js)
    await deleteTeacher(env, acct.id);
    await env.DB.prepare('DELETE FROM sessions WHERE account = ?').bind(acct.id).run();
    await env.DB.prepare('UPDATE gone SET account = NULL WHERE account = ?').bind(acct.id).run();
    await env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(acct.id).run();
    return json({ ok: true }, 200, { 'set-cookie': cookie('kp_session', '', 0, base) });
  }
  // a player in the account, in full (for bringing it to this computer: no code guessing to slow down here)
  m = path.match(/^\/me\/players\/([^/]+)$/);
  if (m && method === 'GET') {
    const acct = await currentAccount(env, request);
    if (!acct) return fail(401, 'Not signed in.');
    if (await limited(env, request, 'sync', 600, 60)) return fail(429, 'Too many tries from here. Try again later.');
    const code = cleanCode(decodeURIComponent(m[1]));
    const row = await env.DB.prepare('SELECT data, updated FROM players WHERE code = ? AND account = ?').bind(code, acct.id).first();
    if (!row) return (await goneAnswer(env, code)) ?? fail(404, 'That player was not found.');
    await env.DB.prepare('UPDATE players SET opened = ? WHERE code = ?').bind(Date.now(), code).run();
    return json({ code, profile: JSON.parse(row.data), updated: row.updated });
  }
  // delete a player everywhere: the saved copy goes, and a tombstone (the code and when, no data) tells
  // every other computer to remove its copy too
  m = path.match(/^\/me\/players\/([^/]+)\/everywhere$/);
  if (m && method === 'DELETE') {
    const acct = await currentAccount(env, request);
    if (!acct) return fail(401, 'Not signed in.');
    const code = cleanCode(decodeURIComponent(m[1]));
    const row = await env.DB.prepare('SELECT account FROM players WHERE code = ?').bind(code).first();
    if (!row || row.account !== acct.id) return (await goneAnswer(env, code)) ?? fail(404, 'That player was not found in your account.');
    await env.DB.batch([
      env.DB.prepare('DELETE FROM players WHERE code = ? AND account = ?').bind(code, acct.id),
      env.DB.prepare('DELETE FROM player_week WHERE player = ?').bind(code),
      env.DB.prepare('INSERT OR REPLACE INTO gone (code, account, at) VALUES (?, ?, ?)').bind(code, acct.id, Date.now()),
    ]);
    return json({ ok: true });
  }
  m = path.match(/^\/me\/players\/([^/]+)$/);
  if (m && (method === 'PUT' || method === 'DELETE')) {
    const acct = await currentAccount(env, request);
    if (!acct) return fail(401, 'Not signed in.');
    const code = cleanCode(decodeURIComponent(m[1]));
    if (method === 'DELETE') {
      // out of the account: only a player that is in it
      const r = await env.DB.prepare('UPDATE players SET account = NULL WHERE code = ? AND account = ?').bind(code, acct.id).run();
      return r.meta.changes ? json({ ok: true }) : fail(404, 'That player was not found.');
    }
    // into the account: limited like opening a player (codes can't be guessed faster here), and only from a
    // computer that has the player: it sends the time of the saved copy it has (`updated`), which a save code
    // alone doesn't tell, so nobody can take another family's player by its code
    if (await limited(env, request, 'open', 60, 60)) return fail(429, 'Too many tries from here. Try again later.');
    const row = await env.DB.prepare('SELECT account, updated FROM players WHERE code = ?').bind(code).first();
    if (row && row.account === acct.id) return json({ ok: true });
    // a player a class made stays with the class (a teacher signed in at a classroom computer, a parent at home)
    if (row && !row.account && await madeByClass(env, code)) return fail(409, 'This player belongs to a class, so it stays with the class.');
    const body = await readBody(request, 2000) || {};
    if (!row || row.account || Number(body.updated) !== row.updated) return fail(404, 'That player was not found.');
    const r = await env.DB.prepare('UPDATE players SET account = ? WHERE code = ? AND account IS NULL AND updated = ?').bind(acct.id, code, row.updated).run();
    return r.meta.changes ? json({ ok: true }) : fail(404, 'That player was not found.');
  }
  return (await helpApi(request, env, url, path, method)) ?? fail(404, 'Not found.');
}

// ---------- ideas and help ----------
// Ideas: a grown-up suggests one (behind the grown-up check in the game). It waits for an admin to approve
// it before it shows on the Ideas board, where anyone can vote with a heart: once per idea per computer
// (remembered on that computer), and the server keeps only the count, limited per address. Problems: a
// grown-up describes one, or the game sends one by itself when something breaks (the message, a trimmed
// stack, the screen, game version, browser and screen size; never player data), the same error counted
// rather than stored again. An email is kept only if the grown-up asks for a reply, and is cleared after
// 180 days. Admins (ADMIN_EMAILS, Google sign-ins only) approve, hide, merge and mark ideas, and read the
// problems, on the Grown-ups screen.
const IDEA_KINDS = ['game', 'better', 'other'];
const IDEA_STATUS = ['new', 'shown', 'planned', 'done', 'hidden'];
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, n);
const emailOf = (v) => { const e = clip(v, 120); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : null; };
const ideaOut = (r) => ({ id: r.id, kind: r.kind, text: r.text, status: r.status, votes: r.votes, created: r.created });
function isAdmin(env, acct) {
  if (!acct || acct.provider !== 'google' || !acct.email) return false;
  const list = String(env.ADMIN_EMAILS || '').toLowerCase().split(/[\s,]+/).filter(Boolean);
  return list.includes(String(acct.email).toLowerCase());
}
/** the first line of a stack that points at code (file:line:col), for telling one error from another */
const firstFrame = (stack) => stack.split('\n').find(l => /:\d+:\d+/.test(l)) ?? '';

// ---------- counting visits, with no identifiers ----------
// The game sends only counts it decided on the device ("one more player today", "a math trip of 3-5
// minutes"), batched, at most every 30 seconds (src/lib/state/counts.ts). They're added into daily
// totals: a row is (day, event, key, n). The only thing added here is the country (from Cloudflare's
// CF-IPCountry, country only) for each game opening. No address, browser string, name, code or id is
// stored. The device's own date is used for the day (that's the day its "first visit today" means), if
// it's within a day of the server's.
// What the game sends for each event (src/lib/state/counts.ts EVENTS, counting.ts), and nothing else is kept,
// so made-up keys can't fill the table: the game's screens (src/lib/state/game.svelte.ts Screen, lowercased as
// counts.ts cleanKey sends them), its kinds of game, its buckets and subjects. An area is a subject and the
// first word of a lesson's id; there are only so many, and a day takes at most COUNT_KEYS_A_DAY keys an event.
const SUBJECTS = 'typing|math|arcade|adventure';
const SCREENS = 'title players newplayer hub map run results stickers closet settings grownups mathrun mathresults garden playground adventure battle glimmers eggs learn duel rivals shop skillrun skillresults skills pizza builder drop arcade arcadeplay market ideas teach classlogin boards clockrush bench shifter shapebuilder smoothie treasure showdown balance island mystuff about path subject topic way keypals dances progress'.split(' ');
const COUNT_KEYS = {
  open: /^(phone|tablet|computer)$/, player_day: /^$/, player_week: /^$/, player_month: /^$/, player_new: /^$/, play_sec: /^$/,
  back: /^(0|1|2-6|7|8-29|30|31\+)$/, screen: new RegExp(`^(${SCREENS.join('|')})$`),
  game: /^(typing-lesson|math-trip|skill-trip|arcade-[a-z]{1,20}|battle|glimmer-drop|rival-ghost|family-duel|playground|pizza|builder|market|smoothie|showdown|balance|fact-garden|learn)$/,
  subject: new RegExp(`^(${SUBJECTS})$`), area: new RegExp(`^(${SUBJECTS}):[a-z0-9._-]{1,30}$`), stars: new RegExp(`^(${SUBJECTS}):[0-5]$`),
  game_min: /^(<1|1-2|3-5|6-10|11-20|20\+)$/, signin: /^(google|microsoft)$/,
};
const COUNT_KEYS_A_DAY = 300;
const isoDay = (t) => new Date(t).toISOString().slice(0, 10);
async function takeCounts(request, env) {
  // generous (a school shares one address), and over the limit the counts are just dropped
  if (await limited(env, request, 'count', 1500, 60)) return new Response(null, { status: 204 });
  const body = await readBody(request, 20000);
  if (!body || !Array.isArray(body.counts) || body.counts.length > 80) return fail(400, 'Not counts.');
  const now = Date.now();
  const day = [isoDay(now - DAY), isoDay(now), isoDay(now + DAY)].includes(body.day) ? body.day : isoDay(now);
  const rows = new Map();
  const add = (e, k, n) => { const id = `${e}\u0000${k}`; rows.set(id, [e, k, (rows.get(id)?.[2] ?? 0) + n]); };
  for (const c of body.counts) {
    if (!c || !Object.hasOwn(COUNT_KEYS, c.e)) continue;
    const k = String(c.k ?? '');
    const n = Math.floor(Number(c.n));
    if (!COUNT_KEYS[c.e].test(k) || !(n >= 1) || n > (c.e === 'play_sec' ? 4 * 3600 : 500)) continue;
    add(c.e, k, n);
    if (c.e === 'open') add('country', /^[A-Z]{2}$/.test(request.cf?.country ?? '') ? request.cf.country : (/^[A-Z]{2}$/.test(request.headers.get('cf-ipcountry') ?? '') ? request.headers.get('cf-ipcountry') : 'XX'), n);
  }
  if (rows.size) {
    // (a key new today only while its event has fewer than COUNT_KEYS_A_DAY)
    await env.DB.batch([...rows.values()].map(([e, k, n]) => env.DB.prepare(`INSERT INTO counts (day, event, key, n) SELECT ?, ?, ?, ?
      WHERE (SELECT COUNT(*) FROM counts WHERE day = ? AND event = ?) < ? OR EXISTS (SELECT 1 FROM counts WHERE day = ? AND event = ? AND key = ?)
      ON CONFLICT(day, event, key) DO UPDATE SET n = n + excluded.n`).bind(day, e, k, n, day, e, COUNT_KEYS_A_DAY, day, e, k)));
  }
  return new Response(null, { status: 204 });
}

async function helpApi(request, env, url, path, method) {
  if (path === '/count' && method === 'POST') return takeCounts(request, env);
  // the Ideas board: approved ideas only, top or newest first
  if (path === '/ideas' && method === 'GET') {
    const order = url.searchParams.get('sort') === 'new' ? 'created DESC' : 'votes DESC, created DESC';
    const rows = await env.DB.prepare(`SELECT id, kind, text, status, votes, created FROM ideas WHERE status IN ('shown', 'planned', 'done') ORDER BY ${order} LIMIT 200`).all();
    return json({ ideas: rows.results.map(ideaOut) });
  }
  if (path === '/ideas' && method === 'POST') {
    if (await limited(env, request, 'idea', 5, 60)) return fail(429, 'Thank you! That is a lot of ideas from here for one hour. Please try again later.');
    const body = await readBody(request, 4000);
    const text = clip(body?.text, 500);
    if (text.length < 3) return fail(400, 'Write a few words about your idea.');
    const now = Date.now();
    const r = await env.DB.prepare("INSERT INTO ideas (kind, text, email, status, votes, created, updated) VALUES (?, ?, ?, 'new', 0, ?, ?)")
      .bind(IDEA_KINDS.includes(body.kind) ? body.kind : 'other', text, emailOf(body.email), now, now).run();
    return json({ ok: true, id: r.meta.last_row_id });
  }
  let m = path.match(/^\/ideas\/(\d+)\/vote$/);
  if (m && method === 'POST') {
    if (await limited(env, request, 'vote', 60, 60)) return fail(429, 'So many hearts from here! Try again in a little while.');
    const body = (await readBody(request, 1000)) || {};
    const id = Number(m[1]);
    const r = await env.DB.prepare("UPDATE ideas SET votes = MAX(0, votes + ?) WHERE id = ? AND status IN ('shown', 'planned', 'done')").bind(body.up === false ? -1 : 1, id).run();
    if (!r.meta.changes) return fail(404, 'That idea is not on the board.');
    return json({ ok: true, votes: (await env.DB.prepare('SELECT votes FROM ideas WHERE id = ?').bind(id).first()).votes });
  }
  if (path === '/problems' && method === 'POST') {
    const body = await readBody(request, 12000);
    if (!body) return fail(400, 'Nothing to send.');
    const now = Date.now();
    const meta = [clip(body.screen, 40), clip(body.version, 30), clip(body.browser, 60), clip(body.size, 20)];
    if (body.auto) {
      // something broke in the game: the same error again only adds to its count
      if (await limited(env, request, 'auto', 20, 60)) return fail(429, 'Too many reports from here.');
      const text = clip(body.message, 300), stack = clip(body.stack, 1500);
      if (!text) return fail(400, 'Nothing to send.');
      const sig = (await sha256(`${text}|${firstFrame(stack)}|${meta[1]}`)).slice(0, 24);
      await env.DB.prepare(`INSERT INTO problems (kind, text, sig, stack, screen, version, browser, size, times, status, created, lastseen)
        VALUES ('auto', ?, ?, ?, ?, ?, ?, ?, 1, 'new', ?, ?)
        ON CONFLICT(sig) DO UPDATE SET times = times + 1, lastseen = excluded.lastseen, screen = excluded.screen, browser = excluded.browser, size = excluded.size,
          status = CASE WHEN status = 'done' THEN 'new' ELSE status END`)
        .bind(text, sig, stack, ...meta, now, now).run();
      return json({ ok: true });
    }
    if (await limited(env, request, 'told', 5, 60)) return fail(429, 'Thank you! That is a lot of messages from here for one hour. Please try again later.');
    const text = clip(body.text, 1000);
    if (text.length < 3) return fail(400, 'Write a few words about what went wrong.');
    await env.DB.prepare("INSERT INTO problems (kind, text, email, screen, version, browser, size, times, status, created, lastseen) VALUES ('told', ?, ?, ?, ?, ?, ?, 1, 'new', ?, ?)")
      .bind(text, emailOf(body.email), ...meta, now, now).run();
    return json({ ok: true });
  }

  // ---- admins only ----
  if (!path.startsWith('/admin/')) return null;
  const acct = await currentAccount(env, request);
  if (!isAdmin(env, acct)) return fail(403, 'This is only for the people who look after Keypals.');
  if (path === '/admin/ideas' && method === 'GET') {
    const rows = await env.DB.prepare("SELECT * FROM ideas ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'shown' THEN 1 WHEN 'planned' THEN 2 WHEN 'done' THEN 3 ELSE 4 END, votes DESC, created DESC LIMIT 500").all();
    return json({ ideas: rows.results });
  }
  m = path.match(/^\/admin\/ideas\/(\d+)$/);
  if (m && method === 'POST') {
    const id = Number(m[1]), body = (await readBody(request, 4000)) || {}, now = Date.now();
    const idea = await env.DB.prepare('SELECT id, votes FROM ideas WHERE id = ?').bind(id).first();
    if (!idea) return fail(404, 'No such idea.');
    if (body.into !== undefined) {
      // merge: the votes move to the other idea, and this one stops showing
      const into = Number(body.into);
      if (into === id || !(await env.DB.prepare('SELECT id FROM ideas WHERE id = ?').bind(into).first())) return fail(400, 'Pick another idea to merge into.');
      await env.DB.batch([
        env.DB.prepare('UPDATE ideas SET votes = votes + ?, updated = ? WHERE id = ?').bind(idea.votes, now, into),
        env.DB.prepare("UPDATE ideas SET status = 'merged', merged_into = ?, votes = 0, updated = ? WHERE id = ?").bind(into, now, id),
      ]);
      return json({ ok: true });
    }
    if (body.status !== undefined && !IDEA_STATUS.includes(body.status)) return fail(400, 'Unknown status.');
    const text = body.text === undefined ? null : clip(body.text, 500);
    await env.DB.prepare('UPDATE ideas SET status = COALESCE(?, status), text = COALESCE(?, text), updated = ? WHERE id = ?').bind(body.status ?? null, text || null, now, id).run();
    return json({ ok: true });
  }
  if (m && method === 'DELETE') { await env.DB.prepare('DELETE FROM ideas WHERE id = ?').bind(Number(m[1])).run(); return json({ ok: true }); }
  if (path === '/admin/problems' && method === 'GET') {
    const rows = await env.DB.prepare("SELECT * FROM problems ORDER BY CASE status WHEN 'new' THEN 0 WHEN 'read' THEN 1 ELSE 2 END, lastseen DESC LIMIT 300").all();
    return json({ problems: rows.results });
  }
  m = path.match(/^\/admin\/problems\/(\d+)$/);
  if (m && method === 'POST') {
    const body = (await readBody(request, 1000)) || {};
    if (!['new', 'read', 'done'].includes(body.status)) return fail(400, 'Unknown status.');
    await env.DB.prepare('UPDATE problems SET status = ? WHERE id = ?').bind(body.status, Number(m[1])).run();
    return json({ ok: true });
  }
  if (m && method === 'DELETE') { await env.DB.prepare('DELETE FROM problems WHERE id = ?').bind(Number(m[1])).run(); return json({ ok: true }); }
  // the daily totals for the Admin numbers: the last 60 days (30 shown, and 30 more for "back after 30 days")
  if (path === '/admin/stats' && method === 'GET') {
    const rows = await env.DB.prepare('SELECT day, event, key, n FROM counts WHERE day >= ? ORDER BY day').bind(isoDay(Date.now() - 61 * DAY)).all();
    return json({ today: isoDay(Date.now()), rows: rows.results });
  }
  return null;
}

/** Once a day: forget players nobody has opened in 18 months, and expired sessions (see the privacy notice). */
async function tidy(env) {
  const now = Date.now();
  await env.DB.prepare('DELETE FROM players WHERE opened < ? AND account IS NULL').bind(now - 548 * DAY).run();
  await env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(now).run();
  await env.DB.prepare('DELETE FROM limits WHERE reset < ?').bind(now).run();
  // (a teacher's classes and the children on them go with the account: classes.js tidyClasses)
  await env.DB.prepare('DELETE FROM accounts WHERE seen < ?').bind(now - 3 * 365 * DAY).run();
  await env.DB.prepare('DELETE FROM gone WHERE at < ?').bind(now - 3 * 365 * DAY).run();
  // ideas and help: an email for a reply is kept 180 days; a problem not seen for 180 days goes
  await env.DB.prepare('UPDATE ideas SET email = NULL WHERE email IS NOT NULL AND created < ?').bind(now - 180 * DAY).run();
  await env.DB.prepare('UPDATE problems SET email = NULL WHERE email IS NOT NULL AND created < ?').bind(now - 180 * DAY).run();
  await env.DB.prepare('DELETE FROM problems WHERE lastseen < ?').bind(now - 180 * DAY).run();
  // visit counts: daily totals kept two years
  await env.DB.prepare('DELETE FROM counts WHERE day < ?').bind(isoDay(now - 730 * DAY)).run();
  await env.DB.prepare('UPDATE players SET account = NULL WHERE account IS NOT NULL AND account NOT IN (SELECT id FROM accounts)').run();
}

// ---------- the weekly backup ----------
const BACKUP_PAGE = 50; // rows a file (a saved player is at most 400 KB)
/** Copy every player and account, the classes, and the ideas and problem reports grown-ups sent, to R2 as
 *  gzipped JSON files, if the last copy is a week old (the tidy-up runs daily; this makes it weekly).
 *  backups/<date>/players-0000.json.gz ..., then manifest.json and backups/latest.json. The bucket deletes
 *  copies after 90 days by itself. */
async function backup(env, force = false) {
  if (!env.BACKUPS) return null;
  const now = Date.now();
  const last = await env.BACKUPS.get('backups/latest.json');
  if (!force && last) { const j = await last.json().catch(() => null); if (j && now - j.at < 6.5 * DAY) return null; }
  const prefix = `backups/${new Date(now).toISOString().slice(0, 10)}/`;
  const gz = async (text) => new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  // (ideas and problems have number ids: a text "after" never matches a number, so a table's first page asks for no "after" at all)
  const tables = { players: 'code', accounts: 'id', ideas: 'id', problems: 'id', ...CLASS_TABLES };
  const counts = {}, files = [];
  for (const [table, key] of Object.entries(tables)) {
    let after = null, page = 0;
    counts[table] = 0;
    for (;;) {
      const res = await (after === null
        ? env.DB.prepare(`SELECT * FROM ${table} ORDER BY ${key} LIMIT ?`).bind(BACKUP_PAGE)
        : env.DB.prepare(`SELECT * FROM ${table} WHERE ${key} > ? ORDER BY ${key} LIMIT ?`).bind(after, BACKUP_PAGE)).all();
      const rows = res.results ?? [];
      if (!rows.length) break;
      const name = `${prefix}${table}-${String(page++).padStart(4, '0')}.json.gz`;
      await env.BACKUPS.put(name, await gz(JSON.stringify(rows)), { httpMetadata: { contentType: 'application/gzip' } });
      files.push(name);
      counts[table] += rows.length;
      after = rows[rows.length - 1][key];
      if (rows.length < BACKUP_PAGE) break;
    }
  }
  const manifest = { at: now, prefix, counts, files };
  await env.BACKUPS.put(`${prefix}manifest.json`, JSON.stringify(manifest, null, 1), { httpMetadata: { contentType: 'application/json' } });
  await env.BACKUPS.put('backups/latest.json', JSON.stringify({ at: now, prefix }), { httpMetadata: { contentType: 'application/json' } });
  return manifest;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // www.keypals.org (and anything else pointed at the redirecting Worker): the one true address
    if (env.REDIRECT_TO) return Response.redirect(`${env.REDIRECT_TO}${url.pathname}${url.search}`, 301);
    const base = baseOf(env);
    const old = base === '/keypals' && url.pathname.match(/^\/keypals2(\/.*)?$/);
    if (old) return Response.redirect(`${url.origin}/keypals${old[1] || '/'}${url.search}`, 302);
    if (url.pathname.startsWith(`${base}/api/`)) {
      try { return await api(request, env, url, base); } catch (e) { return fail(500, 'Something went wrong. Try again.'); }
    }
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
  },
  async scheduled(_event, env) { await tidy(env); await tidyClasses(env); await backup(env); },
};
