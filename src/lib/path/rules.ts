// The grown-ups' and teachers' rules around My path, and the free-time places:
//   - how many path things make a day (about 3 by default),
//   - "Keep to the path": off; "path first" (the rest of the game opens once today's path things are
//     done); or "path only" (the path and what it starts, all day),
//   - daily time limits for the Arcade, the Fact Garden, My Sky Island, the Wardrobe and Shop, and Dances:
//     off (the usual), 10 to 30 minutes, or earned by practice like Adventure's play time,
//   - how play time is earned for Adventure and Glimmer Drop, and what math battles use.
// A grown-up sets them for a player on the Grown-ups screen (kept in the player's settings); a teacher sets
// them for a class (classes.js keeps them with the class; the game gets them with the class work). Both
// use the same card, in the same words (RulesCard.svelte). When both say something, the stricter one
// counts, and each page says so (ruleDiffs). A family's own player linked to a class keeps the family's
// rules everywhere: the game can't tell home from school, so class rules are for the players the class made.
//
// When time's up, the door says so kindly ("That's enough island time today. Your island will be here
// tomorrow!"), says who set it, and gives a way to the path; App.svelte shows the door instead of the place.
import type { Profile, Settings } from '../engine/profile';
import { dayKey } from '../engine/profile';
import type { Screen } from '../state/game.svelte';
import { advView, DEFAULT_SETTINGS, practiceMinToday, type AdvSettings, type PlayRule } from '../adventure/state';
import { doneToday, pathSave, type PathProfile } from './progress';
import { ARCADE_GAMES_SCREENS } from './pass';
import { AREAS } from '../math/skills/registry';

export type Keep = 'off' | 'first' | 'only';
export type Limit = 'off' | '10' | '15' | '20' | '30' | 'earned';
export type FreePlace = 'arcade' | 'garden' | 'island' | 'closet' | 'dances';
export const FREE_PLACES: FreePlace[] = ['arcade', 'garden', 'island', 'closet', 'dances'];
export const LIMITS: Limit[] = ['off', '10', '15', '20', '30', 'earned'];
export const KEEPS: Keep[] = ['off', 'first', 'only'];
/** What a grown-up or a teacher chose (any part can be missing: the usual then). */
export type PathRules = { keep?: Keep; goal?: number; limits?: Partial<Record<FreePlace, Limit>>; grade?: number | null };
/** What a class says about play time (anything left out: the class has no say in it). */
export type PlayChoice = Partial<Pick<AdvSettings, 'rule' | 'ratio' | 'freeMin' | 'capMin' | 'focus' | 'versus'>>;
/** A class's rules, as the server keeps them (classes.js cleanClassSettings): the path and time rules, play
 *  time, sound off for the class, its spelling list, the order of its units, and how students may sign in. */
export type ClassSettings = PathRules & { play?: PlayChoice; sound?: 'on' | 'off'; words?: string; order?: string[]; google?: 'on' | 'off'; domain?: string | null };
/** The player's own settings, with the grown-ups' path rules riding along. */
type PathSettings = Settings & { pathGoal?: number; keepPath?: Keep; limits?: Partial<Record<FreePlace, Limit>>; pathGrade?: number | null };

export const DEFAULT_GOAL = 3;
export const PLACE_NAME: Record<FreePlace, string> = { arcade: 'Arcade', garden: 'Fact Garden', island: 'My Sky Island', closet: 'Wardrobe and Shop', dances: 'Dances' };
/** The words for each rule, the same on the Grown-ups screen and the teacher's Class rules. */
export const RULE_WORDS = { keep: 'Keep to the path', goal: 'Things a day', play: 'Play time', limits: 'Daily limits', rule: 'Adventure and Glimmer Drop', ratio: 'Play minutes per practice minute', freeMin: 'Free minutes each day', capMin: 'Most Adventure a day', versus: 'Family Duel and Rival Ghosts', focus: 'Battles use', grade: 'Math path starts at' } as const;
export const KEEP_TEXT: Record<Keep, { name: string; text: string }> = {
  off: { name: 'Free to roam', text: 'My path is there as a guide. Everything is open.' },
  first: { name: 'Path first', text: 'The rest of the game opens once today\'s path things are done.' },
  only: { name: 'Path only', text: 'Just the path, and what it starts, all day.' },
};
export const LIMIT_NAME = (l: Limit) => (l === 'off' ? 'No limit' : l === 'earned' ? 'Earned by practice' : `${l} min a day`);

