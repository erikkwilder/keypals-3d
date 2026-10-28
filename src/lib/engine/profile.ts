// Players, their progress and settings, and what happens after every run: records, the
// daily goal, and each buddy's own XP, level, outfits, dances, medals and stickers. All pure
// functions over plain data.

import { BUDDIES, type FriendId, type Look } from '../art/cast';
import { ALL_LESSONS, LESSON, REGIONS, knownChars, lessonIndex, type Lesson, type RegionId } from './course';
import type { Layout, LayoutId } from './layouts';
import { AWARD, type AwardDef } from './achievements';
import { STICKERS, levelFromXp, medalTier, newPalProgress, type PalProgress, type StickerDef } from './stickers';
import { teamBuddies, welcomeNew } from './team';
import { REWARDS, forBuddy, newBetween, treasureFor, type Reward } from './rewards';
import { updateKeyStats, type KeyStat } from './mastery';
import { lessonGoal, platinumScore, starScores, type RunStats } from './scoring';
import { RIDES } from './rides';

export type FontChoice = 'fredoka' | 'atkinson' | 'lexend' | 'opendyslexic';

export type Settings = {
  look: Look;
  grown: boolean;
  layout: LayoutId;
  sound: boolean;
  music: boolean;
  melody: boolean;
  tune: string;
  /** the background music's style ('mix': a different one each lesson) */
  musicStyle?: import('../audio/sound').MusicStyleId | 'mix';
  volume: number; // 0..1
  reducedMotion: boolean;
  font: FontChoice;
  dailyGoalMin: number;
  hints: 'auto' | 'always' | 'off'; // auto = fade as keys are mastered
  hands: boolean;
  keyboard: boolean;
  voice: boolean; // the coach speaks
  voiceChars: boolean; // the Keypals speak
  demos: 'auto' | 'always' | 'off'; // animated finger demos before lessons
  easy?: boolean; // easy mode: two thirds of the goal score earns the stars (kids only)
  ghost?: boolean; // show the ghost racer at three-star pace
  graphics?: 'high' | 'low'; // low: fewer grass blades, softer shadows, fewer pixels
};

export type LessonRecord = {
  stars: number; bestWpm: number; bestAcc: number; bestRide: number;
  attempts: number; passes: number; lastAt: number;
  /** best and running total of the score (speed plus clean-typing bonus), for "high score" and "average" */
  bestScore?: number; scoreSum?: number;
  /** reached the platinum score on this lesson */
  platinum?: boolean;
  /** the best treasure step earned on this lesson */
  treasure?: number;
  /** times finished, stars or not */
  finishes?: number;
};

export type DayRecord = { ms: number; runs: number; goal?: boolean };

export type Totals = {
  runs: number; chars: number; words: number; ms: number; perfect: number;
  semis: number; spaces: number; stories: number; customs: number; wpmSum: number;
};

export type Profile = {
  id: string;
  name: string;
  buddy: FriendId;
  /** legacy (v0.1): the outfit now lives on each Keypal in `pals` */
  accessory: string;
  createdAt: number;
  settings: Settings;
  lessons: Record<string, LessonRecord>;
  keys: Record<string, KeyStat>;
  totals: Totals;
  days: Record<string, DayRecord>;
  badges: Record<string, number>; // legacy (v0.1)
  medals: Record<string, number>; // legacy (v0.1)
  unlocked: string[]; // legacy (v0.1)
  /** legacy (before 2026-10-28): progress kept per buddy; now merged into `team` */
  pals: Partial<Record<FriendId, PalProgress>>;
  /** everything earned (friendship, stickers, medals, treasure, best ride) belongs to the player's team,
   *  shared by every buddy: switching buddies never starts anything over */
  team?: PalProgress;
  /** each buddy's own look: the outfit it wears and its finish dance */
  looks?: Partial<Record<FriendId, { outfit: string; dance: string }>>;
  /** buddies already welcomed to the team (new ones are announced once) */
  buddiesMet?: FriendId[];
  rideBest: number;
  /** finger demos already watched: 'home' and 'lesson:<id>' */
  demosSeen?: string[];
  /** the first-time sound setup was answered */
  soundSetup?: boolean;
  customText: string;
  /** when this player last changed (for keeping copies on other computers in step) */
  updatedAt?: number;
  /** saved online under a save code; at = the server's time for the copy we last sent or got */
  cloud?: { code: string; at: number };
  history: HistoryItem[];
  /** a test player: every buddy on the team whatever the progress (Grown-ups → test player) */
  allBuddies?: boolean;
  /** the math game: fact memory, trips and which game home shows (absent in older saves) */
  math?: import('../math/progress').MathProgress;
};

