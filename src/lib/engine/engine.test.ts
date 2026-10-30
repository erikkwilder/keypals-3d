import { BUDDIES } from '../art/cast';
import { describe, expect, it } from 'vitest';
import { LAYOUTS, detectLayout, fingerFor, shiftFor } from './layouts';
import { ALL_LESSONS, LESSON, REGIONS, knownChars, lessonMove, newCharsFor } from './course';
import { generate, targetLength, fits } from './textgen';
import { Session } from './session';
import { computeStats, lessonGoal, runTitle, starsFor } from './scoring';
import { RideMeter } from './rides';
import { STICKERS, newPalProgress } from './stickers';
import { MEDALS } from './achievements';
import { RIDES, RIDE_SCORE } from './rides';
import type { Profile } from './profile';
import { applyRun, isUnlocked, lookOf, newProfile, nextLesson, migrate, knownFor, palOf, bookView, buddyPal, allPals } from './profile';
import { checkStickers } from './settle';
import { mastery, updateKeyStats } from './mastery';
import { WORDS_KIDS, WORDS_GROWN } from '../content/words';
import { POOLS } from '../content/sentences';
import { ALL_LINES } from '../content/voice';
import { demoKeys, homeDemo, lessonDemo } from './demos';
import { REWARDS, treasureFor } from './rewards';
import { existsSync, readFileSync } from 'node:fs';
import { CLIP_NAMES } from '../three/clipNames';

const Q = LAYOUTS.qwerty;

describe('layouts', () => {
  it('maps characters to fingers', () => {
    expect(fingerFor(Q, 'a')).toBe('LP');
    expect(fingerFor(Q, 'j')).toBe('RI');
    expect(fingerFor(Q, ' ')).toBe('TH');
    expect(fingerFor(LAYOUTS.dvorak, 'o')).toBe('LR');
    expect(fingerFor(LAYOUTS.colemak, 't')).toBe('LI');
  });
  it('uses the opposite shift', () => {
    expect(shiftFor(Q, 'A')).toBe('ShiftRight');
    expect(shiftFor(Q, 'J')).toBe('ShiftLeft');
    expect(shiftFor(Q, 'a')).toBeNull();
  });
  it('detects a layout from what keys produce', () => {
    const dv = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL'].map(code => ({ code, key: LAYOUTS.dvorak.byCode.get(code)!.base }));
    expect(detectLayout(dv)).toBe('dvorak');
    const qw = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL'].map(code => ({ code, key: Q.byCode.get(code)!.base }));
    expect(detectLayout(qw)).toBeNull(); // QWERTZ shares the home row
    const qw2 = ['KeyA', 'KeyS', 'KeyQ', 'KeyY', 'KeyZ', 'KeyW', 'KeyJ', 'KeyK'].map(code => ({ code, key: Q.byCode.get(code)!.base }));
    expect(detectLayout(qw2)).toBe('qwerty');
  });
});

describe('course', () => {
  it('has seven regions of lessons', () => {
    expect(ALL_LESSONS.length).toBeGreaterThan(40);
  });
  it('teaches the home row first', () => {
    expect([...knownChars('village-1', Q)].sort().join('')).toBe(' fj');
    expect([...knownChars('village-8', Q)].sort().join('')).toBe(' ;adfghjkls');
  });
  it('teaches every lowercase letter by the end of the burrows', () => {
    const k = knownChars('burrows-8', Q);
    for (const ch of 'abcdefghijklmnopqrstuvwxyz,.') expect(k.has(ch)).toBe(true);
    expect(k.has('A')).toBe(false);
  });
  it('adds capitals one hand at a time', () => {
    const fresh = newCharsFor(LESSON['cliffs-1'], Q);
    expect(fresh).toContain('J');
    expect(fresh).not.toContain('A');
    expect(knownChars('cliffs-2', Q).has('A')).toBe(true);
  });
  it('finds digits on AZERTY even though they need shift', () => {
    expect(knownChars('ridge-4', LAYOUTS.azerty).has('7')).toBe(true);
  });
  it('gives every layout a full home row', () => {
    for (const L of Object.values(LAYOUTS)) expect(knownChars('village-8', L).size).toBeGreaterThanOrEqual(10);
  });
  it('spreads the climb, swim and sled through every region, with the trail in between', () => {
    expect(lessonMove(LESSON['village-1'])).toBe('run');
    for (const r of REGIONS.filter(r => r.id !== 'road')) {
      const moves = r.lessons.map(lessonMove);
      // every region has all three courses, and about half its lessons on the trail with the rides
      for (const m of ['climb', 'swim', 'slide'] as const) expect(moves).toContain(m);
      const trail = moves.filter(m => m === 'run').length;
      expect(trail).toBeGreaterThanOrEqual(r.lessons.length / 2);
      expect(trail).toBeLessThanOrEqual(r.lessons.length / 2 + 2);
      // never two courses in a row
      moves.forEach((m, i) => { if (i && m !== 'run') expect(moves[i - 1]).toBe('run'); });
    }
    // the big races, the graduation test and the Open Road stay on the trail
    for (const l of ALL_LESSONS.filter(l => l.kind === 'checkpoint' || l.kind === 'final' || l.practice)) expect(lessonMove(l)).toBe('run');
    expect(lessonMove(LESSON['cliffs-1b'])).toBe('climb');
  });
});

