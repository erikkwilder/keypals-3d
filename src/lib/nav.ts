// Going places from the subjects list (subjects.ts): open a subject's page on one way and one part,
// open one thing (an episode, a game, a world), the "Keep going" for each subject, and the little
// line each thing shows (learned, best score, locked...). Home, the subject pages and the Menu use these.
import { game, type Screen } from './state/game.svelte';
import type { Place } from './state/where';
import { sfx } from './audio/sound';
import { ANYWHERE, MATH_CHIPS, SUBJECT, SUBJECTS, WAYS, thingsIn, type Anywhere, type Subject, type Thing, type WayId } from './subjects';
import { LESSON as TYPING_LESSON, REGION, REGIONS, lessonTitle, type RegionId } from './engine/course';
import { isUnlocked, nextLesson, passed, regionUnlocked, type Profile } from './engine/profile';
import { MATH_LESSONS, STRAND, regionsOf } from './math/course';
import { mathOf, mathPassed, nextMathLesson } from './math/progress';
import { isLearned } from './math/learn';
import { AREA, areaOfOp } from './math/skills/registry';
import { areaGrades } from './path/units';
import { nextSkillLesson, SKILL_LESSONS, SKILL_PLACEMENTS, skillPassed, skillRegionsOf } from './math/skills/course';
import type { AreaId } from './math/skills/types';
import { PLACEMENTS } from './math/course';
import { arcadeOf, type ArcadeId } from './arcade/arcade';
import { playNextLevel, playOf, type PlayGame } from './math/playground';
import { builderOf, builderOpen } from './math/place/builder';
import { advOf, worldOpen, type WorldId } from './adventure/state';
import { adventureVisit, lastWorld, WORLD_PIN, worldSubject } from './adventure/worlds';
import { modeFor } from './path/journey';
import { playerRules } from './path/player.svelte';
import { pathHolds } from './path/rules';

export const wayOf = (s: string): WayId => game.way[s] ?? 'practice';
/** a part of math by its chip name, for a sentence ("place value") */
const partName = (a?: string) => (MATH_CHIPS.find(c => c.id === a)?.name ?? 'math').toLowerCase();

/** The part a subject's page shows ('all', a math area, a typing region). */
export function chipOf(s: string): string {
  if (s === 'math') return game.mathOp ? areaOfOp(game.mathOp) : game.mathArea ?? 'all';
  if (s === 'typing') return game.typingArea ?? 'all';
  return 'all';
}
export function setChip(s: string, chip: string) {
  if (s === 'math') {
    const a = chip === 'all' ? null : AREA[chip as AreaId];
    game.mathOp = a?.op ?? null;
    game.mathArea = a && !a.op ? a.id : null;
    if (a?.op) { const op = a.op; game.update(pp => { pp.math = { ...mathOf(pp), strand: op }; }); }
  } else if (s === 'typing') game.typingArea = chip === 'all' ? null : (chip as RegionId);
}

/** A subject's page (and, given a part, that part: its Practice map, or its Learn or Play list). */
export function openSubject(s: string, way: WayId = wayOf(s), chip?: string) {
  if (s === 'typing' || s === 'math') game.setHome(s);
  game.way = { ...game.way, [s]: way };
  if (chip === undefined || chip === 'all' || !isTopic(s, chip)) { openSubjectPage(s); return; }
  if (way === 'practice') openTopicMap(s, chip);
  else if (way === 'adventure') openTopic(s, chip);
  else openWay(s, chip, way);
}