export type HistoryItem = { at: number; lessonId: string; wpm: number; acc: number; stars: number; ride: number; ms: number; score?: number };

export type SaveFile = { version: 1; profiles: Profile[]; activeId: string | null };

export const MAX_PROFILES = 8;

export function defaultSettings(): Settings {
  return {
    look: 'soft', grown: false, layout: 'qwerty', sound: true, music: true, melody: false, tune: 'twinkle', volume: 0.8,
    reducedMotion: false, font: 'fredoka', dailyGoalMin: 10, hints: 'auto', hands: true, keyboard: true,
    voice: true, voiceChars: true, demos: 'auto',
  };
}

const emptyTotals = (): Totals => ({ runs: 0, chars: 0, words: 0, ms: 0, perfect: 0, semis: 0, spaces: 0, stories: 0, customs: 0, wpmSum: 0 });

export function newProfile(name: string, buddy: FriendId, grown = false): Profile {
  const s = defaultSettings();
  s.grown = grown;
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: name.trim().slice(0, 16) || 'Typist',
    buddy, accessory: 'none', createdAt: Date.now(), settings: s,
    lessons: {}, keys: {}, totals: emptyTotals(), days: {}, badges: {}, medals: {}, unlocked: [], rideBest: 0, customText: '', history: [],
    pals: {}, team: newPalProgress(), looks: {}, buddiesMet: [],
  };
}

export const emptySave = (): SaveFile => ({ version: 1, profiles: [], activeId: null });
/** Players from before the team: whoever their progress has already earned joins quietly. */
function seedMet(p: Profile): Profile { if (!p.buddiesMet) p.buddiesMet = teamBuddies(p); return p; }

/** Fill in anything a newer version added, so old saves keep working. */
export function migrate(raw: unknown): SaveFile {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Partial<SaveFile>;
  const profiles = Array.isArray(s.profiles) ? s.profiles : [];
  return {
    version: 1,
    activeId: typeof s.activeId === 'string' ? s.activeId : null,
    profiles: profiles.filter(p => p && typeof p === 'object' && typeof p.id === 'string').map(p => {
      const buddy = (p.buddy && BUDDIES.some(b => b.id === p.buddy) ? p.buddy : 'dino') as FriendId;
      const pals: Partial<Record<FriendId, PalProgress>> = {};
      for (const [id, v] of Object.entries(p.pals ?? {})) pals[id as FriendId] = { ...newPalProgress(), ...v };
      return {
        ...newProfile(p.name ?? 'Typist', buddy),
        ...p,
        buddy,
        settings: { ...defaultSettings(), ...(p.settings ?? {}) },
        totals: { ...emptyTotals(), ...(p.totals ?? {}) },
        lessons: p.lessons ?? {}, keys: p.keys ?? {}, days: p.days ?? {}, badges: p.badges ?? {}, medals: p.medals ?? {},
        unlocked: Array.isArray(p.unlocked) ? p.unlocked : [],
        history: Array.isArray(p.history) ? p.history : [],
        pals,
        team: p.team ? { ...newPalProgress(), ...p.team } : mergePals(pals),
        buddiesMet: p.buddiesMet,
        looks: p.looks ?? Object.fromEntries(Object.entries(pals).map(([id, v]) => [id, { outfit: v!.outfit ?? 'none', dance: v!.dance ?? 'dance_hiphop' }])),
      };
    }).map(seedMet),
  };
}

/** Old saves kept progress per buddy: add it all up into one team (friendship points add together,
 *  stickers and medals combine, bests take the best). */
