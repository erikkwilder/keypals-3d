import { describe, expect, it } from 'vitest';
import { newProfile, dayKey, buddyPal } from '../engine/profile';
import { answerOf } from '../math/facts';
import { newBattle, play, block, finale, deal, openFact, sparkFor, hitFor, FINALE_AT, type Pool, type Foe } from './battle';
import { advOf, applyBattle, buy, currentNode, foeFor, hatch, mathPool, NODE, nodesOf, nodeOpen, notePractice, playLeft, reachStop, typingPool, collectStop, practiceDone, worldOpen, BATTLE_FRIENDSHIP } from './state';
import { mathOf } from '../math/progress';
import { noteSkillAnswers } from '../math/skills/progress';
import { GLIMMERS, GLIMMER, type GlimmerId } from './glimmers';
import { putOnTeam, teamGap } from './state';

const pool: Pool = { subject: 'math', facts: [{ f: { a: 3, b: 4, op: '+' }, stage: 3 }, { f: { a: 5, b: 5, op: '+' }, stage: 2 }, { f: { a: 6, b: 2, op: '+' }, stage: 1 }, { f: { a: 2, b: 2, op: '+' }, stage: 2 }], open: false };
const foe = (grump = 30): Foe => ({ glimmer: 'puddlepup', rarity: 'common', champion: false, element: 'tide', grump, max: grump, hit: 3 });
const right = (f: { a: number; b: number; op?: '+' | 'x' | '-' | '/' }) => ({ ok: true, value: answerOf(f), thinkMs: 1500 });

