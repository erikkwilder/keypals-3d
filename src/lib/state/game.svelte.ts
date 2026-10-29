// App-wide state: the save file, the active player, and which screen is showing.

import { OLD_SAVE_KEYS, SAVE_KEY } from '../config';
import { emptySave, migrate, newProfile, type Profile, type RunOutcome, type SaveFile, type Settings } from '../engine/profile';
import type { FriendId } from '../art/cast';
import { LAYOUTS } from '../engine/layouts';

export type Screen = 'title' | 'players' | 'newPlayer' | 'hub' | 'map' | 'run' | 'results' | 'stickers' | 'closet' | 'settings' | 'grownups' | 'mathRun' | 'mathResults' | 'garden' | 'playground' | 'adventure' | 'battle' | 'glimmers' | 'eggs' | 'learn' | 'duel' | 'rivals' | 'shop' | 'skillRun' | 'skillResults' | 'skills' | 'arcade' | 'arcadePlay';

function load(): SaveFile {
  try {
    const raw = localStorage.getItem(SAVE_KEY) ?? OLD_SAVE_KEYS.map(k => localStorage.getItem(k)).find(Boolean) ?? null;
    return raw ? migrate(JSON.parse(raw)) : emptySave();
  } catch {
    return emptySave();
  }
}

export type LastRun = RunOutcome & {
  lessonId: string;
  text: string;
  wpm: number;
  /** speed plus the clean-typing bonus */
  score: number;
  bonusMs: number;
  acc: number;
  stars: number;
  bestRide: number;
  durationMs: number;
  errors: number;
  maxStreak: number;
  finished: boolean;
  /** the race against the ghost: did you win, and by how many seconds (absent with the ghost off) */
  ghost?: { beat: boolean; by: number; finished: boolean };
};

class Game {
  save = $state<SaveFile>(load());
  screen = $state<Screen>('title');
  lessonId = $state<string>('village-1');
  last = $state<LastRun | null>(null);
  /** bumps when a run restarts so the run screen rebuilds */
  runKey = $state(0);
  toast = $state<string | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  /** the quick settings sheet: opened from any screen, or once as the first-time sound setup */
  sheet = $state<'settings' | 'setup' | null>(null);
  private sheetDone: (() => void) | null = null;
  /** the full settings, opened over whatever screen you're on (a paused lesson stays paused) */
  settingsOpen = $state(false);
  /** the progress chart for one lesson, opened over any screen */
  chartLesson = $state<string | null>(null);
  /** which tab the sticker book opens on */
  stickerTab = $state<'stickers' | 'medals' | 'rides'>('stickers');
  /** which tab Keypals opens on (outfits and gear are both the Wardrobe now) */
  closetTab = $state<'outfits' | 'dances' | 'gear'>('outfits');
  /** the Shop: where its back button goes, and a slot to show first */
  shopBack = $state<Screen>('hub');
  shopSlot = $state<string | null>(null);
  /** Adventure: the map stop being battled, and a fresh key so "battle again" starts a new one */
  battleNode = $state<string | null>(null);
  battleKey = $state(0);
  /** the Glimmer to show first on the Glimmers screen (a new one to put on the team) */
  glimmerSel = $state<string | null>(null);
  /** Family Duel or Rival Ghosts, and the rival picked (the duel screen rebuilds when duelKey bumps) */
  duelMode = $state<'duel' | 'rival'>('duel');
  duelRival = $state<import('../adventure/ghosts').Rival | null>(null);
  duelKey = $state(0);
  /** Learn: the lesson open on the Learn screen (null: the list of tricks), and where Back goes */
  learnId = $state<string | null>(null);
  learnBack = $state<Screen>('map');
  /** the Arcade: the game being played, today's challenge or a free round, and a key so "play again" starts fresh */
  arcadeGame = $state<import('../arcade/arcade').ArcadeId>('slalom');
  arcadeDaily = $state(false);
  arcadeKey = $state(0);
  playArcade(id: import('../arcade/arcade').ArcadeId, daily = false) {
    this.arcadeGame = id;
    this.arcadeDaily = daily;
    this.arcadeKey++;
    this.screen = 'arcadePlay';
  }
  /** a Learn lesson opened over a math trip (the trip waits underneath) */
  learnOverlay = $state<string | null>(null);
  openLearn(id: string | null = null, back: Screen = this.screen === 'learn' ? this.learnBack : this.screen) {
    this.learnId = id;
    this.learnBack = back;
    this.screen = 'learn';
  }

  get profile(): Profile | null {
    return this.save.profiles.find(p => p.id === this.save.activeId) ?? null;
  }
  get settings(): Settings {
    return this.profile?.settings ?? defaultish;
  }
  get layout() {
    return LAYOUTS[this.settings.layout] ?? LAYOUTS.qwerty;
  }

