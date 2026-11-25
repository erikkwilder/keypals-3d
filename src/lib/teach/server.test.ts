// The classes server (deploy/site/classes.js) run end to end through worker.js, on a real SQLite with the
// real schema: class codes, rosters, the picture-password login and its limits, class work, the boards,
// families linking a player from home, deleting, and what's kept about a child.
import { beforeEach, describe, expect, it } from 'vitest';
import worker from '../../../deploy/site/worker.js';
import { newClassCode, newPics, cleanAssignment, PIC_TRIES } from '../../../deploy/site/classes.js';
import { CLASS_WORDS, cleanStudentName, splitNames, isAlias, PICTURE_COUNT } from '../../../deploy/site/class-rules.js';
import { TestD1 } from './d1.testutil';
import { weekKey } from './activity';

type Env = { DB: TestD1; KP_DEV_SIGNIN?: string };
let env: Env;
type Res = { status: number; json: any; headers: Headers; text: string };
async function call(method: string, path: string, body?: unknown, o: { host?: string; cookie?: string; ip?: string } = {}): Promise<Res> {
  const req = new Request(`${o.host ?? 'http://127.0.0.1:8787'}/keypals/api${path}`, {
    method, headers: { 'content-type': 'application/json', 'cf-connecting-ip': o.ip ?? '10.0.0.1', ...(o.cookie ? { cookie: o.cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const r: Response = await worker.fetch(req, env);
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: r.status, json, headers: r.headers, text };
}
async function teacher(name = 'Ms. Rivera'): Promise<string> {
  const r = await call('GET', `/auth/dev?name=${encodeURIComponent(name)}`);
  expect(r.status).toBe(302);
  const cookie = r.headers.get('set-cookie')!.split(';')[0];
  const t = await call('POST', '/teach/me', { display: name, agree: true }, { cookie });
  expect(t.status).toBe(200);
  return cookie;
}
async function classWith(cookie: string, names: string, name = 'Room 12') {
  const c = await call('POST', '/teach/classes', { name, grade: 3 }, { cookie });
  const id = c.json.class.id, code = c.json.class.code;
  const add = await call('POST', `/teach/classes/${id}/students`, { text: names }, { cookie });
  return { id, code, students: add.json.students as { id: string; name: string; pics: number[] }[] };
}
const login = (code: string, student: string, pics: number[], ip?: string) => call('POST', `/class/${code}/login`, { student, pics }, { ip });

beforeEach(() => { env = { DB: new TestD1(), KP_DEV_SIGNIN: '1' }; });

describe('codes and names', () => {
  it('class codes are two easy words and a number', () => {
    for (let i = 0; i < 50; i++) {
      const c = newClassCode();
      expect(c).toMatch(/^[A-Z]+-[A-Z]+-\d{2}$/);
      const [a, b] = c.split('-');
      expect(CLASS_WORDS).toContain(a.toLowerCase());
      expect(CLASS_WORDS).toContain(b.toLowerCase());
    }
  });
  it('picture passwords are two different pictures', () => {
    for (let i = 0; i < 200; i++) {
      const [a, b] = newPics().split(',').map(Number);
      expect(a).not.toBe(b);
      expect(a).toBeGreaterThanOrEqual(0); expect(b).toBeLessThan(PICTURE_COUNT);
    }
  });
  it('students keep a first name or nickname only', () => {
    expect(cleanStudentName('maria lopez')).toBe('Maria');
    expect(cleanStudentName('Maria L.')).toBe('Maria L.');
    expect(cleanStudentName('Sam')).toBe('Sam');
    expect(cleanStudentName('jo.b@example.org')).toBeNull();
    expect(cleanStudentName('555-123-4567')).toBeNull();
    expect(cleanStudentName('Lopez, Maria')).toBe('Lopez');
    expect(cleanStudentName('Zoë\t3rd grade\t2017-04-02')).toBe('Zoë');
    expect(splitNames('Maria Lopez\nsam\n\nmaria\nkid@example.org\nJo B.')).toEqual(['Maria', 'Sam', 'Jo B.']);
    expect(splitNames('Ana, Ben, Cy')).toEqual(['Ana', 'Ben', 'Cy']);
  });
});

describe('teachers and classes', () => {
  it('the test sign-in only works on this computer with the variable set', async () => {
    expect((await call('GET', '/auth/dev?name=X', undefined, { host: 'https://fancyant.com' })).status).toBe(404);
    env.KP_DEV_SIGNIN = undefined;
    expect((await call('GET', '/auth/dev?name=X')).status).toBe(404);
    expect((await call('GET', '/teach/config')).json).toEqual({ dev: false });
    env.KP_DEV_SIGNIN = '1';
    expect((await call('GET', '/teach/config')).json).toEqual({ dev: true });
    expect((await call('GET', '/teach/config', undefined, { host: 'https://keypals.org' })).json).toEqual({ dev: false });
  });
  it('"I\'m a teacher" needs a name and agreeing to the note', async () => {
    const r = await call('GET', '/auth/dev?name=Mr.%20Lee');
    const cookie = r.headers.get('set-cookie')!.split(';')[0];
    expect((await call('GET', '/teach/classes', undefined, { cookie })).status).toBe(403);
    expect((await call('POST', '/teach/me', { display: 'Mr. Lee' }, { cookie })).status).toBe(400);
    expect((await call('POST', '/teach/me', { display: 'Mr. Lee', agree: true }, { cookie })).status).toBe(200);
    expect((await call('GET', '/teach/me', undefined, { cookie })).json.teacher.display).toBe('Mr. Lee');
    expect((await call('GET', '/teach/classes')).status).toBe(401);
  });
  it('makes a class with a code and a roster of class players', async () => {
    const cookie = await teacher();
    const c = await classWith(cookie, 'Maria Lopez\nSam\nmaria\nkid@example.org\nJo B.\nAva');
    expect(c.code).toMatch(/^[A-Z]+-[A-Z]+-\d{2}$/);
    expect(c.students.map(s => s.name)).toEqual(['Maria', 'Sam', 'Jo B.', 'Ava']);
    expect(env.DB.rows('players')).toHaveLength(4);
    const detail = await call('GET', `/teach/classes/${c.id}`, undefined, { cookie });
    expect(detail.json.students).toHaveLength(4);
    // another teacher can't see it
    const other = await teacher('Mr. Kim');
    expect((await call('GET', `/teach/classes/${c.id}`, undefined, { cookie: other })).status).toBe(404);
    expect((await call('POST', '/teach/classes', { name: 'Bad', grade: 12 }, { cookie })).status).toBe(400);
  });
  it('renames, resets pictures, removes, archives and (with the typed name) deletes', async () => {
    const cookie = await teacher();
    const c = await classWith(cookie, 'Ana\nBen\nCy');
    const [ana, ben] = c.students;
    expect((await call('PATCH', `/teach/students/${ana.id}`, { name: 'Anya Smith' }, { cookie })).json.student.name).toBe('Anya');
    const before = ben.pics.join();
    let changed = false;
    for (let i = 0; i < 5 && !changed; i++) changed = (await call('POST', `/teach/students/${ben.id}/pics`, {}, { cookie })).json.student.pics.join() !== before;
    expect(changed).toBe(true);
    expect((await call('DELETE', `/teach/students/${ana.id}`, {}, { cookie })).status).toBe(200);
    expect(env.DB.rows('players')).toHaveLength(2);
    await call('PATCH', `/teach/classes/${c.id}`, { archived: true }, { cookie });
    expect((await call('GET', `/class/${c.code}`)).status).toBe(410);
    expect((await call('DELETE', `/teach/classes/${c.id}`, { confirm: 'nope' }, { cookie })).status).toBe(400);
    expect((await call('DELETE', `/teach/classes/${c.id}`, { confirm: 'room 12' }, { cookie })).json.removed).toBe(2);
    expect(env.DB.rows('players')).toHaveLength(0);
    expect(env.DB.rows('students')).toHaveLength(0);
  });
});

describe('a class player can only be removed by the teacher', () => {
  it('stopping saving online is refused for a player the class made, and still works for a family\'s', async () => {
    const cookie = await teacher();
    const c = await classWith(cookie, 'Ana');
    const ok = await login(c.code, c.students[0].id, c.students[0].pics);
    const r = await call('DELETE', `/players/${ok.json.code}`);
    expect(r.status).toBe(403);
    expect(r.json.error).toContain('belongs to a class');
    expect(env.DB.rows('players')).toHaveLength(1);
    const made = await call('POST', '/players', { profile: { name: 'Home' } });
    expect((await call('DELETE', `/players/${made.json.code}`)).status).toBe(200);
  });
});

describe('students logging in', () => {
  it('class code, tap your name, tap your two pictures', async () => {
    const cookie = await teacher();
    const c = await classWith(cookie, 'Maria\nSam');
    const look = await call('GET', `/class/${c.code.toLowerCase().replaceAll('-', ' ')}`);
    expect(look.json.class).toEqual({ name: 'Room 12', grade: 3, teacher: 'Ms. Rivera' });
    expect(look.json.students.map((s: { name: string }) => s.name)).toEqual(['Maria', 'Sam']);
    const maria = c.students[0];
    const ok = await login(c.code, maria.id, maria.pics);
    expect(ok.status).toBe(200);
    expect(ok.json.code).toMatch(/^[A-Z]+-[A-Z]+-[A-Z]+-\d+$/);
    expect(ok.json.profile.name).toBe('Maria');
    // the order matters
    const wrong = await login(c.code, maria.id, [maria.pics[1], maria.pics[0]]);
    expect(wrong.status).toBe(403);
    expect(wrong.json.wrong).toBe(true);
  });
  it('wrong pictures: a gentle retry, then a rest for that child only', async () => {
    const cookie = await teacher();
    const c = await classWith(cookie, 'Maria\nSam');
    const [maria, sam] = c.students;
    const bad = [(maria.pics[0] + 1) % PICTURE_COUNT, maria.pics[0]];
    for (let i = 0; i < PIC_TRIES; i++) expect((await login(c.code, maria.id, bad)).status).toBe(403);
    // resting now, even with the right pictures
    const rest = await login(c.code, maria.id, maria.pics);
    expect(rest.status).toBe(429);
    expect(rest.json.error).toMatch(/break/);
    // a classmate on the same school address is fine
    expect((await login(c.code, sam.id, sam.pics)).status).toBe(200);
    // the teacher resetting the pictures ends the rest
    const reset = await call('POST', `/teach/students/${maria.id}/pics`, {}, { cookie });
    expect((await login(c.code, maria.id, reset.json.student.pics)).status).toBe(200);
  });
  it('a player that was tidied away comes back fresh at login', async () => {
    const cookie = await teacher();
    const c = await classWith(cookie, 'Maria');
    env.DB.db.exec('DELETE FROM players');
    const ok = await login(c.code, c.students[0].id, c.students[0].pics);
    expect(ok.status).toBe(200);
    expect(ok.json.profile.name).toBe('Maria');
  });
});

describe('class work and the boards', () => {
  const week = weekKey(Date.now()); // (the boards take only a week near now)
  it('assignments are checked and trimmed; students see only theirs', async () => {
    expect(cleanAssignment({ what: 'skills', skills: [], goal: { type: 'right', n: 10 } })).toBeNull();
    expect(cleanAssignment({ what: 'oops', skills: ['fr-name'], goal: { type: 'right', n: 10 } })).toBeNull();
    const cookie = await teacher();
    const c = await classWith(cookie, 'Maria\nSam');
    const [maria, sam] = c.students;
    const a = await call('POST', `/teach/classes/${c.id}/assignments`, { data: { title: '<b>Fractions</b>', what: 'skills', skills: ['fr-name', 'bad id!'], goal: { type: 'right', n: 20 }, scoring: 'both', start: 1, due: null, students: [maria.id] } }, { cookie });
    expect(a.json.assignment.title).toBe('bFractions/b');
    expect(a.json.assignment.skills).toEqual(['fr-name']);
    const m = await login(c.code, maria.id, maria.pics), s = await login(c.code, sam.id, sam.pics);
    expect((await call('GET', `/class/student/${m.json.code}?week=${week}`)).json.classes[0].assignments).toHaveLength(1);
    expect((await call('GET', `/class/student/${s.json.code}?week=${week}`)).json.classes[0].assignments).toHaveLength(0);
  });
  it('the class board: this week, first names, inside the class, and the teacher can turn it off', async () => {
    const cookie = await teacher();
    const c = await classWith(cookie, 'Maria\nSam\nAva');
    const codes = [];
    for (const st of c.students) codes.push((await login(c.code, st.id, st.pics)).json.code);
    await call('PUT', `/class/week/${codes[1]}`, { week, right: 120, ms: 900000, stars: 6, name: 'Sammy', buddy: 'koala' });
    await call('PUT', `/class/week/${codes[0]}`, { week, right: 80, ms: 1200000, stars: 3, name: 'Maria', buddy: 'dino' });
    // too much for a week is kept to what a child could do
    await call('PUT', `/class/week/${codes[2]}`, { week, right: 9e9, ms: -5, stars: 2 });
    const me = (await call('GET', `/class/student/${codes[0]}?week=${week}`)).json.classes[0];
    expect(me.rows.map((r: { name: string }) => r.name)).toEqual(['Ava', 'Sam', 'Maria']);
    expect(me.rows[0].right).toBe(30000);
    expect(me.rows[1]).toEqual({ name: 'Sam', buddy: 'koala', right: 120, ms: 900000, me: false });
    expect(me.rows[2].me).toBe(true);
    expect(me.week.right).toBe(30200);
    await call('PATCH', `/teach/classes/${c.id}`, { board: false, goal: 3000 }, { cookie });
    const off = (await call('GET', `/class/student/${codes[0]}?week=${week}`)).json.classes[0];
    expect(off.rows).toEqual([]);
    expect(off.goal).toBe(3000);
  });
  it('class against class: a challenge code, averages per student, class names only', async () => {
    // this week's: a challenge can't be joined once its week is over (it was a fixed date, so the test
    // started failing a week after it was written)
    const week = weekKey(Date.now());
    const t1 = await teacher('Ms. Rivera'), t2 = await teacher('Mr. Kim');
    const a = await classWith(t1, 'Ana\nBen', 'Room 12'), b = await classWith(t2, 'Cy\nDee\nEd\nFay', 'Owls');
    const ch = await call('POST', `/teach/classes/${a.id}/challenge`, { week }, { cookie: t1 });
    const code = ch.json.challenge.code;
    expect((await call('POST', `/teach/classes/${b.id}/challenge/join`, { code: 'NOPE-NOPE-11' }, { cookie: t2 })).status).toBe(404);
    expect((await call('POST', `/teach/classes/${b.id}/challenge/join`, { code: code.toLowerCase() }, { cookie: t2 })).status).toBe(200);
    const send = async (cls: typeof a, i: number, right: number) => { const s = cls.students[i]; const code = (await login(cls.code, s.id, s.pics)).json.code; await call('PUT', `/class/week/${code}`, { week, right, ms: 60000, stars: 1 }); return code; };
    await send(a, 0, 100); await send(a, 1, 50); // 75 a student
    const kid = await send(b, 0, 200); await send(b, 1, 120); // 320 / 4 = 80 a student
    const view = (await call('GET', `/class/student/${kid}?week=${week}`)).json.classes[0].challenge;
    expect(view.classes.map((x: { name: string; avg: number }) => [x.name, x.avg])).toEqual([['Owls', 80], ['Room 12', 75]]);
    expect(JSON.stringify(view)).not.toMatch(/Ana|Ben|Cy|Dee|Rivera|Kim/);
  });
  it('a challenge can still be joined on its last evening in America, and is over the next day', async () => {
    const t1 = await teacher('Ms. Rivera'), t2 = await teacher('Mr. Kim');
    const a = await classWith(t1, 'Ana\nBen', 'Room 12'), b = await classWith(t2, 'Cy\nDee', 'Owls'), c = await classWith(t2, 'Ed', 'Bees');
    const real = Date.now;
    try {
      // the week of Monday 2 November; Sunday 8 November, 9 pm in Atlanta, is already Monday 02:00 UTC
      Date.now = () => Date.parse('2026-11-09T02:00:00Z');
      const code = (await call('POST', `/teach/classes/${a.id}/challenge`, { week: '2026-11-02' }, { cookie: t1 })).json.challenge.code;
      expect((await call('POST', `/teach/classes/${b.id}/challenge/join`, { code }, { cookie: t2 })).status).toBe(200);
      // Monday afternoon (UTC): the week is over everywhere in the Americas
      Date.now = () => Date.parse('2026-11-09T15:00:00Z');
      const late = await call('POST', `/teach/classes/${c.id}/challenge/join`, { code }, { cookie: t2 });
      // (the same answer as a wrong code, so codes can't be found by trying)
      expect([late.status, late.json.error]).toEqual([404, "That code can't be joined. Check the words and number: a challenge that's over or full can't be joined either."]);
    } finally { Date.now = real; }
  });
  it('a class can start the new week\'s challenge on Monday morning, while last week\'s can still be joined', async () => {
    const t1 = await teacher('Ms. Rivera'), t2 = await teacher('Mr. Kim');
    const a = await classWith(t1, 'Ana\nBen', 'Room 12'), b = await classWith(t2, 'Cy\nDee', 'Owls');
    const real = Date.now;
    try {
      Date.now = () => Date.parse('2026-11-04T12:00:00Z');
      const old = (await call('POST', `/teach/classes/${a.id}/challenge`, { week: '2026-11-02' }, { cookie: t1 })).json.challenge.code;
      // the same week again: it's in one already
      const twice = await call('POST', `/teach/classes/${a.id}/challenge`, { week: '2026-11-02' }, { cookie: t1 });
      expect([twice.status, twice.json.error]).toEqual([400, 'This class is in a challenge this week already.']);
      // Monday 9 November, 9 am in London: last week's code is still open (it's Sunday night in Hawaii),
      // and that must not stop this class making the new week's
      Date.now = () => Date.parse('2026-11-09T09:00:00Z');
      const next = await call('POST', `/teach/classes/${a.id}/challenge`, { week: '2026-11-09' }, { cookie: t1 });
      expect(next.status).toBe(200);
      expect(next.json.challenge.week).toBe('2026-11-09');
      expect((await call('POST', `/teach/classes/${b.id}/challenge/join`, { code: old }, { cookie: t2 })).status).toBe(200);
      // a class in this week's can't go back and join last week's as well
      const back = await call('POST', `/teach/classes/${a.id}/challenge/join`, { code: old }, { cookie: t1 });
      expect([back.status, back.json.error]).toEqual([400, 'This class is in a challenge this week already.']);
    } finally { Date.now = real; }
  });
  it('the family board: players in one grown-up account, this week, for that grown-up signed in', async () => {
    const mk = async (name: string) => (await call('POST', '/players', { profile: { name, buddy: 'dino' } })).json.code as string;
    const a = await mk('Lulu'), b = await mk('Max'), c = await mk('Stranger');
    // the family's grown-up signs in on this computer (the test sign-in) and their two players are in the account
    const cookie = (await call('GET', '/auth/dev?name=Pat%20Parent')).headers.get('set-cookie')!.split(';')[0];
    const acct = String(env.DB.rows('accounts')[0].id);
    env.DB.db.prepare(`UPDATE players SET account = ? WHERE code IN (?, ?)`).run(acct, a, b);
    for (const [code, stars] of [[a, 9], [b, 14], [c, 99]] as const) await call('PUT', `/class/week/${code}`, { week, right: 10, ms: 60000, stars, name: code === a ? 'Lulu' : code === b ? 'Max' : 'Stranger', buddy: 'koala' });
    const fam = (await call('GET', `/family/${a}?week=${week}`, undefined, { cookie })).json;
    expect(fam.players.map((p: { name: string; stars: number; me: boolean }) => [p.name, p.stars, p.me])).toEqual([['Max', 14, false], ['Lulu', 9, true]]);
    expect(JSON.stringify(fam)).not.toMatch(/@|Pat|Stranger/);
    // not signed in, or a code that isn't in the account: nothing
    expect((await call('GET', `/family/${a}?week=${week}`)).status).toBe(401);
    expect((await call('GET', `/family/${c}?week=${week}`, undefined, { cookie })).status).toBe(404);
  });
  it('the world board: made-up names only, believable scores, top 20', async () => {
    const day = new Date().toISOString().slice(0, 10);
    const post = (who: string, alias: string, score: number, game = 'slalom') => call('POST', '/world', { game, day, score, who, alias, buddy: 'dino' });
    expect((await post('aaaaaaaaaa', 'Maria Lopez', 500)).status).toBe(400);
    expect((await post('aaaaaaaaaa', 'Brave Otter', 10_000_000)).status).toBe(400);
    expect((await post('aaaaaaaaaa', 'Brave Otter', 500, 'nope')).status).toBe(400);
    for (let i = 0; i < 25; i++) expect((await post(`player-${i}-xx`, 'Brave Otter', 1000 + i)).status).toBe(200);
    await post('player-3-xx', 'Brave Otter', 50); // a worse round keeps the best
    const board = (await call('GET', `/world/slalom?day=${day}`)).json.rows;
    expect(board).toHaveLength(20);
    expect(board[0]).toEqual({ alias: 'Brave Otter', buddy: 'dino', score: 1024 });
    for (const r of board) { expect(isAlias(r.alias)).toBe(true); expect(Object.keys(r).sort()).toEqual(['alias', 'buddy', 'score']); }
    expect(env.DB.rows('world_scores').some(r => String(r.who).includes('player'))).toBe(false);
  });
});

describe('families linking a player from home', () => {
  it('asks, the teacher says yes, and it can leave again', async () => {
    const cookie = await teacher();
    const c = await classWith(cookie, 'Maria\nSam');
    const home = (await call('POST', '/players', { profile: { name: 'Lulu', buddy: 'koala' } })).json.code;
    expect((await call('POST', '/class/link', { code: c.code, player: home, name: 'Lulu Smith' })).json.status).toBe('pending');
    // waiting: not in the class yet
    expect((await call('GET', `/class/${c.code}`)).json.students).toHaveLength(2);
    const pending = (await call('GET', `/teach/classes/${c.id}`, undefined, { cookie })).json.students.find((s: { status: string }) => s.status === 'pending');
    expect(pending.name).toBe('Lulu');
    await call('POST', `/teach/students/${pending.id}/approve`, {}, { cookie });
    const mine = (await call('GET', `/class/student/${home}?week=2026-10-26`)).json;
    expect(mine.classes[0].student.name).toBe('Lulu');
    expect((await call('DELETE', '/class/link', { player: home, class: c.id })).status).toBe(200);
    expect((await call('GET', `/class/student/${home}`)).json.classes).toEqual([]);
    // the family's player is still there
    expect(env.DB.rows('players').some(p => p.code === home)).toBe(true);
  });
  it('"this is Maria": after yes, Maria plays as the family\'s player and the class one goes', async () => {
    const cookie = await teacher();
    const c = await classWith(cookie, 'Maria\nSam');
    const maria = c.students[0];
    const schoolCode = (await login(c.code, maria.id, maria.pics)).json.code;
    const home = (await call('POST', '/players', { profile: { name: 'Mimi', buddy: 'koala' } })).json.code;
    // (Maria's two pictures, from her login card, say the family really is Maria)
    expect((await call('POST', '/class/link', { code: c.code, player: home, claims: maria.id, pics: maria.pics })).json.status).toBe('pending');
    const pending = (await call('GET', `/teach/classes/${c.id}`, undefined, { cookie })).json.students.find((s: { status: string }) => s.status === 'pending');
    expect(pending.name).toBe('Maria');
    await call('POST', `/teach/students/${pending.id}/approve`, { profile: { name: 'Mimi', buddy: 'koala', combined: true } }, { cookie });
    expect(env.DB.rows('players').some(p => p.code === schoolCode)).toBe(false);
    const again = await login(c.code, maria.id, maria.pics);
    expect(again.json.code).toBe(home);
    expect(again.json.profile.combined).toBe(true);
    expect(env.DB.rows('students')).toHaveLength(2);
  });
});

describe('a whole class on one school address', () => {
  it('class players open and save by their own code; anonymous traffic keeps the address limits', async () => {
    const cookie = await teacher();
    const c = await classWith(cookie, Array.from({ length: 32 }, (_, i) => `Kid${String.fromCharCode(65 + (i % 26))}${i}`).map(n => n.replace(/\d+/, '')).join('\n'));
    expect(c.students.length).toBeGreaterThanOrEqual(26);
    const codes: string[] = [];
    for (const s of c.students) codes.push((await login(c.code, s.id, s.pics, '10.9.9.9')).json.code);
    // every child opens their player three times and saves ten times, all from the school's one address
    const school = { ip: '10.9.9.9' };
    let opened = 0, saved = 0;
    for (const code of codes) {
      for (let i = 0; i < 3; i++) if ((await call('GET', `/players/${code}`, undefined, school)).status === 200) opened++;
      for (let i = 0; i < 10; i++) if ((await call('PUT', `/players/${code}`, { profile: { name: 'x', buddy: 'dino' } }, school)).status === 200) saved++;
    }
    expect(opened).toBe(codes.length * 3);
    expect(saved).toBe(codes.length * 10);
    // a player that isn't in a class still counts by address: guessing codes stays slow
    const plain = (await call('POST', '/players', { profile: { name: 'Lulu', buddy: 'koala' } }, { ip: '10.7.7.7' })).json.code;
    let ok = 0;
    for (let i = 0; i < 70; i++) if ((await call('GET', `/players/${plain}`, undefined, { ip: '10.7.7.7' })).status === 200) ok++;
    expect(ok).toBe(60);
  });
  it("a class's own player is never filed under a grown-up's account; a family's linked player is", async () => {
    const cookie = await teacher();
    const c = await classWith(cookie, 'Maria');
    const school = (await login(c.code, c.students[0].id, c.students[0].pics)).json.code;
    const filed = await call('PUT', `/me/players/${school}`, undefined, { cookie });
    expect(filed.status).toBe(409);
    expect(env.DB.rows('players').find(p => p.code === school)!.account).toBeNull();
    const home = (await call('POST', '/players', { profile: { name: 'Lulu', buddy: 'koala' } })).json.code;
    await call('POST', '/class/link', { code: c.code, player: home, name: 'Lulu' });
    const pending = (await call('GET', `/teach/classes/${c.id}`, undefined, { cookie })).json.students.find((s: { status: string }) => s.status === 'pending');
    await call('POST', `/teach/students/${pending.id}/approve`, {}, { cookie });
    expect((await call('PUT', `/me/players/${home}`, undefined, { cookie })).status).not.toBe(409);
  });
});

describe('the daily tidy-up and the weekly backup', () => {
  it('runs with the class tables, and the backup keeps them', async () => {
    const cookie = await teacher();
    await classWith(cookie, 'Maria\nSam');
    const store = new Map<string, unknown>();
    const BACKUPS = { get: async () => null, put: async (k: string, v: unknown) => { store.set(k, v); } };
    await worker.scheduled(null, { ...env, BACKUPS });
    const manifest = JSON.parse([...store.entries()].find(([k]) => k.endsWith('manifest.json'))![1] as string);
    expect(manifest.counts).toMatchObject({ players: 2, accounts: 1, teachers: 1, classes: 1, students: 2 });
  });
});

describe('privacy: what is kept and sent about a child', () => {
  it('no field holds an email, a last name or a birthday', async () => {
    const cookie = await teacher();
    const c = await classWith(cookie, 'Maria Lopez\tmaria.lopez@example.org\t2017-04-02\nSam Jones');
    const payloads: unknown[] = [];
    payloads.push((await call('GET', `/class/${c.code}`)).json);
    const lg = await login(c.code, c.students[0].id, c.students[0].pics);
    payloads.push(lg.json);
    payloads.push((await call('GET', `/class/student/${lg.json.code}?week=2026-10-26`)).json);
    payloads.push((await call('GET', `/teach/classes/${c.id}?week=2026-10-26`, undefined, { cookie })).json);
    payloads.push(JSON.parse((await call('GET', `/teach/classes/${c.id}/profiles`, undefined, { cookie })).text));
    payloads.push(env.DB.rows('students'), env.DB.rows('players'), env.DB.rows('player_week'));
    for (const p of payloads) {
      const s = JSON.stringify(p);
      expect(s).not.toMatch(/@/);
      expect(s).not.toMatch(/Lopez|Jones/);
      expect(s).not.toMatch(/2017-04-02/);
    }
    // a student is: a name, a class, a player, pictures, and bookkeeping
    expect(Object.keys(env.DB.rows('students')[0]).sort()).toEqual(['buddy', 'claims', 'class', 'created', 'home', 'id', 'name', 'pics', 'player', 'status']);
    expect(Object.keys(JSON.parse(String(env.DB.rows('players')[0].data))).sort()).toEqual(['buddy', 'createdAt', 'name', 'settings']);
  });
});

// ---------- pupils signing in with a school Google account (the test sign-in stands in for Google) ----------
describe('pupils signing in with Google', () => {
  /** back from Google as `name`: the one-time ticket the server sends the browser back with */
  async function google(name: string, sub = `g-${name.trim().toLowerCase()}`): Promise<string> {
    const r = await call('GET', `/class/google/dev?name=${encodeURIComponent(name)}&sub=${encodeURIComponent(sub)}`);
    expect(r.status).toBe(302);
    return new URL(r.headers.get('location')!).hash.replace('#classgoogle=', '');
  }
  const join = (ticket: string, code: string, more: Record<string, unknown> = {}) => call('POST', '/class/google/join', { ticket, code, ...more });
  const listed = async (code: string) => (await call('GET', `/class/${code}`)).json.students.map((s: { name: string }) => s.name).sort();
  const already = (name: string) => `There's already a ${name} in this class. If that's you, tap your name and then your two pictures. If it isn't, ask your teacher to add you.`;
  const openToAnyAccount = async (t: string, id: string) => expect((await call('PATCH', `/teach/classes/${id}`, { settings: { google: 'on', domain: '' } }, { cookie: t })).status).toBe(200);

  it("a first name the list has already isn't added again: she's told to tap her name and pictures, and that works", async () => {
    const t = await teacher();
    const c = await classWith(t, 'Maria\nSam');
    const maria = c.students.find(s => s.name === 'Maria')!;
    const ticket = await google('maria'); // Google's "maria" is the list's Maria: case doesn't matter
    const r = await join(ticket, c.code);
    expect([r.status, r.json.error, r.json.code]).toEqual([409, already('Maria'), undefined]);
    expect((await join(await google('SAM', 'g-sam-2'), c.code)).json.error).toBe(already('Sam'));
    expect(await listed(c.code)).toEqual(['Maria', 'Sam']);
    // the same sign-in, then her name and her two pictures: she is the list's Maria
    const linked = await join(ticket, c.code, { student: maria.id, pics: maria.pics });
    expect([linked.status, linked.json.status, linked.json.name]).toEqual([200, 'in', 'Maria']);
    // a name the class hasn't got joins as before
    const leo = await join(await google('Leo'), c.code);
    expect([leo.status, leo.json.name]).toEqual([200, 'Leo']);
    expect(await listed(c.code)).toEqual(['Leo', 'Maria', 'Sam']);
  });

  it("a name waiting for the teacher's yes counts too (a class open to any Google account)", async () => {
    const t = await teacher();
    const c = await classWith(t, 'Maria');
    await openToAnyAccount(t, c.id);
    expect((await join(await google('Zoe'), c.code)).json.pending).toBe(true);
    const other = await join(await google('zoe ', 'g-another-zoe'), c.code);
    expect([other.status, other.json.error]).toEqual([409, already('Zoe')]);
    const zoes = (await call('GET', `/teach/classes/${c.id}`, undefined, { cookie: t })).json.students.filter((s: { name: string }) => s.name === 'Zoe');
    expect(zoes.length).toBe(1);
  });

  it("a pupil waiting for the teacher's yes hears so whenever she signs in to the class again: never 'ran out', never 'type your class code'", async () => {
    const t = await teacher();
    const c = await classWith(t, 'Maria');
    await openToAnyAccount(t, c.id);
    const first = await google('Zoe');
    const asked = await join(first, c.code);
    expect([asked.status, asked.json.pending, asked.json.name, asked.json.code]).toEqual([403, true, 'Zoe', undefined]);
    // "I'm new" tapped again with the same sign-in: still waiting (the sign-in wasn't used up)
    expect([(await join(first, c.code)).json.pending, (await call('POST', '/class/google', { ticket: first })).json]).toEqual([true, { status: 'waiting', name: 'Zoe' }]);
    // signing in with Google again later: waiting at once, not "type your class code"
    const later = await google('Zoe');
    expect((await call('POST', '/class/google', { ticket: later })).json).toEqual({ status: 'waiting', name: 'Zoe' });
    expect((await join(later, c.code)).json).toMatchObject({ pending: true, name: 'Zoe' });
    const waiting = (await call('GET', `/teach/classes/${c.id}`, undefined, { cookie: t })).json.students.filter((s: { status: string }) => s.status === 'pending');
    expect(waiting.map((s: { name: string }) => s.name)).toEqual(['Zoe']); // still one request on the Students tab
    // the teacher says yes: Google alone takes her in, and that sign-in is used up
    expect((await call('POST', `/teach/students/${waiting[0].id}/approve`, {}, { cookie: t })).status).toBe(200);
    const yes = await google('Zoe');
    expect((await call('POST', '/class/google', { ticket: yes })).json).toMatchObject({ status: 'in', name: 'Zoe' });
    expect((await call('POST', '/class/google', { ticket: yes })).status).toBe(410);
  });

  it("a pupil the teacher said no to isn't waiting any more: Google asks for the class code again", async () => {
    const t = await teacher();
    const c = await classWith(t, 'Maria');
    await openToAnyAccount(t, c.id);
    expect((await join(await google('Zoe'), c.code)).json.pending).toBe(true);
    const row = (await call('GET', `/teach/classes/${c.id}`, undefined, { cookie: t })).json.students.find((s: { status: string }) => s.status === 'pending');
    expect((await call('DELETE', `/teach/students/${row.id}`, undefined, { cookie: t })).status).toBe(200);
    expect((await call('POST', '/class/google', { ticket: await google('Zoe') })).json).toEqual({ status: 'code', first: 'Zoe' });
  });

  it("back from Google, the game asks first whether the class takes her account: joining's own words, and nothing changes", async () => {
    const t = await teacher();
    const c = await classWith(t, 'Maria\nSam'); // kept to the teacher's school (school.test), as a school teacher's class starts
    const check = (ticket: string, code = c.code) => call('POST', '/class/google/check', { ticket, code });
    const signIn = async (name: string, hd: string) => new URL((await call('GET', `/class/google/dev?name=${name}&sub=g-${name}&hd=${hd}`)).headers.get('location')!).hash.replace('#classgoogle=', '');
    const school = 'This class is for school accounts from school.test. Sign in with your school Google account.';
    // Omar (another school's account) and Gia (plain Gmail): told at once, in joining's words; joining still refuses
    for (const ticket of [await signIn('Omar', 'other.test'), await signIn('Gia', 'nohd')]) {
      const asked = await check(ticket);
      expect([asked.status, asked.json.error]).toEqual([403, school]);
      const joined = await join(ticket, c.code);
      expect([joined.status, joined.json.error]).toEqual([403, school]);
    }
    // a pupil the class takes hears yes, and nothing changes: nobody added, the sign-in not used up
    const leo = await google('Leo');
    const yes = await check(leo);
    expect([yes.status, yes.json]).toEqual([200, { ok: true }]);
    expect(await listed(c.code)).toEqual(['Maria', 'Sam']);
    expect((await join(leo, c.code)).json.name).toBe('Leo');
    // a Google account in another class already, and a class with Google sign-in off: joining's words too
    const room14 = await classWith(t, 'Ana', 'Room 14');
    expect((await check(await google('Leo'), room14.code)).json.error).toBe('This Google account is in another class already. Ask your teacher.');
    expect((await call('PATCH', `/teach/classes/${room14.id}`, { settings: { google: 'off' } }, { cookie: t })).status).toBe(200);
    const off = await check(await google('Nia'), room14.code);
    expect([off.status, off.json.error]).toEqual([403, "Your teacher hasn't turned on Google sign-in for this class. Use your class code and pictures."]);
    expect((await check('not-a-ticket')).status).toBe(410);
  });
});