describe('the Cheer Duel', () => {
  it('cheers by the number you make, and an exact landing is a Perfect Cheer', () => {
    const b = newBattle({ pool, seed: 1, sparkMax: 20, role: 'steady', gear: null, team: [], foe: foe(7) });
    const card = b.cards.find(c => c.fact && answerOf(c.fact) === 7) ?? (b.cards[0].fact = { a: 3, b: 4, op: '+' }, b.cards[0]);
    const ev = play(b, card.id, right(card.fact!));
    expect(ev.some(e => e.k === 'won' && e.perfect)).toBe(true);
    expect(b.phase).toBe('won');
  });
  it('a miss cheers nothing and breaks the streak; the Grumble then makes mischief to block', () => {
    const b = newBattle({ pool, seed: 2, sparkMax: 20, role: 'steady', gear: null, team: [], foe: foe(40) });
    b.streak = 2;
    const c = b.cards.find(x => x.fact)!;
    play(b, c.id, { ok: false, value: 99, thinkMs: 2000 });
    expect(b.foe.grump).toBe(40);
    expect(b.streak).toBe(0);
    expect(b.phase).toBe('block');
    const ev = block(b, true, 1000);
    expect(ev[0]).toMatchObject({ k: 'mischief', result: 'full', damage: 0 });
    expect(b.phase).toBe('pick');
  });
  it('a block in time holds it off; too late or wrong, it lands; energy at zero loses', () => {
    const b = newBattle({ pool, seed: 3, sparkMax: 6, role: 'heart', gear: null, team: [], foe: { ...foe(99), hit: 4 } });
    play(b, b.cards[0].id, { ok: false, value: 0, thinkMs: 1 });
    expect(block(b, true, 1000)[0]).toMatchObject({ result: 'full', damage: 0 });
    play(b, b.cards[0].id, { ok: false, value: 0, thinkMs: 1 });
    block(b, true, 9000);
    expect(b.spark).toBe(2);
    play(b, b.cards[0].id, { ok: false, value: 0, thinkMs: 1 });
    const ev = block(b, false, 1000);
    expect(ev.some(e => e.k === 'lost')).toBe(true);
  });
  it('each counterattack that gets through in a row is bigger; blocking one calms it down', () => {
    const b = newBattle({ pool, seed: 3, sparkMax: 99, role: 'speed', gear: null, team: [], foe: { ...foe(999), hit: 6 } });
    const miss = () => { play(b, b.cards[0].id, { ok: false, value: 0, thinkMs: 1 }); return b.block!.hit; };
    expect(miss()).toBe(6); block(b, false, 1000);
    expect(miss()).toBe(9); block(b, false, 1000);
    expect(miss()).toBe(14); block(b, true, 1000);
    expect(miss()).toBe(6);
    expect(b.spark).toBe(99 - 6 - 9);
  });
  it('a counterattack takes the same share of energy at any friendship level, a bit more on later islands', () => {
    const share = (level: number, tier = 0) => hitFor({ champion: false, tier, level, subject: 'math' }) / sparkFor(level, 'speed');
    expect(share(1)).toBeCloseTo(share(30), 1);
    expect(share(10, 2)).toBeGreaterThanOrEqual(share(10, 0));
    expect(hitFor({ champion: true, tier: 0, level: 10, subject: 'math' })).toBeLessThan(hitFor({ champion: false, tier: 0, level: 10, subject: 'math' }));
  });
  it('Glimmer extras come after your number and never spoil an exact plan', () => {
    const b = newBattle({ pool, seed: 4, sparkMax: 20, role: 'steady', gear: null, team: [{ id: 'embernewt', level: 1 }], foe: foe(20) });
    const c = b.cards.find(x => x.fact)!;
    const ev = play(b, c.id, right(c.fact!));
    const cast = ev.find(e => e.k === 'cast')!;
    const ember = ev.find(e => e.k === 'extra');
    expect(cast).toMatchObject({ value: answerOf(c.fact!) });
    expect(ember).toMatchObject({ what: 'Ember Puff', value: 4 });
    expect(b.foe.grump).toBe(20 - answerOf(c.fact!) - 4);
  });
  it('Pebble Shell and Hover take the first mischiefs; five right fills the Finale', () => {
    const b = newBattle({ pool, seed: 5, sparkMax: 20, role: 'steady', gear: 'hover', team: [{ id: 'pebbletort', level: 1 }], foe: foe(500) });
    for (let i = 0; i < 2; i++) { const c = b.cards.find(x => x.fact)!; const ev = play(b, c.id, right(c.fact!)); expect(ev.find(e => e.k === 'mischief')).toMatchObject({ result: 'skip' }); }
    for (let i = 0; i < 3; i++) { const c = b.cards.find(x => x.fact)!; play(b, c.id, right(c.fact!)); if (b.phase === 'block') block(b, true, 100); }
    expect(b.finale).toBe(FINALE_AT);
    const ev = finale(b);
    expect(ev[0]).toMatchObject({ k: 'finale', value: 150 });
  });
  it('shields from helpers and gear stop 2 counterattacks a battle at most, all together', () => {
    const b = newBattle({ pool, seed: 5, sparkMax: 99, role: 'steady', gear: 'hover', team: [{ id: 'pinepango', level: 20, evolved: true }, { id: 'bubbleocto', level: 20, evolved: true }], foe: foe(9999), kit: ['bubble', 'skyset'] });
    let skipped = 0, bubbles = 0;
    for (let i = 0; i < 12; i++) {
      const c = b.cards.find(x => x.fact)!;
      const ev = play(b, c.id, right(c.fact!));
      bubbles += ev.filter(e => e.k === 'bubble' || (e.k === 'gear' && e.item === 'bubble_wand')).length;
      if (ev.some(e => e.k === 'mischief' && e.result === 'skip')) skipped++;
      if (b.phase === 'block') block(b, true, 100);
    }
    expect(skipped).toBe(2);
    // no bubble is blown that couldn't stop anything
    expect(bubbles).toBe(0);
    // a grown-up Pine Pangolin gives energy back when its curl blocks
    const p2 = newBattle({ pool, seed: 5, sparkMax: 30, role: 'steady', gear: null, team: [{ id: 'pinepango', level: 1, evolved: true }], foe: foe(9999) });
    p2.spark = 20;
    const c = p2.cards.find(x => x.fact)!;
    expect(play(p2, c.id, right(c.fact!)).find(e => e.k === 'heal')).toMatchObject({ what: 'Pine curl', value: 2 });
  });
  it('open cards make the fact you choose (kept for later; off in battles for now)', () => {
    expect(openFact({ a: 6, op: 'x', max: 10 }, 4)).toEqual({ a: 6, b: 4 });
    const p = newProfile('Ava', 'dino');
    const pl = mathPool(p);
    expect(pl.subject === 'math' && pl.open).toBe(false);
  });
  it('a new player gets easy plus facts; a typist gets words from the keys learned', () => {
    const p = newProfile('Ava', 'dino');
    const m = mathPool(p);
    expect(m.subject === 'math' && m.facts.length).toBeGreaterThan(4);
    const t = typingPool(p);
    expect(t.subject === 'typing' && t.words.length).toBeGreaterThan(8);
    // energy starts at 20 (30 with lots of friendship), and Big Heart adds 6
    expect(sparkFor(1, 'heart')).toBe(26);
    expect(sparkFor(30, 'speed')).toBe(30);
  });
});

