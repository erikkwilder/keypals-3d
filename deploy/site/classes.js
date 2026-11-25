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
// A family can link a player from home to a class (the teacher says yes first), and unlink it later. To say
// it's a child on the list already, the family taps that child's two pictures, as the child does to log in.
//
// Becoming a teacher takes a Google sign-in. A Google account from a school or company (Google Workspace:
// Google tells us its domain, `hd`) is approved straight away; a plain Gmail account can set up classes,
// but students can't log in to them until an admin says yes (Grown-ups → Admin → Teachers). Teachers from
// before this check, and the people who look after Keypals, are approved.
//
// Students with a school Google account (like Gimkit): "Sign in with Google" on the class login, then the
// class code once (and, if they're on the list already, their two pictures): next time Google alone takes
// them to their player, on any computer. We keep a hash of the Google account's id and the first name,
// never the email; a class can be kept to one school domain. Until the teacher sets it, a class is kept to
// the teacher's own school domain, or Google sign-in is off when the teacher has none; in a class not kept
// to a domain, a new name from Google waits for the teacher's yes, like a family's link. A class also
// keeps its My path rules (keep students on the path, path things a day, time limits for the free-time
// places: src/lib/path/rules.ts).
//
// A test sign-in exists for checking the teacher side on a computer: only when KP_DEV_SIGNIN is "1" (a
// variable never set on the live site) AND the address is 127.0.0.1 or localhost. (&gmail=1: a plain
// Gmail account; otherwise a school account.) Students have one too (/class/google/dev).

import { CLASS_WORDS, MAX_CLASSES, MAX_STUDENTS, PICTURE_COUNT, START_BUDDIES, cleanClassName, cleanClassSettings, cleanStudentName, cleanTeacherName, sameStudentName, cleanWeek, domainOk, googleDomain, inOrder, isAlias, isBuddyId, isDay, isWeek, splitNames, teacherStatusFor, worldScoreOk } from './class-rules.js';

/** Tables for the weekly backup (worker.js backup): table and its key. The world boards aren't kept. */
export const CLASS_TABLES = { teachers: 'account', classes: 'id', students: 'id', assignments: 'id', player_week: 'id', challenges: 'id', challenge_classes: 'id', teacher_status: 'account', class_settings: 'class', student_google: 'gid', account_domains: 'account' };

const DAY = 86400000;
/** When a class challenge's week is over: once its Sunday has ended across the Americas too (Monday 12:00 UTC).
 *  A week's key is the child's own Monday, so ending at Monday 00:00 UTC closed it at 7 pm on a Sunday in Atlanta.
 *  This is only how long its code can still be joined. Whether a class "is in a challenge this week already"
 *  goes by the week itself (below), so a class east of the Atlantic can start the new week's on Monday morning. */
const GRACE = 12 * 3600000;
export const weekEnds = week => Date.parse(week) + 7 * DAY + GRACE;
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
/** Wrong pictures: five tries from one address, then a ten-minute rest for that child at that address, so
 *  someone else's wrong guesses from elsewhere can't lock the child out (a class at school shares one
 *  address, which is fine). All addresses together get twice that, so many addresses can't guess a pair. */
export const PIC_TRIES = 5, PIC_REST_MIN = 10, PIC_TRIES_ALL = 10;

let swept = 0;
/** One more for a key: true when that's over `max` this window (worker.js limited() counts this way too).
 *  Counted and checked in one statement, so calls sent all at once can't all read "not yet" before any of
 *  them writes. Rows whose window is over are deleted as we go (at most once a minute from each copy of the
 *  Worker), so none is kept long past its window: the privacy notice says up to an hour. */
export async function hit(env, key, max, minutes) {
  const now = Date.now();
  if (now - swept > 60000) { swept = now; await env.DB.prepare('DELETE FROM limits WHERE reset < ?').bind(now).run(); }
  const row = await env.DB.prepare(`INSERT INTO limits (key, n, reset) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET n = CASE WHEN reset < ? THEN 1 ELSE n + 1 END, reset = CASE WHEN reset < ? THEN excluded.reset ELSE reset END
    RETURNING n`).bind(key, now + minutes * 60000, now, now).first();
  return row.n > max;
}
/** Gives back one try hit() counted: a code that turned out to exist (worker.js codeTry). */
export const giveBack = (env, key) => env.DB.prepare('UPDATE limits SET n = n - 1 WHERE key = ? AND n > 0').bind(key).run();
/** The class of an active student's player (null: not a class player). Saving players must never fail
 *  because of classes: before schema-classes.sql is applied there's simply no class to find. */
async function classOfPlayer(env, code, any = false) {
  try {
    return await env.DB.prepare(any ? 'SELECT class FROM students WHERE player = ? AND home = 0 LIMIT 1' : "SELECT class FROM students WHERE player = ? AND status = 'active' LIMIT 1").bind(code).first();
  } catch { return null; }
}
/** Did a class make this player (not a family's player linked to a class)? */
export const madeByClass = async (env, code) => !!(await classOfPlayer(env, code, true));
/** A whole class plays on one school address, so opening and saving a class player, and sending its week for
 *  the boards, count by the player's own code (an hour's worth each) and by its class (room for a big class),
 *  never by the address. */
export const CLASS_PLAYER_LIMITS = { open: 120, save: 900, 'cls-week': 900 };
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
/** A teacher's status: approved, pending (a plain Gmail account, waiting for an admin) or declined. No
 *  row: a teacher from before the check, approved. Never fails (before the schema has the table: approved). */
async function statusOf(env, account) {
  try { return (await env.DB.prepare('SELECT status FROM teacher_status WHERE account = ?').bind(account).first())?.status ?? 'approved'; } catch { return 'approved'; }
}
/** A class students can use: not archived, and its teacher's classes are on. */
const classOn = async (env, c) => !c.archived && (await statusOf(env, c.teacher)) === 'approved';
const NOT_ON = "This class isn't open yet. Your teacher will hear from us soon.";
/** A class's settings (cleaned, with the usual for anything not set). Students' Google sign-in, until the
 *  teacher sets it: kept to the teacher's own school domain (the `hd` Google gave), or off when the teacher's
 *  account has none, so a stranger's Google account can't join a class nobody opened to it. (`teacher`: given
 *  where Google sign-in matters; without it, off.) */