describe('text generator', () => {
  const pools = POOLS;
  it('only uses characters the player knows, for every lesson and layout', () => {
    for (const L of Object.values(LAYOUTS)) {
      for (const lesson of ALL_LESSONS) {
        if (lesson.kind === 'custom') continue;
        const p = newProfile('t', 'dino');
        const known = lesson.region === 'road' ? knownChars('shores-6', L) : knownChars(lesson.id, L);
        for (const grown of [false, true]) {
          const text = generate({ lesson, layout: L, known, fresh: newCharsFor(lesson, L), grown, seed: 7, words: grown ? WORDS_KIDS.concat(WORDS_GROWN) : WORDS_KIDS, pools });
          expect(fits(text, known), `${L.id} ${lesson.id} ${JSON.stringify(text)}`).toBe(true);
          expect(text.length, `${L.id} ${lesson.id}`).toBeGreaterThan(Math.min(40, targetLength(lesson, grown) * 0.5));
          expect(text).not.toMatch(/^ | $| {2}/);
          void p;
        }
      }
    }
  }, 30_000); // (every lesson on every layout: slow on a busy machine)
  it('drills the new keys in lesson one', () => {
    const lesson = LESSON['village-1'];
    const text = generate({ lesson, layout: Q, known: knownChars(lesson.id, Q), fresh: newCharsFor(lesson, Q), seed: 1, words: WORDS_KIDS, pools });
    expect(text.startsWith('fff jjj')).toBe(true);
  });
  it('uses real words once enough letters are known', () => {
    const lesson = LESSON['village-7'];
    const text = generate({ lesson, layout: Q, known: knownChars(lesson.id, Q), fresh: [], seed: 3, words: WORDS_KIDS, pools });
    const words = text.split(' ');
    const real = words.filter(w => WORDS_KIDS.includes(w)).length;
    expect(real / words.length).toBeGreaterThan(0.8);
  });
  it('leans on weak keys in Tricky Keys', () => {
    const lesson = LESSON['road-3'];
    const known = knownChars('burrows-8', Q);
    const weak = new Map([['q', 0.9], ['z', 0.9]]);
    const text = generate({ lesson, layout: Q, known, fresh: [], weak, seed: 5, words: WORDS_KIDS, pools });
    const count = [...text].filter(c => c === 'q' || c === 'z').length;
    expect(count).toBeGreaterThan(4);
  });
  it('turns a pasted spelling list into a lesson', () => {
    const lesson = LESSON['road-5'];
    const text = generate({ lesson, layout: Q, known: knownChars('shores-6', Q), fresh: [], seed: 5, words: WORDS_KIDS, pools, custom: 'because\nfriend\nbeautiful' });
    expect(text).toContain('friend');
    expect(text.length).toBeGreaterThanOrEqual(60);
  });
});

function typeOut(text: string, msPerKey: number, mistakesEvery = 0) {
  const s = new Session(text);
  let t = 1000;
  let n = 0;
  while (!s.done) {
    n++;
    if (mistakesEvery && n % mistakesEvery === 0) s.press('#', t);
    else s.press(s.expected, t);
    t += msPerKey;
  }
  return s;
}

