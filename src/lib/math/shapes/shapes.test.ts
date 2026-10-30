// Shapes and angles: the geometry, every skill's answers against the shapes' own corners (not the
// generator's word for them), the dot-grid rules, the course (every trip reachable, Show What You Know),
// the Learn episodes, Shape Shifter, Shape Builder and the Shape Peaks world.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../engine/rng';
import { newProfile } from '../../engine/profile';
import { mathOf } from '../progress';
import { tripStats, mathStars } from '../meter';
import { SKILL, skillsOf } from '../skills/registry';
import { SKILL_EPISODES, SKILL_LESSON, SKILL_LESSONS, SKILL_PLACEMENTS, skillRegionsOf, skillUnlocked } from '../skills/course';
import { SkillTripPicker } from '../skills/picker';
import { applySkillRun, type SkillResult } from '../skills/progress';
import { RUNGS, type Item } from '../skills/types';
import { angles, areaOf, clean, factsOf, regular, symmetryLines, type P } from './geo';
import { shapeOf, type Kind } from './kinds';
import { cut, CUTS_FOR } from './pieces';
import { decodePts, encodePts, exampleFor, ruleOk, type GridRule } from './rules';
import { SHAPE_SKILLS, samePicks } from './skills';
import type { Fig } from './fig';
import { SHAPE_LESSONS, SHAPE_LESSON } from './episodes';
import { epLesson, isEpisode, taskFor } from '../episodes';
import { fracRight } from '../fracEpisodes';
import { SHAPE_EPISODE_LINES } from '../../content/voice';
import manifest from '../../content/voice-manifest.json';
import { RULE, RULE_ORDER, Round, applyShifter, makePiece, starsFor, STAR_AT, rulesFor } from './shifter';
import { BUILDS, noteBuild, builderOf } from './builder';
import { ISLAND, islandsOf, mathPool, worldOpen, nodesOf } from '../../adventure/state';
import { WORLD_PIN } from '../../adventure/worlds';
import { SPOTS } from '../../adventure/mapSpots';
import { SHAPE_PEAKS_GLIMMERS } from '../../adventure/shapesGlimmers';
import { GLIMMER } from '../../adventure/glimmers';

const T0 = new Date('2026-11-02T16:00:00').getTime();
const many = (skill: string, sub: string, r: number, n = 120): Item[] => { const rng = mulberry32(31 + r * 7 + sub.length); return Array.from({ length: n }, () => SKILL[skill].make(rng, sub, r)); };
const polysOf = (f: Fig) => (f.polys ?? []).filter(p => !p.open);

