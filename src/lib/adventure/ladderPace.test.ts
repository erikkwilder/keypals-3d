// The ladder's pace: a simulated child playing 45 minutes a day, 5 days a week, for four years, through
// the real goals (ladder.ts checkLadder) with every Glimmer's model in. The six math worlds still to come
// are stood in for while it runs (an island, its six stops, 3 natives and a Champion each, the way the area
// helpers add theirs), so all 100 are in play. What the child does each play day is a model:
//
// Two children, both starting on 7 September 2026. Each play day: 25 minutes of practice (120 right answers)
// and 20 minutes of battles (4 wins, 80 right answers), the wins taken in turn round the open worlds;
// about 4 wins in 10 bring an egg, and up to two eggs a day hatch a rolled Glimmer (the real egg odds, a
// new one when it can). The two team Glimmers learn from every win; grown up, one is swapped for another
// now and then (3 days in 10); a ready one is grown up the next day. Typing: 8 words a minute at the
// start, 12 more a year. Secrets: the Seed Library day 10, a perfect quick Bonus Round day 25, the secret
// word day 45, the bay's hidden spot day 75. Worlds open when their math starts and math turns strong (the
// adaptive ability) by grade (the coming areas aren't live, so "every kind of math" is the seven live
// today), in months from the start:
//   GRADE3 (starts grade 3): Counting Caves at once, Fraction Falls 1, Market Isle 2, Clockwork Isle 1,
//     Shape Peaks 6, Chance Fair 9, Juice Jungle and Below Zero Caves 30, Star Lab 33; strong: adding and
//     taking away 2, place value 10, times and sharing 12, fractions 20, decimals 26.
//   GRADE2 (starts grade 2): Counting Caves at once, Clockwork Isle 1, Market Isle 4, Shape Peaks 6,
//     Fraction Falls and Chance Fair 12, Juice Jungle and Below Zero Caves 42, Star Lab 45; strong: adding
//     and taking away 4, place value 14, times and sharing 22, fractions 32, decimals 38.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../engine/rng';
import { newProfile, dayKey } from '../engine/profile';
import { mathOf } from '../math/progress';
import { AREAS, skillsOf } from '../math/skills/registry';
import { STRAND_SKILL } from '../math/skills/ability';
import { ALL_GLIMMERS, GLIMMER, RARITIES, glimmersOf, ownChampion, type Element, type GlimmerDef, type GlimmerId, type Rarity } from './glimmers';
import { ISLAND, ISLANDS, NODES, advOf, giveXp, hatch, meet, notePractice, type Island, type IslandId, type MapNode } from './state';
import { COMING_WORLDS, checkLadder, worldSlots } from './ladder';
import { noteLadder, noteSecret } from './ladderSave';

const DAY = 86_400_000;
const START = new Date('2026-09-07T16:00:00').getTime();
const MONTH = 365.25 / 12;
const roll = (rng: () => number, odds: Partial<Record<Rarity, number>>): Rarity => {
  const tot = RARITIES.reduce((t, r) => t + (odds[r] ?? 0), 0);
  let x = rng() * tot;
  for (const r of RARITIES) { x -= odds[r] ?? 0; if (x < 0) return r; }
  return 'common';
};
type Child = { open: Record<string, number>; coming: Record<string, number>; strong: { plusminus: number; place: number; timesshare: number; fractions: number; decimals: number } };
const GRADE3: Child = { open: { sky: 0, caves: 0, falls: 1, market: 2 }, coming: { measure: 1, shapes: 6, data: 9, ratios: 30, integers: 30, algebra: 33 },
  strong: { plusminus: 2, place: 10, timesshare: 12, fractions: 20, decimals: 26 } };
const GRADE2: Child = { open: { sky: 0, caves: 0, falls: 12, market: 4 }, coming: { measure: 1, shapes: 6, data: 12, ratios: 42, integers: 42, algebra: 45 },
  strong: { plusminus: 4, place: 14, timesshare: 22, fractions: 32, decimals: 38 } };