/** Open one thing from a subject's list. */
export function openThing(s: Subject, w: WayId, t: Thing) {
  const p = game.profile;
  if (!p) return;
  if (t.soon) { sfx.nope(); game.say(`${t.name} is coming soon!`); return; }
  sfx.click();
  game.way = { ...game.way, [s.id]: w };
  if (s.id === 'typing') {
    if (w === 'practice') { openSubject('typing', 'practice', t.id); return; }
    // a typing adventure: the typing worlds (the Sky Islands, for now), answering with typing
    if (w === 'adventure') { game.update(pp => { advOf(pp).subject = 'typing'; }); worldSubject.id = 'typing'; lastWorld.id = 'sky'; game.visit('adventure'); return; }
    const l = TYPING_LESSON[t.id];
    if (!l) return;
    if (!isUnlocked(p, l)) { sfx.nope(); game.say('Keep going on the typing map to open this one!'); return; }
    game.setHome('typing');
    game.startLesson(l.id, passed(p, l.id));
    return;
  }
  game.setHome('math');
  if (w === 'learn') {
    // the market's and the clockmaker's episodes open over the page you're on (screens/WayPage.svelte, the map)
    if (t.kind === 'market' || t.kind === 'measure') { game.learnCheck = false; game.learnOverlay = t.id; return; }
    game.learnCheck = false;
    game.openLearn(t.id);
    return;
  }
  if (w === 'practice') {
    if (t.id === 'garden') { game.visit('garden'); return; }
    openSubject('math', 'practice', t.id);
    return;
  }
  if (w === 'games') {
    if (t.kind === 'arcade') {
      if (t.id === 'pizza') game.go('pizza');
      else if (t.id === 'market') game.go('market');
      else if (t.id === 'clockrush') game.go('clockrush');
      else if (t.id === 'shifter') game.go('shifter');
      else if (t.id === 'smoothie') game.go('smoothie');
      else if (t.id === 'treasure') game.go('treasure');
      else if (t.id === 'showdown') game.go('showdown');
      else if (t.id === 'balance') game.go('balance');
      else if (t.id === 'builder') { builderOpen.toy = false; builderOpen.from = 'map'; game.go('builder'); }
      else game.playArcade(t.id as ArcadeId);
      return;
    }
    if (t.id === 'blocks') { builderOpen.toy = true; builderOpen.from = 'map'; game.go('builder'); return; }
    if (t.id === 'bench') { game.go('bench'); return; }
    if (t.id === 'shapebuilder') { game.go('shapebuilder'); return; }
    game.playPick = t.id;
    game.go('playground');
    return;
  }
  // a world: open the Adventure map there (a world opens once its kind of math is started)
  const id = t.id as WorldId;
  if (id !== 'sky' && !worldOpen(p, id)) {
    const area = WORLD_PIN[id]?.area;
    sfx.nope();
    game.say(`Play a ${partName(area)} trip first to open ${t.name}!`, 3600);
    return;
  }
  game.update(pp => { advOf(pp).subject = 'math'; });
  worldSubject.id = 'math';
  lastWorld.id = id;
  adventureVisit.free = true;
  game.visit('adventure');
}

/** The next thing to do in a subject: its name, and how to start it. */
export function keepGoing(s: string, p: Profile): { label: string; fresh: boolean; go: () => void } {
  if (s === 'typing') {
    const l = nextLesson(p);
    const fresh = !passed(p, 'village-1');
    return { label: lessonTitle(l, game.layout), fresh, go: () => { sfx.click(); game.setHome('typing'); game.startLesson(l.id); } };
  }
  const m = mathOf(p);
  const fresh = m.totals.trips === 0;
  if (game.mathArea && AREA[game.mathArea] && !AREA[game.mathArea].op) {
    const l = nextSkillLesson(m, game.mathArea);
    return { label: l.title, fresh, go: () => { sfx.click(); game.setHome('math'); game.startSkill(l.id); } };
  }
  const l = nextMathLesson(m);
  // a first-time math player picks what kind of math first
  return { label: fresh ? 'Pick a kind of math' : l.title, fresh, go: () => { if (fresh) openSubjectPage('math'); else { sfx.click(); game.setHome('math'); game.startMath(l.id); } } };
}