describe('geometry', () => {
  it('names shapes from their corners, whichever way they are turned', () => {
    const sq: P[] = [[0, 0], [2, 0], [2, 2], [0, 2]];
    expect(factsOf(sq).name).toBe('square');
    expect(factsOf(sq).family).toEqual(expect.arrayContaining(['rectangle', 'rhombus', 'parallelogram', 'quadrilateral']));
    expect(factsOf(regular(4, 3, 0, 0, 45)).name).toBe('square');
    expect(factsOf([[0, 0], [4, 0], [4, 2], [0, 2]]).name).toBe('rectangle');
    expect(factsOf([[0, 2], [2, 1], [4, 2], [2, 3]]).name).toBe('rhombus');
    expect(factsOf([[1, 0], [4, 0], [3, 2], [0, 2]]).name).toBe('parallelogram');
    expect(factsOf([[0, 3], [4, 3], [3, 1], [1, 1]]).name).toBe('trapezoid');
    expect(factsOf([[0, 0], [0, 3], [4, 3]]).name).toBe('right triangle');
    expect(factsOf(regular(6, 2)).symmetry).toBe(6);
    expect(factsOf([[0, 0], [2, 0], [2, 2], [4, 2], [4, 4], [0, 4]]).reflex).toBe(1);
  });
  it('angles of a shape add up as they should, and dents count as more than 180°', () => {
    for (const n of [3, 4, 5, 6, 8]) expect(angles(regular(n, 3)).reduce((a, b) => a + b, 0)).toBeCloseTo((n - 2) * 180, 0);
    const ell: P[] = [[0, 0], [2, 0], [2, 2], [4, 2], [4, 4], [0, 4]];
    expect(angles(ell).reduce((a, b) => a + b, 0)).toBeCloseTo(720, 0);
    expect(areaOf(ell)).toBe(12);
    expect(clean([[0, 0], [1, 0], [2, 0], [2, 2], [0, 2]])).toHaveLength(4);
  });
  it('every kind of shape the generators make is what it says it is', () => {
    const rng = mulberry32(5);
    const want: Partial<Record<Kind, (f: ReturnType<typeof factsOf>) => boolean>> = {
      triangle: f => f.sides === 3, 'right-triangle': f => f.sides === 3 && f.right === 1, square: f => f.name === 'square', rectangle: f => f.name === 'rectangle',
      rhombus: f => f.name === 'rhombus', parallelogram: f => f.name === 'parallelogram', trapezoid: f => f.name === 'trapezoid', kite: f => f.name === 'kite',
      pentagon: f => f.sides === 5, hexagon: f => f.sides === 6, octagon: f => f.sides === 8, arrow: f => f.sides === 7, ell: f => f.sides === 6,
    };
    for (const [k, ok] of Object.entries(want)) for (let i = 0; i < 60; i++) {
      const pts = shapeOf(rng, k as Kind, { wild: i % 2 === 1, turn: (i * 37) % 360 });
      expect(ok!(factsOf(pts)), `${k} #${i}`).toBe(true);
    }
  });
  it('cuts shapes into equal parts, and unequal ones aren\'t', () => {
    for (const [n, kinds] of Object.entries(CUTS_FOR)) for (const k of kinds) {
      const eq = cut(k, +n, 0), areas = eq.pieces.map(areaOf);
      expect(eq.pieces, `${k} ${n}`).toHaveLength(+n);
      for (const a of areas) expect(a / areas[0], `${k} ${n} equal`).toBeCloseTo(1, 2);
      const un = cut(k, +n, 0.2).pieces.map(areaOf);
      expect(Math.max(...un) / Math.min(...un), `${k} ${n} unequal`).toBeGreaterThan(1.05);
    }
  });
});