// ---------- what counts for a player ----------
const settingsOf = (p: Profile) => p.settings as PathSettings;
/** The grown-ups' rules for a player (Grown-ups → Time and goals). */
export function homeRules(p: Profile): PathRules {
  const s = settingsOf(p);
  return { keep: s.keepPath, goal: s.pathGoal, limits: s.limits, grade: s.pathGrade ?? null };
}
/** Change the grown-ups' rules (call inside game.update, or on a player then persist). */
export function setHomeRules(p: Profile, patch: { keep?: Keep; goal?: number; limits?: Partial<Record<FreePlace, Limit>>; grade?: number | null }) {
  const s = settingsOf(p);
  if (patch.grade !== undefined) s.pathGrade = patch.grade === null ? null : Math.max(0, Math.min(8, Math.round(patch.grade)));
  if (patch.keep !== undefined) s.keepPath = patch.keep;
  if (patch.goal !== undefined) s.pathGoal = Math.max(1, Math.min(6, Math.round(patch.goal)));
  if (patch.limits) s.limits = { ...(s.limits ?? {}), ...patch.limits };
}
const keepRank = (k?: Keep) => KEEPS.indexOf(k ?? 'off');
/** Minutes a limit allows today (null: no limit). Earned: 5 free minutes plus a minute per minute of practice. */
export function allowed(l: Limit | undefined, p: Profile, now = Date.now()): number | null {
  if (!l || l === 'off') return null;
  if (l === 'earned') return 5 + Math.floor(practiceMinToday(p, now));
  return Number(l);
}

// ---------- play time: the family's and the class's ----------
const PLAY_RANK: PlayRule[] = ['open', 'balanced', 'practiceFirst'];
const PLAY_KEYS = ['rule', 'ratio', 'freeMin', 'capMin'] as const;
/** What the family chose. The usual values are nobody's choice: a player nobody at home has set plays by
 *  the class's choice, which can be kinder than the usual (a teacher can pick Open). */
export function familyPlay(p: Profile): PlayChoice {
  const s = advView(p).settings, out: PlayChoice = {};
  if (s.rule !== DEFAULT_SETTINGS.rule) out.rule = s.rule;
  if (s.ratio !== DEFAULT_SETTINGS.ratio) out.ratio = s.ratio;
  if (s.freeMin !== DEFAULT_SETTINGS.freeMin) out.freeMin = s.freeMin;
  if (s.capMin) out.capMin = s.capMin;
  if (s.focus !== 'all') out.focus = s.focus;
  if (s.versus === false) out.versus = false;
  return out;
}
/** Play time for a player: the stricter of the family's and each class's, and who that comes from. A
 *  class's "battles use" counts first (it's what the class is working on). */
export function playFor(p: Profile, classes: ClassSettings[] = []): { play: AdvSettings; from: Who | 'none' } {
  const fam = familyPlay(p), cls = classes.map(c => c.play ?? {}), all: PlayChoice[] = [fam, ...cls];
  const nums = (k: 'ratio' | 'freeMin') => all.map(c => c[k]).filter((x): x is number => x !== undefined);
  const rules = all.map(c => c.rule).filter((x): x is PlayRule => !!x);
  const caps = all.map(c => c.capMin).filter((x): x is number => !!x);
  const play: AdvSettings = {
    ...advView(p).settings,
    rule: rules.length ? PLAY_RANK[Math.max(...rules.map(r => PLAY_RANK.indexOf(r)))] : DEFAULT_SETTINGS.rule,
    ratio: nums('ratio').length ? Math.min(...nums('ratio')) : DEFAULT_SETTINGS.ratio,
    freeMin: nums('freeMin').length ? Math.min(...nums('freeMin')) : DEFAULT_SETTINGS.freeMin,
    capMin: caps.length ? Math.min(...caps) : 0,
    focus: cls.find(c => c.focus && c.focus !== 'all')?.focus ?? fam.focus ?? 'all',
    ...(all.some(c => c.versus === false) ? { versus: false } : {}),
  };
  const from = cls.some(c => PLAY_KEYS.some(k => c[k] !== undefined && c[k] === play[k])) ? 'class' : PLAY_KEYS.some(k => fam[k] !== undefined) ? 'home' : 'none';
  return { play, from };
}

