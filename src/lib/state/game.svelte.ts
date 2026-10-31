// App-wide state: the save file, the active player, and which screen is showing.

import { OLD_SAVE_KEYS, SAVE_KEY } from '../config';
import { emptySave, migrate, newProfile, type Profile, type RunOutcome, type SaveFile, type Settings } from '../engine/profile';
import type { FriendId } from '../art/cast';
import { LAYOUTS } from '../engine/layouts';
import { CTX_FIELDS, isAbove, isActivity, parentOf, samePlace, type Place } from './where';
import { ledgerNote, ledgerSnap, ledgerWhere } from '../engine/ledger';

export type Screen = 'title' | 'players' | 'newPlayer' | 'hub' | 'map' | 'run' | 'results' | 'stickers' | 'closet' | 'settings' | 'grownups' | 'mathRun' | 'mathResults' | 'garden' | 'playground' | 'adventure' | 'battle' | 'glimmers' | 'eggs' | 'learn' | 'duel' | 'rivals' | 'shop' | 'skillRun' | 'skillResults' | 'skills' | 'pizza' | 'builder' | 'drop' | 'arcade' | 'arcadePlay' | 'market' | 'ideas' | 'teach' | 'classLogin' | 'boards' | 'clockrush' | 'bench' | 'shifter' | 'shapebuilder'
  | 'smoothie' | 'treasure' | 'showdown' | 'balance'
  | 'island' // My Sky Island (screens/SkyIsland.svelte)
  | 'mystuff' | 'about' // everything that's yours in one place (screens/MyStuff.svelte), and About Keypals (screens/About.svelte)
  | 'path' // My path: each subject's units, what's done and what's next (screens/MyPath.svelte)
  // the one way around (state/where.ts): a subject's page, one topic of it, one way of a topic (Learn, Play),
  // and My stuff's own pages (the closet is the Wardrobe; Glimmers holds the Glimmer Book as its All 100 tab)
  | 'subject' | 'topic' | 'way' | 'keypals' | 'dances' | 'progress';

