// fancyant.com/keypals: files are served straight from storage before this ever runs. This script only
// sees what isn't a file:
//   /keypals2/...          the 3D game's old test address, forwarded to /keypals
//   /keypals/api/...       saves and sign-in (data in the D1 database bound as DB)
//
// Saves: any player can get a save code (three words and a number). The code holds the game's own
// profile: a nickname, the chosen buddy, progress and settings. No emails or real names from
// children. Grown-ups (parents, teachers) can sign in with Google or Microsoft to keep several
// players together; that stores their email and name from the provider, nothing else.

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

/** At most `max` calls per `minutes` from one address (only a hash of the address is kept). */
async function limited(env, request, what, max, minutes) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const key = `${what}:${await sha256(ip + what)}`, now = Date.now();
  const row = await env.DB.prepare('SELECT n, reset FROM limits WHERE key = ?').bind(key).first();
  if (!row || row.reset < now) {
    await env.DB.prepare('INSERT OR REPLACE INTO limits (key, n, reset) VALUES (?, 1, ?)').bind(key, now + minutes * 60000).run();
    return false;
  }
  if (row.n >= max) return true;
  await env.DB.prepare('UPDATE limits SET n = n + 1 WHERE key = ?').bind(key).run();
  return false;
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
const callbackUrl = (url, p) => `${url.origin}/keypals/api/auth/${p}/callback`;

function cookie(name, value, maxAgeS) {
  return `${name}=${value}; Path=/keypals; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeS}`;
}
async function currentAccount(env, request) {
  const m = (request.headers.get('cookie') || '').match(/(?:^|;\s*)kp_session=([^;]+)/);
  if (!m) return null;
  const row = await env.DB.prepare('SELECT a.id, a.email, a.name, a.provider, s.expires FROM sessions s JOIN accounts a ON a.id = s.account WHERE s.hash = ?')
    .bind(await sha256(m[1])).first();
  if (!row || row.expires < Date.now()) return null;
  return row;
}

async function startSignIn(env, url, p) {
  if (!ready(env, p)) return fail(503, 'This sign-in is not set up yet.');
  const P = PROVIDERS[p], state = randomToken(18), verifier = randomToken(48);
  await env.DB.prepare('DELETE FROM sign_ins WHERE created < ?').bind(Date.now() - 15 * 60000).run();
  await env.DB.prepare('INSERT INTO sign_ins (state, verifier, provider, created) VALUES (?, ?, ?, ?)').bind(state, verifier, p, Date.now()).run();
  const q = new URLSearchParams({
    client_id: P.id(env), redirect_uri: callbackUrl(url, p), response_type: 'code', scope: 'openid email profile',
    state, code_challenge: await sha256(verifier), code_challenge_method: 'S256', ...P.extra,
  });
  return Response.redirect(`${P.authorize}?${q}`, 302);
}

async function finishSignIn(env, url, p) {
  const back = (msg) => Response.redirect(`${url.origin}/keypals/#signin=${msg}`, 302);
  if (!ready(env, p)) return back('unavailable');
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  if (!code || !state) return back('cancelled');
  const si = await env.DB.prepare('SELECT verifier, provider, created FROM sign_ins WHERE state = ?').bind(state).first();
  await env.DB.prepare('DELETE FROM sign_ins WHERE state = ?').bind(state).run();
  if (!si || si.provider !== p || si.created < Date.now() - 15 * 60000) return back('expired');
  const P = PROVIDERS[p];
  const tok = await fetch(P.token, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: P.id(env), client_secret: P.secret(env), code, code_verifier: si.verifier, grant_type: 'authorization_code', redirect_uri: callbackUrl(url, p) }),
  }).then(r => r.json()).catch(() => null);
  if (!tok || !tok.access_token) return back('failed');
  const me = await fetch(P.userinfo, { headers: { authorization: `Bearer ${tok.access_token}` } }).then(r => r.json()).catch(() => null);
  if (!me || !me.sub) return back('failed');
  const now = Date.now();
  let acct = await env.DB.prepare('SELECT id FROM accounts WHERE provider = ? AND sub = ?').bind(p, me.sub).first();
  if (acct) await env.DB.prepare('UPDATE accounts SET email = ?, name = ?, seen = ? WHERE id = ?').bind(me.email || null, me.name || null, now, acct.id).run();
  else {
    acct = { id: randomToken(12) };
    await env.DB.prepare('INSERT INTO accounts (id, provider, sub, email, name, created, seen) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(acct.id, p, me.sub, me.email || null, me.name || null, now, now).run();
  }
  const token = randomToken(32);
  await env.DB.prepare('INSERT INTO sessions (hash, account, expires) VALUES (?, ?, ?)').bind(await sha256(token), acct.id, now + SESSION_DAYS * DAY).run();
  return new Response(null, { status: 302, headers: { location: `${url.origin}/keypals/#signin=ok`, 'set-cookie': cookie('kp_session', token, SESSION_DAYS * 86400) } });
}

// ---------- players (save codes) ----------
async function readBody(request, maxBytes = 400000) {
  const text = await request.text();
  if (text.length > maxBytes) return null;
  try { return JSON.parse(text); } catch { return null; }
}