/** `grade`: where the math path starts (a class's grade first, else the grown-ups' pick; null: the beginning).
 *  `from`: who put "keep to the path" on; `limitFrom`: who set each limit that holds; `play`, `playFrom`: play
 *  time; `quiet`: a class turned sound off. */
export type Who = 'home' | 'class';
export type Rules = { keep: Keep; goal: number; limits: Partial<Record<FreePlace, Limit>>; grade: number | null; from: Who | 'none'; limitFrom: Partial<Record<FreePlace, Who>>; play: AdvSettings; playFrom: Who | 'none'; quiet: boolean };
/** The rules that hold for a player: the grown-ups' and any class's together, the stricter of each. */
export function rulesFor(p: Profile, classes: ClassSettings[] = [], now = Date.now()): Rules {
  const home = homeRules(p), all = [home, ...classes];
  const keep = all.reduce<Keep>((k, r) => (keepRank(r.keep) > keepRank(k) ? r.keep! : k), 'off');
  const goals = all.map(r => r.goal).filter((g): g is number => !!g && g > 0);
  const goal = goals.length ? Math.max(...goals) : DEFAULT_GOAL;
  const limits: Partial<Record<FreePlace, Limit>> = {}, limitFrom: Partial<Record<FreePlace, Who>> = {};
  for (const place of FREE_PLACES) {
    let best: Limit | undefined, mins = Infinity;
    all.forEach((r, i) => { const l = r.limits?.[place]; const a = allowed(l, p, now); if (a !== null && a <= mins) { mins = a; best = l; limitFrom[place] = i ? 'class' : 'home'; } });
    if (best) limits[place] = best;
  }
  const from = keep === 'off' ? 'none' : classes.some(c => c.keep === keep) ? 'class' : 'home';
  const grade = classes.find(c => c.grade !== undefined && c.grade !== null)?.grade ?? home.grade ?? null;
  const { play, from: playFrom } = playFor(p, classes);
  return { keep, goal, limits, grade, from, limitFrom, play, playFrom, quiet: classes.some(c => c.sound === 'off') };
}

// ---------- where a family and a class say different things ----------
export const RATIOS = [0.5, 1, 1.5, 2], FREE_MINS = [0, 5, 10, 15, 20], CAP_MINS = [0, 15, 20, 30, 45, 60];
export const ratioName = (r: number) => (r === 0.5 ? '1 for every 2' : r === 1 ? '1 for 1' : r === 1.5 ? '3 for every 2' : '2 for 1');
export const capName = (m: number) => (m ? `${m} min` : 'No limit');
/** Words for each play rule (the same as the cards on the page). */
export const PLAY_NAME: Record<PlayRule, string> = { open: 'Open', balanced: 'Balanced', practiceFirst: 'Practice first' };
/** What "battles use" can be set to. */
export const focusChoices = (): { id: string; name: string }[] => [
  { id: 'all', name: 'All the math met so far' }, { id: '+', name: 'Adding only' }, { id: '-', name: 'Taking away only' }, { id: 'x', name: 'Times only' }, { id: '/', name: 'Sharing only' },
  ...AREAS.filter(a => a.live && !a.op).map(a => ({ id: a.id as string, name: `${a.name} only` })),
];
const focusName = (f: string) => focusChoices().find(x => x.id === f)?.name ?? f;
export type RuleDiff = { key: string; label: string; family: string; cls: string; counts: 'family' | 'class' };
/** Each rule a family and a class differ on, in the pages' own words, and which one counts. Both pages read
 *  this: the parent's says "Room 12 says 10 min a day, so that counts"; the teacher's lists a stricter family. */