/** The little line on a thing's card: done or new, a best score, locked. */
export function statusOf(s: Subject, w: WayId, t: Thing, p: Profile): { tag: string; done?: boolean; locked?: boolean } {
  if (t.soon) return { tag: 'Coming soon', locked: true };
  const m = mathOf(p);
  if (s.id === 'typing') {
    if (w === 'learn') { const l = TYPING_LESSON[t.id]; return !l ? { tag: '' } : passed(p, l.id) ? { tag: 'Done', done: true } : isUnlocked(p, l) ? { tag: 'New keys' } : { tag: 'Locked', locked: true }; }
    return { tag: '' };
  }
  if (w === 'learn') return isLearned(m, t.id) ? { tag: 'Learned', done: true } : { tag: 'New' };
  if (w === 'games') {
    const best = t.kind === 'arcade'
      ? (t.id === 'builder' ? builderOf(p).best : t.id === 'pizza' ? m.arcade?.['pizza-rush']?.best ?? 0 : t.id === 'market' ? m.arcade?.['market-dash']?.best ?? 0 : t.id === 'clockrush' ? m.arcade?.['clock-rush']?.best ?? 0 : t.id === 'smoothie' ? m.arcade?.['smoothie-stand']?.best ?? 0 : t.id === 'treasure' ? m.arcade?.['treasure-grid']?.best ?? 0 : t.id === 'balance' ? m.arcade?.['balance-beam']?.best ?? 0 : arcadeOf(p)[t.id as ArcadeId]?.best ?? 0)
      : t.id === 'blocks' || t.id === 'bench' ? 0 : (playOf(p, t.id as PlayGame).stars.filter(Boolean).length);
    if (t.kind === 'toy') return t.id === 'blocks' ? { tag: 'Build anything' } : t.id === 'bench' ? { tag: 'Measure anything' } : best ? { tag: `Level ${playNextLevel(p, t.id as PlayGame)} next`, done: true } : { tag: 'No clock' };
    return best ? { tag: `Best ${Math.round(best).toLocaleString('en-US')}`, done: true } : { tag: 'New! Give it a go' };
  }
  if (w === 'adventure') { const a = WORLD_PIN[t.id]?.area; return t.id === 'sky' || worldOpen(p, t.id as WorldId) ? { tag: 'Open', done: true } : { tag: `Opens with a ${partName(a)} trip`, locked: true }; }
  return { tag: '' };
}

/** "Show What You Know" for one part of math: the quick mix that skips ahead. */
export function placementFor(chip: string) {
  const a = AREA[chip as AreaId];
  if (!a) return null;
  return a.op ? PLACEMENTS[a.op] : SKILL_PLACEMENTS[a.id] ?? null;
}
export const strandName = (chip: string) => { const a = AREA[chip as AreaId]; return a?.op ? STRAND[a.op].name : a?.name ?? ''; };
export const subjectOf = (id: string) => SUBJECT[id];

/** Adventure from Home or the Menu: the worlds of the subject played last; the Journey trail is math's. */
function adventureSubject(): 'typing' | 'math' {
  const p = game.profile;
  return p && modeFor(p, pathHolds(p, playerRules(p))) === 'journey' ? 'math' : game.homeGame;
}

/** Open one of the places that take every subject (Home's "Play anywhere", the Menu). */
export function openAnywhere(id: Anywhere['id']) {
  sfx.click();
  if (id === 'duel') { game.duelMode = 'duel'; game.duelRival = null; game.duelKey++; game.go('duel'); return; }
  // Adventure from Home or the menu: the worlds of the subject played last
  if (id === 'adventure') worldSubject.id = adventureSubject();
  game.go(id === 'drop' ? 'drop' : id === 'rivals' ? 'rivals' : id);
}

