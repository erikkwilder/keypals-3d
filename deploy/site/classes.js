// Keypals for teachers: classes, students who log in with a class code and two pictures, assignments,
// and the boards (class, family, class against class, and the world board for the Arcade's daily
// challenge). worker.js hands every /keypals/api/ request here first (classApi); anything that isn't
// ours comes back null and worker.js carries on.
//
// Teachers sign in with the same grown-up accounts as everyone (Google), then say "I'm a teacher" once:
// the name kids see and agreeing to a short note. About a child we keep only the first name or nickname
// the teacher typed (cut to a first name and an initial: class-rules.js), the picture password (two of
// sixteen pictures, so the teacher can print it), the game progress (an ordinary player with a save
// code, in players) and this week's effort (right answers, minutes, stars) for the boards. No emails,
// last names or birthdays from children, ever.
//
// Students: a class player is a save code the class made. Logging in (class code, tap your name, tap
// your two pictures) hands the game that player; "Done for today" takes it off a shared computer again.
// A family can link a player from home to a class (the teacher says yes first), and unlink it later.
//
// A test sign-in exists for checking the teacher side on a computer: only when KP_DEV_SIGNIN is "1" (a
// variable never set on the live site) AND the address is 127.0.0.1 or localhost.

import { CLASS_WORDS, MAX_CLASSES, MAX_STUDENTS, PICTURE_COUNT, START_BUDDIES, cleanClassName, cleanStudentName, cleanTeacherName, cleanWeek, isAlias, isBuddyId, isDay, isWeek, splitNames, worldScoreOk } from './class-rules.js';

/** Tables for the weekly backup (worker.js backup): table and its key. The world boards aren't kept. */
export const CLASS_TABLES = { teachers: 'account', classes: 'id', students: 'id', assignments: 'id', player_week: 'id', challenges: 'id', challenge_classes: 'id' };

const DAY = 86400000;
const newId = (h) => h.randomToken(9);

/** A class code: two words and a number (FOX-PEAR-42). */
export function newClassCode() {
  const r = crypto.getRandomValues(new Uint32Array(3));
  return `${CLASS_WORDS[r[0] % CLASS_WORDS.length].toUpperCase()}-${CLASS_WORDS[r[1] % CLASS_WORDS.length].toUpperCase()}-${10 + (r[2] % 90)}`;
}
/** Two different pictures, in order: "3,11". */
export function newPics() {
  const r = crypto.getRandomValues(new Uint32Array(2));
  const a = r[0] % PICTURE_COUNT;
  const b = (a + 1 + (r[1] % (PICTURE_COUNT - 1))) % PICTURE_COUNT;
  return `${a},${b}`;
}
const picsOf = (s) => String(s).split(',').map(Number);
const randomBuddy = () => START_BUDDIES[crypto.getRandomValues(new Uint32Array(1))[0] % START_BUDDIES.length];

/** A player for a new student: just the name and a buddy; the game fills in everything else when it opens. */
const starterProfile = (name, buddy, now) => JSON.stringify({ name, buddy, createdAt: now, settings: { grown: false } });

// ---------- tries that count per child (not per address: a whole school shares one address) ----------
async function blocked(env, key, max) {
  const row = await env.DB.prepare('SELECT n, reset FROM limits WHERE key = ?').bind(key).first();
  return !!row && row.reset > Date.now() && row.n >= max;
}
async function count(env, key, minutes) {
  const now = Date.now();
  const row = await env.DB.prepare('SELECT n, reset FROM limits WHERE key = ?').bind(key).first();
  if (!row || row.reset < now) await env.DB.prepare('INSERT OR REPLACE INTO limits (key, n, reset) VALUES (?, 1, ?)').bind(key, now + minutes * 60000).run();
  else await env.DB.prepare('UPDATE limits SET n = n + 1 WHERE key = ?').bind(key).run();
}
/** Wrong pictures: five tries, then a ten-minute rest for that child. */
export const PIC_TRIES = 5, PIC_REST_MIN = 10;

/** One more for a key: true when it's already at `max` this window (the same rule as worker.js limited()). */
async function hit(env, key, max, minutes) {
  const now = Date.now();
  const row = await env.DB.prepare('SELECT n, reset FROM limits WHERE key = ?').bind(key).first();
  if (!row || row.reset < now) { await env.DB.prepare('INSERT OR REPLACE INTO limits (key, n, reset) VALUES (?, 1, ?)').bind(key, now + minutes * 60000).run(); return false; }
  if (row.n >= max) return true;
  await env.DB.prepare('UPDATE limits SET n = n + 1 WHERE key = ?').bind(key).run();
  return false;
}
/** The class of an active student's player (null: not a class player). Saving players must never fail
 *  because of classes: before schema-classes.sql is applied there's simply no class to find. */
async function classOfPlayer(env, code, any = false) {
  try {
    return await env.DB.prepare(any ? 'SELECT class FROM students WHERE player = ? AND home = 0 LIMIT 1' : "SELECT class FROM students WHERE player = ? AND status = 'active' LIMIT 1").bind(code).first();
  } catch { return null; }
}
/** A whole class plays on one school address, so opening and saving a class player count by the player's
 *  own code (an hour's worth each) and by its class (room for a big class), never by the address. */