describe('Adventure', () => {
  it('the map runs battle, battle, practice stop, ..., Champion; practice stops finish after a practice session', () => {
    const p = newProfile('Ava', 'dino');
    const a = advOf(p);
    expect(currentNode(a)!.id).toBe('meadow-0');
    a.nodes['meadow-0'] = 1; a.nodes['meadow-1'] = 1;
    expect(currentNode(a)!.kind).toBe('practice');
    expect(nodeOpen(a, NODE['meadow-3'])).toBe(false);
    reachStop(a, 'meadow-2');
    notePractice(p, 10);
    expect(practiceDone(a, 'meadow-2')).toBe(true);
    expect(collectStop(p, 'meadow-2')!.shells).toBe(20);
    expect(nodeOpen(a, NODE['meadow-3'])).toBe(true);
    a.settings.rule = 'open';
    // (stops 3 and 4 are battles on two routes, either first: the Champion waits for both)
    expect(nodeOpen(a, NODE['meadow-4'])).toBe(true);
    expect(nodeOpen(a, NODE['meadow-5'])).toBe(false);
    expect(nodesOf('sky').filter(n => n.kind === 'champion').map(n => GLIMMER[n.island === 'meadow' ? 'lanternfox' : n.island === 'treetops' ? 'bloomdrake' : 'skywhale'].rarity)).toEqual(['legendary', 'legendary', 'legendary']);
  });
  it('winning cheers the Glimmer onto your team, pays shells, and may drop an egg', () => {
    const p = newProfile('Ava', 'dino');
    const pl = mathPool(p);
    const f = foeFor(p, NODE['meadow-5'], pl, 5);
    expect(f.glimmer).toBe('lanternfox');
    const out = applyBattle(p, { node: 'meadow-5', subject: 'math', won: true, perfect: false, foe: f, ms: 120000, answers: 10, right: 9, answered: [{ f: { a: 3, b: 4, op: '+' }, ok: true, thinkMs: 1200 }], team: [], crystal: false, treasureNose: false, at: Date.now(), seed: 1 });
    expect(out.met).toMatchObject({ id: 'lanternfox', isNew: true });
    expect(out.islandDone).toBe('meadow');
    expect(out.egg).not.toBeNull();
    expect(out.shells).toBeGreaterThanOrEqual(62);
    expect(advOf(p).team[0]).toBe('lanternfox');
    expect(p.math!.facts['3+4'].seen).toBe(1);
    // a Champion win: the battle's friendship plus the Champion's (paced like practice)
    expect(p.pals.dino!.xp).toBe(BATTLE_FRIENDSHIP.win + BATTLE_FRIENDSHIP.champion);
  });
  it('eggs warm with practice and hatch; a second one of a kind becomes stardust', () => {
    const p = newProfile('Ava', 'dino');
    const a = advOf(p);
    a.incubator[0] = { id: 'e1', rarity: 'common', need: 20, have: 0, got: 0 };
    a.nest.push({ id: 'e2', rarity: 'common', need: 20, have: 0, got: 0 });
    expect(notePractice(p, 12)).toEqual([]);
    expect(notePractice(p, 12)).toEqual(['common']);
    const h = hatch(p, 0, 3)!;
    expect(h.isNew).toBe(true);
    expect(a.incubator[0]!.id).toBe('e2');
    for (const g of GLIMMERS.filter(g => g.rarity === 'common')) a.glimmers[g.id] = { level: 1, xp: 0, got: 0 };
    a.incubator[0]!.have = 20;
    const h2 = hatch(p, 0, 4)!;
    expect(h2.isNew).toBe(false);
    expect(a.glimmers[h2.id]!.xp + a.glimmers[h2.id]!.level).toBeGreaterThan(1);
  });
  it('the shop sells eggs for shells', () => {
    const p = newProfile('Ava', 'dino');
    const a = advOf(p);
    expect(buy(p, 'egg-common').ok).toBe(false);
    a.shells = 100;
    expect(buy(p, 'egg-common')).toMatchObject({ ok: true, where: 'incubator' });
    expect(a.shells).toBe(40);
  });
  it('Balanced: 10 free minutes, then practice earns play time; Practice first waits for the goal', () => {
    const p = newProfile('Ava', 'dino');
    const now = Date.now(), a = advOf(p);
    expect(playLeft(p, now)).toMatchObject({ open: true, left: 10 });
    a.day = { key: dayKey(now), ms: 10 * 60000, answers: 0, right: 0 };
    expect(playLeft(p, now).open).toBe(false);
    p.days[dayKey(now)] = { ms: 6 * 60000, runs: 2 };
    expect(playLeft(p, now)).toMatchObject({ open: true, left: 6 });
    a.settings.rule = 'practiceFirst';
    expect(playLeft(p, now).open).toBe(false);
    p.days[dayKey(now)].goal = true;
    expect(playLeft(p, now).open).toBe(true);
    a.settings.rule = 'open'; a.settings.capMin = 5;
    expect(playLeft(p, now).open).toBe(false);
  });
});