// ---------- the one way around: subjects, topics and their ways (state/where.ts has the levels) ----------
/** A topic: a kind of math (an area: Plus, Fractions...) or a typing island (a region). */
export function isTopic(s: string, topic: string): boolean {
  return !!SUBJECT[s]?.chips.some(c => c.id === topic);
}
export function topicName(s: string, topic: string | null): string {
  if (!topic) return SUBJECT[s]?.name ?? '';
  if (s === 'typing') return REGION[topic as RegionId]?.name ?? topic;
  return SUBJECT[s]?.chips.find(c => c.id === topic)?.name ?? AREA[topic as AreaId]?.name ?? topic;
}
const WAY_PAGE: Record<WayId, string> = { learn: 'Learn', practice: 'Practice', games: 'Play', adventure: 'Adventure' };
export const SCREEN_NAME: Partial<Record<Screen, string>> = {
  arcade: 'Arcade', adventure: 'Adventure', island: 'My Sky Island', mystuff: 'My stuff', path: 'My path', ideas: 'Ideas and help',
  about: 'About Keypals', teach: 'For teachers', boards: 'Boards', settings: 'Settings', skills: 'Math skills', keypals: 'Keypals',
  closet: 'Wardrobe', shop: 'Shop', dances: 'Dances', eggs: 'Eggs', garden: 'Fact Garden', progress: 'My progress',
  duel: 'Family Duel', rivals: 'Rival Ghosts', players: 'Players', learn: 'Learn',
};
/** Grown-ups' sections (screens/Grownups.svelte) */
export const GU_NAME: Record<string, string> = {
  saving: 'Sign-in and saving', players: 'Players', time: 'Time and rules', progress: 'Reports', admin: 'Admin',
};
/** What a place is called (a page's title, and "Back to ..." on a Pause card). */
export function placeName(pl: Place): string {
  const c = pl.ctx;
  const s = c.subject ?? 'math';
  switch (pl.screen) {
    case 'hub': return 'Home';
    case 'subject': return SUBJECT[s]?.name ?? 'Math';
    case 'topic': return topicName(s, c.topic);
    case 'map': return c.topic ? `${topicName(s, c.topic)} map` : `${SUBJECT[s]?.name ?? 'Math'} map`;
    case 'way': return WAY_PAGE[(c.wayId as WayId) ?? 'learn'];
    case 'grownups': return c.guSection ? GU_NAME[c.guSection] ?? 'Grown-ups' : 'Grown-ups';
    case 'stickers': return 'Sticker book';
    case 'glimmers': return 'Glimmers';
    default: return SCREEN_NAME[pl.screen] ?? 'Home';
  }
}
/** The little line under a page's title: where it sits ("Math › Fractions"), on the levels under a subject. */
export function trailOf(pl: Place): string {
  const c = pl.ctx;
  const s = c.subject ?? 'math';
  if (pl.screen === 'topic') {
    // (a math topic's grades come from its lessons on the curriculum path)
    const g = s === 'math' && c.topic ? areaGrades(c.topic) ?? AREA[c.topic as AreaId]?.grades.replace('-', '–') : null;
    const label = !g ? '' : g.includes('–') ? `Grades ${g}` : g === 'K' ? 'Kindergarten' : `Grade ${g}`;
    return `${SUBJECT[s]?.name ?? ''} › ${topicName(s, c.topic)}${label ? ` · ${label}` : ''}`;
  }
  if (pl.screen === 'map' || pl.screen === 'way') return c.topic ? `${SUBJECT[s]?.name ?? ''} › ${topicName(s, c.topic)}` : SUBJECT[s]?.name ?? '';
  if (pl.screen === 'grownups' && c.guSection) return 'Grown-ups';
  if (pl.screen === 'skills') return 'Grown-ups › Reports';
  return '';
}

/** A subject's page (Typing, Math). */
export function openSubjectPage(s: string) {
  if (s === 'typing' || s === 'math') game.setHome(s);
  game.subject = s;
  game.topic = null;
  game.go('subject');
}
/** One topic's page (Math › Fractions, Typing › Home Row Island). */
export function openTopic(s: string, topic: string) {
  if (s === 'typing' || s === 'math') game.setHome(s);
  game.subject = s;
  game.topic = topic;
  game.go('topic');
}
/** Set the subject-map fields for a topic (the math map's strand or area, the typing map's island). */
function aimMap(s: string, topic: string | null) {
  if (s === 'math') {
    const a = topic ? AREA[topic as AreaId] : null;
    game.mathOp = a?.op ?? null;
    game.mathArea = a && !a.op ? a.id : null;
    if (a?.op) { const op = a.op; game.update(pp => { pp.math = { ...mathOf(pp), strand: op }; }); }
  } else if (s === 'typing') game.typingArea = (topic as RegionId | null) ?? null;
}
/** A topic's Practice: its islands map (the trips or lessons, in order). */
export function openTopicMap(s: string, topic: string) {
  if (s === 'typing' || s === 'math') game.setHome(s);
  game.subject = s;
  game.topic = topic;
  aimMap(s, topic);
  game.way = { ...game.way, [s]: 'practice' };
  game.go('map');
}
/** A topic's Learn or Play list (or, with no topic, every Learn lesson of the subject). */
export function openWay(s: string, topic: string | null, w: WayId) {
  if (s === 'typing' || s === 'math') game.setHome(s);
  game.subject = s;
  game.topic = topic;
  game.wayId = w;
  aimMap(s, topic);
  game.go('way');
}