async function settingsOf(env, classId, teacher = null) {
  let row = null;
  try { row = await env.DB.prepare('SELECT data FROM class_settings WHERE class = ?').bind(classId).first(); } catch { /* before the schema: the usual */ }
  let d = {}; try { d = row ? JSON.parse(row.data) : {}; } catch { /* the usual */ }
  if (!row) { const hd = teacher ? await domainOf(env, teacher) : null; d = { google: hd ? 'on' : 'off', domain: hd }; }
  return cleanClassSettings(d);
}
/** What students' games need of the settings (not how they sign in, and they get the order as the order of
 *  their class work: older games read that without knowing). */
const playSettings = (s) => ({ keep: s.keep, goal: s.goal, limits: s.limits, play: s.play, sound: s.sound, words: s.words });
/** The school domain Google gave an account at sign-in (null: a plain Gmail account, or none). */
async function domainOf(env, account) {
  try { return (await env.DB.prepare('SELECT hd FROM account_domains WHERE account = ?').bind(account).first())?.hd ?? null; } catch { return null; }
}
/** Whether the class with this code takes this student's Google sign-in (`t`, its ticket): the class, its
 *  settings and where the account is already, or `no`, the refusal to send. Joining asks it, and so does the
 *  game, back from Google, before it shows the class's list or "I'm new" (/class/google/check). */
async function googleClass(env, h, request, t, rawCode) {
  const found = await h.codeTry(env, request, 'cls-code');
  if (!found) return { no: h.fail(429, 'Lots of tries from this school right now. Wait a minute and try again.') };
  const c = await env.DB.prepare('SELECT * FROM classes WHERE code = ?').bind(h.cleanCode(rawCode)).first();
  if (!c) return { no: h.fail(404, "That class code wasn't found. Check the words and number.") };
  await found();
  if (c.archived) return { no: h.fail(410, 'This class is closed. Ask your teacher.') };
  if (!(await classOn(env, c))) return { no: h.fail(403, NOT_ON) };
  const set = await settingsOf(env, c.id, c.teacher);
  if (set.google === 'off') return { no: h.fail(403, "Your teacher hasn't turned on Google sign-in for this class. Use your class code and pictures.") };
  if (!domainOk(t.hd, set.domain)) return { no: h.fail(403, `This class is for school accounts from ${set.domain}. Sign in with your school Google account.`) };
  const had = await env.DB.prepare('SELECT g.student, s.class FROM student_google g LEFT JOIN students s ON s.id = g.student WHERE g.gid = ?').bind(t.gid).first();
  if (had && had.class && had.class !== c.id) return { no: h.fail(409, 'This Google account is in another class already. Ask your teacher.') };
  return { c, set, had };
}
/** worker.js, after a grown-up signs in: keep the school domain Google gave (or forget an old one). */
export async function noteSignIn(env, account, provider, me) {
  const hd = provider === 'google' || provider === 'dev' ? googleDomain(me) : null;
  try {
    if (hd) await env.DB.prepare('INSERT INTO account_domains (account, hd, updated) VALUES (?, ?, ?) ON CONFLICT(account) DO UPDATE SET hd = excluded.hd, updated = excluded.updated').bind(account, hd, Date.now()).run();
    else await env.DB.prepare('DELETE FROM account_domains WHERE account = ?').bind(account).run();
  } catch { /* before the schema: nothing to keep */ }
}
const ownClass = (env, acct, id) => env.DB.prepare('SELECT * FROM classes WHERE id = ? AND teacher = ?').bind(id, acct).first();
async function ownStudent(env, acct, id) {
  return env.DB.prepare('SELECT s.* FROM students s JOIN classes c ON c.id = s.class WHERE s.id = ? AND c.teacher = ?').bind(id, acct).first();
}
const classView = (c, extra = {}) => ({ id: c.id, name: c.name, grade: c.grade, code: c.code, board: !!c.board, goal: c.goal, archived: !!c.archived, created: c.created, ...extra });

// ---------- assignments: kept as the game describes them, checked and trimmed ----------
const WHAT = ['skills', 'typing', 'learn', 'check', 'unit'];
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
  if (out.what === 'unit') {
    // a unit: its items in order (My path's: ep:, trip:, skill:, game:, battle:, check), and the path unit it
    // came from, if any
    out.items = ids(d.items, 40).filter(x => /^(ep|trip|skill|game|battle):[\w.-]+$|^check$/.test(x));
    if (typeof d.unit === 'string' && /^[\w:.-]{1,40}$/.test(d.unit)) out.unit = d.unit;
    if (d.subject === 'math' || d.subject === 'typing') out.subject = d.subject;
    out.goal = { type: 'finish', n: 1 };
  }
  const n = { skills: out.skills, typing: out.lessons, learn: out.episodes, check: out.areas, unit: out.items }[out.what];
  return n && n.length ? out : null;
}

// ---------- the boards ----------
/** Every active student's week in a class (the class board, the class goal). */
async function classWeek(env, classId, week) {
  const r = await env.DB.prepare(`SELECT s.id, s.name, s.buddy, COALESCE(w.correct, 0) AS correct, COALESCE(w.ms, 0) AS ms, COALESCE(w.stars, 0) AS stars
    FROM students s LEFT JOIN player_week w ON w.id = s.player || ':' || ? WHERE s.class = ? AND s.status = 'active'
    ORDER BY correct DESC, ms DESC, s.name`).bind(week, classId).all();
  return (r.results ?? []).map(x => ({ id: x.id, name: x.name, buddy: x.buddy, right: x.correct, ms: x.ms, stars: x.stars }));
}
/** A class against class challenge: every class's average right answers per student for its week (names only:
 *  another class's id is never sent, so it can't be tried elsewhere; the asking class's own is, so the game
 *  can show which one is theirs). */
