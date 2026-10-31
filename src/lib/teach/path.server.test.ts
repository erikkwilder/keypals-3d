// The classes server's newer parts, run end to end through worker.js on a real SQLite with the real schema:
// who may become a teacher and when their classes turn on (a school Google account straight away, a plain
// Gmail account once an admin says yes), the Admin list, a class's My path and time rules, unit class
// work, and students signing in with their own school Google account (a hashed id and a first name kept,
// never the email).
import { beforeEach, describe, expect, it } from 'vitest';
import worker from '../../../deploy/site/worker.js';
import { cleanAssignment, studentGoogleBack, googleKey } from '../../../deploy/site/classes.js';
import { cleanClassSettings, domainOk, googleDomain, teacherStatusFor } from '../../../deploy/site/class-rules.js';
import { TestD1 } from './d1.testutil';

type Env = { DB: TestD1; KP_DEV_SIGNIN?: string; ADMIN_EMAILS?: string };
let env: Env;
type Res = { status: number; json: any; headers: Headers; text: string };
async function call(method: string, path: string, body?: unknown, o: { cookie?: string } = {}): Promise<Res> {
  const req = new Request(`http://127.0.0.1:8787/keypals/api${path}`, {
    method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': '10.0.0.1', ...(o.cookie ? { cookie: o.cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual',
  });
  const r: Response = await worker.fetch(req, env);
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json, headers: r.headers, text };
}
const b64url = (bytes: ArrayBuffer) => Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sha256 = async (t: string) => b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
const h = { sha256, randomToken: (n = 24) => b64url(crypto.getRandomValues(new Uint8Array(n)).buffer as ArrayBuffer) };
/** a grown-up signed in with a provider (as the real sign-in leaves them), with a session cookie */
async function account(provider: string, email: string, hd?: string) {
  const id = `acct-${Math.random().toString(36).slice(2, 8)}`, now = Date.now(), token = h.randomToken(32);
  env.DB.db.prepare('INSERT INTO accounts (id, provider, sub, email, name, created, seen) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, provider, `sub-${id}`, email, 'A Grown-up', now, now);
  env.DB.db.prepare('INSERT INTO sessions (hash, account, expires) VALUES (?, ?, ?)').run(await sha256(token), id, now + 86400000);
  if (hd) env.DB.db.prepare('INSERT INTO account_domains (account, hd, updated) VALUES (?, ?, ?)').run(id, hd, now);
  return { id, cookie: `kp_session=${token}` };
}
async function devTeacher(name: string, gmail = false) {
  const r = await call('GET', `/auth/dev?name=${encodeURIComponent(name)}${gmail ? '&gmail=1' : ''}`);
  const cookie = r.headers.get('set-cookie')!.split(';')[0];
  const t = await call('POST', '/teach/me', { display: name, agree: true }, { cookie });
  return { cookie, status: t.json.teacher?.status, res: t };
}
async function classWith(cookie: string, names: string) {
  const c = await call('POST', '/teach/classes', { name: 'Room 12', grade: 3 }, { cookie });
  const add = await call('POST', `/teach/classes/${c.json.class.id}/students`, { text: names }, { cookie });
  return { id: c.json.class.id as string, code: c.json.class.code as string, students: add.json.students as { id: string; name: string; pics: number[] }[] };
}
/** a student back from the test Google sign-in: the ticket from the address */
async function googleTicket(name: string, sub: string, hd = 'school.test') {
  const r = await call('GET', `/class/google/dev?name=${name}&sub=${sub}&hd=${hd}`);
  expect(r.status).toBe(302);
  const m = /#classgoogle=([\w-]+)/.exec(r.headers.get('location') ?? '');
  expect(m).not.toBeNull();
  return m![1];
}

beforeEach(() => { env = { DB: new TestD1(), KP_DEV_SIGNIN: '1', ADMIN_EMAILS: 'erik@example.org' }; });

describe('who may teach, and when classes turn on', () => {
  it('the rules: a school account (hd) is approved, plain Gmail waits, admins are approved, others can\'t', () => {
    expect(teacherStatusFor({ provider: 'google', hd: 'school.org' })).toBe('approved');
    expect(teacherStatusFor({ provider: 'google', hd: null })).toBe('pending');
    expect(teacherStatusFor({ provider: 'google', hd: null, admin: true })).toBe('approved');
    expect(teacherStatusFor({ provider: 'microsoft', hd: null })).toBeNull();
    expect(googleDomain({ sub: '1', hd: 'Lincoln.K12.org' })).toBe('lincoln.k12.org');
    expect(googleDomain({ sub: '1', email: 'kid@gmail.com' })).toBeNull();
  });
  it('a school account\'s classes are on straight away', async () => {
    const t = await devTeacher('Ms. Rivera');
    expect(t.status).toBe('approved');
    const c = await classWith(t.cookie, 'Maria');
    expect((await call('GET', `/class/${c.code}`)).status).toBe(200);
    expect((await call('POST', `/class/${c.code}/login`, { student: c.students[0].id, pics: c.students[0].pics })).status).toBe(200);
  });
  it('a plain Gmail account sets up, but students wait until an admin approves; turned down stays off', async () => {
    const t = await devTeacher('Mr. Lee', true);
    expect(t.status).toBe('pending');
    expect((await call('GET', '/teach/me', undefined, { cookie: t.cookie })).json.teacher.status).toBe('pending');
    const c = await classWith(t.cookie, 'Sam\nAva');
    expect(c.students).toHaveLength(2);
    const look = await call('GET', `/class/${c.code}`);
    expect(look.status).toBe(403);
    expect(look.json.error).toMatch(/isn't open yet/);
    expect((await call('POST', `/class/${c.code}/login`, { student: c.students[0].id, pics: c.students[0].pics })).status).toBe(403);
    // the Admin list: only for admins
    const parent = await account('google', 'mum@example.org');
    expect((await call('GET', '/admin/teachers', undefined, { cookie: parent.cookie })).status).toBe(403);
    const erik = await account('google', 'erik@example.org');
    const list = (await call('GET', '/admin/teachers', undefined, { cookie: erik.cookie })).json.teachers;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ display: 'Mr. Lee', status: 'pending', classes: 1, students: 2 });
    expect((await call('POST', `/admin/teachers/${list[0].account}`, { status: 'approved' }, { cookie: parent.cookie })).status).toBe(403);
    expect((await call('POST', `/admin/teachers/${list[0].account}`, { status: 'approved' }, { cookie: erik.cookie })).status).toBe(200);
    expect((await call('GET', `/class/${c.code}`)).status).toBe(200);
    await call('POST', `/admin/teachers/${list[0].account}`, { status: 'declined' }, { cookie: erik.cookie });
    expect((await call('GET', `/class/${c.code}`)).status).toBe(403);
  });
  it('Erik\'s own account is approved; a Microsoft account can\'t become a new teacher; teachers from before stay working', async () => {
    const erik = await account('google', 'erik@example.org');
    expect((await call('POST', '/teach/me', { display: 'Mr. Wilder', agree: true }, { cookie: erik.cookie })).json.teacher.status).toBe('approved');
    const ms = await account('microsoft', 'teacher@school.org');
    const r = await call('POST', '/teach/me', { display: 'Ms. Ng', agree: true }, { cookie: ms.cookie });
    expect(r.status).toBe(403);
    expect(r.json.error).toMatch(/Google/);
    expect((await call('GET', '/teach/me', undefined, { cookie: ms.cookie })).json.canTeach).toBe(false);
    // a Microsoft teacher from before the check: no status row, still approved, still works
    env.DB.db.prepare('INSERT INTO teachers (account, display, agreed, created) VALUES (?, ?, ?, ?)').run(ms.id, 'Ms. Ng', 1, 1);
    expect((await call('GET', '/teach/me', undefined, { cookie: ms.cookie })).json.teacher.status).toBe('approved');
    const c = await classWith(ms.cookie, 'Kai');
    expect((await call('GET', `/class/${c.code}`)).status).toBe(200);
  });
  it('the domain Google gives at sign-in is kept for the account (a school one), not for Gmail', async () => {
    const school = await devTeacher('Ms. Park');
    const me = (await call('GET', '/teach/me', undefined, { cookie: school.cookie })).json;
    expect(me.account.domain).toBe('school.test');
    const gm = await devTeacher('Mr. Cho', true);
    expect((await call('GET', '/teach/me', undefined, { cookie: gm.cookie })).json.account.domain).toBeNull();
  });
});