describe('shapes and angles skills', () => {
  it('thirteen skills in grade order, K to 8, each with its episode where there is one', () => {
    expect(skillsOf('shapes').map(s => s.id)).toEqual(SHAPE_SKILLS.map(s => s.id));
    expect(SHAPE_SKILLS).toHaveLength(13);
    const grades = SHAPE_SKILLS.map(s => s.grade);
    expect([...grades].sort((a, b) => a - b)).toEqual(grades);
    expect(grades[0]).toBe(0); expect(grades.at(-1)).toBe(8);
    for (const [skill, ep] of Object.entries(SKILL_EPISODES).filter(([s]) => s.startsWith('sh-'))) { expect(SKILL[skill], skill).toBeTruthy(); expect(isEpisode(ep), ep).toBe(true); }
  });
  it('a shape to name is that shape; sides and corners are counted from the picture', () => {
    for (let r = 1; r <= RUNGS; r++) {
      for (const it of many('sh-sides', 'sides', r)) {
        const p = polysOf((it.prompt[0] as { fig: Fig }).fig)[0];
        expect(clean(p.pts).length, it.id).toBe((it.answer as { value: number }).value);
      }
      for (const it of many('sh-name', 'flat', r)) {
        const f = (it.prompt[0] as { fig: Fig }).fig, p = polysOf(f)[0], id = (it.answer as { id: string }).id;
        if (!p) { expect(id).toBe('circle'); continue; }
        const facts = factsOf(p.pts);
        if (id === 'triangle') expect(facts.sides).toBe(3);
        else if (['square', 'rectangle', 'rhombus', 'trapezoid'].includes(id)) expect(facts.name, it.id).toBe(id);
        else expect(facts.sides, it.id).toBe({ pentagon: 5, hexagon: 6, octagon: 8 }[id]);
      }
    }
  });
  it('"find them all": the right picks are exactly the shapes of that kind', () => {
    for (const [skill, sub] of [['sh-name', 'find'], ['sh-quad', 'find']]) for (let r = 1; r <= RUNGS; r++) for (const it of many(skill, sub, r, 60)) {
      const spec = it.custom!.spec as { figs: Fig[]; word: string }, ans = (it.answer as { id: string }).id.split(',').map(Number);
      expect(ans.length, it.id).toBeGreaterThan(0);
      expect(ans.length, it.id).toBeLessThan(spec.figs.length);
      spec.figs.forEach((f, i) => {
        const p = polysOf(f)[0], facts = p ? factsOf(p.pts) : null, w = spec.word;
        const is = !facts ? w === 'circle' : w === 'triangle' ? facts.sides === 3 : w === 'quadrilateral' ? facts.sides === 4 : w === 'shape with 4 right angles' ? facts.right === 4 : facts.family.includes(w);
        expect(is, `${it.id} #${i} (${w})`).toBe(ans.includes(i));
      });
      expect(SKILL[skill].check(it, { kind: 'choice', id: [...ans].reverse().join(',') })).toBe(true);
      expect(SKILL[skill].check(it, { kind: 'choice', id: ans.slice(1).join(',') || '99' })).toBe(false);
    }
    expect(samePicks('3,1', '1,3')).toBe(true);
  });
  it('the dot grid: each rule\'s example follows it, and a shape that doesn\'t is wrong', () => {
    const rules: GridRule[] = [];
    for (const s of SHAPE_SKILLS) for (const sub of s.subs) for (let r = 1; r <= RUNGS; r++) { const it = s.make(mulberry32(r), sub.id, r); if (it.custom?.name === 'dot-grid') rules.push((it.custom.spec as { rule: GridRule }).rule); }
    expect(rules.length).toBeGreaterThan(10);
    for (const rule of [...rules, ...BUILDS.map(b => b.rule)]) {
      const ex = exampleFor(rule);
      expect(ruleOk(rule, ex), JSON.stringify(rule)).toBe(true);
      expect(ex.every(([x, y]) => x >= 0 && y >= 0 && x <= 5 && y <= 5), JSON.stringify(rule)).toBe(true);
      expect(decodePts(encodePts(ex))).toEqual(ex);
    }
    expect(ruleOk({ k: 'quad', name: 'square' }, [[0, 0], [3, 0], [3, 2], [0, 2]])).toBe(false);
    expect(ruleOk({ k: 'poly', sides: 4 }, [[0, 0], [2, 2], [2, 0], [0, 2]])).toBe(false);
    expect(ruleOk({ k: 'area', area: 6, shape: 'triangle' }, [[0, 3], [4, 3], [1, 0]])).toBe(true);
  });
  it('equal parts: the right picture is cut equally, the others are not', () => {
    for (let r = 1; r <= RUNGS; r++) for (const it of many('sh-parts', 'equal', r, 60)) {
      for (const c of it.choices!) {
        const pieces = polysOf((c.parts[0] as { fig: Fig }).fig).map(p => areaOf(p.pts));
        const even = Math.max(...pieces) / Math.min(...pieces) < 1.01;
        expect(even, `${it.id} ${c.id}`).toBe(c.id === (it.answer as { id: string }).id);
      }
    }
  });
  it('lines of symmetry and folds come from the shape itself', () => {
    for (let r = 1; r <= RUNGS; r++) {
      for (const it of many('sh-lines', 'sym', r)) expect(symmetryLines(polysOf((it.prompt[0] as { fig: Fig }).fig)[0].pts).length).toBe((it.answer as { value: number }).value);
      for (const it of many('sh-lines', 'fold', r, 40)) {
        expect(it.choices!.length, it.id).toBeGreaterThanOrEqual(2);
        expect(it.choices!.filter(c => c.id.startsWith('y'))).toHaveLength(1);
      }
    }
  });
  it('the best name is the shape\'s own; the triangles are the kind they say', () => {
    for (let r = 1; r <= RUNGS; r++) {
      for (const it of many('sh-family', 'best', r)) expect(factsOf(polysOf((it.prompt[0] as { fig: Fig }).fig)[0].pts).name, it.id).toBe((it.answer as { id: string }).id);
      for (const it of many('sh-family', 'tri', r)) {
        const f = factsOf(polysOf((it.prompt[0] as { fig: Fig }).fig)[0].pts), id = (it.answer as { id: string }).id;
        expect(f.family, it.id).toContain(`${id} triangle`);
      }
    }
  });
  it('areas, volumes, circles and right triangles add up', () => {
    for (let r = 1; r <= RUNGS; r++) {
      for (const it of many('sh-area', 'tri', r)) if (!it.id.includes(':h:')) expect(areaOf(polysOf((it.prompt[0] as { fig: Fig }).fig)[0].pts)).toBeCloseTo((it.answer as { value: number }).value, 6);
      for (const it of many('sh-area', 'compose', r)) {
        const ps = polysOf((it.prompt[0] as { fig: Fig }).fig), a = areaOf(ps[0].pts) - (ps[1] ? areaOf(ps[1].pts) : 0);
        expect(a, it.id).toBeCloseTo((it.answer as { value: number }).value, 6);
      }
      for (const it of many('sh-pyth', 'long', r)) { const [, a, b, c] = it.id.split(':').slice(1).map(Number); expect(a * a + b * b, it.id).toBe(c * c); }
    }
  });
});