describe('scoring', () => {
  it('computes speed and accuracy', () => {
    const s = typeOut('the quick fox jumps over the lazy dog', 200); // 60 wpm
    const st = computeStats(s);
    expect(st.wpm).toBeGreaterThan(55);
    expect(st.wpm).toBeLessThan(65);
    expect(st.acc).toBe(1);
    expect(st.steady).toBe(true);
  });
  it('scores speed plus a clean-typing bonus, like Animal Typing', () => {
    // Animal Typing's first kids lesson, typed cleanly: its score came out 1.24 to 1.43 times the speed
    const clean = computeStats(typeOut('asdf asdf asdf dadada sfsfsf asdf asdf', 360));
    expect(clean.score / clean.wpm).toBeGreaterThan(1.2);
    expect(clean.score / clean.wpm).toBeLessThan(1.45);
    // three slips spread through the lesson: Animal Typing gave no bonus at all
    const slips = computeStats(typeOut('asdf asdf asdf dadada sfsfsf asdf asdf', 550, 10));
    expect(slips.score - Math.round(slips.wpm)).toBeLessThanOrEqual(1);
  });
  it('gives stars as shares of the goal score', () => {
    const lesson = LESSON['village-5'];
    const goal = lessonGoal(lesson, false);
    expect(goal).toBeGreaterThanOrEqual(25);
    expect(goal).toBeLessThanOrEqual(30);
    expect(starsFor(computeStats(typeOut('ask dad all salads ask dad all salads', 300)), lesson, false, true)).toBe(3);
    expect(starsFor(computeStats(typeOut('ask dad all salads ask dad all salads', 700)), lesson, false, true)).toBe(2);
    expect(starsFor(computeStats(typeOut('ask dad all salads ask dad all salads', 1200)), lesson, false, true)).toBe(1);
    expect(starsFor(computeStats(typeOut('ask dad all salads ask dad all salads', 3000)), lesson, false, true)).toBe(0);
    // sloppy but fast: no third star
    expect(starsFor(computeStats(typeOut('ask dad all salads ask dad all salads', 250, 4)), lesson, false, true)).toBeLessThanOrEqual(2);
    // easy mode asks for two thirds
    expect(lessonGoal(lesson, false, true)).toBeLessThan(goal * 0.7);
    expect(lessonGoal(lesson, false, true)).toBeGreaterThan(goal * 0.6);
  });
});

describe('rides', () => {
  function ride(msPerKey: number, keys: number, missEvery = 0) {
    const m = new RideMeter(false);
    let t = 0;
    for (let i = 0; i < keys; i++) {
      const ok = !(missEvery && i % missEvery === 0);
      m.push(ok, t);
      for (let f = 0; f < 4; f++) { t += msPerKey / 4; m.update(t); }
    }
    return m;
  }
  it('climbs with the live score', () => {
    expect(ride(1500, 60).best).toBeLessThanOrEqual(1); // about 8 wpm: walking or running
    expect(ride(400, 80).best).toBeGreaterThanOrEqual(3); // 30 wpm, clean: a bike or the car
    expect(ride(400, 80).best).toBeLessThanOrEqual(4);
    expect(ride(150, 160).best).toBe(5); // 80 wpm, clean: the rocket is for strong typists
  });
  it('rewards clean streaks', () => {
    expect(ride(400, 80, 3).best).toBeLessThan(ride(400, 80).best);
  });
});