describe("a class's My path rules and unit class work", () => {
  it('settings are checked, kept, and sent to students (without how they sign in)', async () => {
    expect(cleanClassSettings({ keep: 'nope', goal: 99, limits: { island: '15', garden: '999', pool: '10' }, google: 'maybe', domain: 'x' })).toEqual({ keep: 'off', goal: 6, limits: { island: '15' }, play: {}, sound: 'on', words: '', order: [], google: 'on', domain: null });
    const t = await devTeacher('Ms. Rivera');
    const c = await classWith(t.cookie, 'Maria');
    const r = await call('PATCH', `/teach/classes/${c.id}`, { settings: { keep: 'first', goal: 2, limits: { island: '10', dances: 'earned' }, domain: 'Lincoln.org' } }, { cookie: t.cookie });
    expect(r.json.settings).toEqual({ keep: 'first', goal: 2, limits: { island: '10', dances: 'earned' }, play: {}, sound: 'on', words: '', order: [], google: 'on', domain: 'lincoln.org' });
    // a later change keeps the rest
    await call('PATCH', `/teach/classes/${c.id}`, { settings: { limits: { garden: '20' } } }, { cookie: t.cookie });
    const detail = (await call('GET', `/teach/classes/${c.id}`, undefined, { cookie: t.cookie })).json;
    expect(detail.settings.limits).toEqual({ island: '10', dances: 'earned', garden: '20' });
    expect(detail.teacher).toEqual({ status: 'approved', domain: 'school.test' });
    const lg = await call('POST', `/class/${c.code}/login`, { student: c.students[0].id, pics: c.students[0].pics });
    const mine = (await call('GET', `/class/student/${lg.json.code}?week=2026-10-26`)).json.classes[0];
    expect(mine.settings).toEqual({ keep: 'first', goal: 2, limits: { island: '10', dances: 'earned', garden: '20' }, play: {}, sound: 'on', words: '' });
  });
  it('a class from before these rules keeps working, and gets the usual', async () => {
    const t = await devTeacher('Ms. Rivera');
    const c = await classWith(t.cookie, 'Maria');
    env.DB.db.prepare('INSERT INTO class_settings (class, data, updated) VALUES (?, ?, ?)').run(c.id, JSON.stringify({ keep: 'first', goal: 2, limits: { island: '10' }, google: 'on', domain: null }), 1);
    const lg = await call('POST', `/class/${c.code}/login`, { student: c.students[0].id, pics: c.students[0].pics });
    const mine = (await call('GET', `/class/student/${lg.json.code}?week=2026-10-26`)).json.classes[0];
    expect(mine.settings).toEqual({ keep: 'first', goal: 2, limits: { island: '10' }, play: {}, sound: 'on', words: '' });
    // an older game changing one rule leaves the new ones alone
    await call('PATCH', `/teach/classes/${c.id}`, { settings: { play: { rule: 'open' }, sound: 'off' } }, { cookie: t.cookie });
    const r = await call('PATCH', `/teach/classes/${c.id}`, { settings: { keep: 'only' } }, { cookie: t.cookie });
    expect(r.json.settings).toMatchObject({ keep: 'only', play: { rule: 'open' }, sound: 'off' });
  });
  it('teachers set play time, an Arcade limit, sound off and a spelling list; students get them', async () => {
    const t = await devTeacher('Ms. Rivera');
    const c = await classWith(t.cookie, 'Maria');
    const r = await call('PATCH', `/teach/classes/${c.id}`, { settings: { limits: { arcade: '15' }, play: { rule: 'balanced', ratio: 2, freeMin: 5, capMin: 30, focus: 'fractions', versus: false }, sound: 'off', words: 'because friend <b>' } }, { cookie: t.cookie });
    expect(r.json.settings).toMatchObject({ limits: { arcade: '15' }, play: { rule: 'balanced', ratio: 2, freeMin: 5, capMin: 30, focus: 'fractions', versus: false }, sound: 'off', words: 'because friend b' });
    const lg = await call('POST', `/class/${c.code}/login`, { student: c.students[0].id, pics: c.students[0].pics });
    const mine = (await call('GET', `/class/student/${lg.json.code}?week=2026-10-26`)).json.classes[0];
    expect(mine.settings).toMatchObject({ limits: { arcade: '15' }, play: { ratio: 2, focus: 'fractions' }, sound: 'off', words: 'because friend b' });
    expect(mine.settings.google).toBeUndefined();
  });
  it('play time choices are checked', () => {
    expect(cleanClassSettings({ play: { rule: 'never', ratio: 7, freeMin: -1, capMin: 1000, focus: '<script>', versus: 'yes' } }).play).toEqual({});
  });
  it('a teacher puts units in their own order: students get them that way, older games too', async () => {
    const t = await devTeacher('Ms. Rivera');
    const c = await classWith(t.cookie, 'Maria');
    const unit = (title: string) => ({ what: 'unit', title, items: ['ep:frac-parts'], goal: { type: 'finish', n: 1 } });
    const ids: string[] = [];
    for (const n of ['First', 'Second', 'Third']) ids.push((await call('POST', `/teach/classes/${c.id}/assignments`, { data: unit(n) }, { cookie: t.cookie })).json.assignment.id);
    await call('PATCH', `/teach/classes/${c.id}`, { settings: { order: [ids[2], ids[0]] } }, { cookie: t.cookie });
    const lg = await call('POST', `/class/${c.code}/login`, { student: c.students[0].id, pics: c.students[0].pics });
    const mine = (await call('GET', `/class/student/${lg.json.code}?week=2026-10-26`)).json.classes[0];
    expect(mine.assignments.map((a: { title: string }) => a.title)).toEqual(['Third', 'First', 'Second']);
    const detail = (await call('GET', `/teach/classes/${c.id}`, undefined, { cookie: t.cookie })).json;
    expect(detail.settings.order).toEqual([ids[2], ids[0]]);
    expect(detail.assignments.map((a: { title: string }) => a.title)).toEqual(['Third', 'First', 'Second']);
  });
  it('a unit: its items in order, checked; nothing else becomes an item', async () => {
    const u: any = cleanAssignment({ what: 'unit', title: 'Pie Pantry', unit: 'math:frac-a', subject: 'math', items: ['ep:frac-parts', 'trip:frac-a-1', 'game:pizza', 'battle:falls', 'check', 'bad item', 'skill:fr-equal', 'evil:<x>'], goal: { type: 'right', n: 5 } });
    expect(u.items).toEqual(['ep:frac-parts', 'trip:frac-a-1', 'game:pizza', 'battle:falls', 'check', 'skill:fr-equal']);
    expect(u.goal).toEqual({ type: 'finish', n: 1 });
    expect(u.unit).toBe('math:frac-a');
    expect(cleanAssignment({ what: 'unit', items: [], goal: { type: 'finish', n: 1 } })).toBeNull();
    const t = await devTeacher('Ms. Rivera');
    const c = await classWith(t.cookie, 'Maria');
    const a = await call('POST', `/teach/classes/${c.id}/assignments`, { data: { ...u, start: 1, due: null, students: null } }, { cookie: t.cookie });
    expect(a.json.assignment).toMatchObject({ what: 'unit', items: u.items, unit: 'math:frac-a' });
    const lg = await call('POST', `/class/${c.code}/login`, { student: c.students[0].id, pics: c.students[0].pics });
    expect((await call('GET', `/class/student/${lg.json.code}?week=2026-10-26`)).json.classes[0].assignments[0].items).toEqual(u.items);
  });
});