export function ruleDiffs(p: Profile, c: ClassSettings, now = Date.now()): RuleDiff[] {
  const out: RuleDiff[] = [], h = homeRules(p);
  const add = (key: string, label: string, family: string, cls: string, classWins: boolean) => { if (family !== cls) out.push({ key, label, family, cls, counts: classWins ? 'class' : 'family' }); };
  const hk = h.keep ?? 'off', ck = c.keep ?? 'off';
  add('keep', RULE_WORDS.keep, KEEP_TEXT[hk].name, KEEP_TEXT[ck].name, keepRank(ck) > keepRank(hk));
  if (h.goal && c.goal) add('goal', RULE_WORDS.goal, String(h.goal), String(c.goal), c.goal > h.goal);
  for (const pl of FREE_PLACES) {
    const hl = h.limits?.[pl] ?? 'off', cl = c.limits?.[pl] ?? 'off';
    const ha = allowed(hl, p, now) ?? Infinity, ca = allowed(cl, p, now) ?? Infinity;
    add(`limit:${pl}`, PLACE_NAME[pl], LIMIT_NAME(hl), LIMIT_NAME(cl), ca < ha);
  }
  const fam = advView(p).settings, chose = familyPlay(p), cp = c.play ?? {}, held = playFor(p, [c]).play;
  if (cp.rule) add('rule', RULE_WORDS.rule, PLAY_NAME[fam.rule], PLAY_NAME[cp.rule], held.rule === cp.rule);
  if (cp.ratio !== undefined) add('ratio', RULE_WORDS.ratio, ratioName(fam.ratio), ratioName(cp.ratio), held.ratio === cp.ratio);
  if (cp.freeMin !== undefined) add('freeMin', RULE_WORDS.freeMin, `${fam.freeMin} min`, `${cp.freeMin} min`, held.freeMin === cp.freeMin);
  if (chose.capMin || cp.capMin) add('capMin', RULE_WORDS.capMin, capName(fam.capMin), capName(cp.capMin ?? 0), held.capMin === (cp.capMin ?? 0));
  if (fam.versus === false || cp.versus === false) add('versus', RULE_WORDS.versus, fam.versus === false ? 'Off' : 'On', cp.versus === false ? 'Off' : 'On', cp.versus === false);
  if (cp.focus && cp.focus !== 'all') add('focus', RULE_WORDS.focus, focusName(fam.focus), focusName(cp.focus), true);
  return out;
}

// ---------- free time ----------
/** A game under way when the Arcade's time runs out gets this long to finish. */
export const GAME_GRACE_MIN = 3;
/** The free-time place a screen is (null: not one of them). The Wardrobe's dances tab is Dances. */
export function placeOf(screen: Screen, closetTab: string): FreePlace | null {
  if (screen === 'arcade' || ARCADE_GAMES_SCREENS.includes(screen)) return 'arcade';
  if (screen === 'garden') return 'garden';
  if (screen === 'island') return 'island';
  if (screen === 'shop') return 'closet';
  if (screen === 'closet' || screen === 'keypals') return 'closet';
  if (screen === 'dances') return 'dances';
  return null;
}
/** Minutes used in a place today (from the save, plus the minute being counted now). */
export function usedMs(p: Profile, place: FreePlace, now = Date.now(), running = 0): number {
  const t = pathSave(p).time;
  return (t && t.day === dayKey(now) ? t.ms[place] ?? 0 : 0) + running;
}
/** Add time spent in a place (on the player; the caller saves). */
export function addUsed(p: Profile, place: FreePlace, ms: number, now = Date.now()) {
  const pp = p as PathProfile, day = dayKey(now);
  const t = pp.path?.time?.day === day ? pp.path.time : { day, ms: {} };
  pp.path = { ...(pp.path ?? {}), time: { day, ms: { ...t.ms, [place]: (t.ms[place] ?? 0) + Math.max(0, Math.round(ms)) } } };
}
/** How much time is left in a place today (null: no limit). */
export function timeLeft(p: Profile, place: FreePlace, rules: Rules, now = Date.now(), running = 0): { open: boolean; leftMin: number | null; limit: Limit | null } {
  const l = rules.limits[place] ?? null;
  const a = allowed(l ?? undefined, p, now);
  if (a === null) return { open: true, leftMin: null, limit: null };
  const left = a - usedMs(p, place, now, running) / 60000;
  return { open: left > 0, leftMin: Math.max(0, left), limit: l };
}