export function mergePals(pals: Partial<Record<FriendId, PalProgress>>): PalProgress {
  const all = Object.values(pals).filter(Boolean).map(v => ({ ...newPalProgress(), ...v }));
  const t = newPalProgress();
  for (const v of all) {
    for (const k of ['xp', 'runs', 'chars', 'stars3', 'perfect', 'sharp', 'medalsTotal', 'comebacks', 'naps', 'dances'] as const) t[k] += v[k] ?? 0;
    for (const k of ['perfectRow', 'bestStreak', 'bestWpm', 'rideBest', 'treasureBest', 'ownKeys'] as const) t[k] = Math.max(t[k], v[k] ?? 0);
    for (const [id, at] of Object.entries(v.stickers ?? {})) t.stickers[id] = Math.min(t.stickers[id] ?? Infinity, at);
    for (const [id, n] of Object.entries(v.medals ?? {})) t.medals[id] = (t.medals[id] ?? 0) + n;
    t.goalDays = [...new Set([...t.goalDays, ...(v.goalDays ?? [])])];
    t.regions = [...new Set([...t.regions, ...(v.regions ?? [])])];
    t.seen = [...new Set([...t.seen, ...(v.seen ?? [])])];
  }
  t.level = levelFromXp(t.xp).level;
  return t;
}

/** The team's progress, to change (runs and trips write here). */
export function teamOf(p: Profile): PalProgress { return (p.team ??= mergePals(p.pals ?? {})); }
/** A buddy's own look: its outfit and finish dance. */
export function lookOf(p: Profile, friend: FriendId = p.buddy): { outfit: string; dance: string } {
  const l = p.looks?.[friend], old = p.pals?.[friend];
  return { outfit: l?.outfit ?? old?.outfit ?? 'none', dance: l?.dance ?? old?.dance ?? 'dance_hiphop' };
}
export function setLook(p: Profile, friend: FriendId, patch: Partial<{ outfit: string; dance: string }>) {
  p.looks ??= {};
  p.looks[friend] = { ...lookOf(p, friend), ...patch };
}
/** The team's progress seen with one buddy's look (to read; write with teamOf and setLook). */
export function palOf(p: Profile, friend: FriendId = p.buddy): PalProgress {
  return { ...(p.team ?? mergePals(p.pals ?? {})), ...lookOf(p, friend) };
}
export const outfitOf = (p: Profile, friend: FriendId = p.buddy) => lookOf(p, friend).outfit ?? 'none';
/** The buddy's finish dance (dances dropped in later versions fall back to the first one). */
export const danceOf = (p: Profile, friend: FriendId = p.buddy) => { const d = lookOf(p, friend).dance; return d && forBuddy(REWARDS, friend).some(r => r.id === d) ? d : 'dance_hiphop'; };
/** Outfits and dances this buddy has unlocked. */
export const rewardsFor = (pal: PalProgress) => REWARDS.filter(r => r.level <= pal.level);

export const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function totalStars(p: Profile): number {
  return Object.values(p.lessons).reduce((a, r) => a + (r.stars || 0), 0);
}

export const passed = (p: Profile, id: string) => (p.lessons[id]?.stars ?? 0) > 0;
/** You can move on after earning a star, or after finishing a lesson twice with 80% right: nobody gets stuck, but nobody skims through. */
export const movedOn = (p: Profile, id: string) => passed(p, id) || ((p.lessons[id]?.finishes ?? 0) >= 2 && (p.lessons[id]?.bestAcc ?? 0) >= 0.8);

export function isUnlocked(p: Profile, lesson: Lesson): boolean {
  // a lesson already played stays open (lessons added to the course later don't lock what came after)
  if (p.lessons[lesson.id]) return true;
  if (lesson.requires) return movedOn(p, lesson.requires);
  const idx = lessonIndex(lesson.id);
  if (idx <= 0) return true;
  const prev = ALL_LESSONS[idx - 1];
  if (prev.region === 'road') return true;
  return movedOn(p, prev.id);
}

export function regionUnlocked(p: Profile, id: RegionId): boolean {
  const r = REGIONS.find(x => x.id === id)!;
  return r.lessons.some(l => isUnlocked(p, l));
}