describe('profiles and progress', () => {
  it('unlocks lessons in order and rewards the buddy', () => {
    let p = newProfile('Mia', 'dino');
    expect(isUnlocked(p, LESSON['village-1'])).toBe(true);
    expect(isUnlocked(p, LESSON['village-2'])).toBe(false);
    const s = typeOut('fff jjj fj jf fff jjj fj jf', 500);
    const out = applyRun(p, { lessonId: 'village-1', stats: computeStats(s), stars: 3, bestRide: 2, keyboardHidden: false, finished: true, at: Date.now() }, Q);
    p = out.profile;
    expect(isUnlocked(p, LESSON['village-2'])).toBe(true);
    const ids = out.stickers.map(st => st.id);
    expect(ids).toEqual(expect.arrayContaining(['runs-1', 'ridestar-run', 'ridestar-skate', 'three-1']));
    expect(out.medals.map(m => m.id)).toContain('firsttry');
    expect(out.xp.gained).toBeGreaterThanOrEqual(80);
    expect(out.xp.after.level).toBe(2);
    expect(out.rewards.map(o => o.id)).toContain('party_hat');
    expect(out.shells).toBeGreaterThan(0);
    expect(nextLesson(p).id).toBe('village-2');
  });
  it('stickers and medals go in the player\'s one book; friendship stays with each buddy', () => {
    let p = newProfile('Mia', 'dino');
    const s = typeOut('fff jjj fj jf fff jjj fj jf', 500);
    p = applyRun(p, { lessonId: 'village-1', stats: computeStats(s), stars: 3, bestRide: 1, keyboardHidden: false, finished: true, at: Date.now() }, Q).profile;
    const won = Object.keys(bookView(p).stickers);
    expect(won.length).toBeGreaterThan(2);
    expect(bookView(p).stickers['runs-1'].by).toBe('dino');
    const dinoXp = p.pals.dino!.xp;
    p.buddy = 'monkey';
    const out = applyRun(p, { lessonId: 'village-1', stats: computeStats(s), stars: 3, bestRide: 1, keyboardHidden: false, finished: true, at: Date.now() }, Q);
    // nothing to win again: the first-lesson sticker is already in the book
    expect(out.stickers.map(st => st.id)).not.toContain('runs-1');
    expect(bookView(out.profile).medals.three).toBe(2);
    expect(out.profile.pals.dino!.xp).toBe(dinoXp);
    expect(out.profile.pals.monkey!.xp).toBeGreaterThan(0);
    expect(out.profile.lessons['village-1'].passes).toBe(2);
  });
  it('drops a shared team from a test save and keeps each buddy\'s own progress', () => {
    const old = { ...newProfile('Mia', 'dino'), team: { xp: 900 }, looks: undefined } as unknown as Record<string, unknown>;
    old.pals = { dino: { xp: 300, stickers: { a: 5 }, medals: { three: 2 }, outfit: 'party_hat', dance: 'jump', rideBest: 2 }, monkey: { xp: 200, stickers: { b: 7 }, medals: { three: 1 }, rideBest: 4 } };
    const p = migrate({ version: 1, profiles: [old], activeId: (old as { id: string }).id }).profiles[0];
    expect((p as unknown as { team?: unknown }).team).toBeUndefined();
    expect(p.pals.dino!.xp).toBe(300);
    expect(Object.keys(p.pals.monkey!.stickers)).toEqual(['b']);
    // the old per-buddy books are merged into the player's one book
    expect(Object.keys(bookView(p).stickers).sort()).toEqual(['a', 'b']);
    expect(bookView(p).stickers.b.by).toBe('monkey');
    expect(bookView(p).medals.three).toBe(3);
    expect(p.looks!.dino).toEqual({ outfit: 'party_hat', dance: 'jump' });
  });
  it('awards the medals that matter on a great run, and only a handful', () => {
    let p = newProfile('Mia', 'dino');
    const s = typeOut('ask dad all salads ask dad all salads ask a lass', 250);
    const out = applyRun(p, { lessonId: 'village-1', stats: computeStats(s), stars: 3, bestRide: 4, keyboardHidden: true, finished: true, at: Date.now() }, Q);
    const ids = out.medals.map(m => m.id);
    expect(ids).toEqual(expect.arrayContaining(['clean', 'three', 'firsttry', 'streak-25']));
    for (const gone of ['steady', 'nopeek', 'ride-car', 'sharp', 'marathon']) expect(ids).not.toContain(gone);
    expect(ids.length).toBeLessThanOrEqual(5);
    p = out.profile;
  });
  it('keeps old saves working', () => {
    const s = migrate({ profiles: [{ id: 'x', name: 'Old', buddy: 'monkey', settings: { look: 'ink' } }], activeId: 'x' });
    expect(s.profiles[0].settings.look).toBe('ink');
    expect(s.profiles[0].settings.layout).toBe('qwerty');
    expect(s.profiles[0].totals.runs).toBe(0);
  });
  it('lets the Open Road know only what you have learned', () => {
    const p = newProfile('Mia', 'dino');
    expect(knownFor(p, LESSON['road-3'], Q).has('q')).toBe(false);
  });
});

describe('mastery', () => {
  it('grows with accurate, quick practice', () => {
    let k = updateKeyStats({}, { f: { hits: 30, misses: 0, ms: 30 * 400, timed: 30 } });
    expect(mastery(k.f, false)).toBeGreaterThan(0.85);
    k = updateKeyStats({}, { f: { hits: 10, misses: 8, ms: 10 * 1500, timed: 10 } });
    expect(mastery(k.f, false)).toBeLessThan(0.2);
  });
});

