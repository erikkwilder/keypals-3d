// The teacher area's state: who's signed in, their classes, the class open now (its students,
// assignments, this week's board and any class against class challenge) and its students' progress for
// the reports (fetched once and kept while the class is open).
import { migrate, type Profile } from '../engine/profile';
import { game, type Screen } from '../state/game.svelte';
import { mergeProfile } from '../state/merge';
import { api, send } from './api';
import { weekKey } from './activity';
import type { Assignment, AssignmentData } from './assignments';
import type { Challenge } from './student.svelte';
import type { ClassSettings } from '../path/rules';
import { classUrl } from './names';

export type ClassSummary = { id: string; name: string; grade: number; code: string; board: boolean; goal: number; archived: boolean; created: number; students?: number; pending?: number };
/** `google`: the student signs in with their school Google account too */
export type Student = { id: string; name: string; pics: number[]; home: boolean; status: 'active' | 'pending'; claims: string | null; buddy: string | null; created: number; google?: boolean };
export type WeekRow = { id: string; name: string; buddy: string | null; right: number; ms: number; stars: number };
/** a teacher's status: approved (classes on), pending (a plain Gmail account, waiting for us) or declined */
export type TeacherStatus = 'approved' | 'pending' | 'declined';
export type ClassDetail = { class: ClassSummary; students: Student[]; assignments: Assignment[]; week: WeekRow[]; challenge: Challenge | null;
  /** My path and time rules, and how students may sign in with Google */
  settings?: ClassSettings & { keep: string; goal: number; google: 'on' | 'off'; domain: string | null };
  teacher?: { status: TeacherStatus; domain: string | null } };
export type Tab = 'overview' | 'students' | 'work' | 'gradebook' | 'skills' | 'standards' | 'boards' | 'settings';

export const teach = $state({
  loaded: false,
  dev: false,
  me: null as null | { signedIn: boolean; account?: { name: string | null; provider?: string; domain?: string | null }; canTeach?: boolean; teacher?: { display: string; agreed: number; status?: TeacherStatus } | null },
  classes: [] as ClassSummary[],
  current: null as ClassDetail | null,
  /** students' progress, by student id (null: not saved online yet) */
  profiles: {} as Record<string, Profile | null>,
  profilesFor: '' as string,
  profilesBusy: false,
  tab: 'overview' as Tab,
  /** a student's own page, open over the class */
  studentId: null as string | null,
  printing: false,
  busy: false,
  msg: null as string | null,
});

/** Run something, showing what went wrong in plain words. */
export async function act<T>(fn: () => Promise<T>, done?: string): Promise<T | null> {
  teach.busy = true; teach.msg = null;
  try { const r = await fn(); if (done) teach.msg = done; return r; }
  catch (e) { teach.msg = (e as Error).message; return null; }
  finally { teach.busy = false; }
}

export async function loadMe() {
  const [cfg, me] = await Promise.all([
    api<{ dev: boolean }>('/teach/config').catch(() => ({ dev: false })),
    api<NonNullable<typeof teach.me>>('/teach/me').catch(() => null),
  ]);
  teach.dev = cfg.dev;
  teach.me = me;
  teach.loaded = true;
  if (me?.teacher) await loadClasses();
}
/** The test sign-in (only on a test computer: the server refuses it anywhere else): a school account, or a
 *  plain Gmail one (its classes wait for an admin). */
export function devSignIn(name: string, gmail = false) { location.href = `api/auth/dev?name=${encodeURIComponent(name)}${gmail ? '&gmail=1' : ''}`; }
export async function becomeTeacher(display: string, agree: boolean) {
  const r = await send<{ teacher: { display: string; agreed: number; status: TeacherStatus } }>('/teach/me', 'POST', { display, agree });
  teach.me = { ...(teach.me ?? { signedIn: true }), teacher: r.teacher };
  await loadClasses();
}

export async function loadClasses() { teach.classes = (await api<{ classes: ClassSummary[] }>('/teach/classes')).classes; }
export async function createClass(name: string, grade: number) {
  const r = await send<{ class: ClassSummary }>('/teach/classes', 'POST', { name, grade });
  teach.classes = [...teach.classes, r.class];
  await openClass(r.class.id);
}
export async function openClass(id: string, tab: Tab = 'overview') {
  teach.current = await api<ClassDetail>(`/teach/classes/${id}?week=${weekKey(Date.now())}`);
  teach.tab = tab; teach.studentId = null;
  if (teach.profilesFor !== id) { teach.profiles = {}; teach.profilesFor = ''; }
  // everyone's latest progress each time the class opens
  void loadProfiles(true);
}
export async function refreshClass() {
  if (!teach.current) return;
  teach.current = await api<ClassDetail>(`/teach/classes/${teach.current.class.id}?week=${weekKey(Date.now())}`);
}
export function closeClass() { teach.current = null; teach.studentId = null; teach.msg = null; void loadClasses().catch(() => null); }

/** Every student's progress (once per class open, or again when asked). */
export async function loadProfiles(force = false) {
  const c = teach.current;
  if (!c || teach.profilesBusy || (!force && teach.profilesFor === c.class.id)) return;
  teach.profilesBusy = true;
  try {
    const r = await api<{ students: { id: string; updated: number; profile: Record<string, unknown> }[] }>(`/teach/classes/${c.class.id}/profiles`);
    const out: Record<string, Profile | null> = {};
    for (const s of r.students) out[s.id] = migrate({ version: 1, activeId: null, profiles: [{ ...s.profile, id: s.id }] }).profiles[0] ?? null;
    teach.profiles = out; teach.profilesFor = c.class.id;
  } finally { teach.profilesBusy = false; }
}