export const CLASS_PLAYER_LIMITS = { open: 120, save: 900 };
export const CLASS_ROOM = 45;
/**
 * The limit for opening or saving a player (worker.js /players/<code>): for a class player (an active
 * student), true or false by its code and class; for anyone else null, and worker.js applies its own
 * limits by address (guessing codes stays slow: a code that isn't a class player's gains nothing here).
 */
export async function classPlayerLimited(env, what, code, sha256) {
  const max = CLASS_PLAYER_LIMITS[what];
  if (!max || !code) return null;
  const s = await classOfPlayer(env, code);
  if (!s) return null;
  if (await hit(env, `${what}:player:${await sha256(code)}`, max, 60)) return true;
  return hit(env, `${what}:class:${s.class}`, max * CLASS_ROOM, 60);
}

// ---------- who's asking ----------
async function teacherOf(env, request, h) {
  const acct = await h.currentAccount(env, request);
  if (!acct) return { error: h.fail(401, 'Please sign in first.') };
  const t = await env.DB.prepare('SELECT display, agreed FROM teachers WHERE account = ?').bind(acct.id).first();
  if (!t) return { error: h.fail(403, 'Say "I\'m a teacher" first.') };
  return { acct, teacher: t };
}
const ownClass = (env, acct, id) => env.DB.prepare('SELECT * FROM classes WHERE id = ? AND teacher = ?').bind(id, acct).first();
async function ownStudent(env, acct, id) {
  return env.DB.prepare('SELECT s.* FROM students s JOIN classes c ON c.id = s.class WHERE s.id = ? AND c.teacher = ?').bind(id, acct).first();
}
const classView = (c, extra = {}) => ({ id: c.id, name: c.name, grade: c.grade, code: c.code, board: !!c.board, goal: c.goal, archived: !!c.archived, created: c.created, ...extra });