describe('putting a Glimmer on the team', () => {
  const mine = (...ids: GlimmerId[]) => { const a = advOf(newProfile('Mia', 'dino')); for (const id of ids) a.glimmers[id] = { level: 1, xp: 0, got: 1 }; return a; };
  it('fills a free place, and a full team has none', () => {
    const a = mine('puddlepup', 'sparkmoth', 'geodemole');
    expect(teamGap(a)).toBe(0);
    putOnTeam(a, 'puddlepup', 0);
    expect(teamGap(a)).toBe(1);
    putOnTeam(a, 'sparkmoth', 1);
    expect(teamGap(a)).toBe(-1);
  });
  it('swaps one out and keeps it, and never holds the same Glimmer twice', () => {
    const a = mine('puddlepup', 'sparkmoth', 'geodemole');
    a.team = ['puddlepup', 'sparkmoth'];
    putOnTeam(a, 'geodemole', 1);
    expect(a.team).toEqual(['puddlepup', 'geodemole']);
    expect(a.glimmers.sparkmoth).toBeTruthy();
    putOnTeam(a, 'geodemole', 0);
    expect(a.team).toEqual(['geodemole', null]);
  });
  it('a place holding a Glimmer you no longer have counts as free, and you can only add your own', () => {
    const a = mine('puddlepup');
    a.team = ['sparkmoth', 'puddlepup'];
    expect(teamGap(a)).toBe(0);
    putOnTeam(a, 'geodemole', 0);
    expect(a.team).toEqual(['sparkmoth', 'puddlepup']);
  });
});

describe('one reward system', () => {
  it('a battle checks stickers too: friendship won in a battle earns its sticker straight away', async () => {
    const { STICKER } = await import('../engine/stickers');
    const p = newProfile('Ava', 'dino');
    const pal = buddyPal(p); pal.xp = 1000; pal.level = 4;
    const out = applyBattle(p, { node: 'meadow-1', subject: 'math', won: true, perfect: false, foe: foeFor(p, NODE['meadow-1'], mathPool(p), 3), ms: 60000, answers: 6, right: 6, answered: [], team: [], crystal: false, treasureNose: false, at: Date.now(), seed: 3 });
    expect(out.stickers.map(s => s.id)).toContain('level-5');
    expect(STICKER['level-5']).toBeTruthy();
  });
});

describe('practice what you missed', () => {
  it('a fact missed in a battle comes back in the next hands until it is answered right', () => {
    const facts = [] as { f: { a: number; b: number }; stage: number }[];
    for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) facts.push({ f: { a, b }, stage: 2 });
    const pool: Pool = { subject: 'math', facts, open: false };
    const foe: Foe = { glimmer: 'puddlepup', rarity: 'common', champion: false, element: 'tide', grump: 500, max: 500, hit: 0 };
    const b = newBattle({ pool, seed: 4, sparkMax: 99, role: 'heart', gear: null, team: [], foe });
    b.frozen = true;
    const missed = b.cards[0];
    play(b, missed.id, { ok: false, value: 0, thinkMs: 2000, fact: missed.fact });
    b.phase = 'pick'; b.block = null; deal(b);
    const back = b.cards.find(c => c.again);
    expect(back?.fact).toEqual(missed.fact);
    play(b, back!.id, { ok: true, value: answerOf(back!.fact!), thinkMs: 2000, fact: back!.fact });
    b.phase = 'pick'; b.block = null; deal(b);
    expect(b.cards.some(c => c.again)).toBe(false);
  });
});