describe('the course in Shape Peaks', () => {
  it('four islands of trips, every one reachable by passing the one before, and a Show What You Know', () => {
    const rs = skillRegionsOf('shapes');
    expect(rs.map(r => r.name)).toEqual(['Shape Meadow', 'Angle Ridge', "Builder's Terrace", 'Crystal Summit']);
    expect(rs.every(r => r.art && r.lessons.every(l => l.skills.every(s => SKILL[s]?.area === 'shapes')))).toBe(true);
    const all = new Set(rs.flatMap(r => r.skills));
    expect([...all].sort()).toEqual(SHAPE_SKILLS.map(s => s.id).sort());
    const p = newProfile('Mia', 'dino'), m = mathOf(p);
    const lessons = SKILL_LESSONS.filter(l => l.area === 'shapes');
    for (const l of lessons) {
      expect(skillUnlocked(m, l), l.id).toBe(true);
      m.lessons[l.id] = { stars: 2, bestScore: 6, bestFpm: 6, bestAcc: 1, bestRide: 2, attempts: 1, finishes: 1, passes: 1, lastAt: T0, treasure: 1 };
    }
    expect(SKILL_PLACEMENTS.shapes?.skills).toHaveLength(13);
  });
  it('a trip plays through and Show What You Know places a child', () => {
    let p = newProfile('Mia', 'dino');
    for (const id of ['shapes-a-1', 'start-shapes']) {
      const lesson = SKILL_LESSON[id];
      const picker = new SkillTripPicker({ lesson, mem: mathOf(p).skills ?? {}, now: T0, seed: 9, math: mathOf(p) });
      const results: SkillResult[] = [];
      let pick, n = 0;
      while ((pick = picker.next()) && n++ < 80) {
        expect(pick.item.skill.startsWith('sh-')).toBe(true);
        picker.answer(true);
        results.push({ id: pick.item.id, key: pick.item.key, label: pick.item.id, ok: true, speed: 'fast', thinkMs: 3000, ms: 4000, intro: pick.reason === 'new', rung: pick.item.rung });
      }
      const stats = tripStats(results);
      const out = applySkillRun(p, { lessonId: id, results, stats, stars: mathStars(stats, lesson.goal, picker.done), bestRide: 2, finished: picker.done, at: T0 });
      p = out.profile;
    }
    expect(Object.keys(mathOf(p).skills ?? {}).some(k => k.startsWith('sh-'))).toBe(true);
    expect(Object.keys(mathOf(p).ability ?? {}).some(k => k.startsWith('sh-'))).toBe(true);
  });
});