const COMING_EL: Record<string, Element> = { measure: 'stone', shapes: 'stone', data: 'sun', ratios: 'leaf', integers: 'frost', algebra: 'tide' };

/** Stand in for what the six coming worlds don't have yet while the simulation runs (a world that's in
 *  keeps its own island and Glimmers; only its missing places get stand-ins); returns how to take them out. */
function standIn(): () => void {
  const added: { defs: GlimmerDef[]; islands: Island[]; nodes: MapNode[] } = { defs: [], islands: [], nodes: [] };
  for (const w of COMING_WORLDS) {
    const real = ISLANDS.find(i => i.world === w.id);
    const isl = real ?? ({ id: `sim-${w.area}`, world: w.id, tier: 1, name: w.name, element: COMING_EL[w.area], region: 'village', champion: 'prismhorn', area: w.area,
      odds: { common: 46, uncommon: 30, rare: 16, epic: 7.6, mythic: 0.4 }, blurb: '' } as unknown as Island);
    if (!real) {
      added.islands.push(isl);
      (['battle', 'battle', 'practice', 'battle', 'battle', 'champion'] as const).forEach((kind, n) => added.nodes.push({ id: `${isl.id}-${n}`, island: isl.id as IslandId, kind, n }));
    }
    const hasChampion = ALL_GLIMMERS.some(g => g.source === 'native' && g.world === w.id && g.champion);
    (['uncommon', 'rare', 'epic', 'legendary'] as Rarity[]).slice(4 - worldSlots(w.area)).forEach((rarity, k) => added.defs.push({
      id: `sim-${w.area}-${k}` as GlimmerId, name: `${w.name} ${k}`, rarity, element: COMING_EL[w.area], source: 'native', world: w.id,
      ...(rarity === 'legendary' && !hasChampion ? { champion: isl.id } : {}), quirk: '', power: { kind: 'nibble', name: '', text: () => '' },
    }));
  }
  ALL_GLIMMERS.push(...added.defs); ISLANDS.push(...added.islands); NODES.push(...added.nodes);
  for (const g of added.defs) (GLIMMER as Record<string, GlimmerDef>)[g.id] = g;
  for (const i of added.islands) (ISLAND as Record<string, Island>)[i.id] = i;
  return () => {
    for (const g of added.defs) { ALL_GLIMMERS.splice(ALL_GLIMMERS.indexOf(g), 1); delete (GLIMMER as Record<string, GlimmerDef>)[g.id]; }
    for (const i of added.islands) { ISLANDS.splice(ISLANDS.indexOf(i), 1); delete (ISLAND as Record<string, Island>)[i.id]; }
    for (const n of added.nodes) NODES.splice(NODES.indexOf(n), 1);
  };
}