export function regionDone(p: Profile, id: RegionId): boolean {
  const r = REGIONS.find(x => x.id === id)!;
  return r.lessons.every(l => passed(p, l.id));
}

/** The lesson to suggest next: the first unlocked lesson not yet passed in the main course. */
export function nextLesson(p: Profile): Lesson {
  for (const l of ALL_LESSONS) if (l.region !== 'road' && isUnlocked(p, l) && !movedOn(p, l.id)) return l;
  return LESSON['road-1'];
}

/** The furthest main-course lesson passed (Open Road knows what you know). */
export function furthestLesson(p: Profile): Lesson {
  let best = ALL_LESSONS[0];
  for (const l of ALL_LESSONS) if (l.region !== 'road' && passed(p, l.id)) best = l;
  return best;
}

export function knownFor(p: Profile, lesson: Lesson, layout: Layout): Set<string> {
  return knownChars(lesson.region === 'road' ? furthestLesson(p).id : lesson.id, layout);
}

export function todayMs(p: Profile, now = Date.now()): number {
  return p.days[dayKey(now)]?.ms ?? 0;
}

export type RunInput = {
  lessonId: string;
  stats: RunStats;
  stars: number;
  bestRide: number;
  keyboardHidden: boolean;
  /** the on-screen hands guide stayed hidden the whole run */
  handsHidden?: boolean;
  finished: boolean;
  at: number;
  napped?: boolean;
};

export type MedalWin = AwardDef & { count: number; tier: number; tierUp: boolean };
export type XpInfo = { gained: number; before: { level: number; into: number; need: number }; after: { level: number; into: number; need: number } };

export type RunOutcome = {
  profile: Profile;
  /** buddies who joined the team with this run */
  buddies: FriendId[];
  medals: MedalWin[];
  stickers: StickerDef[];
  /** outfits and dances unlocked by this run's friendship level-up */
  rewards: Reward[];
  /** the treasure step this run's score earned (-1: none) */
  treasure: number;
  newBestTreasure: boolean;
  xp: XpInfo;
  before: LessonRecord | null;
  record: LessonRecord;
  newBestWpm: boolean;
  newBestScore: boolean;
  platinumJust: boolean;
  newBestRide: boolean;
  goalJustHit: boolean;
  regionJustDone: RegionId | null;
};

/**
 * Friendship XP for one run. Paced so a first great lesson is about one friendship level (one outfit),
 * outfits keep coming every lesson or two early on, and the last one takes a few weeks of practice.
 */
export function runXp(stats: RunStats, stars: number, medals: number, finished: boolean, grown: boolean) {
  return Math.round(stats.chars * 0.5 * (0.5 + stats.acc) * (grown ? 0.8 : 1) + stars * 10 + Math.min(medals, 5) * 4 + (finished ? 10 : 0));
}