describe('Shapes Learn episodes', () => {
  it('seven episodes in the crystal workshop, each playable, with a job for the hands', () => {
    expect(SHAPE_LESSONS).toHaveLength(7);
    for (const l of SHAPE_LESSONS) {
      const e = epLesson(l.id)!;
      expect(e.set).toBe('peaks');
      expect(SKILL[l.skill]?.area).toBe('shapes');
      expect(e.art).toMatch(/^learn\/shapes\/card-.+\.webp$/);
      const tasks = l.steps.map((s, i, all) => (s.do === 'watch' ? 'watch' : taskFor(i ? all[i - 1].board : null, s.board).kind));
      expect(tasks.filter(t => t !== 'watch').length, l.id).toBeGreaterThanOrEqual(1);
      for (const q of [...l.tries, l.teach.q]) {
        expect(fracRight(q, q.ans), `${l.id}: ${q.text}`).toBe(true);
        expect(q.pic.dots.length + q.pic.frames.length, `${l.id}: ${q.text} has a picture`).toBeGreaterThan(0);
      }
      expect(new Set([l.teach.q.ans, l.teach.wrong, l.teach.decoy]).size).toBe(3);
    }
  });
  it('the coach has a voiced line for every story, step and card', () => {
    const ids = new Set(SHAPE_EPISODE_LINES.map(x => x.id));
    for (const l of SHAPE_LESSONS) for (const id of [`ep.${l.id}.intro`, ...l.steps.map((_, i) => `ep.${l.id}.s${i}`), `ep.${l.id}.card`]) {
      expect(ids.has(id), id).toBe(true);
      expect((manifest as Record<string, unknown>)[id], `${id} recorded`).toBeTruthy();
    }
    expect(SHAPE_LESSON['sh-sides'].steps[1].board.tags).toHaveLength(3);
  });
});

describe('Shape Shifter', () => {
  it('every crystal is what it was made to be, worked out from its corners', () => {
    const rng = mulberry32(3);
    for (const id of RULE_ORDER) for (let r = 1; r <= RUNGS; r++) for (const want of [true, false]) for (let i = 0; i < 25; i++) {
      const pc = makePiece(rng, id, want, r);
      expect(pc.fits, `${id} r${r} ${want} ${pc.name}`).toBe(want);
      expect(RULE[id].fits(pc.pts, pc.angle)).toBe(want);
    }
  });
  it('a round: the same day gives the same crystals; about half fit; never three misfits in a row', () => {
    const a = new Round(1234, RULE_ORDER), b = new Round(1234, RULE_ORDER);
    const pa = Array.from({ length: 40 }, () => a.piece()), pb = Array.from({ length: 40 }, () => b.piece());
    expect(pa.map(x => x.name)).toEqual(pb.map(x => x.name));
    const fits = pa.map(x => x.fits);
    expect(fits.filter(Boolean).length).toBeGreaterThan(12);
    expect(fits.join('').includes('falsefalsefalse')).toBe(false);
    expect(new Round(1, []).rule).toBe('triangles');
  });
  it('the rules a child gets grow with what they have met; a round pays and keeps its best', () => {
    const p = newProfile('Mia', 'dino');
    expect(rulesFor(p).every(r => RULE[r].skill === 'sh-name')).toBe(true);
    const out = applyShifter(p, { score: STAR_AT[1] + 10, caught: 20, wrong: 2, bestCombo: 9, ms: 90_000, at: T0, daily: true, answers: [{ key: 'sh-name:flat', ok: true, thinkMs: 1200 }] });
    expect(out.stars).toBe(2);
    expect(starsFor(0)).toBe(0);
    const rec = mathOf(out.profile).arcade!['shape-shifter'];
    expect(rec.best).toBe(STAR_AT[1] + 10);
    expect(rec.daily?.best).toBe(STAR_AT[1] + 10);
    expect(out.xp.gained).toBeGreaterThan(0);
  });
});