function simulate(kid: Child, years = 4) {
  const shipped = new Map(ALL_GLIMMERS.map(g => [g.id, g.pending]));
  for (const g of ALL_GLIMMERS) g.pending = false;
  const takeOut = standIn();
  try {
    expect(COMING_WORLDS.reduce((t, w) => t + worldSlots(w.area), 0)).toBe(0);
    expect(ALL_GLIMMERS).toHaveLength(100);
    const rng = mulberry32(2026);
    const p = newProfile('Sim', 'dino'); p.createdAt = START;
    const a = advOf(p), m = (p.math = mathOf(p));
    const st = kid.strong;
    const strongAt: [string[], number][] = [
      [[STRAND_SKILL['+'], STRAND_SKILL['-']], st.plusminus], [skillsOf('place').map(s => s.id), st.place], [[STRAND_SKILL.x, STRAND_SKILL['/']], st.timesshare],
      [skillsOf('fractions').map(s => s.id), st.fractions], [skillsOf('decimals').map(s => s.id), st.decimals],
      // each newer area (live once its world is in) strong about 8 months after its world opens
      ...AREAS.filter(ar => ar.live && !ar.op && kid.coming[ar.id] !== undefined).map(ar => [skillsOf(ar.id).map(s => s.id), kid.coming[ar.id] + 8] as [string[], number]),
    ];
    const opens: Record<string, number> = { ...kid.open };
    for (const w of COMING_WORLDS) opens[w.id] = kid.coming[w.area];
    const secrets: [number, 'hut' | 'bonus' | 'word' | 'trail'][] = [[10, 'hut'], [25, 'bonus'], [45, 'word'], [75, 'trail']];
    let eggs = 0, eggsMade = 0, turn = 0;
    const arrived: { id: GlimmerId; month: number }[] = [];
    const out: { month: number; met: number; roll: number; ladder: number }[] = [];
    const marks = [1, 3, 6, 12, 18, 24, 30, 36, 42, 48].filter(x => x <= years * 12);
    for (let d = 0; d <= years * 366; d++) {
      const t = START + d * DAY, dk = dayKey(t), wd = new Date(t).getDay(), month = d / MONTH;
      if (wd !== 0 && wd !== 6) {
        // practice and battles
        p.days[dk] = { ms: 25 * 60000, runs: 3 };
        a.day = { key: dk, ms: 20 * 60000, answers: 90, right: 80 };
        notePractice(p, 120, true, t);
        noteLadder(p, a, 80, t);
        p.lessons.sim = { stars: 3, bestWpm: 8 + 12 * (d / 365), bestAcc: 0.95, bestRide: 1, attempts: 1, passes: 1, lastAt: t };
        for (const [skills, mo] of strongAt) if (month >= mo) for (const s of skills) m.ability = { ...(m.ability ?? {}), [s]: { t: 3.9, n: 80, at: t } };
        for (const [day, s] of secrets) if (d >= day) noteSecret(p, a, s);
        // four wins, in turn round the open worlds
        const worlds = Object.keys(opens).filter(w => month >= opens[w]);
        for (let k = 0; k < 4; k++) {
          const w = worlds[turn++ % worlds.length];
          const stops = NODES.filter(n => ISLAND[n.island].world === w);
          const again = stops.filter(n => n.kind !== 'champion');
          const node = stops.find(n => !(a.nodes[n.id] > 0)) ?? again[Math.floor(rng() * again.length)];
          a.nodes[node.id] = (a.nodes[node.id] ?? 0) + 1;
          const isl = ISLAND[node.island];
          let id: GlimmerId;
          if (node.kind === 'champion') id = ownChampion(isl.id) ?? isl.champion;
          else {
            const r = roll(rng, isl.odds), all = glimmersOf(r).filter(g => !g.champion || r !== 'legendary');
            const list = all.length ? all : glimmersOf(r), home = list.filter(g => g.home === isl.id || isl.natives?.includes(g.id));
            const from0 = home.length && rng() < 0.7 ? home : list, fresh = from0.filter(g => !a.glimmers[g.id]);
            const from = fresh.length && rng() < 0.65 ? fresh : from0;
            id = from[Math.floor(rng() * from.length)].id;
          }
          meet(a, id);
          if (rng() < 0.4) eggs++;
          for (const tid of a.team) if (tid && a.glimmers[tid]) giveXp(a.glimmers[tid]!, 14);
        }
        // eggs hatch from the day's right answers (two a day at most)
        for (let k = 0; k < 2 && eggs > 0; k++, eggs--) {
          eggsMade++;
          let r = roll(rng, { common: 50, uncommon: 28, rare: 14, epic: 6, legendary: 1.6, mythic: 0.4 });
          if (eggsMade % 10 === 0 && RARITIES.indexOf(r) < 2) r = 'rare';
          const list = glimmersOf(r), fresh = list.filter(g => !a.glimmers[g.id]);
          meet(a, (fresh.length ? fresh : list)[Math.floor(rng() * (fresh.length || list.length))].id);
        }
        // grown up: Evolve is tapped when it glows; a grown-up is swapped off the team now and then
        for (const o of Object.values(a.glimmers)) if (o && !o.evolved && o.level >= 5) o.evolved = true;
        a.team = a.team.map(tid => {
          if (tid && a.glimmers[tid] && !a.glimmers[tid]!.evolved) return tid;
          if (tid && rng() > 0.3) return tid;
          const next = (Object.keys(a.glimmers) as GlimmerId[]).filter(x => !a.glimmers[x]!.evolved && !a.team.includes(x)).sort((u, v) => RARITIES.indexOf(GLIMMER[v].rarity) - RARITIES.indexOf(GLIMMER[u].rarity))[0];
          return next ?? tid;
        });
        // the ladder: special eggs arrive ready, and the child hatches them
        for (const n of checkLadder(p, t)) {
          if (!a.glimmers[n.id]) arrived.push({ id: n.id, month });
          const slot = a.incubator.findIndex(e => e?.id === n.egg.id);
          if (slot >= 0) hatch(p, slot, d); else { a.nest = a.nest.filter(e => e.id !== n.egg.id); meet(a, n.id); }
        }
      }
      while (marks.length && month >= marks[0]) {
        const ids = Object.keys(a.glimmers) as GlimmerId[], rolled = ids.filter(x => (GLIMMER[x].source ?? 'roll') === 'roll').length;
        out.push({ month: marks.shift()!, met: ids.length, roll: rolled, ladder: ids.length - rolled });
      }
    }
    return { rows: out, arrived };
  } finally {
    takeOut();
    for (const g of ALL_GLIMMERS) g.pending = shipped.get(g.id);
  }
}