async function challengeView(env, ch, mine) {
  const r = await env.DB.prepare(`SELECT c.id, c.name, COUNT(s.id) AS n, COALESCE(SUM(w.correct), 0) AS correct
    FROM challenge_classes x JOIN classes c ON c.id = x.class
    LEFT JOIN students s ON s.class = c.id AND s.status = 'active'
    LEFT JOIN player_week w ON w.id = s.player || ':' || ?
    WHERE x.challenge = ? GROUP BY c.id, c.name`).bind(ch.week, ch.id).all();
  const classes = (r.results ?? []).map(x => ({ id: x.id, name: x.name, students: x.n, avg: x.n ? Math.round((x.correct / x.n) * 10) / 10 : 0 }))
    .sort((a, b) => b.avg - a.avg || a.name.localeCompare(b.name)).map((x, i) => (x.id === mine ? x : { ...x, id: `class-${i + 1}` }));
  return { code: ch.code, week: ch.week, ends: weekEnds(ch.week), classes };
}
async function challengeOf(env, classId) {
  const ch = await env.DB.prepare('SELECT c.* FROM challenge_classes x JOIN challenges c ON c.id = x.challenge WHERE x.class = ? ORDER BY c.week DESC LIMIT 1').bind(classId).first();
  return ch ? challengeView(env, ch, classId) : null;
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
    st.push(env.DB.prepare('DELETE FROM student_google WHERE student = ?').bind(s.id));
    st.push(env.DB.prepare('DELETE FROM students WHERE id = ?').bind(s.id));
  }
  if (st.length) await env.DB.batch(st);
}

/** Delete a class and everything in it: its students (dropStudents), class work, challenge places, settings
 *  and Google sign-ins. When the teacher deletes it, and for each class of a teacher whose account goes
 *  (deleteTeacher, tidyClasses). How many players the class made went with it. */
export async function deleteClass(env, id, teacher) {
  const st = (await env.DB.prepare('SELECT id, player, home FROM students WHERE class = ?').bind(id).all()).results ?? [];
  await dropStudents(env, st, teacher);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM assignments WHERE class = ?').bind(id),
    env.DB.prepare('DELETE FROM challenge_classes WHERE class = ?').bind(id),
    env.DB.prepare('DELETE FROM class_settings WHERE class = ?').bind(id),
    env.DB.prepare('DELETE FROM student_google WHERE class = ?').bind(id),
    env.DB.prepare('DELETE FROM classes WHERE id = ?').bind(id),
  ]);
  return st.filter(s => !s.home).length;
}
/** worker.js, when a grown-up deletes their account: a teacher's classes and the children on them go too, and
 *  so do what made them a teacher and the school domain Google gave, right away (as the privacy notice says).
 *  The 3-year tidy-up does the same for an account nobody used (tidyClasses). */
export async function deleteTeacher(env, account) {
  for (const c of (await env.DB.prepare('SELECT id FROM classes WHERE teacher = ?').bind(account).all()).results ?? []) await deleteClass(env, c.id, account);
  await env.DB.batch(['teachers', 'teacher_status', 'account_domains'].map(t => env.DB.prepare(`DELETE FROM ${t} WHERE account = ?`).bind(account)));
}

const devReady = (env, url) => env.KP_DEV_SIGNIN === '1' && (url.hostname === '127.0.0.1' || url.hostname === 'localhost');

/** A student's two pictures: null when right; else the answer to send (wrong, or resting after too many).
 *  Every try is counted before it's checked (PIC_TRIES); a right answer clears this child's count. */