describe('Shape Builder', () => {
  it('twelve builds, each one possible on its board, kept once made', () => {
    expect(BUILDS).toHaveLength(12);
    const p = newProfile('Mia', 'dino');
    for (const b of BUILDS) expect(ruleOk(b.rule, exampleFor(b.rule)), b.id).toBe(true);
    noteBuild(p, 'square', true, T0); noteBuild(p, 'square', true, T0);
    expect(builderOf(p).done).toEqual(['square']);
    expect(builderOf(p).best).toBe(1);
  });
});

describe('Shape Peaks', () => {
  it('a world of its own with six stops on its painted map, opening once shapes are started', () => {
    const pin = WORLD_PIN.peaks;
    expect(pin.map?.wide).toBe('game/map-peaks-wide.webp');
    expect(pin.station).toBe('snow');
    expect(islandsOf('peaks').map(i => i.id)).toEqual(['peaks']);
    expect(ISLAND.peaks.area).toBe('shapes');
    const nodes = nodesOf('peaks');
    expect(nodes).toHaveLength(6);
    for (const n of nodes) { expect(SPOTS.wide[n.id], n.id).toBeTruthy(); expect(SPOTS.tall[n.id], n.id).toBeTruthy(); }
    expect(GLIMMER[ISLAND.peaks.champion]).toBeTruthy();
    const p = newProfile('Mia', 'dino');
    expect(worldOpen(p, 'peaks')).toBe(false);
    p.math = { ...mathOf(p), skills: { 'sh-name:flat': { stage: 1, seen: 1, right: 1, wrong: 0, times: [], fastDays: [], last: T0, due: 0, step: 0 } } };
    expect(worldOpen(p, 'peaks')).toBe(true);
  });
  it('its battles draw only shapes and angles questions', () => {
    const p = newProfile('Mia', 'dino');
    p.math = { ...mathOf(p), skills: { 'sh-name:flat': { stage: 2, seen: 4, right: 4, wrong: 0, times: [], fastDays: [], last: T0, due: 0, step: 0 }, 'fr-name:4': { stage: 2, seen: 4, right: 4, wrong: 0, times: [], fastDays: [], last: T0, due: 0, step: 0 } } };
    type MathPool = { skills: { key: string }[]; facts: unknown[]; mix: number };
    const pool = mathPool(p, 'shapes') as unknown as MathPool;
    expect(pool.skills.length).toBeGreaterThan(0);
    expect(pool.skills.every(s => s.key.startsWith('sh-'))).toBe(true);
    expect(pool.facts.length === 0 || pool.mix === 1).toBe(true);
    // with nothing met yet, the first trip's skills
    const fresh = mathPool(newProfile('Al', 'dino'), 'shapes') as unknown as MathPool;
    expect(fresh.skills.every(s => s.key.startsWith('sh-'))).toBe(true);
  });
  it('its own Glimmers are natives of Shape Peaks, on their way until their models come', () => {
    expect(SHAPE_PEAKS_GLIMMERS).toHaveLength(4);
    expect(SHAPE_PEAKS_GLIMMERS.filter(g => g.champion)).toEqual([expect.objectContaining({ id: 'prismgryphon', champion: 'peaks' })]);
    expect(SHAPE_PEAKS_GLIMMERS.every(g => g.source === 'native' && g.world === 'peaks' && g.pending && GLIMMER[g.id] === g)).toBe(true);
  });
});