describe('Fraction Falls', () => {
  it('is a world of its own: its stops run in order by themselves, and the Sky Islands are unchanged', () => {
    const p = newProfile('Ava', 'dino'), a = advOf(p);
    expect(nodesOf('sky').map(n => n.id)).toEqual(['meadow', 'treetops', 'bay'].flatMap(i => [0, 1, 2, 3, 4, 5].map(k => `${i}-${k}`)));
    expect(nodesOf('falls').map(n => n.kind)).toEqual(['battle', 'battle', 'practice', 'battle', 'battle', 'champion']);
    expect(currentNode(a)!.id).toBe('meadow-0');
    expect(currentNode(a, 'falls')!.id).toBe('falls-0');
    expect(nodeOpen(a, NODE['falls-0'])).toBe(true);
    expect(nodeOpen(a, NODE['falls-1'])).toBe(false);
    a.nodes['falls-0'] = 1;
    expect(nodeOpen(a, NODE['falls-1'])).toBe(true);
    expect(currentNode(a)!.id).toBe('meadow-0');
    // finishing the Sky Islands doesn't wander into another world
    for (const n of nodesOf('sky')) a.nodes[n.id] = 1;
    expect(currentNode(a)).toBe(null);
  });
  it('opens once fractions are started, and every battle card there is a fraction', () => {
    const p = newProfile('Ava', 'dino');
    expect(worldOpen(p, 'sky')).toBe(true);
    expect(worldOpen(p, 'falls')).toBe(false);
    const m = (p.math = mathOf(p));
    noteSkillAnswers(m, [{ key: 'fr-name:2', ok: true, thinkMs: 3000 }, { key: 'fr-name:4', ok: true, thinkMs: 3000 }], Date.now());
    expect(worldOpen(p, 'falls')).toBe(true);
    const pl = mathPool(p, 'fractions');
    expect(pl.subject === 'math' && pl.mix).toBe(1);
    expect(pl.subject === 'math' && pl.skills!.every(s => s.key.startsWith('fr-'))).toBe(true);
    const b = newBattle({ pool: pl, seed: 4, sparkMax: 20, role: 'heart', gear: null, team: [], foe: { ...foeFor(p, NODE['falls-0'], pl, 4), hit: 3 } });
    expect(b.cards.every(c => c.item?.skill.startsWith('fr-'))).toBe(true);
  });
  it('its Grumbles send waterfall spray and live there; the Champion is the Thundercloud Lamb', () => {
    const p = newProfile('Ava', 'dino'), pl = mathPool(p, 'fractions');
    const champ = foeFor(p, NODE['falls-5'], pl, 1);
    expect(champ).toMatchObject({ glimmer: 'stormlamb', champion: true, mischief: { kind: 'rain' } });
    const seen = new Set<string>();
    for (let s = 1; s <= 200; s++) { const f = foeFor(p, NODE['falls-1'], pl, s); expect(f.mischief?.name).toMatch(/spray/); seen.add(f.glimmer); }
    expect(['bubbleocto', 'rainbootfrog', 'frostjelly'].every(id => seen.has(id))).toBe(true);
    // the sky islands keep their own mischief
    expect(foeFor(p, NODE['meadow-1'], pl, 3).mischief).toBeUndefined();
  });
});