async function picturesWrong(env, h, request, s, pics) {
  const all = `pics:${s.id}`, here = `${all}:${await h.addressHash(env, request, 'pics')}`;
  if (await hit(env, here, PIC_TRIES, PIC_REST_MIN) || await hit(env, all, PIC_TRIES_ALL, PIC_REST_MIN)) return h.fail(429, "Let's take a little break. Ask your teacher to check your pictures.");
  const given = Array.isArray(pics) ? pics.map(Number) : [];
  const want = picsOf(s.pics);
  if (given.length !== 2 || given[0] !== want[0] || given[1] !== want[1]) return h.json({ error: 'Not quite! Try your two pictures again.', wrong: true }, 403);
  await env.DB.prepare('DELETE FROM limits WHERE key = ? OR key = ?').bind(all, here).run();
  return null;
}
/** A logged-in student's player, as saved (sent on as it is), made fresh if it was tidied away. */
async function playerFor(env, s, extra = '') {
  let row = await env.DB.prepare('SELECT data, updated FROM players WHERE code = ?').bind(s.player).first();
  if (!row) {
    // the player was tidied away or deleted: a fresh one with the same name
    const now = Date.now(), data = starterProfile(s.name, randomBuddy(), now);
    await env.DB.prepare('INSERT OR REPLACE INTO players (code, data, updated, created, opened) VALUES (?, ?, ?, ?, ?)').bind(s.player, data, now, now, now).run();
    row = { data, updated: now };
  } else await env.DB.prepare('UPDATE players SET opened = ? WHERE code = ?').bind(Date.now(), s.player).run();
  return new Response(`{${extra}"code":${JSON.stringify(s.player)},"name":${JSON.stringify(s.name)},"updated":${Number(row.updated)},"profile":${row.data}}`, { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}

// ---------- students signing in with their school Google account ----------
/** The hash we keep for a Google account (never its id or email). */
export const googleKey = (h, sub) => h.sha256(`kp-student:${sub}`);
/**
 * worker.js, back from Google for a student (never a grown-up's account, no sign-in cookie): a one-time
 * ticket for the next ten minutes, holding only the hashed id, the first name and the school domain, and
 * back to the game with it after a `#` (never sent to a server by the browser).
 */
export async function studentGoogleBack(env, url, base, me, h) {
  const back = (frag) => Response.redirect(`${url.origin}${base}/#${frag}`, 302);
  if (!me || !me.sub) return back('classgoogle-no');
  const now = Date.now(), ticket = h.randomToken(24);
  const first = cleanStudentName(me.given_name || String(me.name ?? '').split(' ')[0]);
  await env.DB.prepare('DELETE FROM google_tickets WHERE expires < ?').bind(now).run();
  await env.DB.prepare('INSERT INTO google_tickets (hash, gid, name, hd, expires) VALUES (?, ?, ?, ?, ?)').bind(await h.sha256(ticket), await googleKey(h, me.sub), first, googleDomain(me), now + 10 * 60000).run();
  return back(`classgoogle=${ticket}`);
}
async function ticketOf(env, h, ticket) {
  if (typeof ticket !== 'string' || ticket.length < 16 || ticket.length > 64) return null;
  const t = await env.DB.prepare('SELECT * FROM google_tickets WHERE hash = ?').bind(await h.sha256(ticket)).first();
  return t && t.expires > Date.now() ? t : null;
}

/**
 * Our part of the API, or null when the path isn't ours. `h` is worker.js's toolbox: json, fail,
 * currentAccount, limited, codeTry, playerTry, addressHash, readBody, sha256, randomToken, cookie, cleanCode,
 * newCode, and base (the game's
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
    const gmail = url.searchParams.get('gmail') === '1';
    const sub = `dev-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}${gmail ? '-gmail' : ''}`, now = Date.now();
    let acct = await DB.prepare("SELECT id FROM accounts WHERE provider = 'dev' AND sub = ?").bind(sub).first();
    if (!acct) { acct = { id: h.randomToken(12) }; await DB.prepare("INSERT INTO accounts (id, provider, sub, email, name, created, seen) VALUES (?, 'dev', ?, NULL, ?, ?, ?)").bind(acct.id, sub, name, now, now).run(); }
    // a test school account has a school domain; a test Gmail account has none
    await noteSignIn(env, acct.id, 'dev', gmail ? {} : { hd: 'school.test' });
    const token = h.randomToken(32);
    await DB.prepare('INSERT INTO sessions (hash, account, expires) VALUES (?, ?, ?)').bind(await h.sha256(token), acct.id, now + DAY).run();
    const base = h.base ?? '/keypals';
    return new Response(null, { status: 302, headers: { location: `${base}/#teach`, 'set-cookie': h.cookie('kp_session', token, 86400, base) } });
  }

  // (a class's own players stay with the class, never filed under a grown-up's account; a family's player
  // linked to a class is the family's. worker.js checks this when a player is filed, after the sign-in and
  // the limit on tries, so it can't tell anyone which codes are a class's)

  // ---------------- teachers ----------------
  if (path === '/teach/me' && method === 'GET') {
    const acct = await h.currentAccount(env, request);
    if (!acct) return h.json({ signedIn: false });
    const t = await DB.prepare('SELECT display, agreed FROM teachers WHERE account = ?').bind(acct.id).first();
    const canTeach = !!t || teacherStatusFor({ provider: acct.provider, hd: null, admin: h.isAdmin?.(env, acct) }) !== null;
    return h.json({ signedIn: true, account: { name: acct.name, provider: acct.provider, domain: await domainOf(env, acct.id) }, canTeach, teacher: t ? { display: t.display, agreed: t.agreed, status: await statusOf(env, acct.id) } : null });
  }
  if (path === '/teach/me' && method === 'POST') {
    const acct = await h.currentAccount(env, request);
    if (!acct) return h.fail(401, 'Please sign in first.');
    const body = await h.readBody(request) || {};
    const display = cleanTeacherName(body.display);
    if (!display) return h.fail(400, 'Type the name your students call you.');
    if (body.agree !== true) return h.fail(400, 'Please read and agree to the note first.');
    const was = await DB.prepare('SELECT account FROM teachers WHERE account = ?').bind(acct.id).first();
    const now = Date.now();
    let status = was ? await statusOf(env, acct.id) : null;
    if (!was) {
      // a new teacher: a Google sign-in; a school account is on straight away, a plain Gmail waits for us
      const hd = await domainOf(env, acct.id);
      status = teacherStatusFor({ provider: acct.provider, hd, admin: h.isAdmin?.(env, acct) });
      if (!status) return h.fail(403, 'Teachers sign in with a Google account (a school account works best). Sign out, then sign in with Google.');
      await DB.prepare('INSERT OR REPLACE INTO teacher_status (account, status, hd, created, decided, decided_by) VALUES (?, ?, ?, ?, ?, ?)').bind(acct.id, status, hd, now, status === 'approved' ? now : null, status === 'approved' ? (hd ? 'domain' : 'admin') : null).run();
    }
    await DB.prepare('INSERT INTO teachers (account, display, agreed, created) VALUES (?, ?, ?, ?) ON CONFLICT(account) DO UPDATE SET display = excluded.display, agreed = excluded.agreed').bind(acct.id, display, now, now).run();
    return h.json({ teacher: { display, agreed: now, status } });
  }

  // ---------------- the people who look after Keypals: new teachers to say yes to ----------------
  if (path === '/admin/teachers' && method === 'GET') {
    const acct = await h.currentAccount(env, request);
    if (!h.isAdmin?.(env, acct)) return h.fail(403, 'This is only for the people who look after Keypals.');
    const r = await DB.prepare(`SELECT t.account, t.display, t.created, s.status, s.hd, s.decided, a.name, a.email, a.provider,
      (SELECT COUNT(*) FROM classes c WHERE c.teacher = t.account) AS classes,
      (SELECT COUNT(*) FROM students x JOIN classes c ON c.id = x.class WHERE c.teacher = t.account AND x.status = 'active') AS students
      FROM teacher_status s JOIN teachers t ON t.account = s.account LEFT JOIN accounts a ON a.id = s.account
      ORDER BY CASE s.status WHEN 'pending' THEN 0 WHEN 'declined' THEN 1 ELSE 2 END, s.created DESC LIMIT 300`).all();
    return h.json({ teachers: (r.results ?? []).map(x => ({ account: x.account, display: x.display, name: x.name, email: x.email, provider: x.provider, hd: x.hd, status: x.status, created: x.created, decided: x.decided, classes: x.classes, students: x.students })) });
  }
  m = path.match(/^\/admin\/teachers\/([\w-]+)$/);
  if (m && method === 'POST') {
    const acct = await h.currentAccount(env, request);
    if (!h.isAdmin?.(env, acct)) return h.fail(403, 'This is only for the people who look after Keypals.');
    const body = await h.readBody(request) || {};
    if (!['approved', 'declined', 'pending'].includes(body.status)) return h.fail(400, 'Approve or turn down?');
    const r = await DB.prepare('UPDATE teacher_status SET status = ?, decided = ?, decided_by = ? WHERE account = ?').bind(body.status, Date.now(), 'admin', m[1]).run();
    return r.meta.changes ? h.json({ ok: true, status: body.status }) : h.fail(404, 'That teacher was not found.');
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
        let google = new Set();
        try { google = new Set(((await DB.prepare('SELECT student FROM student_google WHERE class = ?').bind(c.id).all()).results ?? []).map(x => x.student)); } catch { /* before the schema: none */ }
        // a family's claim to a classmate waits under the classmate's name: the home player's own nickname, as saved
        // and cleaned as the list's names are (never an email or a last name), goes with it, so the teacher can
        // judge it ("Mia (from home) says it's Maria")
        const homeNames = new Map(((await DB.prepare("SELECT s.id, p.data FROM students s JOIN players p ON p.code = s.player WHERE s.class = ? AND s.status = 'pending' AND s.claims IS NOT NULL").bind(c.id).all()).results ?? []).map(x => {
          let name = null; try { const d = JSON.parse(x.data); name = typeof d?.name === 'string' ? cleanStudentName(d.name) : null; } catch { /* no name to show */ }
          return [x.id, name];
        }));
        const students = (st.results ?? []).map(s => ({ id: s.id, name: s.name, pics: picsOf(s.pics), home: !!s.home, status: s.status, claims: s.claims, buddy: s.buddy, created: s.created, google: google.has(s.id), ...(s.claims ? { homeName: homeNames.get(s.id) ?? null } : {}) }));
        const settings = await settingsOf(env, c.id, c.teacher);
        const assignments = inOrder((as.results ?? []).map(a => ({ id: a.id, ...JSON.parse(a.data), created: a.created, archived: !!a.archived })), settings.order);
        return h.json({ class: classView(c), students, assignments, week: week ? await classWeek(env, c.id, week) : [], challenge: await challengeOf(env, c.id), settings, teacher: { status: await statusOf(env, acct), domain: await domainOf(env, acct) } });
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
        // My path and time rules, and students' Google sign-in
        let settings;
        if (body.settings && typeof body.settings === 'object') {
          settings = cleanClassSettings(body.settings, await settingsOf(env, c.id, c.teacher));
          await DB.prepare('INSERT INTO class_settings (class, data, updated) VALUES (?, ?, ?) ON CONFLICT(class) DO UPDATE SET data = excluded.data, updated = excluded.updated').bind(c.id, JSON.stringify(settings), Date.now()).run();
        }
        return h.json({ class: classView({ ...c, name, grade, board, goal, archived }), ...(settings ? { settings } : {}) });
      }
      if (rest === '' && method === 'DELETE') {
        // a typed confirmation: the class's name
        const body = await h.readBody(request) || {};
        if (String(body.confirm ?? '').trim().toLowerCase() !== c.name.trim().toLowerCase()) return h.fail(400, `Type the class's name, ${c.name}, to delete it.`);
        return h.json({ ok: true, removed: await deleteClass(env, c.id, acct) });
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
        // (by the week asked for, not by the clock: last week's may still be open for the Americas' Sunday)
        if (cur && cur.week >= body.week) return h.fail(400, 'This class is in a challenge this week already.');
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
        // a teacher's tries at challenge codes are limited, and a code that's wrong, over or full gets the one
        // answer, so codes (and the classes in them) can't be found by trying
        if (await hit(env, `cls-join:${acct}`, 20, 60)) return h.fail(429, 'That is a lot of tries. Try again in a while.');
        const body = await h.readBody(request) || {};
        const ch = await DB.prepare('SELECT * FROM challenges WHERE code = ?').bind(h.cleanCode(body.code)).first();
        const cur = await challengeOf(env, c.id);
        if (ch && cur && cur.code === ch.code) return h.fail(400, 'This class is in that challenge already.');
        const n = ch ? await DB.prepare('SELECT COUNT(*) AS n FROM challenge_classes WHERE challenge = ?').bind(ch.id).first() : null;
        if (!ch || weekEnds(ch.week) < Date.now() || (n?.n ?? 0) >= 8) return h.fail(404, "That code can't be joined. Check the words and number: a challenge that's over or full can't be joined either.");
        if (cur && cur.week >= ch.week) return h.fail(400, 'This class is in a challenge this week already.');
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
        await DB.prepare('DELETE FROM limits WHERE key = ? OR substr(key, 1, ?) = ?').bind(`pics:${s.id}`, `pics:${s.id}:`.length, `pics:${s.id}:`).run();
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
    // (a class code, then a save code: each on the budget every route that looks one up shares, worker.js codeTry)
    const classFound = await h.codeTry(env, request, 'cls-code');
    if (!classFound) return h.fail(429, 'Too many tries from here. Try again later.');
    const c = await DB.prepare('SELECT * FROM classes WHERE code = ? AND archived = 0').bind(h.cleanCode(body.code)).first();
    if (!c) return h.fail(404, "That class code wasn't found. Check the words and number.");
    await classFound();
    if (!(await classOn(env, c))) return h.fail(403, NOT_ON);
    const playerFound = await h.codeTry(env, request);
    if (!playerFound) return h.fail(429, 'Too many tries from here. Try again later.');
    const p = await DB.prepare('SELECT code, data FROM players WHERE code = ?').bind(player).first();
    if (!p) return h.fail(404, 'Save this player online first.');
    await playerFound();
    const dup = await DB.prepare('SELECT id, status FROM students WHERE class = ? AND player = ?').bind(c.id, player).first();
    if (dup) return h.json({ ok: true, status: dup.status });
    let claims = null, name = cleanStudentName(body.name);
    if (body.claims) {
      const was = await DB.prepare("SELECT id, name, pics FROM students WHERE id = ? AND class = ? AND status = 'active'").bind(String(body.claims), c.id).first();
      if (!was) return h.fail(404, 'That classmate was not found.');
      // once the teacher says yes, that classmate plays as this player, so the family shows it really is the
      // child: their two pictures from the login card, counted and rested with the class login's tries (a
      // class code and a name off the list aren't enough)
      const wrong = await picturesWrong(env, h, request, was, body.pics);
      if (wrong) return wrong;
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
      if (!(await classOn(env, r))) continue;
      const as = (await DB.prepare('SELECT id, data, created FROM assignments WHERE class = ? AND archived = 0 ORDER BY created').bind(r.id).all()).results ?? [];
      const set = await settingsOf(env, r.id);
      const assignments = inOrder(as.map(a => ({ id: a.id, ...JSON.parse(a.data), created: a.created })).filter(a => !a.students || a.students.includes(r.sid)), set.order);
      const wk = week ? await classWeek(env, r.id, week) : [];
      classes.push({
        id: r.id, name: r.name, grade: r.grade, teacher: r.display ?? 'Your teacher', home: !!r.home,
        student: { id: r.sid, name: r.sname }, board: !!r.board, goal: r.goal, assignments,
        week: { right: wk.reduce((t, x) => t + x.right, 0), ms: wk.reduce((t, x) => t + x.ms, 0), played: wk.filter(x => x.right || x.ms).length, students: wk.length },
        rows: r.board ? wk.map(x => ({ name: x.name, buddy: x.buddy, right: x.right, ms: x.ms, me: x.id === r.sid })) : [],
        challenge: await challengeOf(env, r.id),
        settings: playSettings(set),
      });
    }
    return h.json({ classes, pending });
  }
  m = path.match(/^\/class\/week\/([^/]+)$/);
  if (m && method === 'PUT') {
    // the game sends this week's effort after playing (for the boards): only for a week near now (its Monday,
    // two weeks either way), so nobody can make records for weeks to come that the tidy-up never reaches
    const code = h.cleanCode(decodeURIComponent(m[1]));
    const body = await h.readBody(request, 4000) || {};
    const monday = Date.parse(body.week);
    if (!isWeek(body.week) || new Date(monday).getUTCDay() !== 1 || !(Math.abs(Date.now() - monday) <= 15 * DAY)) return h.fail(400, 'Which week?');
    // a class player counts by its code and class (a whole class shares one school address), anyone else by
    // address and on the budget every route that looks up a save code shares (worker.js playerTry)
    const found = await h.playerTry(env, request, 'cls-week', 6000, code);
    if (!found) return h.fail(429, 'Saving too often. It will catch up.');
    const p = await DB.prepare('SELECT code, data FROM players WHERE code = ?').bind(code).first();
    if (!p) return h.fail(404, 'That save code no longer exists.');
    await found();
    const w = cleanWeek(body), now = Date.now();
    // the nickname the family board shows is the player's own, as saved: never a name sent with the week
    let name = null;
    try { const d = JSON.parse(p.data); if (typeof d?.name === 'string') name = d.name.replace(/[<>`@]/g, '').trim().slice(0, 16) || null; } catch { /* no name to show */ }
    const buddy = isBuddyId(body.buddy) ? body.buddy : null;
    await DB.prepare(`INSERT INTO player_week (id, player, week, correct, ms, stars, name, buddy, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET correct = excluded.correct, ms = excluded.ms, stars = excluded.stars, name = excluded.name, buddy = excluded.buddy, updated = excluded.updated`)
      .bind(`${code}:${body.week}`, code, body.week, w.right, w.ms, w.stars, name, buddy, now).run();
    if (buddy) await DB.prepare('UPDATE students SET buddy = ? WHERE player = ?').bind(buddy, code).run();
    return h.json({ ok: true });
  }
  // ---------------- a student's school Google account ----------------
  if (path === '/class/google/dev' && method === 'GET') {
    // the test sign-in for a student (this computer only): as if Google had said who it is
    if (!devReady(env, url)) return h.fail(404, 'Not found.');
    const name = cleanStudentName(url.searchParams.get('name')) || 'Sam';
    return studentGoogleBack(env, url, h.base ?? '/keypals', { sub: String(url.searchParams.get('sub') || `dev-${name}`).slice(0, 60), given_name: name, hd: url.searchParams.get('hd') || 'school.test' }, h);
  }
  if (path === '/class/google' && method === 'POST') {
    // back from Google: straight in if this account is in a class already; "waiting" if it asked to join one
    // and the teacher hasn't said yes yet (the sign-in isn't used up: nothing changed); else "type your class code"
    if (await h.limited(env, request, 'cls-google', 1200, 60)) return h.fail(429, 'Lots of tries from this school right now. Wait a minute and try again.');
    const body = await h.readBody(request, 2000) || {};
    const t = await ticketOf(env, h, body.ticket);
    if (!t) return h.fail(410, 'That sign-in ran out. Sign in with Google again.');
    const s = await DB.prepare("SELECT s.id, s.name, s.player, s.class, s.status, c.archived, c.teacher FROM student_google g JOIN students s ON s.id = g.student JOIN classes c ON c.id = s.class WHERE g.gid = ? AND s.status IN ('active', 'pending')").bind(t.gid).first();
    if (s?.status === 'active' && await classOn(env, { archived: s.archived, teacher: s.teacher })) {
      await DB.prepare('DELETE FROM google_tickets WHERE hash = ?').bind(t.hash).run();
      return playerFor(env, s, '"status":"in",');
    }
    if (s?.status === 'pending' && !s.archived) return h.json({ status: 'waiting', name: s.name });
    return h.json({ status: 'code', first: t.name ?? null });
  }
  if (path === '/class/google/check' && method === 'POST') {
    // back from Google, before the game shows a class's list or "I'm new": whether this class takes this Google
    // account, by the checks joining makes (and joining still makes them). Nothing changes, and the sign-in
    // isn't used up
    if (await h.limited(env, request, 'cls-google', 1200, 60)) return h.fail(429, 'Lots of tries from this school right now. Wait a minute and try again.');
    const body = await h.readBody(request, 2000) || {};
    const t = await ticketOf(env, h, body.ticket);
    if (!t) return h.fail(410, 'That sign-in ran out. Sign in with Google again.');
    const { no } = await googleClass(env, h, request, t, body.code);
    return no ?? h.json({ ok: true });
  }
  if (path === '/class/google/join' && method === 'POST') {
    // the class code once: as a new student (the first name Google gave), or as someone on the list already
    // (their two pictures say so); from then on, Google alone
    if (await h.limited(env, request, 'cls-google', 1200, 60)) return h.fail(429, 'Lots of tries from this school right now. Wait a minute and try again.');
    const body = await h.readBody(request, 2000) || {};
    const t = await ticketOf(env, h, body.ticket);
    if (!t) return h.fail(410, 'That sign-in ran out. Sign in with Google again.');
    // (every check the game asked first, back from Google, is made again here: googleClass)
    const { no, c, set, had } = await googleClass(env, h, request, t, body.code);
    if (no) return no;
    // (the name it waits under goes back with it, for the game to say)
    const waiting = (name) => h.json({ error: 'Your teacher needs to say yes first. Then sign in with Google again.', pending: true, name }, 403);
    let s = null;
    if (body.student) {
      s = await DB.prepare("SELECT id, name, player, pics FROM students WHERE id = ? AND class = ? AND status = 'active'").bind(String(body.student), c.id).first();
      if (!s) return h.fail(404, "That name isn't in this class.");
      const taken = await DB.prepare('SELECT gid FROM student_google WHERE student = ?').bind(s.id).first();
      if (taken && taken.gid !== t.gid) return h.fail(409, `Someone already signs in with Google as ${s.name}. Ask your teacher.`);
      const wrong = await picturesWrong(env, h, request, s, body.pics);
      if (wrong) return wrong;
    } else if (had?.student) {
      s = await DB.prepare('SELECT id, name, player, pics, status FROM students WHERE id = ?').bind(had.student).first();
      // asked to join already: still waiting for the teacher
      if (s?.status === 'pending') return waiting(s.name);
      if (s?.status !== 'active') s = null;
    }
    if (!s) {
      // a new student: the first name Google gave (or the one typed, if Google gave none). In a class kept to
      // its school's domain they join as before; in any other the teacher says yes first (the Students tab),
      // so a stranger's Google account can't put itself on the list
      const name = t.name || cleanStudentName(body.name);
      if (!name) return h.json({ error: 'Type your first name.', needName: true }, 400);
      // a name the class has already (on the list, or waiting for the teacher's yes) isn't added again: that's
      // most likely her, who taps her name and her two pictures; anyone else the teacher adds. So the list
      // never gets a second, empty copy of a child
      const same = ((await DB.prepare("SELECT name FROM students WHERE class = ? AND status IN ('active', 'pending')").bind(c.id).all()).results ?? []).find(r => sameStudentName(r.name, name));
      if (same) return h.json({ error: `There's already a ${same.name} in this class. If that's you, tap your name and then your two pictures. If it isn't, ask your teacher to add you.`, sameName: true }, 409);
      const status = set.domain ? 'active' : 'pending';
      const have = await DB.prepare(`SELECT COUNT(*) AS n FROM students WHERE class = ?${status === 'active' ? " AND status = 'active'" : ''}`).bind(c.id).first();
      if ((have?.n ?? 0) >= MAX_STUDENTS + (status === 'active' ? 0 : 10)) return h.fail(400, 'That class is full. Ask your teacher.');
      const now = Date.now(), buddy = randomBuddy();
      let code = null;
      for (let tries = 0; tries < 5 && !code; tries++) {
        const cand = h.newCode();
        const r = await DB.prepare('INSERT OR IGNORE INTO players (code, data, updated, created, opened) VALUES (?, ?, ?, ?, ?)').bind(cand, starterProfile(name, buddy, now), now, now, now).run();
        if (r.meta.changes) code = cand;
      }
      if (!code) return h.fail(500, 'Could not add you. Try again.');
      s = { id: newId(h), name, player: code, status };
      await DB.prepare('INSERT INTO students (id, class, name, player, pics, home, status, buddy, created) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)').bind(s.id, c.id, name, code, newPics(), status, buddy, now).run();
    }
    // on the waiting list, the sign-in isn't used up: until it runs out, tapping again says "waiting" again
    // (above), never "ran out"; let in, it is
    await DB.batch([
      DB.prepare('INSERT OR REPLACE INTO student_google (gid, student, class, created) VALUES (?, ?, ?, ?)').bind(t.gid, s.id, c.id, Date.now()),
      ...(s.status === 'pending' ? [] : [DB.prepare('DELETE FROM google_tickets WHERE hash = ?').bind(t.hash)]),
    ]);
    if (s.status === 'pending') return waiting(s.name);
    return playerFor(env, s, '"status":"in",');
  }

  m = path.match(/^\/class\/([^/]+)\/login$/);
  if (m && method === 'POST') {
    if (await h.limited(env, request, 'cls-login', 1200, 60)) return h.fail(429, 'Lots of tries from this school right now. Wait a minute and try again.');
    const found = await h.codeTry(env, request, 'cls-code');
    if (!found) return h.fail(429, 'Lots of tries from this school right now. Wait a minute and try again.');
    const c = await DB.prepare('SELECT id, archived, teacher FROM classes WHERE code = ?').bind(h.cleanCode(decodeURIComponent(m[1]))).first();
    if (!c) return h.fail(404, "That class code wasn't found.");
    await found();
    if (c.archived) return h.fail(410, 'This class is closed. Ask your teacher.');
    if (!(await classOn(env, c))) return h.fail(403, NOT_ON);
    const body = await h.readBody(request) || {};
    const s = await DB.prepare("SELECT id, name, player, pics FROM students WHERE id = ? AND class = ? AND status = 'active'").bind(String(body.student ?? ''), c.id).first();
    if (!s) return h.fail(404, "That name isn't in this class.");
    const wrong = await picturesWrong(env, h, request, s, body.pics);
    if (wrong) return wrong;
    return playerFor(env, s);
  }
  m = path.match(/^\/class\/([^/]+)$/);
  if (m && method === 'GET') {
    // a class code: the class and its students' names, to tap your own
    if (await h.limited(env, request, 'cls-open', 600, 60)) return h.fail(429, 'Lots of tries from this school right now. Wait a minute and try again.');
    // (and on the budget every route that looks up a class code shares, used up only by codes that aren't
    // found: worker.js codeTry)
    const found = await h.codeTry(env, request, 'cls-code');
    if (!found) return h.fail(429, 'Lots of tries from this school right now. Wait a minute and try again.');
    const c = await DB.prepare('SELECT c.id, c.name, c.grade, c.archived, c.teacher, t.display FROM classes c LEFT JOIN teachers t ON t.account = c.teacher WHERE c.code = ?').bind(h.cleanCode(decodeURIComponent(m[1]))).first();
    if (!c) return h.fail(404, "That class code wasn't found. Check the words and number.");
    await found();
    if (c.archived) return h.fail(410, 'This class is closed. Ask your teacher.');
    if (!(await classOn(env, c))) return h.fail(403, NOT_ON);
    const st = await DB.prepare("SELECT id, name, buddy FROM students WHERE class = ? AND status = 'active' ORDER BY name").bind(c.id).all();
    // and whether its students may sign in with Google, for the game to offer it here too (nothing more about how)
    const google = (await settingsOf(env, c.id, c.teacher)).google !== 'off';
    return h.json({ class: { name: c.name, grade: c.grade, teacher: c.display ?? 'Your teacher', google }, students: (st.results ?? []).map(s => ({ id: s.id, name: s.name, buddy: s.buddy })) });
  }

  // ---------------- the family board ----------------
  m = path.match(/^\/family\/([^/]+)$/);
  if (m && method === 'GET') {
    if (await h.limited(env, request, 'family', 600, 60)) return h.fail(429, 'Too many tries from here. Try again later.');
    // it shows every player in a grown-up's account (names, buddies, stars, minutes), so it answers only that
    // grown-up, signed in: on the family's own computer. One child's save code, which anyone with it could
    // send, isn't enough
    const acct = await h.currentAccount(env, request);
    if (!acct) return h.fail(401, 'Please sign in first.');
    const code = h.cleanCode(decodeURIComponent(m[1]));
    const week = url.searchParams.get('week');
    if (!isWeek(week)) return h.fail(400, 'Which week?');
    const found = await h.codeTry(env, request);
    if (!found) return h.fail(429, 'Too many tries from here. Try again later.');
    // a code in someone else's account, or in none, gets the answer a code that doesn't exist gets (and uses
    // up a try like one), so trying codes can't tell them apart
    const p = await DB.prepare('SELECT account FROM players WHERE code = ? AND account = ?').bind(code, acct.id).first();
    if (!p) return h.fail(404, 'That save code no longer exists.');
    await found();
    const r = await DB.prepare(`SELECT p.code, w.name, w.buddy, w.correct, w.ms, w.stars FROM players p JOIN player_week w ON w.id = p.code || ':' || ?
      WHERE p.account = ? ORDER BY w.stars DESC, w.correct DESC`).bind(week, acct.id).all();
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
    if (await hit(env, key, 60, 24 * 60)) return h.fail(429, 'That is a lot of rounds today! Your best is on the board.');
    await DB.prepare(`INSERT INTO world_scores (id, game, day, who, alias, buddy, score, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET score = MAX(score, excluded.score), alias = excluded.alias, buddy = excluded.buddy, at = CASE WHEN excluded.score > score THEN excluded.at ELSE at END`)
      .bind(id, body.game, body.day, who, body.alias, body.buddy, score, Date.now()).run();
    return h.json({ ok: true });
  }
  return null;
}

/** Once a day (worker.js tidy): old world boards, old weeks, families' link requests nobody answered, and
 *  what's left of accounts and players that are gone. */
export async function tidyClasses(env) {
  const now = Date.now();
  const day = (t) => new Date(t).toISOString().slice(0, 10);
  await env.DB.prepare('DELETE FROM world_scores WHERE day < ?').bind(day(now - 30 * DAY)).run();
  await env.DB.prepare('DELETE FROM player_week WHERE week < ?').bind(day(now - 400 * DAY)).run();
  // (a new name from Google that nobody said yes to: the player the class made for it goes too)
  await env.DB.prepare("DELETE FROM players WHERE account IS NULL AND code IN (SELECT player FROM students WHERE status = 'pending' AND home = 0 AND created < ?)").bind(now - 60 * DAY).run();
  await env.DB.prepare("DELETE FROM students WHERE status = 'pending' AND created < ?").bind(now - 60 * DAY).run();
  await env.DB.prepare('DELETE FROM challenge_classes WHERE class NOT IN (SELECT id FROM classes)').run();
  await env.DB.prepare('DELETE FROM google_tickets WHERE expires < ?').bind(now).run();
  await env.DB.prepare('DELETE FROM student_google WHERE student NOT IN (SELECT id FROM students)').run();
  // a teacher's classes and the children on them go with the teacher's account (not used for 3 years:
  // worker.js tidy; or deleted before deleteTeacher did it straight away), and so do the teacher's rows and
  // the school domain of any grown-up whose account is gone
  for (const c of (await env.DB.prepare('SELECT id, teacher FROM classes WHERE teacher NOT IN (SELECT id FROM accounts)').all()).results ?? []) await deleteClass(env, c.id, c.teacher);
  for (const t of ['teachers', 'teacher_status', 'account_domains']) await env.DB.prepare(`DELETE FROM ${t} WHERE account NOT IN (SELECT id FROM accounts)`).run();
  // weekly records whose player is gone (stopped, deleted everywhere, or not opened for 18 months)
  await env.DB.prepare('DELETE FROM player_week WHERE player NOT IN (SELECT code FROM players)').run();
}