/** "Where to?" on Home: one tile each, a picture, a name and one line. */
export type HomeTile = { id: string; name: string; line: string; art: string; icon: string; go: () => void };
export function homeTiles(p: Profile): HomeTile[] {
  const subj = SUBJECTS.map(s => ({
    id: s.id, name: s.name, art: s.card, icon: s.icon,
    line: subjectLine(s.id, p), go: () => { sfx.click(); openSubjectPage(s.id); },
  }));
  const places = ANYWHERE.filter(a => a.id === 'arcade' || a.id === 'adventure' || a.id === 'island').map(a => ({
    id: a.id, name: a.name, art: a.card ?? a.art, icon: a.icon, line: a.line, go: () => openAnywhere(a.id),
  }));
  return [...subj, ...places];
}
/** One line for a subject: where you are in it. */
export function subjectLine(s: string, p: Profile): string {
  if (s === 'typing') { const l = nextLesson(p); return passed(p, 'village-1') ? `${REGION[l.region].name} · ${lessonTitle(l, game.layout)}` : 'Start with the home row'; }
  const m = mathOf(p);
  if (!m.totals.trips) return 'Pick a kind of math to start';
  const started = SUBJECT.math.chips.filter(c => topicStarted('math', c.id, p)).length;
  return `${started} of ${SUBJECT.math.chips.length} kinds of math started`;
}

/** The topics of a subject in groups: math by grade band, typing's islands in order. */
export type TopicTile = { id: string; name: string; art: string; color: string; line: string; done: number; of: number; locked?: string; go: () => void };
export type TopicGroup = { name: string; tiles: TopicTile[] };
const BANDS = [
  { name: 'Starting out · K–2', max: 2 },
  { name: 'Building up · 3–5', max: 5 },
  { name: 'Big ideas · 6–8', max: 8 },
];
const firstGrade = (g: string) => (g.trim().startsWith('K') ? 0 : parseInt(g, 10) || 0);
export function topicGroups(s: string, p: Profile): TopicGroup[] {
  const S = SUBJECT[s];
  if (!S) return [];
  const tiles = S.chips.map(c => topicTile(s, c.id, p));
  if (s !== 'math') return [{ name: '', tiles }];
  return BANDS.map((b, i) => ({
    name: b.name,
    tiles: tiles.filter(t => { const g = firstGrade(areaGrades(t.id) ?? AREA[t.id as AreaId]?.grades ?? '0'); return g <= b.max && (i === 0 || g > BANDS[i - 1].max); }),
  })).filter(g => g.tiles.length);
}
/** islands done of all a topic's islands (a math area's regions; a typing island's lessons) */
export function topicProgress(s: string, topic: string, p: Profile): { done: number; of: number } {
  if (s === 'typing') { const r = REGION[topic as RegionId]; return { done: r.lessons.filter(l => passed(p, l.id)).length, of: r.lessons.length }; }
  const a = AREA[topic as AreaId];
  const m = mathOf(p);
  if (a?.op) { const rs = regionsOf(a.op); return { done: rs.filter(r => mathPassed(m, r.lessons.at(-1)!.id)).length, of: rs.length }; }
  const rs = skillRegionsOf(topic as AreaId);
  return { done: rs.filter(r => skillPassed(m, r.lessons.at(-1)!.id)).length, of: rs.length };
}
export function topicStarted(s: string, topic: string, p: Profile): boolean {
  if (s === 'typing') return REGION[topic as RegionId].lessons.some(l => p.lessons[l.id]);
  const a = AREA[topic as AreaId], m = mathOf(p);
  return a?.op ? MATH_LESSONS.some(l => l.op === a.op && m.lessons[l.id]) : SKILL_LESSONS.some(l => l.area === topic && m.lessons[l.id]);
}
export function topicTile(s: string, topic: string, p: Profile): TopicTile {
  const c = SUBJECT[s].chips.find(x => x.id === topic)!;
  const pr = topicProgress(s, topic, p);
  let locked: string | undefined;
  if (s === 'typing' && !regionUnlocked(p, topic as RegionId)) {
    const i = REGIONS.findIndex(r => r.id === topic);
    locked = `Finish ${REGIONS[i - 1]?.name ?? 'the island before'} first`;
  }
  const unit = s === 'typing' ? 'lessons' : 'islands';
  const line = locked ?? (pr.done === pr.of && pr.of ? 'All done!' : pr.done ? `${pr.done} of ${pr.of} ${unit}` : topicStarted(s, topic, p) ? 'Started' : 'New');
  return { id: topic, name: topicName(s, topic), art: c.art, color: c.color, line, done: pr.done, of: pr.of, locked, go: () => { sfx.click(); openTopic(s, topic); } };
}