/** the most cross-links remembered on the way back */
const RETURNS_MAX = 24;

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
  /** the Shop: a slot to show first */
  shopSlot = $state<string | null>(null);
  /** Adventure: the map stop being battled, and a fresh key so "battle again" starts a new one */
  battleNode = $state<string | null>(null);
  battleKey = $state(0);
  /** the Glimmer to show first on the Glimmers screen (a new one to put on the team) */
  glimmerSel = $state<string | null>(null);
  /** Glimmers: your team, or all 100 (the Glimmer Book); every Glimmer Book link opens All 100 */
  glimmerTab = $state<'team' | 'all'>('team');
  openBook() { this.glimmerTab = 'all'; this.visit('glimmers'); }
  /** Family Duel or Rival Ghosts, and the rival picked (the duel screen rebuilds when duelKey bumps) */
  duelMode = $state<'duel' | 'rival'>('duel');
  duelRival = $state<import('../adventure/ghosts').Rival | null>(null);
  duelKey = $state(0);
  /** Learn: the episode playing on the Learn screen */
  learnId = $state<string | null>(null);
  /** the Arcade: the game being played, today's challenge or a free round, and a key so "play again" starts fresh */
  arcadeGame = $state<import('../arcade/arcade').ArcadeId>('slalom');
  arcadeDaily = $state(false);
  arcadeKey = $state(0);
  playArcade(id: import('../arcade/arcade').ArcadeId, daily = false) {
    this.arcadeGame = id;
    this.arcadeDaily = daily;
    this.arcadeKey++;
    this.arrive('arcadePlay');
  }
  /** the subject pages (Typing, Math): which way to play shows, Learn, Practice, Games or Adventure */
  way = $state<Record<string, import('../subjects').WayId>>({});
  /** the subject page showing (Typing, Math), the topic (a kind of math, a typing island) and, on a way
   *  page, which way (Learn or Play) */
  subject = $state<string>('math');
  topic = $state<string | null>(null);
  wayId = $state<import('../subjects').WayId>('learn');
  /** Grown-ups: the section open (null: the list of sections) */
  guSection = $state<string | null>(null);
  /** Grown-ups: the list of sections, or one section (Back comes back to where it was opened from) */
  openGrownups(section: string | null = null) { this.guSection = section; this.visit('grownups'); }
  /** the typing page's part (a region), or null for all of typing */
  typingArea = $state<import('../engine/course').RegionId | null>(null);
  /** the Learn episode opened from a subject page is just its next-day quick check */
  learnCheck = $state(false);
  /** a Playground game to start straight away (picked on a subject page's Games) */
  playPick = $state<string | null>(null);
  /** a Learn lesson opened over a math trip (the trip waits underneath) */
  learnOverlay = $state<string | null>(null);
  /** a Learn episode (an activity: its Pause card goes back to where it was started from) */
  openLearn(id: string) {
    this.learnId = id;
    this.arrive('learn');
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

  // ---- where you are, and the way back (state/where.ts has the map of levels) ----
  /** where the activity on screen was started from: its Pause card's "Back to" and its end card go there */
  from = $state<Place | null>(null);
  /** cross-links: a place opened from somewhere that isn't above it goes back there (newest last) */
  returns: { at: Place; to: Place }[] = [];

  /** Where you are now: the screen and what it shows. */
  here(screen: Screen = this.screen): Place {
    const ctx: Record<string, string | null> = {};
    const self = this as unknown as Record<string, unknown>;
    for (const k of CTX_FIELDS[screen] ?? []) ctx[k] = (self[k] as string | null | undefined) ?? null;
    return { screen, ctx };
  }
  /** Go to a screen, as a step up or down the levels (a tile on a page, the Menu, Back). */
  go(screen: Screen) { this.arrive(screen); }
  /** Go somewhere by a cross-link (the bar's My stuff, a Glimmers link on Adventure, the Wardrobe's Shop):
   *  Back from there comes back here. A place above this one, or below it, is just a step. Cross-links
   *  chain: the island's Shop, then the Shop's "Move and size it" to the Wardrobe, and Back unwinds them in
   *  order (the Wardrobe, the Shop, the island). */
  visit(screen: Screen) {
    const from = this.here();
    const to = this.here(screen);
    if (samePlace(from, to)) return;
    const step = isAbove(to, from, this.from) || isAbove(from, to, this.from) || parentOf(to, this.from) === null;
    this.arrive(screen, step ? null : from);
    if (!step) this.returns.push({ at: this.here(), to: from });
    if (this.returns.length > RETURNS_MAX) this.returns.splice(0, this.returns.length - RETURNS_MAX);
  }
  /** Go to a place (a screen and what it shows). */
  goPlace(pl: Place) {
    const self = this as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(pl.ctx)) self[k] = v;
    this.arrive(pl.screen);
  }
  /** Back: to where a cross-link came from, else up one level. Esc does the same. Home has no Back. */
  back() {
    const h = this.here();
    const top = this.returns.at(-1);
    // (back along a chain of cross-links: the ones before this one stay, to unwind next)
    if (top && samePlace(top.at, h)) { const rest = this.returns.slice(0, -1); this.goPlace(top.to); this.returns = rest; return; }
    const up = this.upFrom(h);
    if (up) this.goPlace(up);
  }
  /** The place Back goes to from here (null on Home). */
  backTo(): Place | null {
    const h = this.here();
    const top = this.returns.at(-1);
    if (top && samePlace(top.at, h)) return top.to;
    return this.upFrom(h);
  }
  /** One level up. Home needs a player: with nobody picked (a new phone back from signing in with Google,
   *  which reloads the game with no way back remembered) up from anywhere is the player list. */
  private upFrom(pl: Place): Place | null {
    const up = parentOf(pl, this.from);
    return up?.screen === 'hub' && !this.profile ? { screen: 'players', ctx: {} } : up;
  }
  /** Leave an activity: back to where it was started from. */
  leaveActivity() { this.goPlace(this.from ?? { screen: 'hub', ctx: {} }); }
  /** `via`: arriving by a cross-link from there (the cross-links on the way back to it stay, so a chain of
   *  them unwinds in order) */
  private arrive(next: Screen, via: Place | null = null) {
    // (Home can't draw without a player: nothing may land there with nobody picked, or the screen hangs)
    if (next === 'hub' && !this.profile) next = 'players';
    const was = this.here();
    if (isActivity(next) && !isActivity(this.screen)) this.from = was;
    this.screen = next;
    // the cross-links still on the way back from here (each one's place is here or above it, or the place
    // a cross-link just left, or above that)
    const now = this.here();
    this.returns = this.returns.filter(r => isAbove(r.at, now, this.from) || (!!via && isAbove(r.at, via, this.from)));
  }

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
  /** Ideas and help: which part opens first (Back comes back to where it was opened from) */
  ideasTab = $state<'board' | 'suggest' | 'problem'>('board');
  /** the screen Ideas and help was opened over (a problem report says which screen it was) */
  ideasFrom: Screen = 'hub';
  openAbout() { this.visit('about'); }
  openIdeas(tab: 'board' | 'suggest' | 'problem' = 'board') {
    if (this.screen !== 'ideas') this.ideasFrom = this.screen;
    this.ideasTab = tab;
    this.visit('ideas');
  }
  /** the menu that goes anywhere in the game (three lines on the top bar) */
  menuOpen = $state(false);
  /** the grown-up check before "Sign in with Google" (ui/GoogleSignIn.svelte) is up over the screen */
  gateOpen = $state(false);
  /** an activity's Pause card: open, and how to keep going */
  pause = $state<{ resume: () => void; back?: { name: string; go: () => void } } | null>(null);
  /** `back`: an activity opened over a page (a Learn episode over a trip or a Learn list) goes back to that page */
  openPause(resume: () => void = () => {}, back?: { name: string; go: () => void }) { this.pause = { resume, back }; }
  closePause(keepGoing = true) { const p = this.pause; this.pause = null; if (keepGoing) p?.resume(); }
  openMenu() { this.menuOpen = true; }
  closeMenu() { this.menuOpen = false; }
  /** something is open on top of the screen and owns the keyboard */
  get modalOpen() { return this.sheet !== null || this.settingsOpen || this.musicOpen || this.menuOpen || this.gateOpen || this.pause !== null || this.chartLesson !== null || this.learnOverlay !== null; }
  openChart(id: string) { this.chartLesson = id; }
  closeChart() { this.chartLesson = null; }
  openStickers(tab: 'stickers' | 'medals' | 'rides' = 'stickers') {
    this.stickerTab = tab;
    this.visit('stickers');
  }
  /** the Wardrobe (outfits, gear) or Dances: their own pages in My stuff */
  openCloset(tab: 'outfits' | 'dances' | 'gear' = 'outfits') {
    this.closetTab = tab;
    this.visit(tab === 'dances' ? 'dances' : 'closet');
  }
  /** The Shop (one for the whole game: My stuff, the shells card, the Wardrobe and My Sky Island open it),
   *  on the section you came from: Wear (a spot on the buddy: `slot`), Island or Glimmers (`care`). */
  openShop(slot: string | null = null, section: 'wear' | 'island' | 'care' | null = null) {
    this.shopSlot = slot;
    this.shopSection = section ?? (slot ? 'wear' : null);
    this.visit('shop');
  }
  /** The Shop's section to open on (null: the one last open, Wear the first time) */
  shopSection = $state<'wear' | 'island' | 'care' | null>(null);
  /** the Wardrobe opens with Move it on this thing (the Shop's "Move and size it") */
  closetMove = $state<string | null>(null);
  /** My Sky Island opens ready to put this thing out (the Shop's "Put it on my island") */
  islandPlace = $state<string | null>(null);

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
    this.onPlayerAdded?.();
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

  /** Change the player (and save). `also.bought`: what shells were spent on (the Shop's keys), for the
   *  "What I earned" list. */
  update(fn: (p: Profile) => void, also?: { bought?: string[] }) {
    const p = this.profile;
    if (!p) return;
    const played = this.watchActivity?.(p); // class work counts battles and Learn too (teach/student.svelte.ts)
    const was = ledgerSnap(p); // what came in goes in the player's ledger (engine/ledger.ts)
    fn(p);
    played?.();
    ledgerNote(p, was, { ...this.where(), ...(also?.bought ? { bought: also.bought } : {}) });
    p.updatedAt = Date.now();
    this.persist();
    this.onProfileChange?.();
  }

  replaceProfile(p: Profile) {
    const i = this.save.profiles.findIndex(x => x.id === p.id);
    this.onActivity?.(i >= 0 ? this.save.profiles[i] : undefined, p); // class work counts every activity (teach/student.svelte.ts)
    if (i >= 0) ledgerNote(p, ledgerSnap(this.save.profiles[i]), this.where()); // and what it earned (engine/ledger.ts)
    p.updatedAt = Date.now();
    if (i >= 0) this.save.profiles[i] = p;
    this.persist();
    this.onProfileChange?.();
  }

  /** where something happens now, in words, for the ledger */
  private where() { return ledgerWhere({ screen: this.screen, arcadeGame: this.arcadeGame, battleNode: this.battleNode }); }

  /** told after a player changes (online saving sends the new copy) */
  onProfileChange: (() => void) | null = null;
  /** told after a player is made (a grown-up signed in here files it under the account) */
  onPlayerAdded: (() => void) | null = null;
  /** told when an activity ends, with the player before and after (classes: teach/student.svelte.ts) */
  onActivity: ((before: Profile | undefined, after: Profile) => void) | null = null;
  /** the same for changes made in place (game.update): looks at the player first, and after */
  watchActivity: ((p: Profile) => () => void) | null = null;

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
    this.arrive('skillRun');
  }
  startMath(id: string, replay = false) {
    this.quickStart = replay;
    this.mathLessonId = id;
    this.runKey++;
    this.arrive('mathRun');
  }

  startLesson(id: string, replay = false) {
    this.quickStart = replay;
    this.lessonId = id;
    this.runKey++;
    this.arrive('run');
  }
}

const defaultish: Settings = {
  look: 'soft', grown: false, layout: 'qwerty', sound: true, music: true, melody: false, tune: 'twinkle', volume: 0.8,
  reducedMotion: false, font: 'fredoka', dailyGoalMin: 10, hints: 'auto', hands: true, keyboard: true,
  voice: true, voiceChars: true, demos: 'auto',
};

export const game = new Game();