// ---------- the roster ----------
export async function addStudents(text: string) {
  const c = teach.current!;
  const r = await send<{ students: Student[] }>(`/teach/classes/${c.class.id}/students`, 'POST', { text });
  c.students = [...c.students, ...r.students];
  void loadProfiles(true);
  return r.students;
}
export async function renameStudent(id: string, name: string) {
  const r = await send<{ student: { name: string } }>(`/teach/students/${id}`, 'PATCH', { name });
  const s = teach.current?.students.find(x => x.id === id); if (s) s.name = r.student.name;
}
export async function resetPics(id: string) {
  const r = await send<{ student: { pics: number[] } }>(`/teach/students/${id}/pics`, 'POST');
  const s = teach.current?.students.find(x => x.id === id); if (s) s.pics = r.student.pics;
}
export async function removeStudent(id: string) {
  await send(`/teach/students/${id}`, 'DELETE');
  if (teach.current) teach.current.students = teach.current.students.filter(x => x.id !== id);
}
/** A family's request: yes. If they said the player is a classmate already here, the two players' progress
 *  is combined first (nothing earned on either is lost), and that classmate plays as the family's player. */
export async function approve(s: Student) {
  let profile: Profile | undefined;
  if (s.claims) {
    await loadProfiles(true);
    const home = teach.profiles[s.id], school = teach.profiles[s.claims];
    if (home && school) { const { id: _id, cloud: _c, ...rest } = mergeProfile(home, school, null); profile = rest as Profile; }
  }
  await send(`/teach/students/${s.id}/approve`, 'POST', profile ? { profile } : {});
  await refreshClass();
  void loadProfiles(true);
}

// ---------- class work ----------
export async function saveAssignment(data: AssignmentData, id?: string, archived = false) {
  const c = teach.current!;
  if (id) {
    const r = await send<{ assignment: Assignment }>(`/teach/assignments/${id}`, 'PUT', { data, archived });
    c.assignments = c.assignments.map(a => (a.id === id ? r.assignment : a));
    return r.assignment;
  }
  const r = await send<{ assignment: Assignment }>(`/teach/classes/${c.class.id}/assignments`, 'POST', { data });
  c.assignments = [...c.assignments, r.assignment];
  return r.assignment;
}
export async function deleteAssignment(id: string) {
  await send(`/teach/assignments/${id}`, 'DELETE');
  if (teach.current) teach.current.assignments = teach.current.assignments.filter(a => a.id !== id);
}

// ---------- the class itself ----------
export async function patchClass(patch: Partial<Pick<ClassSummary, 'name' | 'grade' | 'board' | 'goal' | 'archived'>>) {
  const c = teach.current!;
  const r = await send<{ class: ClassSummary }>(`/teach/classes/${c.class.id}`, 'PATCH', patch);
  c.class = { ...c.class, ...r.class };
  teach.classes = teach.classes.map(x => (x.id === r.class.id ? { ...x, ...r.class } : x));
}
export async function deleteClass(confirm: string) {
  const c = teach.current!;
  await send(`/teach/classes/${c.class.id}`, 'DELETE', { confirm });
  teach.classes = teach.classes.filter(x => x.id !== c.class.id);
  teach.current = null;
}
export async function makeChallenge() {
  const c = teach.current!;
  const r = await send<{ challenge: Challenge }>(`/teach/classes/${c.class.id}/challenge`, 'POST', { week: weekKey(Date.now()) });
  c.challenge = r.challenge;
}
export async function joinChallenge(code: string) {
  const c = teach.current!;
  const r = await send<{ challenge: Challenge }>(`/teach/classes/${c.class.id}/challenge/join`, 'POST', { code });
  c.challenge = r.challenge;
}
export async function leaveChallenge() {
  const c = teach.current!;
  await send(`/teach/classes/${c.class.id}/challenge`, 'DELETE');
  c.challenge = null;
}

/** A class's My path, time and Google sign-in settings. */
export async function saveSettings(patch: Partial<NonNullable<ClassDetail['settings']>>) {
  const c = teach.current!;
  const r = await send<{ class: ClassSummary; settings?: ClassDetail['settings'] }>(`/teach/classes/${c.class.id}`, 'PATCH', { settings: patch });
  if (r.settings) c.settings = r.settings;
}

// ---------- Google Classroom ----------
/** Google Classroom's free share button, as a link: the teacher picks a class and posts it there (no
 *  sign-in to Keypals or Classroom access needed). */
export function classroomShare(url: string, title: string, body = '') {
  const q = new URLSearchParams({ url, title, ...(body ? { body } : {}) });
  window.open(`https://classroom.google.com/share?${q}`, '_blank', 'noopener,width=640,height=600');
}
/** Share a class's login link (students tap it, then their name and pictures, or Sign in with Google). */
export function shareClass(c: ClassSummary) {
  classroomShare(classUrl(c.code), `Join ${c.name} on Keypals`, 'Open the link, then tap your name and your two pictures, or Sign in with Google.');
}
/** Share one piece of class work (the class's link: it's on each student's Class work card). */
export function shareWork(c: ClassSummary, a: Assignment) {
  classroomShare(classUrl(c.code), `Keypals: ${a.title}`, `Open Keypals and log in. "${a.title}" is on your Class work card${a.due ? `, due ${new Date(a.due).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}.`);
}

// ---------- getting here ----------
/** Where the teacher area's Back button goes (the screen it was opened from). */
export const teachBack = $state({ to: 'title' as Screen });
export function openTeach(from: Screen) { teachBack.to = from; game.go('teach'); }