/** A topic's four ways: Learn, Practice, Play, Adventure, each with one line; a way with nothing is "Coming soon". */
export type WayTile = { id: WayId; name: string; icon: string; color: string; tint: string; line: string; soon: boolean; go: () => void };
export function topicWays(s: string, topic: string, p: Profile): WayTile[] {
  const S = SUBJECT[s];
  const m = mathOf(p);
  return WAYS.map(w => {
    const things = thingsIn(S, w.id, topic).filter(t => !t.soon);
    let line = '', go: () => void = () => {};
    const soon = w.id !== 'practice' && !things.length;
    if (w.id === 'learn') {
      const done = s === 'typing' ? things.filter(t => passed(p, t.id)).length : things.filter(t => isLearned(m, t.id)).length;
      line = `${done} of ${things.length} ${s === 'typing' ? 'done' : 'watched'}`;
      go = () => { sfx.click(); openWay(s, topic, 'learn'); };
    } else if (w.id === 'practice') {
      const pr = topicProgress(s, topic, p);
      line = `${pr.done} of ${pr.of} ${s === 'typing' ? 'lessons' : 'islands'}`;
      go = () => { sfx.click(); openTopicMap(s, topic); };
    } else if (w.id === 'games') {
      const best = Math.max(0, ...things.map(t => bestOf(t, p)));
      line = things.length === 1 ? (best ? `${things[0].name} · best ${best.toLocaleString('en-US')}` : things[0].name) : `${things.length} games${best ? ` · best ${best.toLocaleString('en-US')}` : ''}`;
      // one game: straight in; more: the list of them
      go = things.length === 1 ? () => openThing(S, 'games', things[0]) : () => { sfx.click(); openWay(s, topic, 'games'); };
    } else {
      const own = things.find(t => t.areas.length === 1) ?? things[0];
      line = own ? own.name : '';
      go = () => { if (own) openThing(S, 'adventure', own); };
    }
    if (soon) { line = 'Coming soon'; go = () => { sfx.nope(); game.say(`${WAY_PAGE[w.id]} for ${topicName(s, topic)} is coming soon!`); }; }
    return { id: w.id, name: WAY_PAGE[w.id], icon: w.icon, color: w.color, tint: w.tint, line, soon, go };
  });
}
function bestOf(t: Thing, p: Profile): number {
  const st = statusOf(SUBJECT.math, 'games', t, p);
  const n = /Best ([\d,]+)/.exec(st.tag)?.[1];
  return n ? Number(n.replace(/,/g, '')) : 0;
}
/** The next thing in a topic: its name, and how to start it (Continue on a topic's page). */
export function topicNext(s: string, topic: string, p: Profile): { label: string; go: () => void } {
  if (s === 'typing') {
    const r = REGION[topic as RegionId];
    const l = r.lessons.find(x => !passed(p, x.id) && isUnlocked(p, x)) ?? r.lessons.find(x => !passed(p, x.id)) ?? r.lessons[0];
    return { label: lessonTitle(l, game.layout), go: () => { if (!isUnlocked(p, l)) { sfx.nope(); game.say(`Finish the island before ${r.name} first!`); return; } sfx.click(); game.setHome('typing'); game.startLesson(l.id, passed(p, l.id)); } };
  }
  const a = AREA[topic as AreaId], m = mathOf(p);
  if (a?.op) { const l = nextMathLesson(m, a.op); return { label: l.title, go: () => { sfx.click(); game.setHome('math'); game.startMath(l.id); } }; }
  const l = nextSkillLesson(m, topic as AreaId);
  return { label: l.title, go: () => { sfx.click(); game.setHome('math'); game.startSkill(l.id); } };
}
/** The small row on a topic: Show What You Know (skip ahead) and the topic's garden bed. */
export function topicExtras(s: string, topic: string): { id: string; name: string; icon: string; go: () => void }[] {
  if (s !== 'math') return [];
  const out: { id: string; name: string; icon: string; go: () => void }[] = [];
  const pl = placementFor(topic);
  if (pl) out.push({ id: 'swyk', name: 'Show What You Know', icon: 'icons/flag.webp', go: () => { sfx.click(); game.setHome('math'); if (AREA[topic as AreaId].op) game.startMath(pl.id); else game.startSkill(pl.id); } });
  out.push({ id: 'garden', name: 'Garden bed', icon: 'icons/garden.webp', go: () => { sfx.click(); game.visit('garden'); } });
  return out;
}