async function api(request, env, url) {
  const path = url.pathname.replace(/^\/keypals\/api/, '');
  const method = request.method;
  // which sign-ins are available
  if (path === '/config' && method === 'GET') return json({ google: ready(env, 'google'), microsoft: ready(env, 'microsoft') });

  // sign in and out
  let m = path.match(/^\/auth\/(google|microsoft)\/(start|callback)$/);
  if (m && method === 'GET') return m[2] === 'start' ? startSignIn(env, url, m[1]) : finishSignIn(env, url, m[1]);
  if (path === '/auth/logout' && method === 'POST') {
    const c = (request.headers.get('cookie') || '').match(/(?:^|;\s*)kp_session=([^;]+)/);
    if (c) await env.DB.prepare('DELETE FROM sessions WHERE hash = ?').bind(await sha256(c[1])).run();
    return json({ ok: true }, 200, { 'set-cookie': cookie('kp_session', '', 0) });
  }

  // a new save code for a player
  if (path === '/players' && method === 'POST') {
    if (await limited(env, request, 'create', 30, 60)) return fail(429, 'Too many new save codes from here. Try again later.');
    const body = await readBody(request);
    if (!body || typeof body.profile !== 'object') return fail(400, 'No player to save.');
    const now = Date.now();
    for (let tries = 0; tries < 5; tries++) {
      const code = newCode();
      const r = await env.DB.prepare('INSERT OR IGNORE INTO players (code, data, updated, created, opened) VALUES (?, ?, ?, ?, ?)').bind(code, JSON.stringify(body.profile), now, now, now).run();
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
      if (await limited(env, request, 'open', 60, 60)) return fail(429, 'Too many tries from here. Try again later.');
      const row = await env.DB.prepare('SELECT data, updated FROM players WHERE code = ?').bind(code).first();
      if (!row) return fail(404, "That save code wasn't found. Check the words and number.");
      await env.DB.prepare('UPDATE players SET opened = ? WHERE code = ?').bind(Date.now(), code).run();
      return json({ code, profile: JSON.parse(row.data), updated: row.updated });
    }
    if (method === 'PUT') {
      if (await limited(env, request, 'save', 600, 60)) return fail(429, 'Saving too often. It will catch up.');
      const body = await readBody(request);
      if (!body || typeof body.profile !== 'object') return fail(400, 'No player to save.');
      const row = await env.DB.prepare('SELECT updated FROM players WHERE code = ?').bind(code).first();
      if (!row) return fail(404, 'That save code no longer exists.');
      const at = Number(body.updated) || Date.now();
      // newest wins: an older copy never overwrites a newer one
      if (at < row.updated) return json({ code, updated: row.updated, stale: true });
      await env.DB.prepare('UPDATE players SET data = ?, updated = ?, opened = ? WHERE code = ?').bind(JSON.stringify(body.profile), at, Date.now(), code).run();
      return json({ code, updated: at });
    }
    if (method === 'DELETE') {
      await env.DB.prepare('DELETE FROM players WHERE code = ?').bind(code).run();
      return json({ ok: true });
    }
  }

  // the signed-in grown-up and their players
  if (path === '/me' && method === 'GET') {
    const acct = await currentAccount(env, request);
    if (!acct) return fail(401, 'Not signed in.');
    const rows = await env.DB.prepare('SELECT code, data, updated FROM players WHERE account = ? ORDER BY updated DESC').bind(acct.id).all();
    const players = rows.results.map(r => { const d = JSON.parse(r.data); return { code: r.code, name: d.name, buddy: d.buddy, updated: r.updated }; });
    return json({ account: { name: acct.name, email: acct.email, provider: acct.provider }, players });
  }
  if (path === '/me' && method === 'DELETE') {
    const acct = await currentAccount(env, request);
    if (!acct) return fail(401, 'Not signed in.');
    const body = await readBody(request) || {};
    if (body.players) await env.DB.prepare('DELETE FROM players WHERE account = ?').bind(acct.id).run();
    else await env.DB.prepare('UPDATE players SET account = NULL WHERE account = ?').bind(acct.id).run();
    await env.DB.prepare('DELETE FROM sessions WHERE account = ?').bind(acct.id).run();
    await env.DB.prepare('DELETE FROM accounts WHERE id = ?').bind(acct.id).run();
    return json({ ok: true }, 200, { 'set-cookie': cookie('kp_session', '', 0) });
  }
  m = path.match(/^\/me\/players\/([^/]+)$/);
  if (m && (method === 'PUT' || method === 'DELETE')) {
    const acct = await currentAccount(env, request);
    if (!acct) return fail(401, 'Not signed in.');
    const code = cleanCode(decodeURIComponent(m[1]));
    const r = await env.DB.prepare('UPDATE players SET account = ? WHERE code = ? AND (account IS NULL OR account = ?)').bind(method === 'PUT' ? acct.id : null, code, acct.id).run();
    return r.meta.changes ? json({ ok: true }) : fail(404, 'That player was not found.');
  }
  return fail(404, 'Not found.');
}

/** Once a day: forget players nobody has opened in 18 months, and expired sessions (see the privacy notice). */
async function tidy(env) {
  const now = Date.now();
  await env.DB.prepare('DELETE FROM players WHERE opened < ? AND account IS NULL').bind(now - 548 * DAY).run();
  await env.DB.prepare('DELETE FROM sessions WHERE expires < ?').bind(now).run();
  await env.DB.prepare('DELETE FROM limits WHERE reset < ?').bind(now).run();
  await env.DB.prepare('DELETE FROM accounts WHERE seen < ?').bind(now - 3 * 365 * DAY).run();
  await env.DB.prepare('UPDATE players SET account = NULL WHERE account IS NOT NULL AND account NOT IN (SELECT id FROM accounts)').run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const old = url.pathname.match(/^\/keypals2(\/.*)?$/);
    if (old) return Response.redirect(`${url.origin}/keypals${old[1] || '/'}${url.search}`, 302);
    if (url.pathname.startsWith('/keypals/api/')) {
      try { return await api(request, env, url); } catch (e) { return fail(500, 'Something went wrong. Try again.'); }
    }
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
  },
  async scheduled(_event, env) { await tidy(env); },
};
