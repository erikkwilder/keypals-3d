// One way around Keypals (state/where.ts, game.back): Back goes up one level, or back to where a cross-link
// came from; Esc is Back; every screen gets back to Home; every screen that isn't an activity has the one top
// bar and every activity the one Pause button; and the design's people get where they want in its taps.
import { readFileSync } from 'node:fs';
import { finishLesson } from '../math/learn';
import { afterEach, describe, expect, it, beforeEach, vi } from 'vitest';
import { game, type Screen } from './game.svelte';
import { ACTIVITIES, START_SCREENS, levelOf, parentOf, type Place } from './where';
import { homeTiles, menuMore, menuPlaces, openThing, openTopic, openSubjectPage, openWay, placeName, statusOf, STUFF_GO, thingAllowed, topicGroups, topicWays, trailOf } from '../nav';
import { SUBJECT } from '../subjects';
import { advOf, advView } from '../adventure/state';
import { nextFor } from '../path/player.svelte';
import { startItem } from '../path/launch';
import { pathNext } from '../path/next';
import { mathOf } from '../math/progress';
import { classState } from '../teach/student.svelte';
import { cloud, forgetCode, landSignedIn, saveStatus } from './cloud.svelte';
import type { Assignment } from '../teach/assignments';

const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
const P = (screen: Screen, ctx: Record<string, string | null> = {}): Place => ({ screen, ctx });

/** a fresh player at Home */
function fresh(name = 'Nav') {
  game.addPlayer(name, 'dino', false);
  game.update(p => { p.soundSetup = true; });
  game.returns = [];
  game.from = null;
  game.go('hub');
}