function run(name: string, kid: Child) {
  const before = ALL_GLIMMERS.length;
  const { rows, arrived } = simulate(kid, 4);
  console.log(`${name}\nmonth | met of 100 | from rolls | from goals\n` + rows.map(r => `${String(r.month).padStart(5)} | ${String(r.met).padStart(10)} | ${String(r.roll).padStart(10)} | ${r.ladder}`).join('\n'));
  if (process.env.LADDER_DEBUG) console.log(arrived.map(x => `${x.id}@${x.month.toFixed(1)}`).join(' '));
  // the simulation put everything back
  expect(ALL_GLIMMERS).toHaveLength(before);
  return (mo: number) => rows.find(r => r.month === mo)!.met;
}
describe('the pace at 45 minutes a day, 5 days a week (lead\'s target: about 35 by month 1, 60 by year 1, 80 by year 2, 100 in years 3 to 4)', () => {
  it('a child who starts in grade 3: the worlds open early, so year 1 runs ahead; 100 before the end of year 4', () => {
    const at = run('Starts grade 3', GRADE3);
    expect(at(1)).toBeGreaterThanOrEqual(28); expect(at(1)).toBeLessThanOrEqual(42);
    expect(at(12)).toBeGreaterThanOrEqual(58); expect(at(12)).toBeLessThanOrEqual(76);
    expect(at(24)).toBeGreaterThanOrEqual(72); expect(at(24)).toBeLessThanOrEqual(88);
    expect(at(36)).toBeLessThan(100);
    expect(at(48)).toBe(100);
  });
  it('a child who starts in grade 2: the worlds open over the years; the upper-grade worlds\' last few come in year 5', () => {
    const at = run('Starts grade 2', GRADE2);
    expect(at(1)).toBeGreaterThanOrEqual(28); expect(at(1)).toBeLessThanOrEqual(42);
    expect(at(12)).toBeGreaterThanOrEqual(52); expect(at(12)).toBeLessThanOrEqual(70);
    expect(at(24)).toBeGreaterThanOrEqual(68); expect(at(24)).toBeLessThanOrEqual(86);
    expect(at(48)).toBeLessThan(100);
  });
});