describe('Counting Caves', () => {
  it('is a world of its own with six stops, opens once place value is started, and every card is place value', () => {
    const p = newProfile('Ava', 'dino'), a = advOf(p);
    expect(nodesOf('caves').map(n => n.kind)).toEqual(['battle', 'battle', 'practice', 'battle', 'battle', 'champion']);
    expect(currentNode(a, 'caves')!.id).toBe('caves-0');
    expect(worldOpen(p, 'caves')).toBe(false);
    const m = (p.math = mathOf(p));
    noteSkillAnswers(m, [{ key: 'pv-tens:read', ok: true, thinkMs: 3000 }, { key: 'pv-count:next', ok: true, thinkMs: 2000 }], Date.now());
    expect(worldOpen(p, 'caves')).toBe(true);
    const pl = mathPool(p, 'place');
    expect(pl.subject === 'math' && pl.skills!.every(s => s.key.startsWith('pv-'))).toBe(true);
    const b = newBattle({ pool: pl, seed: 6, sparkMax: 20, role: 'heart', gear: null, team: [], foe: { ...foeFor(p, NODE['caves-0'], pl, 6), hit: 3 } });
    expect(b.cards.every(c => c.item?.skill.startsWith('pv-'))).toBe(true);
  });
  it('its Grumbles shake crystals loose and live there; the Champion is the Prism Hornback', () => {
    const p = newProfile('Ava', 'dino'), pl = mathPool(p, 'place');
    expect(foeFor(p, NODE['caves-5'], pl, 1)).toMatchObject({ glimmer: 'prismhorn', champion: true, mischief: { kind: 'pebbles' } });
    const seen = new Set<string>();
    for (let s = 1; s <= 200; s++) { const f = foeFor(p, NODE['caves-1'], pl, s); expect(f.mischief?.name).toMatch(/crystals/); seen.add(f.glimmer); }
    expect(['geodemole', 'rollodillo', 'potgolem'].every(id => seen.has(id))).toBe(true);
  });
});

describe('Below Zero Caves', () => {
  it('is a world of its own with six stops, opens once negative numbers are started, and every card is from the area', () => {
    const p = newProfile('Ava', 'dino'), a = advOf(p);
    expect(nodesOf('frost').map(n => n.kind)).toEqual(['battle', 'battle', 'practice', 'battle', 'battle', 'champion']);
    expect(currentNode(a, 'frost')!.id).toBe('frost-0');
    expect(worldOpen(p, 'frost')).toBe(false);
    const m = (p.math = mathOf(p));
    noteSkillAnswers(m, [{ key: 'in-real:temp', ok: true, thinkMs: 3000 }, { key: 'in-plot:plot', ok: true, thinkMs: 4000 }], Date.now());
    expect(worldOpen(p, 'frost')).toBe(true);
    const pl = mathPool(p, 'integers');
    expect(pl.subject === 'math' && pl.skills!.length > 0 && pl.skills!.every(s => s.key.startsWith('in-'))).toBe(true);
    for (const seed of [6, 7, 8, 9]) {
      const b = newBattle({ pool: pl, seed, sparkMax: 20, role: 'heart', gear: null, team: [], foe: { ...foeFor(p, NODE['frost-0'], pl, seed), hit: 3 } });
      expect(b.cards.length).toBeGreaterThan(0);
      expect(b.cards.every(c => c.item?.skill.startsWith('in-'))).toBe(true);
    }
  });
  it('a world started from nothing still deals its first lesson\'s cards', () => {
    const p = newProfile('Ava', 'dino'), pl = mathPool(p, 'integers');
    expect(pl.subject === 'math' && pl.skills!.every(s => s.key.startsWith('in-plot:'))).toBe(true);
  });
  it('icicles fall when its Grumbles sulk, the frosty Glimmers live there, and the Comet Cat is its Champion', () => {
    const p = newProfile('Ava', 'dino'), pl = mathPool(p, 'integers');
    expect(foeFor(p, NODE['frost-5'], pl, 1)).toMatchObject({ glimmer: 'cometcat', champion: true, mischief: { kind: 'snow' } });
    const seen = new Set<string>();
    for (let s = 1; s <= 200; s++) { const f = foeFor(p, NODE['frost-1'], pl, s); expect(f.mischief?.name).toMatch(/icicle/); seen.add(f.glimmer); }
    expect(['snowseal', 'mittenyeti', 'frostjelly'].every(id => seen.has(id))).toBe(true);
  });
  it('its own Glimmers are natives of the world, on their way until their models come (never in a random roll)', async () => {
    const { FROST_GLIMMERS } = await import('./frostGlimmers');
    expect(FROST_GLIMMERS.length).toBe(4);
    expect(FROST_GLIMMERS.filter(g => g.champion)).toEqual([expect.objectContaining({ id: 'auroranarwhal', champion: 'frost' })]);
    for (const g of FROST_GLIMMERS) {
      expect(g).toMatchObject({ source: 'native', world: 'frost', pending: true });
      expect(GLIMMERS.some(x => x.id === g.id)).toBe(false); expect(GLIMMER[g.id]).toBe(g); expect(g.power.text(1).length).toBeGreaterThan(10);
    }
  });
});