// ---------- every screen the game routes (App.svelte), and which component draws it ----------
const app = src('../../App.svelte');
// (screens load when first opened: App's list S names each one's file, `{@render screen(S.hub)}` draws it)
const LAZY: Record<string, string> = Object.fromEntries([...app.matchAll(/(\w+): lazy\(\(\) => import\('\.\/lib\/\w+\/(\w+)\.svelte'\)\)/g)].map(m => [m[1], m[2]]));
const ROUTES: [Screen, string][] = [...app.matchAll(/game\.screen === '(\w+)'\}(?:\{#key [^}]+\})?(?:\{#if [^}]+\})?(?:<(\w+)|\{@render screen\(S\.(\w+))/g)].map(m => [m[1] as Screen, m[2] ?? LAZY[m[3]]]);
const ALL: Screen[] = [...new Set([...ROUTES.map(r => r[0]), 'hub' as Screen])];
const FILE: Record<string, string> = { Hub: 'Hub', MapScreen: 'MapScreen', MathMap: 'MathMap', SettingsScreen: 'Settings' };
/** a component's source, with the components it draws its page with (the Shop is the Closet, Learn is an episode) */
function pageSrc(comp: string): string {
  const name = FILE[comp] ?? comp;
  let s = src(`../screens/${name}.svelte`);
  if (name === 'Shop') s += src('../screens/Closet.svelte');
  if (name === 'Learn') s += src('../math/ui/Episode.svelte');
  if (name === 'Duel') s += src('../screens/DuelPlay.svelte');
  if (s.includes('<RunResults')) s += src('../ui/RunResults.svelte');
  return s;
}

describe('nobody picked: a new phone just back from signing in with Google', () => {
  // the game restarts on the way back from Google: no player picked, no way back remembered
  function freshStart(profiles: number) {
    game.save.profiles = [];
    for (let i = 0; i < profiles; i++) game.addPlayer(`Kid ${i}`, 'dino', false);
    game.save.activeId = null;
    game.returns = [];
    game.from = null;
    game.screen = 'title';
  }
  beforeEach(() => { game.guSection = null; });

  it('Back from the teachers\' page goes to the player list, never to a Home with no player', () => {
    for (const n of [0, 2]) {
      freshStart(n);
      game.go('teach');
      expect(game.backTo()).toEqual(P('players'));
      game.back();
      expect(game.screen).toBe('players');
    }
  });
  it('Home is never landed on with nobody picked, however it is asked for', () => {
    freshStart(1);
    game.go('hub');
    expect(game.screen).toBe('players');
    game.go('teach'); game.goPlace(P('hub'));
    expect(game.screen).toBe('players');
    game.from = null; game.leaveActivity();
    expect(game.screen).toBe('players');
  });
  it('every screen a grown-up can reach there has a way out', () => {
    freshStart(0);
    for (const s of ['teach', 'grownups', 'about', 'ideas'] as Screen[]) {
      game.go(s);
      for (let i = 0; i < 4 && game.screen !== 'players'; i++) game.back();
      expect(game.screen, s).toBe('players');
    }
  });
  it('with a player picked, Back goes Home as ever', () => {
    fresh('Back home');
    game.go('teach');
    expect(game.backTo()).toEqual(P('hub'));
    game.back();
    expect(game.screen).toBe('hub');
  });
  it('coming back from Google lands somewhere you can go on from', () => {
    freshStart(0);
    landSignedIn(false);
    expect(game.screen).toBe('newPlayer');
    freshStart(2);
    landSignedIn(false);
    expect(game.screen).toBe('players');
    freshStart(0);
    landSignedIn(true);
    expect(game.screen).toBe('teach');
    fresh('Signed in');
    landSignedIn(false);
    expect(game.here()).toEqual(P('grownups', { guSection: 'saving' }));
  });
  it('the sign-in button is on the first screens, and the teachers\' page is not the only way in', () => {
    for (const f of ['../screens/Title.svelte', '../screens/NewPlayer.svelte', '../screens/Players.svelte']) expect(src(f), f).toContain('<GoogleSignIn');
    expect(src('../ui/GlobalMenu.svelte')).toContain('Sign in with Google');
  });
  it('the Grown-ups saving page works with no player on this device, and every other page says what to do', () => {
    const g = src('../screens/Grownups.svelte');
    const pane = g.indexOf('class="card pane acct"'), onlyWithPlayer = g.indexOf("{#if p && sec === 'players'}");
    expect(pane).toBeGreaterThan(0);
    expect(pane, 'the saving page is not inside the block that needs a player').toBeLessThan(onlyWithPlayer);
    expect(g).toContain("{#if !p && sec && sec !== 'admin' && sec !== 'saving'}");
  });
  it('the teachers\' page offers a parent the way to their players, signed in or not', () => {
    const t = src('../screens/Teach.svelte');
    expect(t).toContain("I'm a parent, take me to my players");
    expect(t.match(/@render parentWay\(\)/g)?.length).toBe(3);
  });
  it('who is signed in shows on Home and in the Menu', () => {
    expect(src('../screens/Hub.svelte')).toContain('<SaveChip');
    expect(src('../ui/GlobalMenu.svelte')).toContain('<SaveChip');
  });
  it('the grown-up check over the title keeps the keyboard (the title takes any key)', () => {
    freshStart(0);
    expect(game.modalOpen).toBe(false);
    game.gateOpen = true;
    expect(game.modalOpen).toBe(true);
    game.gateOpen = false;
  });
});

describe('the levels: Back goes up one', () => {
  const UP: [Place, Place | null][] = [
    [P('hub'), null],
    [P('subject', { subject: 'math' }), P('hub')],
    [P('topic', { subject: 'math', topic: 'fractions' }), P('subject', { subject: 'math' })],
    [P('map', { subject: 'math', topic: 'fractions' }), P('topic', { subject: 'math', topic: 'fractions' })],
    [P('way', { subject: 'typing', topic: 'village', wayId: 'learn' }), P('topic', { subject: 'typing', topic: 'village' })],
    [P('way', { subject: 'math', topic: null, wayId: 'learn' }), P('subject', { subject: 'math' })],
    [P('arcade'), P('hub')], [P('adventure'), P('hub')], [P('island'), P('hub')], [P('mystuff'), P('hub')], [P('path'), P('hub')],
    [P('keypals'), P('mystuff')], [P('closet'), P('mystuff')], [P('shop'), P('mystuff')], [P('dances'), P('mystuff')],
    [P('stickers'), P('mystuff')], [P('glimmers'), P('mystuff')], [P('eggs'), P('mystuff')], [P('garden'), P('mystuff')], [P('progress'), P('mystuff')],
    [P('duel'), P('arcade')], [P('rivals'), P('arcade')], [P('boards'), P('arcade')],
    [P('grownups', { guSection: 'time' }), P('grownups', { guSection: null })], [P('grownups'), P('hub')],
    [P('skills'), P('grownups', { guSection: 'progress' })],
    [P('ideas'), P('hub')], [P('about'), P('hub')], [P('teach'), P('hub')],
  ];
  it.each(UP.map(([a, b]) => [a.screen + (a.ctx.topic ? `:${a.ctx.topic}` : '') + (a.ctx.guSection ? `:${a.ctx.guSection}` : ''), a, b] as const))('%s', (_n, a, b) => {
    const up = parentOf(a);
    if (!b) expect(up).toBeNull();
    else { expect(up?.screen).toBe(b.screen); for (const [k, v] of Object.entries(b.ctx)) expect(up?.ctx[k] ?? null).toBe(v); }
  });
  it('the levels are the design\'s: Home 0, subjects and places 1, topics and My stuff\'s pages 2, activities 3', () => {
    expect(levelOf(P('hub'))).toBe(0);
    for (const s of ['subject', 'arcade', 'adventure', 'island', 'mystuff', 'grownups'] as Screen[]) expect(levelOf(P(s, { subject: 'math' }))).toBe(1);
    for (const s of ['keypals', 'closet', 'shop', 'dances', 'stickers', 'glimmers', 'eggs', 'garden', 'progress'] as Screen[]) expect(levelOf(P(s))).toBe(2);
    expect(levelOf(P('topic', { subject: 'math', topic: 'plus' }))).toBe(2);
    expect(levelOf(P('pizza'), P('topic', { subject: 'math', topic: 'fractions' }))).toBe(3);
  });
});

describe('Back, in play', () => {
  beforeEach(() => fresh());
  it('down the levels and back up: Home > Math > Fractions > its map, then Back three times', () => {
    openSubjectPage('math');
    openTopic('math', 'fractions');
    topicWays('math', 'fractions', game.profile!).find(w => w.id === 'practice')!.go();
    expect(game.screen).toBe('map');
    expect(game.mathArea).toBe('fractions');
    game.back(); expect([game.screen, game.topic]).toEqual(['topic', 'fractions']);
    game.back(); expect([game.screen, game.subject]).toEqual(['subject', 'math']);
    game.back(); expect(game.screen).toBe('hub');
    game.back(); expect(game.screen).toBe('hub'); // Home has no Back
  });
  it('a cross-link goes back where it came from: the bar\'s My stuff from Math, then Dances', () => {
    openSubjectPage('math');
    game.visit('mystuff');
    STUFF_GO.dances();
    expect(game.screen).toBe('dances');
    game.back(); expect(game.screen).toBe('mystuff');
    game.back(); expect([game.screen, game.subject]).toEqual(['subject', 'math']);
  });
  it('a typing topic\'s Learn and Play open something real, and a locked game says what opens it', () => {
    game.addPlayer('Tess', 'dino', false);
    const p = game.profile!;
    for (const c of SUBJECT.typing.chips) {
      const ways = topicWays('typing', c.id, p);
      expect(ways.filter(w => w.soon).map(w => w.id), c.id).toEqual([]);
      expect(ways.every(w => w.line && !/coming soon/i.test(w.line)), c.id).toBe(true);
    }
    const sprint = SUBJECT.typing.ways.games.things.find(t => t.id === 'road-4')!;
    expect(statusOf(SUBJECT.typing, 'games', sprint, p)).toMatchObject({ locked: true, tag: 'Opens after Island Parade' });
    openThing(SUBJECT.typing, 'games', sprint);
    expect(game.screen).not.toBe('run');
    // played: it opens, and its best shows
    game.update(pp => { for (const id of ['village-9', 'road-4']) pp.lessons[id] = { stars: 2, bestWpm: 23, bestAcc: 0.97, bestRide: 3, attempts: 1, passes: 1, lastAt: 1, bestScore: 30, scoreSum: 30, finishes: 1 }; });
    expect(statusOf(SUBJECT.typing, 'games', sprint, game.profile!)).toMatchObject({ tag: 'Best 23 words a minute', done: true });
    openThing(SUBJECT.typing, 'games', sprint);
    expect([game.screen, game.lessonId]).toEqual(['run', 'road-4']);
  });
  it('My Words with no words asks for a grown-up instead of opening an empty lesson', () => {
    game.addPlayer('Wes', 'dino', false);
    game.update(pp => { pp.lessons['burrows-10'] = { stars: 2, bestWpm: 23, bestAcc: 0.97, bestRide: 3, attempts: 1, passes: 1, lastAt: 1, bestScore: 30, scoreSum: 30, finishes: 1 }; });
    const t = SUBJECT.typing.ways.games.things.find(x => x.id === 'road-5')!;
    game.go('arcade');
    expect(statusOf(SUBJECT.typing, 'games', t, game.profile!).tag).toBe('Needs your words');
    openThing(SUBJECT.typing, 'games', t);
    expect(game.screen).toBe('arcade');
    game.update(pp => { pp.customText = 'spell these words'; });
    openThing(SUBJECT.typing, 'games', t);
    expect(game.screen).toBe('run');
  });
  it('Family Duel and Rival Ghosts open set to typing from a typing topic, come back there, and leave when the grown-ups turn them off', () => {
    game.addPlayer('Vee', 'dino', false);
    openTopic('typing', 'village');
    openWay('typing', 'village', 'games');
    const duel = SUBJECT.typing.ways.games.things.find(x => x.id === 'duel')!;
    openThing(SUBJECT.typing, 'games', duel);
    expect(game.screen).toBe('duel');
    expect(advView(game.profile!).subject).toBe('typing');
    game.back(); expect([game.screen, game.topic]).toEqual(['way', 'village']);
    expect(thingAllowed(duel, game.profile!)).toBe(true);
    game.update(pp => { advOf(pp).settings.versus = false; });
    expect(thingAllowed(duel, game.profile!)).toBe(false);
    expect(topicWays('typing', 'village', game.profile!).find(w => w.id === 'games')!.soon).toBe(false);
  });
  it('Home\'s minutes open My progress, and Back comes straight home; from My stuff it goes back to My stuff', () => {
    game.go('hub');
    game.visit('progress', true);
    expect(game.screen).toBe('progress');
    game.back(); expect(game.screen).toBe('hub');
    game.go('mystuff'); STUFF_GO.progress();
    game.back(); expect(game.screen).toBe('mystuff');
  });
  it('Adventure\'s Glimmers and Eggs come back to Adventure; from My stuff they go back to My stuff', () => {
    game.go('adventure');
    game.glimmerTab = 'team'; game.visit('glimmers');
    game.glimmerTab = 'all'; // a tab isn't a step
    game.back(); expect(game.screen).toBe('adventure');
    game.visit('eggs'); game.back(); expect(game.screen).toBe('adventure');
    game.go('mystuff'); STUFF_GO.glimmers(); game.back(); expect(game.screen).toBe('mystuff');
  });
  it('the Wardrobe\'s Shop comes back to the Wardrobe; every Glimmer Book link opens All 100', () => {
    game.go('mystuff'); STUFF_GO.closet();
    game.openShop('head');
    expect(game.screen).toBe('shop');
    game.back(); expect(game.screen).toBe('closet');
    game.back(); expect(game.screen).toBe('mystuff');
    game.go('adventure'); game.openBook();
    expect([game.screen, game.glimmerTab]).toEqual(['glimmers', 'all']);
    game.back(); expect(game.screen).toBe('adventure');
  });
  it('a chain of cross-links unwinds in order: the island\'s Shop, then Move and size it to the Wardrobe, then Back, Back, Back', () => {
    game.go('island');
    game.openShop(null, 'island'); // the island tray's Shop button
    expect([game.screen, game.shopSection]).toEqual(['shop', 'island']);
    game.closetTab = 'outfits'; game.visit('closet'); // Wear's "Move and size it"
    expect(game.screen).toBe('closet');
    game.back(); expect(game.screen).toBe('shop');
    game.back(); expect(game.screen).toBe('island');
    game.back(); expect(game.screen).toBe('hub');
    // the Wardrobe's Shop and back again (Back from the Shop is the Wardrobe, then where the Wardrobe came from)
    game.go('island'); game.openShop(null, 'island'); game.visit('closet'); game.openShop('head');
    expect(game.screen).toBe('shop');
    game.back(); expect(game.screen).toBe('closet');
    game.back(); expect(game.screen).toBe('shop');
    game.back(); expect(game.screen).toBe('island');
  });
  it('leaving a chain of cross-links the usual way ends it: the Menu from the Wardrobe, then Back goes up', () => {
    game.go('island'); game.openShop(null, 'island'); game.visit('closet');
    menuPlaces().find(m => m.id === 'arcade')!.go();
    expect(game.screen).toBe('arcade');
    expect(game.returns).toEqual([]);
    game.back(); expect(game.screen).toBe('hub');
  });
  it('a topic\'s garden bed comes back to the topic; Ideas and help to wherever it was opened', () => {
    openSubjectPage('math'); openTopic('math', 'times');
    game.visit('garden'); game.back();
    expect([game.screen, game.topic]).toEqual(['topic', 'times']);
    game.openIdeas(); expect(game.screen).toBe('ideas');
    game.back(); expect([game.screen, game.topic]).toEqual(['topic', 'times']);
  });
  it('the Menu jumps a level at a time: Back from there goes up', () => {
    openSubjectPage('math'); openTopic('math', 'times');
    menuPlaces().find(m => m.id === 'arcade')!.go();
    expect(game.screen).toBe('arcade');
    game.back(); expect(game.screen).toBe('hub');
    menuMore().find(m => m.id === 'grownups')!.go();
    expect([game.screen, game.guSection]).toEqual(['grownups', null]);
    game.guSection = 'time'; game.go('grownups');
    game.back(); expect([game.screen, game.guSection]).toEqual(['grownups', null]);
    game.back(); expect(game.screen).toBe('hub');
  });
  it('an activity goes back to where it was started: a topic\'s game, the Arcade\'s, Home\'s Continue', () => {
    openSubjectPage('math'); openTopic('math', 'fractions');
    topicWays('math', 'fractions', game.profile!).find(w => w.id === 'games')!.go();
    expect(game.screen).toBe('pizza');
    expect(placeName(game.from!)).toBe('Fractions');
    game.leaveActivity(); expect([game.screen, game.topic]).toEqual(['topic', 'fractions']);
    game.go('arcade'); game.playArcade('slalom');
    expect(placeName(game.from!)).toBe('Arcade');
    game.back(); expect(game.screen).toBe('arcade');
    game.go('hub'); game.startLesson('village-1');
    game.go('results'); // an activity's end stays part of it
    expect(game.from?.screen).toBe('hub');
  });
  it('no dead ends: every screen gets back to Home', () => {
    for (const s of ALL) {
      if (START_SCREENS.has(s)) continue;
      game.from = { screen: 'topic', ctx: { subject: 'math', topic: 'plus' } };
      let pl: Place | null = { screen: s, ctx: { subject: 'math', topic: 'plus' } }, n = 0;
      while (pl && pl.screen !== 'hub' && n < 8) { pl = parentOf(pl, game.from); n++; }
      expect(pl?.screen, s).toBe('hub');
    }
  });
});

describe('the one frame', () => {
  const bar = src('../ui/Bar.svelte');
  it('the bar: Back or the player on the left; Shells, My stuff, Ideas and help, Music, Menu on the right, in that order; Esc is Back', () => {
    const order = ['class="shells"', 'class="round stuff"', 'class="round help"', 'class="round tunes"', 'class="round menu"'].map(k => bar.indexOf(k));
    expect(order.every(i => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(bar).toMatch(/\{#if !phone\}\s*<button class="round help"/); // phones: Shells, My stuff, Menu
    expect(bar).toMatch(/\{#if !phone\}\s*<button class="round tunes"/); // (the music is at the top of the Menu there)
    expect(src('../ui/GlobalMenu.svelte')).toMatch(/<MusicNow\b/);
    expect(src('../ui/PauseCard.svelte')).toMatch(/<MusicNow\b/);
    expect(bar).toMatch(/icons\/hamburger\.svg/);
    expect(bar).toMatch(/e\.key !== 'Escape'/);
    expect(bar).toMatch(/goBack\(\)/);
    expect(bar).toMatch(/game\.back\(\)/);
  });
  it.each(ROUTES.filter(([s]) => !ACTIVITIES.has(s) && !START_SCREENS.has(s) && s !== 'settings'))('%s (%s) draws the one bar', (_s, comp) => {
    const s = pageSrc(comp);
    expect(/<Bar\b|<Header\b/.test(s)).toBe(true);
    // and none of the old bars and corner buttons
    expect(s).not.toMatch(/<TopBar\b|<GearButton\b|<MenuButton\b|<HelpButton\b|<WaysBar\b/);
  });
  it.each(ROUTES.filter(([s]) => ACTIVITIES.has(s)))('%s (%s) is an activity: no bar, the one Pause button', (_s, comp) => {
    const s = pageSrc(comp);
    expect(s).not.toMatch(/<Bar\b|<Header\b|<TopBar\b/);
    expect(s).toMatch(/<PauseButton\b/);
    expect(s).not.toMatch(/<MusicButton\b|<GearButton\b|<MenuButton\b/);
  });
  it('the Pause card: Keep going, Back to where it started, Home (one card for every activity)', () => {
    const card = src('../ui/PauseCard.svelte');
    expect(card).toMatch(/Keep going/);
    expect(card).toMatch(/Back to \{backName\}/);
    expect(card).toMatch(/>Home</);
    expect(app).toMatch(/\{#if game\.pause\}\{@render layer\(O\.pause\)\}/);
    expect(LAZY.pause).toBe('PauseCard');
  });
});

describe('the people in the design, tap by tap', () => {
  beforeEach(() => fresh('Persona'));
  it('"Tell me what to do": Home\'s Continue, 1 tap', () => {
    const p = game.profile!;
    const n = nextFor(p)!;
    startItem(p, n.unit.unit, n.item); // tap 1
    expect(ACTIVITIES.has(game.screen)).toBe(true);
    expect(game.from?.screen).toBe('hub');
  });
  it('"Keep going": the end of something started from the path offers the path\'s next thing, 1 tap', () => {
    // (the path's first lesson opens with its Learn: watched, the practice trip is next)
    const first = nextFor(game.profile!, 'math')!;
    if (first.item.ref.startsWith('ep:')) game.update(pp => { finishLesson(pp, first.item.ref.slice(3)); });
    const n = nextFor(game.profile!, 'math')!;
    const [k, id] = n.item.ref.split(':');
    expect(k).toBe('trip');
    startItem(game.profile!, n.unit.unit, n.item); // tap 1: a practice trip
    expect(ACTIVITIES.has(game.screen)).toBe(true);
    // not passed yet: no "next" (the same trip is still next, and Try again is the way on)
    expect(pathNext(game.profile, `lesson:${id}`)).toBeNull();
    game.update(pp => { (pp.math ??= mathOf(pp)).lessons[id] = { stars: 2, bestScore: 10, bestFpm: 10, bestAcc: 0.9, bestRide: 1, attempts: 1, finishes: 1, passes: 1, lastAt: Date.now() } as never; });
    const after = pathNext(game.profile, `lesson:${id}`)!;
    expect(after).not.toBeNull();
    expect(after.item.ref).not.toBe(n.item.ref);
    // only for the activity it started (a trip started somewhere else doesn't offer it)
    expect(pathNext(game.profile, 'lesson:frac-a-9')).toBeNull();
  });
  it('"My teacher set something": the Today card shows the class work first, 1 tap', () => {
    const p = game.profile!;
    game.update(pp => { pp.cloud = { code: 'NAVTEST', at: Date.now() } as unknown as typeof pp.cloud; });
    const now = Date.now();
    const a = { id: 'u1', title: 'Pie Pantry', what: 'unit', skills: [], lessons: [], episodes: [], areas: [], by: '', goal: { type: 'finish', n: 1 }, scoring: 'completion', start: now - 3600000, due: now + 4 * 86400000, students: null, created: now - 3600000,
      items: ['ep:frac-parts', 'trip:frac-a-1', 'game:pizza', 'check'], unit: 'math:frac-a', subject: 'math' } as unknown as Assignment;
    classState.byCode.NAVTEST = { classes: [{ id: 'c1', name: 'Room 4', grade: 3, teacher: 'Ms Rivera', home: false, student: { id: 's1', name: 'Persona' }, board: false, goal: 0, assignments: [a], week: { right: 0, ms: 0, played: 0, students: 0 }, rows: [], challenge: null }], pending: [], at: now };
    const n = nextFor(game.profile!)!;
    expect(n.teacher).toBe('Ms Rivera');
    startItem(game.profile!, n.unit.unit, n.item); // tap 1
    expect([game.screen, game.learnId]).toEqual(['learn', 'frac-parts']);
    delete classState.byCode.NAVTEST;
    void p;
  });
  it('"I want to learn this topic": Home > Math > Fractions > Learn, 3 taps (or Practice)', () => {
    const p = game.profile!;
    homeTiles(p).find(t => t.id === 'math')!.go(); // tap 1
    expect(game.screen).toBe('subject');
    topicGroups('math', p).flatMap(g => g.tiles).find(t => t.id === 'fractions')!.go(); // tap 2
    expect([game.screen, game.topic]).toEqual(['topic', 'fractions']);
    expect(trailOf(game.here())).toBe('Math › Fractions · Grades 3–5');
    topicWays('math', 'fractions', p).find(w => w.id === 'learn')!.go(); // tap 3
    expect([game.screen, game.wayId, game.topic]).toEqual(['way', 'learn', 'fractions']);
    game.back();
    topicWays('math', 'fractions', p).find(w => w.id === 'practice')!.go(); // or Practice, tap 3
    expect([game.screen, game.mathArea]).toEqual(['map', 'fractions']);
  });
  it('"I want to play": Home > Arcade (or Adventure, or My Sky Island), 2 taps to a game', () => {
    const p = game.profile!;
    homeTiles(p).find(t => t.id === 'arcade')!.go(); // tap 1
    expect(game.screen).toBe('arcade');
    game.playArcade('catch'); // tap 2: a cabinet
    expect(game.screen).toBe('arcadePlay');
    game.go('hub');
    homeTiles(p).find(t => t.id === 'adventure')!.go();
    expect(game.screen).toBe('adventure');
    game.go('hub');
    homeTiles(p).find(t => t.id === 'island')!.go();
    expect(game.screen).toBe('island');
  });
  it('"My stuff": the chest on the bar, then a section, 2 taps from any screen', () => {
    openSubjectPage('typing');
    game.visit('mystuff'); // tap 1: the bar's chest
    STUFF_GO.dances(); // tap 2
    expect(game.screen).toBe('dances');
    for (const k of Object.keys(STUFF_GO)) { game.go('mystuff'); STUFF_GO[k](); expect(game.screen).not.toBe('mystuff'); }
  });
  it('a parent: Menu > Grown-ups, 2 taps; a teacher: Menu > For teachers', () => {
    menuMore().find(m => m.id === 'grownups')!.go(); // tap 2 (the Menu is tap 1)
    expect(game.screen).toBe('grownups');
    game.go('hub');
    menuMore().find(m => m.id === 'teach')!.go();
    expect(game.screen).toBe('teach');
  });
  it('Home\'s Where to? is the subjects and the three places, one tile each', () => {
    expect(homeTiles(game.profile!).map(t => t.id)).toEqual(['typing', 'math', 'arcade', 'adventure', 'island']);
    // each with its own picture, no two the same
    const arts = homeTiles(game.profile!).map(t => t.art);
    expect(new Set(arts).size).toBe(arts.length);
    for (const a of arts) expect(a.startsWith('game/cards/'), a).toBe(true);
    expect(menuPlaces().map(m => m.name)).toEqual(['Home', 'Typing', 'Math', 'Arcade', 'Adventure', 'My Sky Island', 'My stuff', 'My path']);
  });
});

describe('saving online, for grown-ups', () => {
  const player = (name: string, code?: string) => { const p = game.addPlayer(name, 'dino', false); if (code) p.cloud = { code, at: 1 }; return game.save.profiles.find(x => x.id === p.id)!; };
  afterEach(() => { cloud.account = null; cloud.online = false; vi.unstubAllGlobals(); });

  it('says who is signed in, and whether this player is saved', () => {
    cloud.online = true;
    cloud.account = { name: 'Erik Wilder', email: 'e@example.invalid', provider: 'google' };
    const saved = player('Saved', 'RED-FOX-SUN-1'), notYet = player('Not yet');
    expect(saveStatus(saved)).toMatchObject({ kind: 'account', text: 'Signed in as Erik: saved online', short: 'Signed in as Erik' });
    expect(saveStatus(notYet)).toMatchObject({ kind: 'local', text: 'Signed in as Erik: not saved online yet', short: 'Signed in as Erik' });
    cloud.account = null;
    expect(saveStatus(saved).kind).toBe('code');
    expect(saveStatus(notYet).text).toContain('Only on this computer');
  });
  it('stopping asks first: the button only opens the question, and the question is what deletes the online copy', () => {
    const g = src('../screens/Grownups.svelte');
    const ask = g.slice(g.indexOf('role="alertdialog"'));
    expect(g).toContain('onclick={() => (confirmStop = p.id)}>Stop saving {p.name} online');
    expect(g.indexOf('forgetCode(p.id)')).toBeGreaterThan(g.indexOf('role="alertdialog"'));
    expect(ask).toContain('Keep saving online');
    expect(ask).toContain('Yes, delete the online copy');
  });
  it('a class player has no Stop saving, and their copy is never deleted from here', async () => {
    const g = src('../screens/Grownups.svelte');
    expect(g.match(/!classKid && confirmStop/g)?.length).toBe(2);
    const p = player('Class kid', 'BLUE-OWL-SKY-2');
    const store: Record<string, string> = { 'kp-class-here': JSON.stringify(['BLUE-OWL-SKY-2']) };
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } });
    const fetched = vi.fn();
    vi.stubGlobal('fetch', fetched);
    await forgetCode(p.id);
    expect(fetched).not.toHaveBeenCalled();
    expect(game.save.profiles.find(x => x.id === p.id)?.cloud?.code).toBe('BLUE-OWL-SKY-2');
  });
});

describe('the Looks in Settings', () => {
  const s = src('../screens/Settings.svelte');
  it('each card is a name, a plain line and a drawn star, not a picture of the buddy', () => {
    expect(s).not.toContain('buddyPicture');
    expect(s).toContain('<LookEmblem look={l.id} />');
    const e = src('../ui/LookEmblem.svelte');
    for (const look of ['soft', 'ink', 'paper']) expect(e, look).toContain(`look === '${look}'`);
  });
});