describe('finger demos', () => {
  const lines = new Set(ALL_LINES.map(l => l.id));
  it('only uses lines that exist, on every layout', () => {
    for (const layout of Object.values(LAYOUTS)) {
      for (const st of homeDemo(layout)) expect(lines.has(st.line), st.line).toBe(true);
      for (const lesson of ALL_LESSONS) for (const st of lessonDemo(lesson, layout)) expect(lines.has(st.line), `${layout.id} ${lesson.id} ${st.line}`).toBe(true);
    }
  });
  it('shows the new keys for a lesson, with Shift for capitals', () => {
    const q = LAYOUTS.qwerty;
    expect(demoKeys(LESSON['treetops-1'], q).map(k => k.ch).sort()).toEqual(['e', 'i']);
    const caps = demoKeys(LESSON['cliffs-1'], q);
    expect(caps.length).toBeGreaterThan(0);
    expect(caps.every(k => k.shift === 'ShiftLeft')).toBe(true);
    expect(lessonDemo(LESSON['village-8'], q)).toEqual([]);
  });
});

describe('friendship pacing', () => {
  it('a great first lesson is one friendship level and one outfit, not several', () => {
    const p = newProfile('Ava', 'koala');
    const text = 'fjfj jfjf ffjj jjff fjjf jffj '.repeat(5).trim(); // about 150 letters
    const out = applyRun(p, { lessonId: 'village-1', stats: computeStats(typeOut(text, 400)), stars: 3, bestRide: 5, keyboardHidden: true, handsHidden: true, finished: true, at: Date.now() }, Q);
    expect(out.xp.after.level).toBe(2);
    expect(out.rewards.map(o => o.id)).toEqual(['party_hat']);
    expect(out.stickers.map(st => st.id)).not.toContain('level-5');
  });
});

describe('six rides', () => {
  it('has a sticker for every ride above walking (rides no longer win a medal each)', () => {
    for (const r of RIDES.slice(1)) {
      expect(STICKERS.some(s => s.id === `ridestar-${r.id}`), r.id).toBe(true);
      expect(MEDALS.some(m => m.id === `ride-${r.id}`), r.id).toBe(false);
    }
    expect(MEDALS).toHaveLength(9);
    expect(STICKERS).toHaveLength(39);
    expect(RIDE_SCORE.kids).toHaveLength(RIDES.length);
    expect(RIDE_SCORE.grown).toHaveLength(RIDES.length);
  });
});

describe('results title', () => {
  it('says perfect only with no mistakes', () => {
    const base = { stars: 3, errors: 0, finished: true, passed: true, sprint: false };
    expect(runTitle(base)).toBe('Perfect run!');
    expect(runTitle({ ...base, errors: 2 })).toBe('Three stars!');
    expect(runTitle({ ...base, errors: 0, stars: 1 })).toBe('No mistakes!');
    expect(runTitle({ ...base, errors: 3, stars: 2 })).toBe('Great job!');
    expect(runTitle({ ...base, stars: 0, passed: false, errors: 5 })).toBe('So close!');
  });
});

