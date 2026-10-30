// Measurement and time: the skills' own rules (the fuzz test in skills/rungs.test.ts covers every rung of
// every skill), the course (every trip reachable, the placement), and the Learn episodes (their words
// match the voice lines, every step's job can be done).
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { newProfile } from '../../engine/profile';
import { mathOf } from '../progress';
import { SKILL, skillsOf } from '../skills/registry';
import { MEASURE_SKILLS, clockMins, fromMins, timeText, timeWords, type ClockSpec, type JugSpec, type RulerSpec } from '../skills/measure';
import { SKILL_EPISODES, SKILL_LESSONS, SKILL_PLACEMENTS, nextSkillLesson, skillRegionsOf, skillUnlocked } from '../skills/course';
import { MEASURE_LESSONS, MEASURE_LESSON, T, measureLines, parseTime, fixChoices } from './episodes';
import { ALL_LINES } from '../../content/voice';
import { existsSync } from 'node:fs';

const pub = (f: string) => existsSync(new URL(`../../../../public/${f}`, import.meta.url));

describe('measurement skills', () => {
  it('has twelve skills from grade 1 to 6, in grade order, each with a standard', () => {
    expect(skillsOf('measure').map(s => s.id)).toEqual(MEASURE_SKILLS.map(s => s.id));
    expect(MEASURE_SKILLS).toHaveLength(12);
    const grades = MEASURE_SKILLS.map(s => s.grade);
    expect(grades).toEqual([...grades].sort((a, b) => a - b));
    expect(Math.min(...grades)).toBe(1); expect(Math.max(...grades)).toBe(6);
    for (const s of MEASURE_SKILLS) { expect(s.standard).toMatch(/^\d\.(MD|RP)\./); expect(s.plain.length).toBeGreaterThan(30); }
  });
  it('tells the time in numbers and words', () => {
    expect(timeText(3, 5)).toBe('3:05'); expect(timeText(12, 0)).toBe('12:00'); expect(timeText(13, 30)).toBe('1:30');
    expect(timeWords(3, 0)).toBe("3 o'clock"); expect(timeWords(3, 30)).toBe('half past 3'); expect(timeWords(8, 45)).toBe('quarter to 9');
    expect(timeWords(6, 20)).toBe('20 past 6'); expect(timeWords(7, 47)).toBe('13 minutes to 8'); expect(timeWords(12, 55)).toBe('5 to 1');
    expect(clockMins(12, 0)).toBe(0); expect(clockMins(3, 30)).toBe(210); expect(fromMins(210)).toEqual([3, 30]); expect(fromMins(-30)).toEqual([11, 30]);
  });
  it('a clock set right counts on any lap of the hands, and only the right time does', () => {
    const rng = mulberry32(4);
    for (const id of ['ms-hour', 'ms-five', 'ms-minute']) for (let r = 1; r <= 6; r++) {
      const it = SKILL[id].make(rng, 'set', r);
      expect(it.input).toBe('custom'); expect(it.custom?.name).toBe('clock');
      const v = (it.answer as { value: number }).value, spec = it.custom!.spec as ClockSpec;
      expect(SKILL[id].check(it, { kind: 'number', value: v + 720 })).toBe(true);
      expect(SKILL[id].check(it, { kind: 'number', value: v + 60 })).toBe(false);
      // it never starts on the answer
      expect(((spec.start - v) % 720 + 720) % 720).not.toBe(0);
      if (spec.lock === 'minute') expect(v % 60).toBe(0);
    }
  });
  it('the ruler and the jug inputs fit their answers', () => {
    const rng = mulberry32(8);
    for (let r = 1; r <= 6; r++) for (let i = 0; i < 50; i++) {
      const a = SKILL['ms-ruler'].make(rng, 'draw', r), rs = a.custom!.spec as RulerSpec, end = (a.answer as { value: number }).value;
      expect(end).toBeGreaterThan(rs.start); expect(end).toBeLessThanOrEqual(rs.len);
      expect(Math.abs(end / rs.snap - Math.round(end / rs.snap))).toBeLessThan(1e-9);
      const b = SKILL['ms-mass'].make(rng, 'pour', r), js = b.custom!.spec as JugSpec, v = (b.answer as { value: number }).value;
      expect(v).toBeGreaterThan(js.start); expect(v).toBeLessThan(js.max); expect(v % js.step).toBe(0);
    }
  });
  it('elapsed time: the answer is the start plus how long, on the clock', () => {
    const rng = mulberry32(11);
    for (let r = 1; r <= 6; r++) for (let i = 0; i < 40; i++) {
      const it = SKILL['ms-elapsed'].make(rng, 'later', r);
      const right = it.choices!.find(c => c.id === (it.answer as { id: string }).id)!;
      const p = right.parts[0] as { t: 'meas'; m: { kind: 'time'; h: number; m: number } };
      expect(p.t).toBe('meas');
      // the choices are all different times
      const keys = it.choices!.map(c => { const q = c.parts[0] as typeof p; return clockMins(q.m.h, q.m.m); });
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe('measurement on the Practice map', () => {
  it('three islands, every skill met in a Meet stop, a Show What You Know with every skill', () => {
    const rs = skillRegionsOf('measure');
    expect(rs.map(r => r.name)).toEqual(['Tick-Tock Square', 'Measuring Mill', "Builder's Yard"]);
    for (const r of rs) { expect(r.art && pub(r.art), r.id).toBeTruthy(); expect(r.lessons.at(-1)!.kind).toBe('check'); }
    const met = new Set(rs.flatMap(r => r.lessons.flatMap(l => l.learn)));
    for (const s of MEASURE_SKILLS) expect(met.has(s.id), s.id).toBe(true);
    const pl = SKILL_PLACEMENTS.measure!;
    expect(new Set(pl.skills)).toEqual(new Set(MEASURE_SKILLS.map(s => s.id)));
  });
  it('every trip can be reached by playing the ones before it', () => {
    const p = newProfile('Kid', 'dino');
    const m = mathOf(p);
    const lessons = SKILL_LESSONS.filter(l => l.area === 'measure');
    expect(skillUnlocked(m, lessons[0])).toBe(true);
    let guard = 0;
    while (guard++ < 100) {
      const l = nextSkillLesson(m, 'measure');
      if (m.lessons[l.id]?.stars) break;
      expect(skillUnlocked(m, l), l.id).toBe(true);
      m.lessons[l.id] = { stars: 2, bestScore: 10, bestFpm: 0, bestAcc: 1, bestRide: 1, attempts: 1, finishes: 1, passes: 1, lastAt: 0, treasure: 0 };
    }
    for (const l of lessons) expect(skillUnlocked(m, l), l.id).toBe(true);
  });
});

describe('measurement Learn episodes', () => {
  it('six episodes, each skill pointing at one, their words the voice lines', () => {
    expect(MEASURE_LESSONS).toHaveLength(6);
    for (const [skill, ep] of Object.entries(SKILL_EPISODES).filter(([k]) => k.startsWith('ms-'))) { expect(SKILL[skill], skill).toBeTruthy(); expect(MEASURE_LESSON[ep], ep).toBeTruthy(); }
    const said = new Map(ALL_LINES.map(l => [l.id, l.text]));
    for (const l of MEASURE_LESSONS) for (const [id, text] of measureLines(l)) expect(said.get(id), id).toBe(text);
    for (const l of MEASURE_LESSONS) for (const [id] of measureLines(l)) expect(pub(`voice/${id}.mp3`), id).toBe(true);
  });
  it('every step can be done, and every question answered', () => {
    for (const l of MEASURE_LESSONS) {
      expect(l.steps.length).toBeGreaterThanOrEqual(3);
      for (const s of l.steps) {
        const d = s.do, at = s.at;
        if (d.kind === 'hand' || d.kind === 'nums') expect(at.clock, l.id).toBeTruthy();
        if (d.kind === 'hand') { expect(d.to).toBeGreaterThanOrEqual(0); expect(d.to).toBeLessThan(720); expect(d.to).not.toBe(at.clock!.t); }
        if (d.kind === 'slide' || d.kind === 'mark') expect(at.ruler, l.id).toBeTruthy();
        if (d.kind === 'slide') expect(at.ruler!.items[d.item].from).not.toBe(d.to);
        if (d.kind === 'load') expect(at.scale && !at.scale.load, l.id).toBeTruthy();
        if (d.kind === 'pour') { expect(at.jug, l.id).toBeTruthy(); expect(d.to % at.jug!.step).toBe(0); }
        if (d.kind === 'tiles') { expect(at.garden).toBeTruthy(); expect(d.to).toBeGreaterThan(at.garden!.tiles); expect(d.to).toBeLessThanOrEqual(at.garden!.w * at.garden!.h); }
        if (d.kind === 'sides') expect(at.garden?.fence).toBe(true);
        expect((s.eq.match(/\[/g) ?? []).length).toBeGreaterThan(0);
      }
      const fix = fixChoices(l);
      expect(new Set(fix).size).toBe(3); expect(fix).toContain(l.teach.q.ans); expect(fix).toContain(l.teach.wrong);
      for (const q of [l.teach.q, ...l.tries]) {
        if (q.input === 'choice' && q.choices) expect(q.choices).toContain(q.ans);
        if (q.input === 'clock') { expect(q.at.clock).toBeTruthy(); expect(parseTime(q.ans)).not.toBe(q.at.clock!.t); }
        if (q.input === 'pour') expect(q.at.jug).toBeTruthy();
        if (q.input === 'num') expect(q.ans).toMatch(/^\d+$/);
      }
    }
    expect(T(3, 30)).toBe(210); expect(parseTime('11:30')).toBe(690);
  });
});