describe('students with their own school Google sign-in', () => {
  it('first time: the class code once, then added to the roster; next time Google alone', async () => {
    const t = await devTeacher('Ms. Rivera');
    const c = await classWith(t.cookie, 'Maria');
    const t1 = await googleTicket('Zoe', 'g-zoe');
    const first = await call('POST', '/class/google', { ticket: t1 });
    expect(first.json).toEqual({ status: 'code', first: 'Zoe' });
    const join = await call('POST', '/class/google/join', { ticket: t1, code: c.code.toLowerCase().replaceAll('-', ' ') });
    expect(join.status).toBe(200);
    expect(join.json).toMatchObject({ status: 'in', name: 'Zoe' });
    const roster = (await call('GET', `/teach/classes/${c.id}`, undefined, { cookie: t.cookie })).json.students;
    expect(roster.find((s: { name: string }) => s.name === 'Zoe')).toMatchObject({ status: 'active', google: true });
    // the ticket is used up
    expect((await call('POST', '/class/google', { ticket: t1 })).status).toBe(410);
    // another day, another computer: Google alone
    const again = await call('POST', '/class/google', { ticket: await googleTicket('Zoe', 'g-zoe') });
    expect(again.json).toMatchObject({ status: 'in', code: join.json.code, name: 'Zoe' });
  });
  it('someone on the list already: their two pictures say it\'s them, then it\'s linked', async () => {
    const t = await devTeacher('Ms. Rivera');
    const c = await classWith(t.cookie, 'Maria');
    const maria = c.students[0];
    const tk = await googleTicket('Maria', 'g-maria');
    expect((await call('POST', '/class/google/join', { ticket: tk, code: c.code, student: maria.id, pics: [maria.pics[1], maria.pics[0]] })).status).toBe(403);
    const ok = await call('POST', '/class/google/join', { ticket: tk, code: c.code, student: maria.id, pics: maria.pics });
    expect(ok.status).toBe(200);
    const school = (await call('POST', `/class/${c.code}/login`, { student: maria.id, pics: maria.pics })).json.code;
    expect(ok.json.code).toBe(school);
    // nobody else can take Maria with another Google account
    const other = await googleTicket('Maria', 'g-not-maria');
    const no = await call('POST', '/class/google/join', { ticket: other, code: c.code, student: maria.id, pics: maria.pics });
    expect(no.status).toBe(409);
  });
  it('the teacher decides: Google off, or only accounts from the school\'s domain', async () => {
    const t = await devTeacher('Ms. Rivera');
    const c = await classWith(t.cookie, 'Maria');
    expect(domainOk('lincoln.org', 'lincoln.org')).toBe(true);
    expect(domainOk('students.lincoln.org', 'lincoln.org')).toBe(true);
    expect(domainOk('gmail.com', 'lincoln.org')).toBe(false);
    expect(domainOk(null, 'lincoln.org')).toBe(false);
    expect(domainOk(null, null)).toBe(true);
    await call('PATCH', `/teach/classes/${c.id}`, { settings: { domain: 'lincoln.org' } }, { cookie: t.cookie });
    const wrong = await call('POST', '/class/google/join', { ticket: await googleTicket('Ava', 'g-ava', 'other.org'), code: c.code });
    expect(wrong.status).toBe(403);
    expect(wrong.json.error).toMatch(/lincoln\.org/);
    expect((await call('POST', '/class/google/join', { ticket: await googleTicket('Ava', 'g-ava', 'students.lincoln.org'), code: c.code })).status).toBe(200);
    await call('PATCH', `/teach/classes/${c.id}`, { settings: { google: 'off' } }, { cookie: t.cookie });
    const off = await call('POST', '/class/google/join', { ticket: await googleTicket('Ben', 'g-ben', 'lincoln.org'), code: c.code });
    expect(off.status).toBe(403);
    expect(off.json.error).toMatch(/class code and pictures/);
  });
  it('back from Google: only a hash of the id and the first name are kept, never the email', async () => {
    const me = { sub: '1098765432123456789', email: 'zoe.martinez@lincoln.org', email_verified: true, given_name: 'Zoe', family_name: 'Martinez', name: 'Zoe Martinez', hd: 'lincoln.org', picture: 'https://x/y.png' };
    const r = await studentGoogleBack(env, new URL('http://127.0.0.1:8787/keypals/api/auth/google/callback'), '/keypals', me, h);
    expect(r.status).toBe(302);
    const ticket = /#classgoogle=([\w-]+)/.exec(r.headers.get('location')!)![1];
    const rows = env.DB.rows('google_tickets');
    expect(rows).toHaveLength(1);
    expect(rows[0].gid).toBe(await googleKey(h, me.sub));
    const t = await devTeacher('Ms. Rivera');
    const c = await classWith(t.cookie, 'Maria');
    const join = await call('POST', '/class/google/join', { ticket, code: c.code });
    const payloads = [join.json, env.DB.rows('student_google'), env.DB.rows('students'), env.DB.rows('players'), env.DB.rows('google_tickets'), env.DB.rows('accounts'), (await call('GET', `/teach/classes/${c.id}`, undefined, { cookie: t.cookie })).json];
    for (const x of payloads) {
      const s = JSON.stringify(x);
      expect(s).not.toMatch(/zoe\.martinez|@lincoln|Martinez/);
      expect(s).not.toContain(me.sub);
    }
    expect(Object.keys(env.DB.rows('student_google')[0]).sort()).toEqual(['class', 'created', 'gid', 'student']);
    expect(env.DB.rows('google_tickets')).toHaveLength(0);
    // a student's Google sign-in never makes a grown-up's account or a sign-in cookie
    expect(r.headers.get('set-cookie')).toBeNull();
    expect(env.DB.rows('accounts').every(a => a.provider === 'dev')).toBe(true);
  });
  it('removing the student, or the class, removes the Google link too; the test sign-in is for this computer only', async () => {
    const t = await devTeacher('Ms. Rivera');
    const c = await classWith(t.cookie, 'Maria');
    const join = await call('POST', '/class/google/join', { ticket: await googleTicket('Zoe', 'g-zoe'), code: c.code });
    const zoe = (await call('GET', `/teach/classes/${c.id}`, undefined, { cookie: t.cookie })).json.students.find((s: { name: string }) => s.name === 'Zoe');
    expect(join.status).toBe(200);
    await call('DELETE', `/teach/students/${zoe.id}`, {}, { cookie: t.cookie });
    expect(env.DB.rows('student_google')).toHaveLength(0);
    env.KP_DEV_SIGNIN = undefined;
    expect((await call('GET', '/class/google/dev?name=Zoe&sub=1')).status).toBe(404);
  });
});