describe('rewards and treasure', () => {
  it('starts every buddy with the fist pump and one dance, and has a model for every outfit', () => {
    const p = newProfile('Mia', 'koala');
    expect(lookOf(p, 'koala').dance).toBe('dance_hiphop');
    expect(REWARDS.filter(r => r.level === 1).map(r => r.id)).toEqual(['fistpump', 'dance_hiphop']);
    for (const o of REWARDS.filter(r => r.kind === 'outfit')) expect(existsSync(`public/outfits/${o.id}.glb`), o.id).toBe(true);
  });
  it('has every dance in every buddy\'s model or moves', () => {
    // a GLB's JSON chunk starts at byte 20 and lists the animations by name; the model's own clips get short names
    const clips = (file: string) => {
      const glb = readFileSync(file);
      return (JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')).animations ?? []).map((a: { name: string }) => CLIP_NAMES[a.name] ?? a.name);
    };
    for (const id of BUDDIES.map(b => b.id)) {
      const names = new Set([...clips(`public/models/${id}.glb`), ...clips(`public/models/${id}-moves.glb`), ...clips(`public/models/${id}-dances.glb`)]);
      for (const d of REWARDS.filter(r => r.kind === 'dance')) expect(names.has(d.id), `${id} ${d.id}`).toBe(true);
    }
  });
  it('gives a growing treasure for a growing score', () => {
    expect(treasureFor(0, false)).toBe(-1);
    expect(treasureFor(20, false)).toBe(3);
    expect(treasureFor(80, false)).toBe(9);
    expect(treasureFor(20, true)).toBeLessThan(treasureFor(20, false));
  });
  it('drills only the new keys in a drill lesson', () => {
    const lesson = LESSON['village-4'];
    const text = generate({ lesson, layout: Q, known: knownChars(lesson.id, Q), fresh: newCharsFor(lesson, Q), seed: 3, words: WORDS_KIDS, pools: POOLS });
    expect(new Set(text.replace(/ /g, ''))).toEqual(new Set(['s', 'l']));
  });
});

describe('the course gives every key enough practice', () => {
  const Q = LAYOUTS.qwerty;
  const textOf = (id: string, seed: number) => {
    const lesson = LESSON[id];
    return generate({ lesson, layout: Q, known: knownChars(id, Q), fresh: newCharsFor(lesson, Q), seed, words: WORDS_KIDS, pools: POOLS });
  };
  it('types every new capital at least five times in its own Shift lesson', () => {
    for (const l of ALL_LESSONS.filter(x => x.shift)) {
      const text = textOf(l.id, 11);
      for (const ch of newCharsFor(l, Q).filter(c => c !== c.toLowerCase())) {
        expect([...text].filter(c => c === ch).length, `${l.id} ${ch}`).toBeGreaterThanOrEqual(5);
      }
    }
  });
  it('brings every taught character back after its first lesson (one pass, kids)', () => {
    const main = ALL_LESSONS.filter(l => l.region !== 'road');
    const firstAt = new Map<string, number>();
    const after = new Map<string, number>();
    main.forEach((l, i) => {
      for (const ch of newCharsFor(l, Q)) if (!firstAt.has(ch)) firstAt.set(ch, i);
      const text = textOf(l.id, 100 + i);
      for (const ch of text) if (firstAt.has(ch) && firstAt.get(ch)! < i) after.set(ch, (after.get(ch) ?? 0) + 1);
    });
    // lowercase letters come back all the time; capitals (typed 5+ times in their own lesson), digits and
    // punctuation are mixed back into the words, sentence, review and checkpoint lessons that follow them;
    // the Open Road's Tricky Keys picks out whichever of them a player still trips on
    // capitals are one skill (Shift with the other hand): each is typed 5+ times in its own lesson (above),
    // and capitals as a whole keep coming back afterwards
    const need = (ch: string) => (/[a-z]/.test(ch) ? 10 : /[0-9]/.test(ch) ? 5 : /[A-Z]/.test(ch) ? 0 : 1);
    const short = [...firstAt.keys()].filter(ch => ch !== ' ' && (after.get(ch) ?? 0) < need(ch)).map(ch => `${ch}:${after.get(ch) ?? 0}`);
    const caps = [...after.entries()].filter(([ch]) => /[A-Z]/.test(ch)).reduce((a, [, n]) => a + n, 0);
    expect(caps, 'capitals after the Shift lessons').toBeGreaterThanOrEqual(60);
    expect(short, short.join(' ')).toEqual([]);
  });
});

describe('earning buddies', () => {
  it('starts with six, adds one for a milestone, announces it once, and never loses progress', async () => {
    const { teamBuddies, welcomeNew, STARTERS } = await import('./team');
    const p = newProfile('Mia', 'dino');
    expect(teamBuddies(p)).toEqual(STARTERS);
    expect(welcomeNew(p)).toEqual([]);
    for (let i = 1; i <= 5; i++) p.lessons[`village-${i}`] = { stars: 2, bestWpm: 10, bestAcc: 1, bestRide: 1, attempts: 1, passes: 1, lastAt: 0 } as Profile['lessons'][string];
    expect(teamBuddies(p)).toContain('fish');
    expect(welcomeNew(p)).toEqual(['fish']);
    expect(welcomeNew(p)).toEqual([]);
    p.buddy = 'fish';
    expect(palOf(p).xp).toBe(0); // a new buddy starts their own friendship
  });
});

describe('the treasure ladder', () => {
  it('counts the best treasure across every buddy, for "best yet" and the treasure stickers', () => {
    const p = newProfile('Mia', 'dino');
    buddyPal(p).treasureBest = 6;
    p.buddy = 'monkey';
    expect(allPals(p).treasureBest).toBe(6);
    const won = checkStickers(p, 1);
    expect(won.map(s => s.id)).toEqual(expect.arrayContaining(['treasure-3', 'treasure-6']));
    expect(won.map(s => s.id)).not.toContain('treasure-9');
  });
});