// ---------- assignments: kept as the game describes them, checked and trimmed ----------
const WHAT = ['skills', 'typing', 'learn', 'check'];
const GOALS = ['right', 'minutes', 'comfortable', 'finish'];
const SCORING = ['completion', 'accuracy', 'both'];
const ids = (x, max = 60) => (Array.isArray(x) ? x.filter(s => typeof s === 'string' && /^[\w.:-]{1,40}$/.test(s)).slice(0, max) : []);
/** A teacher's assignment from the game, or null if it isn't one. */
export function cleanAssignment(d) {
  if (!d || typeof d !== 'object' || !WHAT.includes(d.what)) return null;
  const goal = d.goal && GOALS.includes(d.goal.type) ? { type: d.goal.type, n: Math.max(1, Math.min(100000, Math.round(Number(d.goal.n) || 1))) } : null;
  if (!goal) return null;
  const out = {
    title: String(d.title ?? '').replace(/[<>`]/g, '').trim().slice(0, 80) || 'Class work',
    what: d.what, skills: ids(d.skills), lessons: ids(d.lessons), episodes: ids(d.episodes), areas: ids(d.areas, 20),
    by: typeof d.by === 'string' ? d.by.slice(0, 60) : '',
    goal, scoring: SCORING.includes(d.scoring) ? d.scoring : 'completion',
    start: Number.isFinite(d.start) ? Math.round(d.start) : Date.now(),
    due: Number.isFinite(d.due) ? Math.round(d.due) : null,
    students: Array.isArray(d.students) ? ids(d.students, 60) : null,
  };
  const n = { skills: out.skills, typing: out.lessons, learn: out.episodes, check: out.areas }[out.what];
  return n.length ? out : null;
}

// ---------- the boards ----------
/** Every active student's week in a class (the class board, the class goal). */
async function classWeek(env, classId, week) {
  const r = await env.DB.prepare(`SELECT s.id, s.name, s.buddy, COALESCE(w.correct, 0) AS correct, COALESCE(w.ms, 0) AS ms, COALESCE(w.stars, 0) AS stars
    FROM students s LEFT JOIN player_week w ON w.id = s.player || ':' || ? WHERE s.class = ? AND s.status = 'active'
    ORDER BY correct DESC, ms DESC, s.name`).bind(week, classId).all();
  return (r.results ?? []).map(x => ({ id: x.id, name: x.name, buddy: x.buddy, right: x.correct, ms: x.ms, stars: x.stars }));
}
/** A class against class challenge: every class's average right answers per student for its week (names only). */
async function challengeView(env, ch) {
  const r = await env.DB.prepare(`SELECT c.id, c.name, COUNT(s.id) AS n, COALESCE(SUM(w.correct), 0) AS correct
    FROM challenge_classes x JOIN classes c ON c.id = x.class
    LEFT JOIN students s ON s.class = c.id AND s.status = 'active'
    LEFT JOIN player_week w ON w.id = s.player || ':' || ?
    WHERE x.challenge = ? GROUP BY c.id, c.name`).bind(ch.week, ch.id).all();
  const classes = (r.results ?? []).map(x => ({ id: x.id, name: x.name, students: x.n, avg: x.n ? Math.round((x.correct / x.n) * 10) / 10 : 0 }))
    .sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name));
  return { code: ch.code, week: ch.week, ends: Date.parse(ch.week) + 7 * DAY, classes };
}
async function challengeOf(env, classId) {
  const ch = await env.DB.prepare('SELECT c.* FROM challenge_classes x JOIN challenges c ON c.id = x.challenge WHERE x.class = ? ORDER BY c.week DESC LIMIT 1').bind(classId).first();
  return ch ? challengeView(env, ch) : null;
}

/** Remove students: a player the class made goes too (unless a family keeps it in their account; one the
 *  teacher's own sign-in filed under the teacher goes), a player from home just leaves the class. */
async function dropStudents(env, rows, teacher = '') {
  const st = [];
  for (const s of rows) {
    if (!s.home) {
      st.push(env.DB.prepare('DELETE FROM players WHERE code = ? AND (account IS NULL OR account = ?)').bind(s.player, teacher));
      st.push(env.DB.prepare('DELETE FROM player_week WHERE player = ? AND player NOT IN (SELECT code FROM players)').bind(s.player));
    }
    st.push(env.DB.prepare('DELETE FROM students WHERE id = ?').bind(s.id));
  }
  if (st.length) await env.DB.batch(st);
}

const devReady = (env, url) => env.KP_DEV_SIGNIN === '1' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');

/**
 * Our part of the API, or null when the path isn't ours. `h` is worker.js's toolbox: json, fail,
 * currentAccount, limited, readBody, sha256, randomToken, cookie, cleanCode, newCode, and base (the game's
 * path: /keypals on fancyant.com, empty on keypals.org).
 */
export async function classApi(request, env, url, path, h) {
  const method = request.method;
  const DB = env.DB;
  let m;

  // ---------------- the test sign-in (a computer only, never the live site) ----------------
  if (path === '/teach/config' && method === 'GET') return h.json({ dev: devReady(env, url) });
  if (path === '/auth/dev' && method === 'GET') {
    if (!devReady(env, url)) return h.fail(404, 'Not found.');
    const name = cleanTeacherName(url.searchParams.get('name')) || 'Test Teacher';
    const sub = `dev-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, now = Date.now();
    let acct = await DB.prepare("SELECT id FROM accounts WHERE provider = 'dev' AND sub = ?").bind(sub).first();
    if (!acct) { acct = { id: h.randomToken(12) }; await DB.prepare("INSERT INTO accounts (id, provider, sub, email, name, created, seen) VALUES (?, 'dev', ?, NULL, ?, ?, ?)").bind(acct.id, sub, name, now, now).run(); }
    const token = h.randomToken(32);
    await DB.prepare('INSERT INTO sessions (hash, account, expires) VALUES (?, ?, ?)').bind(await h.sha256(token), acct.id, now + DAY).run();
    const base = h.base ?? '/keypals';
    return new Response(null, { status: 302, headers: { location: `${base}/#teach`, 'set-cookie': h.cookie('kp_session', token, 86400, base) } });
  }

  // ---------------- a class's own players stay with the class ----------------
  // never filed under a grown-up's account (a teacher signed in at a classroom computer, a parent at home);
  // a family's player linked to a class is the family's, and files as usual
  m = path.match(/^\/me\/players\/([^/]+)$/);
  if (m && method === 'PUT') {
    if (await classOfPlayer(env, h.cleanCode(decodeURIComponent(m[1])), true)) return h.fail(409, 'This player belongs to a class, so it stays with the class.');
  }

  // ---------------- teachers ----------------
  if (path === '/teach/me' && method === 'GET') {
    const acct = await h.currentAccount(env, request);
    if (!acct) return h.json({ signedIn: false });
    const t = await DB.prepare('SELECT display, agreed FROM teachers WHERE account = ?').bind(acct.id).first();
    return h.json({ signedIn: true, account: { name: acct.name }, teacher: t ? { display: t.display, agreed: t.agreed } : null });
  }
  if (path === '/teach/me' && method === 'POST') {
    const acct = await h.currentAccount(env, request);
    if (!acct) return h.fail(401, 'Please sign in first.');
    const body = await h.readBody(request) || {};
    const display = cleanTeacherName(body.display);
    if (!display) return h.fail(400, 'Type the name your students call you.');
    if (body.agree !== true) return h.fail(400, 'Please read and agree to the note first.');
    const now = Date.now();
    await DB.prepare('INSERT INTO teachers (account, display, agreed, created) VALUES (?, ?, ?, ?) ON CONFLICT(account) DO UPDATE SET display = excluded.display, agreed = excluded.agreed').bind(acct.id, display, now, now).run();
    return h.json({ teacher: { display, agreed: now } });
  }

  if (path.startsWith('/teach/')) {
    const who = await teacherOf(env, request, h);
    if (who.error) return who.error;
    const acct = who.acct.id;

    if (path === '/teach/classes' && method === 'GET') {
      const r = await DB.prepare(`SELECT c.*, (SELECT COUNT(*) FROM students s WHERE s.class = c.id AND s.status = 'active') AS n,
        (SELECT COUNT(*) FROM students s WHERE s.class = c.id AND s.status = 'pending') AS pending FROM classes c WHERE c.teacher = ? ORDER BY c.archived, c.created`).bind(acct).all();
      return h.json({ classes: (r.results ?? []).map(c => classView(c, { students: c.n, pending: c.pending })) });
    }
    if (path === '/teach/classes' && method === 'POST') {
      const body = await h.readBody(request) || {};
      const name = cleanClassName(body.name), grade = Math.round(Number(body.grade));
      if (!name) return h.fail(400, 'Give the class a name.');
      if (!(grade >= 0 && grade <= 8)) return h.fail(400, 'Pick a grade from K to 8.');
      const have = await DB.prepare('SELECT COUNT(*) AS n FROM classes WHERE teacher = ?').bind(acct).first();
      if ((have?.n ?? 0) >= MAX_CLASSES) return h.fail(400, `${MAX_CLASSES} classes is the most for now. Delete an old one first.`);
      const now = Date.now(), id = newId(h);
      for (let tries = 0; tries < 6; tries++) {
        const code = newClassCode();
        const r = await DB.prepare('INSERT OR IGNORE INTO classes (id, teacher, name, grade, code, board, goal, archived, created) VALUES (?, ?, ?, ?, ?, 1, 0, 0, ?)').bind(id, acct, name, grade, code, now).run();
        if (r.meta.changes) return h.json({ class: classView({ id, name, grade, code, board: 1, goal: 0, archived: 0, created: now }, { students: 0, pending: 0 }) });
      }
      return h.fail(500, 'Could not make a class code. Try again.');
    }

    m = path.match(/^\/teach\/classes\/([\w-]+)(\/.*)?$/);
    if (m) {
      const c = await ownClass(env, acct, m[1]);
      if (!c) return h.fail(404, 'That class was not found.');
      const rest = m[2] || '';
      if (rest === '' && method === 'GET') {
        const week = isWeek(url.searchParams.get('week')) ? url.searchParams.get('week') : null;
        const st = await DB.prepare('SELECT id, name, pics, home, status, claims, buddy, created FROM students WHERE class = ? ORDER BY status, name').bind(c.id).all();
        const as = await DB.prepare('SELECT id, data, created, archived FROM assignments WHERE class = ? ORDER BY created').bind(c.id).all();
        const students = (st.results ?? []).map(s => ({ id: s.id, name: s.name, pics: picsOf(s.pics), home: !!s.home, status: s.status, claims: s.claims, buddy: s.buddy, created: s.created }));
        const assignments = (as.results ?? []).map(a => ({ id: a.id, ...JSON.parse(a.data), created: a.created, archived: !!a.archived }));
        return h.json({ class: classView(c), students, assignments, week: week ? await classWeek(env, c.id, week) : [], challenge: await challengeOf(env, c.id) });
      }
      if (rest === '' && method === 'PATCH') {
        const body = await h.readBody(request) || {};
        const name = body.name !== undefined ? cleanClassName(body.name) : c.name;
        const grade = body.grade !== undefined ? Math.round(Number(body.grade)) : c.grade;
        if (!name || !(grade >= 0 && grade <= 8)) return h.fail(400, 'Check the name and grade.');
        const board = body.board !== undefined ? (body.board ? 1 : 0) : c.board;
        const goal = body.goal !== undefined ? Math.max(0, Math.min(1000000, Math.round(Number(body.goal) || 0))) : c.goal;
        const archived = body.archived !== undefined ? (body.archived ? 1 : 0) : c.archived;
        await DB.prepare('UPDATE classes SET name = ?, grade = ?, board = ?, goal = ?, archived = ? WHERE id = ?').bind(name, grade, board, goal, archived, c.id).run();
        return h.json({ class: classView({ ...c, name, grade, board, goal, archived }) });
      }
      if (rest === '' && method === 'DELETE') {
        // a typed confirmation: the class's name
        const body = await h.readBody(request) || {};
        if (String(body.confirm ?? '').trim().toLowerCase() !== c.name.trim().toLowerCase()) return h.fail(400, `Type the class's name, ${c.name}, to delete it.`);
        const st = await DB.prepare('SELECT id, player, home FROM students WHERE class = ?').bind(c.id).all();
        await dropStudents(env, st.results ?? [], acct);
        await DB.batch([
          DB.prepare('DELETE FROM assignments WHERE class = ?').bind(c.id),
          DB.prepare('DELETE FROM challenge_classes WHERE class = ?').bind(c.id),
          DB.prepare('DELETE FROM classes WHERE id = ?').bind(c.id),
        ]);
        return h.json({ ok: true, removed: (st.results ?? []).filter(s => !s.home).length });
      }
      if (rest === '/students' && method === 'POST') {
        const body = await h.readBody(request) || {};
        const names = Array.isArray(body.names) ? body.names.map(cleanStudentName).filter(Boolean) : splitNames(body.text);
        if (!names.length) return h.fail(400, 'Type a first name or nickname (no last names or emails).');
        const have = await DB.prepare("SELECT COUNT(*) AS n FROM students WHERE class = ? AND status = 'active'").bind(c.id).first();
        if ((have?.n ?? 0) + names.length > MAX_STUDENTS) return h.fail(400, `A class can have up to ${MAX_STUDENTS} students.`);
        const now = Date.now(), added = [];
        for (const name of names) {
          const buddy = randomBuddy(), sid = newId(h), pics = newPics();
          let code = null;
          for (let tries = 0; tries < 5 && !code; tries++) {
            const cand = h.newCode();
            const r = await DB.prepare('INSERT OR IGNORE INTO players (code, data, updated, created, opened) VALUES (?, ?, ?, ?, ?)').bind(cand, starterProfile(name, buddy, now), now, now, now).run();
            if (r.meta.changes) code = cand;
          }
          if (!code) return h.fail(500, 'Could not add everyone. Try again.');
          await DB.prepare("INSERT INTO students (id, class, name, player, pics, home, status, buddy, created) VALUES (?, ?, ?, ?, ?, 0, 'active', ?, ?)").bind(sid, c.id, name, code, pics, buddy, now).run();
          added.push({ id: sid, name, pics: picsOf(pics), home: false, status: 'active', buddy, created: now });
        }
        return h.json({ students: added });
      }
      if (rest === '/profiles' && method === 'GET') {
        // every student's progress for the reports, as saved (sent on as it is: not read here)
        const r = await DB.prepare('SELECT s.id, p.data, p.updated FROM students s JOIN players p ON p.code = s.player WHERE s.class = ?').bind(c.id).all();
        const parts = (r.results ?? []).map(x => `{"id":${JSON.stringify(x.id)},"updated":${Number(x.updated)},"profile":${x.data}}`);
        return new Response(`{"students":[${parts.join(',')}]}`, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
      }
      if (rest === '/assignments' && method === 'POST') {
        const body = await h.readBody(request) || {};
        const a = cleanAssignment(body.data);
        if (!a) return h.fail(400, 'Pick what to practise and a goal.');
        const id = newId(h), now = Date.now();
        await DB.prepare('INSERT INTO assignments (id, class, data, created, due, archived) VALUES (?, ?, ?, ?, ?, 0)').bind(id, c.id, JSON.stringify(a), now, a.due).run();
        return h.json({ assignment: { id, ...a, created: now, archived: false } });
      }
      if (rest === '/challenge' && method === 'POST') {
        const body = await h.readBody(request) || {};
        if (!isWeek(body.week)) return h.fail(400, 'Which week?');
        const cur = await challengeOf(env, c.id);
        if (cur && cur.ends > Date.now()) return h.fail(400, 'This class is in a challenge this week already.');
        const id = newId(h), now = Date.now();
        for (let tries = 0; tries < 6; tries++) {
          const code = newClassCode();
          const r = await DB.prepare('INSERT OR IGNORE INTO challenges (id, code, week, created, owner) VALUES (?, ?, ?, ?, ?)').bind(id, code, body.week, now, c.id).run();
          if (r.meta.changes) {
            await DB.prepare('INSERT INTO challenge_classes (id, challenge, class, joined) VALUES (?, ?, ?, ?)').bind(newId(h), id, c.id, now).run();
            return h.json({ challenge: await challengeOf(env, c.id) });
          }
        }
        return h.fail(500, 'Could not make a challenge code. Try again.');
      }
      if (rest === '/challenge/join' && method === 'POST') {
        const body = await h.readBody(request) || {};
        const ch = await DB.prepare('SELECT * FROM challenges WHERE code = ?').bind(h.cleanCode(body.code)).first();
        if (!ch) return h.fail(404, "That challenge code wasn't found. Check the words and number.");
        if (Date.parse(ch.week) + 7 * DAY < Date.now()) return h.fail(400, 'That challenge is over. Make a new one!');
        const cur = await challengeOf(env, c.id);
        if (cur && cur.ends > Date.now()) return h.fail(400, cur.code === ch.code ? 'This class is in that challenge already.' : 'This class is in a challenge this week already.');
        const n = await DB.prepare('SELECT COUNT(*) AS n FROM challenge_classes WHERE challenge = ?').bind(ch.id).first();
        if ((n?.n ?? 0) >= 8) return h.fail(400, 'That challenge is full (8 classes).');
        await DB.prepare('INSERT INTO challenge_classes (id, challenge, class, joined) VALUES (?, ?, ?, ?)').bind(newId(h), ch.id, c.id, Date.now()).run();
        return h.json({ challenge: await challengeOf(env, c.id) });
      }
      if (rest === '/challenge' && method === 'DELETE') {
        await DB.prepare('DELETE FROM challenge_classes WHERE class = ? AND challenge IN (SELECT id FROM challenges WHERE week >= ?)').bind(c.id, new Date(Date.now() - 8 * DAY).toISOString().slice(0, 10)).run();
        return h.json({ ok: true });
      }
      return h.fail(404, 'Not found.');
    }

    m = path.match(/^\/teach\/students\/([\w-]+)(\/approve|\/pics)?$/);
    if (m) {
      const s = await ownStudent(env, acct, m[1]);
      if (!s) return h.fail(404, 'That student was not found.');
      if (!m[2] && method === 'PATCH') {
        const body = await h.readBody(request) || {};
        const name = cleanStudentName(body.name);
        if (!name) return h.fail(400, 'Type a first name or nickname (no last names or emails).');
        await DB.prepare('UPDATE students SET name = ? WHERE id = ?').bind(name, s.id).run();
        return h.json({ student: { id: s.id, name } });
      }
      if (!m[2] && method === 'DELETE') { await dropStudents(env, [s], acct); return h.json({ ok: true }); }
      if (m[2] === '/pics' && method === 'POST') {
        const pics = newPics();
        await DB.prepare('UPDATE students SET pics = ? WHERE id = ?').bind(pics, s.id).run();
        await DB.prepare('DELETE FROM limits WHERE key = ?').bind(`pics:${s.id}`).run();
        return h.json({ student: { id: s.id, pics: picsOf(pics) } });
      }
      if (m[2] === '/approve' && method === 'POST') {
        if (s.status !== 'pending') return h.json({ ok: true });
        if (!s.claims) {
          await DB.prepare("UPDATE students SET status = 'active' WHERE id = ?").bind(s.id).run();
          return h.json({ ok: true });
        }
        // the family says this player is a classmate already on the roster: from now on that classmate
        // plays as the family's player (the game combined the two players' progress and sends it here)
        const was = await DB.prepare("SELECT * FROM students WHERE id = ? AND class = ? AND status = 'active'").bind(s.claims, s.class).first();
        if (!was) { await DB.prepare("UPDATE students SET status = 'active', claims = NULL WHERE id = ?").bind(s.id).run(); return h.json({ ok: true }); }
        const body = await h.readBody(request) || {};
        const st = [];
        if (body.profile && typeof body.profile === 'object') {
          const text = JSON.stringify(body.profile);
          if (text.length > 400000) return h.fail(400, 'That progress is too big to combine.');
          const row = await DB.prepare('SELECT updated FROM players WHERE code = ?').bind(s.player).first();
          if (row) st.push(DB.prepare('UPDATE players SET data = ?, updated = ? WHERE code = ?').bind(text, Math.max(Date.now(), row.updated + 1), s.player));
        }
        if (!was.home) st.push(DB.prepare('DELETE FROM players WHERE code = ? AND account IS NULL').bind(was.player));
        st.push(DB.prepare('UPDATE students SET player = ?, home = 1, buddy = COALESCE(?, buddy) WHERE id = ?').bind(s.player, s.buddy, was.id));
        st.push(DB.prepare('DELETE FROM students WHERE id = ?').bind(s.id));
        await DB.batch(st);
        return h.json({ ok: true, merged: was.id });
      }
      return h.fail(404, 'Not found.');
    }

    m = path.match(/^\/teach\/assignments\/([\w-]+)$/);
    if (m) {
      const a = await DB.prepare('SELECT a.* FROM assignments a JOIN classes c ON c.id = a.class WHERE a.id = ? AND c.teacher = ?').bind(m[1], acct).first();
      if (!a) return h.fail(404, 'That assignment was not found.');
      if (method === 'PUT') {
        const body = await h.readBody(request) || {};
        const d = cleanAssignment(body.data);
        if (!d) return h.fail(400, 'Pick what to practise and a goal.');
        await DB.prepare('UPDATE assignments SET data = ?, due = ?, archived = ? WHERE id = ?').bind(JSON.stringify(d), d.due, body.archived ? 1 : 0, a.id).run();
        return h.json({ assignment: { id: a.id, ...d, created: a.created, archived: !!body.archived } });
      }
      if (method === 'DELETE') { await DB.prepare('DELETE FROM assignments WHERE id = ?').bind(a.id).run(); return h.json({ ok: true }); }
    }
    return h.fail(404, 'Not found.');
  }

  // ---------------- students logging in ----------------
  if (path === '/class/link' && method === 'POST') {
    // a family links a player from home: the teacher says yes before it joins
    if (await h.limited(env, request, 'cls-link', 30, 60)) return h.fail(429, 'Too many tries from here. Try again later.');
    const body = await h.readBody(request) || {};
    const player = h.cleanCode(body.player);
    const c = await DB.prepare('SELECT * FROM classes WHERE code = ? AND archived = 0').bind(h.cleanCode(body.code)).first();
    if (!c) return h.fail(404, "That class code wasn't found. Check the words and number.");
    const p = await DB.prepare('SELECT code, data FROM players WHERE code = ?').bind(player).first();
    if (!p) return h.fail(404, 'Save this player online first.');
    const dup = await DB.prepare('SELECT id, status FROM students WHERE class = ? AND player = ?').bind(c.id, player).first();
    if (dup) return h.json({ ok: true, status: dup.status });
    let claims = null, name = cleanStudentName(body.name);
    if (body.claims) {
      const was = await DB.prepare("SELECT id, name FROM students WHERE id = ? AND class = ? AND status = 'active'").bind(String(body.claims), c.id).first();
      if (!was) return h.fail(404, 'That classmate was not found.');
      claims = was.id; name = was.name;
    }
    if (!name) return h.fail(400, 'Type a first name or nickname (no last names or emails).');
    const have = await DB.prepare('SELECT COUNT(*) AS n FROM students WHERE class = ?').bind(c.id).first();
    if ((have?.n ?? 0) >= MAX_STUDENTS + 10) return h.fail(400, 'That class is full.');
    let buddy = null; try { buddy = JSON.parse(p.data).buddy ?? null; } catch { /* the buddy shows after the first save */ }
    await DB.prepare("INSERT INTO students (id, class, name, player, pics, home, status, claims, buddy, created) VALUES (?, ?, ?, ?, ?, 1, 'pending', ?, ?, ?)").bind(newId(h), c.id, name, player, newPics(), claims, isBuddyId(buddy) ? buddy : null, Date.now()).run();
    return h.json({ ok: true, status: 'pending', class: { name: c.name } });
  }
  if (path === '/class/link' && method === 'DELETE') {
    // the family unlinks: the player stays theirs, it just leaves the class
    if (await h.limited(env, request, 'cls-link', 30, 60)) return h.fail(429, 'Too many tries from here. Try again later.');
    const body = await h.readBody(request) || {};
    const r = await DB.prepare('DELETE FROM students WHERE player = ? AND class = ? AND (home = 1 OR status = ?)').bind(h.cleanCode(body.player), String(body.class ?? ''), 'pending').run();
    return r.meta.changes ? h.json({ ok: true }) : h.fail(404, 'That link was not found.');
  }

  m = path.match(/^\/class\/student\/([^/]+)$/);
  if (m && method === 'GET') {
    // a player's classes, class work and boards (the save code is the key, as for the player itself)
    if (await h.limited(env, request, 'cls-me', 3000, 60)) return h.fail(429, 'Too many tries from here. Try again later.');
    const code = h.cleanCode(decodeURIComponent(m[1]));
    const week = isWeek(url.searchParams.get('week')) ? url.searchParams.get('week') : null;
    const rows = (await DB.prepare(`SELECT s.id AS sid, s.name AS sname, s.status, s.home, c.*, t.display FROM students s JOIN classes c ON c.id = s.class
      LEFT JOIN teachers t ON t.account = c.teacher WHERE s.player = ?`).bind(code).all()).results ?? [];
    const classes = [], pending = [];
    for (const r of rows) {
      if (r.status !== 'active') { pending.push({ id: r.id, name: r.name, teacher: r.display }); continue; }
      if (r.archived) continue;
      const as = (await DB.prepare('SELECT id, data, created FROM assignments WHERE class = ? AND archived = 0 ORDER BY created').bind(r.id).all()).results ?? [];
      const assignments = as.map(a => ({ id: a.id, ...JSON.parse(a.data), created: a.created })).filter(a => !a.students || a.students.includes(r.sid));
      const wk = week ? await classWeek(env, r.id, week) : [];
      classes.push({
        id: r.id, name: r.name, grade: r.grade, teacher: r.display ?? 'Your teacher', home: !!r.home,
        student: { id: r.sid, name: r.sname }, board: !!r.board, goal: r.goal, assignments,
        week: { right: wk.reduce((t, x) => t + x.right, 0), ms: wk.reduce((t, x) => t + x.ms, 0), played: wk.filter(x => x.right || x.ms).length, students: wk.length },
        rows: r.board ? wk.map(x => ({ name: x.name, buddy: x.buddy, right: x.right, ms: x.ms, me: x.id === r.sid })) : [],
        challenge: await challengeOf(env, r.id),
      });
    }
    return h.json({ classes, pending });
  }
  m = path.match(/^\/class\/week\/([^/]+)$/);
  if (m && method === 'PUT') {
    // the game sends this week's effort after playing (for the boards)
    if (await h.limited(env, request, 'cls-week', 6000, 60)) return h.fail(429, 'Saving too often. It will catch up.');
    const code = h.cleanCode(decodeURIComponent(m[1]));
    const body = await h.readBody(request, 4000) || {};
    if (!isWeek(body.week)) return h.fail(400, 'Which week?');
    const p = await DB.prepare('SELECT code FROM players WHERE code = ?').bind(code).first();
    if (!p) return h.fail(404, 'That save code no longer exists.');
    const w = cleanWeek(body), now = Date.now();
    const name = typeof body.name === 'string' ? body.name.replace(/[<>`@]/g, '').trim().slice(0, 16) : null;
    const buddy = isBuddyId(body.buddy) ? body.buddy : null;
    await DB.prepare(`INSERT INTO player_week (id, player, week, correct, ms, stars, name, buddy, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET correct = excluded.correct, ms = excluded.ms, stars = excluded.stars, name = excluded.name, buddy = excluded.buddy, updated = excluded.updated`)
      .bind(`${code}:${body.week}`, code, body.week, w.right, w.ms, w.stars, name, buddy, now).run();
    if (buddy) await DB.prepare('UPDATE students SET buddy = ? WHERE player = ?').bind(buddy, code).run();
    return h.json({ ok: true });
  }
  m = path.match(/^\/class\/([^/]+)\/login$/);
  if (m && method === 'POST') {
    if (await h.limited(env, request, 'cls-login', 1200, 60)) return h.fail(429, 'Lots of tries from this school right now. Wait a minute and try again.');
    const c = await DB.prepare('SELECT id, archived FROM classes WHERE code = ?').bind(h.cleanCode(decodeURIComponent(m[1]))).first();
    if (!c) return h.fail(404, "That class code wasn't found.");
    if (c.archived) return h.fail(410, 'This class is closed. Ask your teacher.');
    const body = await h.readBody(request) || {};
    const s = await DB.prepare("SELECT id, name, player, pics FROM students WHERE id = ? AND class = ? AND status = 'active'").bind(String(body.student ?? ''), c.id).first();
    if (!s) return h.fail(404, "That name isn't in this class.");
    const key = `pics:${s.id}`;
    if (await blocked(env, key, PIC_TRIES)) return h.fail(429, "Let's take a little break. Ask your teacher to check your pictures.");
    const given = Array.isArray(body.pics) ? body.pics.map(Number) : [];
    const want = picsOf(s.pics);
    if (given.length !== 2 || given[0] !== want[0] || given[1] !== want[1]) {
      await count(env, key, PIC_REST_MIN);
      return h.json({ error: 'Not quite! Try your two pictures again.', wrong: true }, 403);
    }
    await DB.prepare('DELETE FROM limits WHERE key = ?').bind(key).run();
    let row = await DB.prepare('SELECT data, updated FROM players WHERE code = ?').bind(s.player).first();
    if (!row) {
      // the player was tidied away or deleted: a fresh one with the same name
      const now = Date.now(), data = starterProfile(s.name, randomBuddy(), now);
      await DB.prepare('INSERT OR REPLACE INTO players (code, data, updated, created, opened) VALUES (?, ?, ?, ?, ?)').bind(s.player, data, now, now, now).run();
      row = { data, updated: now };
    } else await DB.prepare('UPDATE players SET opened = ? WHERE code = ?').bind(Date.now(), s.player).run();
    return new Response(`{"code":${JSON.stringify(s.player)},"name":${JSON.stringify(s.name)},"updated":${Number(row.updated)},"profile":${row.data}}`, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
  m = path.match(/^\/class\/([^/]+)$/);
  if (m && method === 'GET') {
    // a class code: the class and its students' names, to tap your own
    if (await h.limited(env, request, 'cls-open', 600, 60)) return h.fail(429, 'Lots of tries from this school right now. Wait a minute and try again.');
    const c = await DB.prepare('SELECT c.id, c.name, c.grade, c.archived, t.display FROM classes c LEFT JOIN teachers t ON t.account = c.teacher WHERE c.code = ?').bind(h.cleanCode(decodeURIComponent(m[1]))).first();
    if (!c) return h.fail(404, "That class code wasn't found. Check the words and number.");
    if (c.archived) return h.fail(410, 'This class is closed. Ask your teacher.');
    const st = await DB.prepare("SELECT id, name, buddy FROM students WHERE class = ? AND status = 'active' ORDER BY name").bind(c.id).all();
    return h.json({ class: { name: c.name, grade: c.grade, teacher: c.display ?? 'Your teacher' }, students: (st.results ?? []).map(s => ({ id: s.id, name: s.name, buddy: s.buddy })) });
  }

  // ---------------- the family board ----------------
  m = path.match(/^\/family\/([^/]+)$/);
  if (m && method === 'GET') {
    if (await h.limited(env, request, 'family', 600, 60)) return h.fail(429, 'Too many tries from here. Try again later.');
    const code = h.cleanCode(decodeURIComponent(m[1]));
    const week = url.searchParams.get('week');
    if (!isWeek(week)) return h.fail(400, 'Which week?');
    const p = await DB.prepare('SELECT account FROM players WHERE code = ?').bind(code).first();
    if (!p) return h.fail(404, 'That save code no longer exists.');
    if (!p.account) return h.json({ players: [], account: false });
    const r = await DB.prepare(`SELECT p.code, w.name, w.buddy, w.correct, w.ms, w.stars FROM players p JOIN player_week w ON w.id = p.code || ':' || ?
      WHERE p.account = ? ORDER BY w.stars DESC, w.correct DESC`).bind(week, p.account).all();
    return h.json({ account: true, players: (r.results ?? []).map(x => ({ name: x.name ?? 'Player', buddy: x.buddy, stars: x.stars, right: x.correct, ms: x.ms, me: x.code === code })) });
  }

  // ---------------- the world board (the Arcade's daily challenge) ----------------
  m = path.match(/^\/world\/(\w+)$/);
  if (m && method === 'GET') {
    const day = url.searchParams.get('day');
    if (!isDay(day)) return h.fail(400, 'Which day?');
    const r = await DB.prepare('SELECT alias, buddy, score FROM world_scores WHERE game = ? AND day = ? ORDER BY score DESC, at ASC LIMIT 20').bind(m[1], day).all();
    return h.json({ rows: r.results ?? [] });
  }
  if (path === '/world' && method === 'POST') {
    if (await h.limited(env, request, 'world', 300, 60)) return h.fail(429, 'Too many scores from here. Try again later.');
    const body = await h.readBody(request, 2000) || {};
    const score = Number(body.score);
    if (!worldScoreOk(body.game, score)) return h.fail(400, "That score can't go on the board.");
    if (!isDay(body.day) || Math.abs(Date.parse(body.day) - Date.parse(new Date().toISOString().slice(0, 10))) > 1.5 * DAY) return h.fail(400, 'That day is over.');
    if (!isAlias(body.alias) || !isBuddyId(body.buddy) || typeof body.who !== 'string' || body.who.length < 8 || body.who.length > 64) return h.fail(400, 'Not a board entry.');
    const who = await h.sha256(`world:${body.who}`), id = `${body.game}:${body.day}:${who}`;
    // this player's own limit too: a few dozen scores a day is already a lot of rounds
    const key = `world:${who}`;
    if (await blocked(env, key, 60)) return h.fail(429, 'That is a lot of rounds today! Your best is on the board.');
    await count(env, key, 24 * 60);
    await DB.prepare(`INSERT INTO world_scores (id, game, day, who, alias, buddy, score, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET score = MAX(score, excluded.score), alias = excluded.alias, buddy = excluded.buddy, at = CASE WHEN excluded.score > score THEN excluded.at ELSE at END`)
      .bind(id, body.game, body.day, who, body.alias, body.buddy, score, Date.now()).run();
    return h.json({ ok: true });
  }
  return null;
}

/** Once a day (worker.js tidy): old world boards, old weeks, families' link requests nobody answered. */
export async function tidyClasses(env) {
  const now = Date.now();
  const day = (t) => new Date(t).toISOString().slice(0, 10);
  await env.DB.prepare('DELETE FROM world_scores WHERE day < ?').bind(day(now - 30 * DAY)).run();
  await env.DB.prepare('DELETE FROM player_week WHERE week < ?').bind(day(now - 400 * DAY)).run();
  await env.DB.prepare("DELETE FROM students WHERE status = 'pending' AND created < ?").bind(now - 60 * DAY).run();
  await env.DB.prepare('DELETE FROM challenge_classes WHERE class NOT IN (SELECT id FROM classes)').run();
}
