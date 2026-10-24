import { describe, expect, it } from 'vitest';
import { LAYOUTS, detectLayout, fingerFor, shiftFor } from './layouts';
import { ALL_LESSONS, LESSON, knownChars, newCharsFor } from './course';
import { generate, targetLength, fits } from './textgen';
import { Session } from './session';
import { computeStats, lessonGoal, starsFor } from './scoring';
import { RideMeter } from './rides';
import { STICKERS, newPalProgress } from './stickers';
import { MEDALS } from './achievements';
import { RIDES, RIDE_SCORE } from './rides';
import type { Profile } from './profile';
import { applyRun, isUnlocked, newProfile, nextLesson, migrate, knownFor } from './profile';
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
  });
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
    expect(out.treasure).toBeGreaterThanOrEqual(0);
    expect(nextLesson(p).id).toBe('village-2');
  });
  it('keeps stickers and medals per buddy', () => {
    let p = newProfile('Mia', 'dino');
    const s = typeOut('fff jjj fj jf fff jjj fj jf', 500);
    p = applyRun(p, { lessonId: 'village-1', stats: computeStats(s), stars: 3, bestRide: 1, keyboardHidden: false, finished: true, at: Date.now() }, Q).profile;
    expect(Object.keys(p.pals.dino!.stickers).length).toBeGreaterThan(2);
    p.buddy = 'monkey';
    const out = applyRun(p, { lessonId: 'village-1', stats: computeStats(s), stars: 3, bestRide: 1, keyboardHidden: false, finished: true, at: Date.now() }, Q);
    expect(out.stickers.map(st => st.id)).toContain('runs-1'); // Momo earns his own first sticker
    expect(out.profile.pals.monkey!.medals.three).toBe(1);
    expect(out.profile.pals.dino!.medals.three).toBe(1);
  });
  it('awards several medals at once on a great run', () => {
    let p = newProfile('Mia', 'dino');
    const s = typeOut('ask dad all salads ask dad all salads ask a lass', 250);
    const out = applyRun(p, { lessonId: 'village-1', stats: computeStats(s), stars: 3, bestRide: 4, keyboardHidden: true, finished: true, at: Date.now() }, Q);
    const ids = out.medals.map(m => m.id);
    expect(ids).toEqual(expect.arrayContaining(['clean', 'steady', 'three', 'nopeek', 'firsttry', 'ride-car', 'streak-25']));
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
  it('has a sticker and a medal for every ride above walking', () => {
    for (const r of RIDES.slice(1)) {
      expect(STICKERS.some(s => s.id === `ridestar-${r.id}`), r.id).toBe(true);
      expect(MEDALS.some(m => m.id === `ride-${r.id}`), r.id).toBe(true);
    }
    expect(RIDE_SCORE.kids).toHaveLength(RIDES.length);
    expect(RIDE_SCORE.grown).toHaveLength(RIDES.length);
  });
});

describe('rewards and treasure', () => {
  it('starts every buddy with the fist pump and one dance, and has a model for every outfit', () => {
    const p = newProfile('Mia', 'koala');
    expect(p.pals.koala!.dance).toBe('dance_hiphop');
    expect(REWARDS.filter(r => r.level === 1).map(r => r.id)).toEqual(['fistpump', 'dance_hiphop']);
    for (const o of REWARDS.filter(r => r.kind === 'outfit')) expect(existsSync(`public/outfits/${o.id}.glb`), o.id).toBe(true);
  });
  it('has every dance in every buddy\'s model or moves', () => {
    // a GLB's JSON chunk starts at byte 20 and lists the animations by name; the model's own clips get short names
    const clips = (file: string) => {
      const glb = readFileSync(file);
      return (JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8')).animations ?? []).map((a: { name: string }) => CLIP_NAMES[a.name] ?? a.name);
    };
    for (const id of ['dino', 'cheetah', 'monkey', 'koala']) {
      const names = new Set([...clips(`public/models/${id}.glb`), ...clips(`public/models/${id}-moves.glb`)]);
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