  persist() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify($state.snapshot(this.save)));
    } catch {
      this.say('Could not save progress on this device.');
    }
  }

  go(screen: Screen) {
    // the sticker book, closet and settings go back to wherever they were opened from
    if (screen === 'hub' || screen === 'map') this.home = screen;
    this.screen = screen;
  }
  /** where "back" goes from the sticker book, closet and settings: Home or a subject's map */
  home = $state<'hub' | 'map'>('hub');

  openSheet(mode: 'settings' | 'setup' = 'settings', onClose?: () => void) {
    this.sheet = mode;
    this.sheetDone = onClose ?? null;
  }
  closeSheet() {
    const done = this.sheetDone;
    this.sheet = null;
    this.sheetDone = null;
    done?.();
  }
  openSettings() { this.settingsOpen = true; }
  closeSettings() { this.settingsOpen = false; }
  /** the music picker, open over any screen (music keeps playing; switching crossfades) */
  musicOpen = $state(false);
  openMusic() { this.musicOpen = true; }
  closeMusic() { this.musicOpen = false; }
  /** something is open on top of the screen and owns the keyboard */
  get modalOpen() { return this.sheet !== null || this.settingsOpen || this.musicOpen || this.chartLesson !== null || this.learnOverlay !== null; }
  openChart(id: string) { this.chartLesson = id; }
  closeChart() { this.chartLesson = null; }
  openStickers(tab: 'stickers' | 'medals' | 'rides' = 'stickers') {
    this.stickerTab = tab;
    this.screen = 'stickers';
  }
  openCloset(tab: 'outfits' | 'dances' | 'gear' = 'outfits') {
    this.closetTab = tab;
    this.screen = 'closet';
  }
  /** The Shop (one for the whole game: Home, the Adventure map and the Wardrobe open it). */
  openShop(slot: string | null = null) {
    if (this.screen !== 'shop') this.shopBack = this.screen;
    this.shopSlot = slot;
    this.screen = 'shop';
  }

  say(msg: string, ms = 2600) {
    this.toast = msg;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = null), ms);
  }

  addPlayer(name: string, buddy: FriendId, grown: boolean, layout?: Settings['layout']) {
    const p = newProfile(name, buddy, grown);
    if (layout) p.settings.layout = layout;
    this.save.profiles.push(p);
    this.save.activeId = p.id;
    this.persist();
    return p;
  }

  choose(id: string) {
    this.save.activeId = id;
    this.persist();
  }

  removePlayer(id: string) {
    this.save.profiles = this.save.profiles.filter(p => p.id !== id);
    if (this.save.activeId === id) this.save.activeId = this.save.profiles[0]?.id ?? null;
    this.persist();
  }

  update(fn: (p: Profile) => void) {
    const p = this.profile;
    if (!p) return;
    fn(p);
    p.updatedAt = Date.now();
    this.persist();
    this.onProfileChange?.();
  }

  replaceProfile(p: Profile) {
    const i = this.save.profiles.findIndex(x => x.id === p.id);
    p.updatedAt = Date.now();
    if (i >= 0) this.save.profiles[i] = p;
    this.persist();
    this.onProfileChange?.();
  }

  /** told after a player changes (online saving sends the new copy) */
  onProfileChange: (() => void) | null = null;

  /** replaying a lesson skips its intro card and starts right away */
  quickStart = false;

  // ---- the math game: home shows typing or math; its trips and results live in src/lib/math ----
  mathLessonId = $state('twins-1');
  /** which part of math the math map shows: a strand, or null for the five big cards */
  mathOp = $state<import('../math/facts').Op | null>(null);
  mathLast = $state<import('../math/progress').MathOutcome & { lessonId: string; stats: import('../math/meter').TripStats; results: import('../math/meter').FactResult[]; stars: number; bestRide: number; finished: boolean } | null>(null);
  get homeGame(): 'typing' | 'math' { return this.profile?.math?.home ?? 'typing'; }
  setHome(g: 'typing' | 'math') {
    this.update(p => { p.math = { ...(p.math ?? { facts: {}, lessons: {}, history: [], totals: { trips: 0, facts: 0, ms: 0 } }), home: g }; });
  }
  // ---- the skill areas (fractions and on): their trips and results live in src/lib/math/skills ----
  skillLessonId = $state('frac-a-1');
  /** the player the grown-ups' skills report is about (null: the one playing) */
  skillsFor = $state<string | null>(null);
  /** the area the math map shows (a skill area), or null */
  mathArea = $state<import('../math/skills/types').AreaId | null>(null);
  skillLast = $state<(import('../math/skills/progress').SkillOutcome & { lessonId: string; stats: import('../math/meter').TripStats; results: import('../math/skills/progress').SkillResult[]; stars: number; bestRide: number; finished: boolean }) | null>(null);
  startSkill(id: string, replay = false) {
    this.quickStart = replay;
    this.skillLessonId = id;
    this.runKey++;
    this.screen = 'skillRun';
  }
  startMath(id: string, replay = false) {
    this.quickStart = replay;
    this.mathLessonId = id;
    this.runKey++;
    this.screen = 'mathRun';
  }

  startLesson(id: string, replay = false) {
    this.quickStart = replay;
    this.lessonId = id;
    this.runKey++;
    this.screen = 'run';
  }
}

const defaultish: Settings = {
  look: 'soft', grown: false, layout: 'qwerty', sound: true, music: true, melody: false, tune: 'twinkle', volume: 0.8,
  reducedMotion: false, font: 'fredoka', dailyGoalMin: 10, hints: 'auto', hands: true, keyboard: true,
  voice: true, voiceChars: true, demos: 'auto',
};

export const game = new Game();