export function applyRun(p0: Profile, run: RunInput, layout: Layout): RunOutcome {
  const lesson = LESSON[run.lessonId];
  const grown = p0.settings.grown;
  const s = run.stats;
  const p: Profile = structuredClone(p0);
  const before = p0.lessons[run.lessonId] ? { ...p0.lessons[run.lessonId] } : null;
  const prev = before ?? { stars: 0, bestWpm: 0, bestAcc: 0, bestRide: 0, attempts: 0, passes: 0, lastAt: 0 };
  const passedNow = run.stars > 0;
  const record: LessonRecord = {
    stars: Math.max(prev.stars, run.stars),
    bestWpm: passedNow || lesson.kind === 'sprint' ? Math.max(prev.bestWpm, s.wpm) : prev.bestWpm,
    bestAcc: Math.max(prev.bestAcc, run.finished ? s.acc : 0),
    bestRide: Math.max(prev.bestRide, run.bestRide),
    attempts: prev.attempts + 1,
    passes: prev.passes + (passedNow ? 1 : 0),
    lastAt: run.at,
    bestScore: Math.max(prev.bestScore ?? 0, s.score),
    scoreSum: (prev.scoreSum ?? 0) + s.score,
    finishes: (prev.finishes ?? 0) + (run.finished ? 1 : 0),
    platinum: !!prev.platinum || (run.finished && s.score >= platinumScore(lessonGoal(lesson, grown, p0.settings.easy))),
    treasure: Math.max(prev.treasure ?? -1, run.finished ? treasureFor(s.score, grown) : -1),
  };
  p.lessons[run.lessonId] = record;
  p.keys = updateKeyStats(p.keys, s.perKey);
  const avgBefore = p.totals.runs ? p.totals.wpmSum / p.totals.runs : 0;
  p.totals.runs++;
  p.totals.chars += s.chars;
  p.totals.words += s.words;
  p.totals.ms += s.durationMs;
  p.totals.semis += s.semis;
  p.totals.spaces += s.spaces;
  p.totals.wpmSum += s.wpm;
  if (run.finished && s.errors === 0 && s.chars >= 20) p.totals.perfect++;
  if (lesson.kind === 'story' || lesson.kind === 'facts') p.totals.stories++;
  if (lesson.kind === 'custom') p.totals.customs++;
  p.rideBest = Math.max(p.rideBest, run.bestRide);
  p.history.push({ at: run.at, lessonId: run.lessonId, wpm: s.wpm, acc: s.acc, stars: run.stars, ride: run.bestRide, ms: s.durationMs, score: s.score });
  if (p.history.length > 300) p.history.splice(0, p.history.length - 300);

  const dk = dayKey(run.at);
  const day = (p.days[dk] ??= { ms: 0, runs: 0 });
  const wasGoal = !!day.goal;
  day.ms += s.durationMs;
  day.runs++;
  if (!day.goal && day.ms >= p.settings.dailyGoalMin * 60000) day.goal = true;
  const goalJustHit = !wasGoal && !!day.goal;

  // medals for this run
  const medals: string[] = [];
  if (run.finished && s.chars >= 15) {
    if (s.errors === 0) medals.push('clean');
    else if (s.acc >= 0.97) medals.push('sharp');
    if (s.steady) medals.push('steady');
  }
  if (passedNow && before && before.bestWpm > 0 && s.wpm > before.bestWpm) medals.push('pb');
  if (before && run.bestRide > before.bestRide) medals.push('ride-record');
  if (run.bestRide > 0) medals.push(`ride-${RIDES[run.bestRide].id}`);
  if (s.maxStreak >= 100) medals.push('streak-100');
  else if (s.maxStreak >= 50) medals.push('streak-50');
  else if (s.maxStreak >= 25) medals.push('streak-25');
  const comeback = run.finished && s.errors >= 3 && s.finalStreak >= 15;
  if (comeback) medals.push('comeback');
  if (run.finished && run.keyboardHidden && passedNow) medals.push('nopeek');
  if (run.finished && run.handsHidden && passedNow) medals.push('hands-free');
  if (run.finished && run.keyboardHidden && run.handsHidden && s.acc >= 0.95) medals.push('touch-typist');
  if (passedNow && prev.attempts === 0) medals.push('firsttry');
  if (run.stars === 3) medals.push('three');
  if (avgBefore > 0 && p.totals.runs > 3 && s.wpm >= avgBefore * 1.15 && passedNow) medals.push('speedy');
  if (run.finished && s.chars >= 300) medals.push('marathon');
  if (goalJustHit) medals.push('goal');

  // this Keypal's own progress
  const pal: PalProgress = teamOf(p);
  const lvlBefore = levelFromXp(pal.xp);
  pal.runs++;
  pal.chars += s.chars;
  pal.bestStreak = Math.max(pal.bestStreak, s.maxStreak);
  if (passedNow || lesson.kind === 'sprint') pal.bestWpm = Math.max(pal.bestWpm, s.wpm);
  if (run.stars === 3) pal.stars3++;
  const perfect = run.finished && s.errors === 0 && s.chars >= 20;
  if (perfect) { pal.perfect++; pal.perfectRow++; } else if (run.finished) pal.perfectRow = 0;
  if (run.finished && s.acc >= 0.97 && s.chars >= 20) pal.sharp++;
  pal.rideBest = Math.max(pal.rideBest, run.bestRide);
  if (comeback) pal.comebacks++;
  if (run.napped && run.finished) pal.naps++;
  if (goalJustHit && !pal.goalDays.includes(dk)) pal.goalDays.push(dk);
  const treasure = run.finished ? treasureFor(s.score, grown) : -1;
  const newBestTreasure = treasure > pal.treasureBest;
  pal.treasureBest = Math.max(pal.treasureBest, treasure);
  if (run.finished) pal.dances++;
  if (passedNow) {
    const region = REGIONS.find(r => r.id === lesson.region)!;
    const last = region.lessons[region.lessons.length - 1];
    if ((lesson.id === last.id || region.id === 'road') && !pal.regions.includes(region.id)) pal.regions.push(region.id);
  }
  const medalWins: MedalWin[] = [];
  for (const m of medals) {
    const before = pal.medals[m] ?? 0;
    pal.medals[m] = before + 1;
    const tier = medalTier(before + 1);
    if (AWARD[m]) medalWins.push({ ...AWARD[m], count: before + 1, tier, tierUp: tier > medalTier(before) });
  }
  pal.medalsTotal += medals.length;
  const gained = runXp(s, run.stars, medals.length, run.finished, grown);
  pal.xp += gained;
  const lvlAfter = levelFromXp(pal.xp);
  pal.level = lvlAfter.level;
  const rewards = forBuddy(newBetween(lvlBefore.level, lvlAfter.level), p.buddy);
  for (const r of rewards) if (!pal.seen.includes('reward:' + r.id)) pal.seen.push('reward:' + r.id);

  // stickers: check everything this buddy hasn't won yet
  void layout;
  const stickers: StickerDef[] = [];
  for (const st of STICKERS) {
    if (pal.stickers[st.id]) continue;
    if (st.check(pal, { grown, friend: p.buddy })) { pal.stickers[st.id] = run.at; stickers.push(st); pal.seen.push('sticker:' + st.id); }
  }

  let regionJustDone: RegionId | null = null;
  for (const r of REGIONS) {
    if (r.id === 'road' || !r.lessons.some(l => l.id === run.lessonId)) continue;
    const doneNow = r.lessons.every(l => (p.lessons[l.id]?.stars ?? 0) > 0);
    const doneBefore = r.lessons.every(l => (p0.lessons[l.id]?.stars ?? 0) > 0);
    if (doneNow && !doneBefore) regionJustDone = r.id;
  }

  const buddies = welcomeNew(p);
  return {
    buddies,
    profile: p,
    medals: medalWins,
    stickers,
    rewards,
    treasure,
    newBestTreasure,
    xp: { gained, before: lvlBefore, after: lvlAfter },
    before,
    record,
    newBestWpm: !!before && record.bestWpm > before.bestWpm,
    newBestScore: !!before && s.score > (before.bestScore ?? 0),
    platinumJust: !!record.platinum && !before?.platinum,
    newBestRide: !!before && record.bestRide > before.bestRide,
    goalJustHit,
    regionJustDone,
  };
}

/** A friendly next goal for the results screen. */
export function nextGoal(p: Profile, out: Pick<RunOutcome, 'record'>, goal: number, rideTh: number[]): string {
  const r = out.record;
  const [one, two] = starScores(goal);
  if (r.stars === 0) return `Next goal: a score of ${one} for your first star. Keep your eyes on the letters!`;
  if (r.stars === 1) return `Next goal: a score of ${two} for two stars. Clean streaks add a time bonus!`;
  if (r.stars === 2) return `Next goal: a score of ${goal} for three stars.`;
  const nextRide = RIDES[r.bestRide + 1];
  if (nextRide) return `Next goal: reach ${nextRide.name} on this lesson (a live score of about ${rideTh[r.bestRide + 1]}).`;
  if (!r.platinum) return `Three stars! Can you reach platinum? It takes a score of ${platinumScore(goal)}.`;
  const pal = palOf(p);
  const left = STICKERS.filter(s => !pal.stickers[s.id]).length;
  return left ? `You've mastered this one! ${left} stickers still to find.` : 'Every sticker found. Legend!';
}