/** The Menu (three lines on the top bar), by level: Home, the subjects, the places, My stuff and My path; then Settings,
 *  Ideas and help, Grown-ups, For teachers and About. A jump from the Menu is a step, so Back from there
 *  goes up a level (Ideas and help comes back to where it was opened). */
export type MenuItem = { id: string; name: string; icon: string; go: () => void };
export function menuPlaces(): MenuItem[] {
  return [
    { id: 'hub', name: 'Home', icon: 'game/icon-home.webp', go: () => game.go('hub') },
    ...SUBJECTS.map(s => ({ id: s.id, name: s.name, icon: s.icon, go: () => openSubjectPage(s.id) })),
    { id: 'arcade', name: 'Arcade', icon: 'icons/arcade.webp', go: () => game.go('arcade') },
    { id: 'adventure', name: 'Adventure', icon: 'game/icon-grump.webp', go: () => { worldSubject.id = adventureSubject(); game.go('adventure'); } },
    { id: 'island', name: 'My Sky Island', icon: 'island/tile.webp', go: () => game.go('island') },
    { id: 'mystuff', name: 'My stuff', icon: 'game/chest.webp', go: () => game.go('mystuff') },
    { id: 'path', name: 'My path', icon: 'icons/path.webp', go: () => game.go('path') },
  ];
}
export function menuMore(): MenuItem[] {
  return [
    { id: 'settings', name: 'Settings', icon: 'game/icon-settings.webp', go: () => game.openSettings() },
    { id: 'ideas', name: 'Ideas and help', icon: 'icons/bulb.webp', go: () => game.openIdeas() },
    { id: 'grownups', name: 'Grown-ups', icon: 'icons/grownups.webp', go: () => { game.guSection = null; game.go('grownups'); } },
    { id: 'teach', name: 'For teachers', icon: 'icons/coach.webp', go: () => game.go('teach') },
    { id: 'about', name: 'About Keypals', icon: 'brand/ant-mark.png', go: () => game.go('about') },
  ];
}

/** My stuff's sections, each its own page (screens/MyStuff.svelte draws them with their counts). */
export const STUFF_GO: Record<string, () => void> = {
  keypals: () => game.go('keypals'),
  closet: () => { game.closetTab = 'outfits'; game.go('closet'); },
  shop: () => { game.shopSlot = null; game.shopSection = null; game.go('shop'); },
  dances: () => { game.closetTab = 'dances'; game.go('dances'); },
  stickers: () => { game.stickerTab = 'stickers'; game.go('stickers'); },
  glimmers: () => { game.glimmerTab = 'team'; game.go('glimmers'); },
  eggs: () => game.go('eggs'),
  garden: () => game.go('garden'),
  progress: () => game.go('progress'),
};
