// Going places from the subjects list (subjects.ts): open a subject's page on one way and one part,
// open one thing (an episode, a game, a world), the "Keep going" for each subject, and the little
// line each thing shows (learned, best score, locked...). Home, the subject pages and the compass use these.
import { game } from './state/game.svelte';
import { sfx } from './audio/sound';
import { MATH_CHIPS, SUBJECT, type Anywhere, type Subject, type Thing, type WayId } from './subjects';
import { LESSON as TYPING_LESSON, lessonTitle, type RegionId } from './engine/course';
import { isUnlocked, nextLesson, passed, type Profile } from './engine/profile';
import { STRAND } from './math/course';
import { mathOf, nextMathLesson } from './math/progress';
import { isLearned } from './math/learn';
import { AREA, areaOfOp } from './math/skills/registry';
import { nextSkillLesson, SKILL_PLACEMENTS } from './math/skills/course';
import type { AreaId } from './math/skills/types';
import { PLACEMENTS } from './math/course';
import { arcadeOf, type ArcadeId } from './arcade/arcade';
import { playNextLevel, playOf, type PlayGame } from './math/playground';
import { builderOf, builderOpen } from './math/place/builder';
import { advOf, worldOpen, type WorldId } from './adventure/state';
import { lastWorld, WORLD_PIN } from './adventure/worlds';

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

/** A subject's page, on one way (and one part). */
export function openSubject(s: string, way: WayId = wayOf(s), chip?: string) {
  if (s === 'typing' || s === 'math') game.setHome(s);
  game.way = { ...game.way, [s]: way };
  if (chip !== undefined) setChip(s, chip);
  game.go('map');
}

/** Open one thing from a subject's list. */
export function openThing(s: Subject, w: WayId, t: Thing) {
  const p = game.profile;
  if (!p) return;
  if (t.soon) { sfx.nope(); game.say(`${t.name} is coming soon!`); return; }
  sfx.click();
  const from = game.screen === 'hub' ? 'hub' : 'map';
  game.way = { ...game.way, [s.id]: w };
  if (s.id === 'typing') {
    if (w === 'practice') { openSubject('typing', 'practice', t.id); return; }
    if (w === 'adventure') { game.update(pp => { advOf(pp).subject = 'typing'; }); lastWorld.id = 'sky'; game.go('adventure'); return; }
    const l = TYPING_LESSON[t.id];
    if (!l) return;
    if (!isUnlocked(p, l)) { sfx.nope(); game.say('Keep going on the typing map to open this one!'); return; }
    game.setHome('typing');
    game.startLesson(l.id, passed(p, l.id));
    return;
  }
  game.setHome('math');
  if (w === 'learn') {
    if (t.kind === 'market') { game.mathOp = null; game.mathArea = 'decimals'; game.go('map'); game.learnOverlay = t.id; return; }
    if (t.kind === 'measure') { game.mathOp = null; game.mathArea = 'measure'; game.learnCheck = false; game.go('map'); game.learnOverlay = t.id; return; }
    game.learnCheck = false;
    game.openLearn(t.id, from);
    return;
  }
  if (w === 'practice') {
    if (t.id === 'garden') { game.go('garden'); return; }
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
    if (area) openSubject('math', 'practice', area);
    return;
  }
  game.update(pp => { advOf(pp).subject = 'math'; });
  lastWorld.id = id;
  game.go('adventure');
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
  return { label: fresh ? 'Pick a kind of math' : l.title, fresh, go: () => { if (fresh) openSubject('math', 'practice', 'all'); else { sfx.click(); game.setHome('math'); game.startMath(l.id); } } };
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
      ? (t.id === 'builder' ? builderOf(p).best : t.id === 'pizza' ? m.arcade?.['pizza-rush']?.best ?? 0 : t.id === 'market' ? m.arcade?.['market-dash']?.best ?? 0 : t.id === 'clockrush' ? m.arcade?.['clock-rush']?.best ?? 0 : t.id === 'smoothie' ? m.arcade?.['smoothie-stand']?.best ?? 0 : t.id === 'treasure' ? m.arcade?.['treasure-grid']?.best ?? 0 : arcadeOf(p)[t.id as ArcadeId]?.best ?? 0)
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

/** Open one of the places that take every subject (Home's "Play anywhere", the compass menu). */
export function openAnywhere(id: Anywhere['id']) {
  sfx.click();
  if (id === 'duel') { game.duelMode = 'duel'; game.duelRival = null; game.duelKey++; game.go('duel'); }
  else game.go(id === 'drop' ? 'drop' : id === 'rivals' ? 'rivals' : id);
}