/** What the door says when a place's time is up. */
export const STOP: Record<FreePlace, { title: string; line: string; art: string }> = {
  arcade: { title: "That's enough Arcade today.", line: 'The games will be here tomorrow!', art: 'icons/arcade.webp' },
  island: { title: "That's enough island time today.", line: 'Your island will be here tomorrow!', art: 'island/card.webp' },
  garden: { title: "That's enough garden time today.", line: 'Your flowers will keep growing until tomorrow!', art: 'icons/garden.webp' },
  closet: { title: "That's enough dressing up today.", line: 'Your wardrobe will be here tomorrow!', art: 'icons/outfits.webp' },
  dances: { title: "That's enough dancing today.", line: 'Your buddy will be ready to dance again tomorrow!', art: 'game/icon-dances.webp' },
};

// ---------- keep to the path ----------
/** The places a child roams to: closed while "keep to the path" holds. The path, what it starts (lessons,
 *  trips, games, battles, Learn), Home, the player's own settings and the grown-ups' screens stay open.
 *  Adventure is closed too: it opens only on the stop the path sends you to (path/pass.ts). */
export const ROAMING: Screen[] = ['adventure', 'map', 'arcade', 'island', 'closet', 'keypals', 'dances', 'shop', 'garden', 'drop', 'duel', 'rivals', 'playground', 'mystuff', 'stickers', 'glimmers', 'eggs', 'progress', 'subject', 'topic', 'way'];
/** Whether "keep to the path" holds right now (path first: until today's path things are done). */
export function pathHolds(p: Profile, rules: Rules, now = Date.now()): boolean {
  if (rules.keep === 'off') return false;
  if (rules.keep === 'only') return true;
  return doneToday(p, now) < rules.goal;
}

export type Door = { kind: 'time'; place: FreePlace; earned: boolean; from: Who } | { kind: 'path'; keep: Keep; left: number; from: Rules['from'] };
/** `work`: this screen was opened by the path or class work (its stop in Adventure, a game): no door, and
 *  no minutes counted. `playing`: a game that started while the Arcade had time left: it may finish. */
export type DoorPass = { work?: boolean; playing?: boolean };
/** What stands at the door of a screen, if anything: the place's time is up, or the path comes first. */
export function doorFor(screen: Screen, closetTab: string, p: Profile | null, rules: Rules, now = Date.now(), running = 0, pass: DoorPass = {}): Door | null {
  if (!p) return null;
  if (pass.work && (screen === 'adventure' || ARCADE_GAMES_SCREENS.includes(screen))) return null;
  if (ROAMING.includes(screen) && pathHolds(p, rules, now)) return { kind: 'path', keep: rules.keep, left: Math.max(0, rules.goal - doneToday(p, now)), from: rules.from };
  const place = placeOf(screen, closetTab);
  if (place) {
    const t = timeLeft(p, place, rules, now, running);
    if (!t.open) {
      const over = (usedMs(p, place, now, running) / 60000) - (allowed(t.limit ?? undefined, p, now) ?? 0);
      if (pass.playing && over < GAME_GRACE_MIN) return null;
      return { kind: 'time', place, earned: t.limit === 'earned', from: rules.limitFrom[place] ?? 'home' };
    }
  }
  return null;
}
