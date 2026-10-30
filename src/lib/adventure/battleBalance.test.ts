// How risky a battle is: 500 seeded battles per case, played by a pretend child against the real battle
// code, counting how often the buddy runs out of energy. The child gets most cards right (85%), picks any
// card, takes the Finale when it's ready, and blocks every counterattack, none of them, or about half.
// BALANCE_REPORT=1 npx vitest run src/lib/adventure/battleBalance.test.ts prints the whole table.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../engine/rng';
import { answerOf, type Fact } from '../math/facts';
import { newBattle, play, block, finale, grumpFor, openFact, sparkFor, hitFor, typePower, FINALE_AT, type Pool, type Foe, type Member, type Battle } from './battle';
import type { GearKind, RoleId } from './glimmers';
import type { KitKind } from './gear';

const facts = (make: (push: (f: Fact) => void) => void): Pool => { const fs: { f: Fact; stage: number }[] = []; make(f => fs.push({ f, stage: (f.a + f.b) % 3 + 1 })); return { subject: 'math', open: false, facts: fs }; };
/** a beginner's plus facts (answers 2 to 11), the times tables (answers up to 100), a typist's words */
const plus = facts(push => { for (let a = 1; a <= 6; a++) for (let b = 1; b <= 5; b++) push({ a, b, op: '+' }); });
const times = facts(push => { for (let a = 2; a <= 10; a++) for (let b = 1; b <= 10; b++) push({ a, b }); });
const typing: Pool = { subject: 'typing', words: ['at', 'sad', 'dad', 'lad', 'fall', 'salad', 'flask', 'glass', 'jar', 'hall', 'ask', 'gas', 'lass', 'alfalfa', 'dash', 'flag', 'had', 'has'] };
const POOLS = { plus, times, typing };
const ROLES: RoleId[] = ['speed', 'trick', 'heart', 'steady', 'helper', 'builder'];
const LEVELS = [1, 26];

type Case = {
  pool?: Pool; role?: RoleId; level?: number; champion?: boolean; tier?: number;
  /** how often a counterattack is blocked: 1 always, 0 never */
  blocks: number;
  /** how often a card is answered right */
  cards?: number;
  team?: Member[]; gear?: GearKind | null; kit?: KitKind[];
  /** the energy and hit to use instead of the game's (to measure the old numbers) */
  old?: boolean;
  /** typing: the wrong keys pressed in a word (`ok`: one the child knows well); a careful typist by default */
  slips?: (kid: () => number, ok: boolean) => number;
};
/** how the pretend child types: a careful typist (no slips on most words, two on the shaky ones), one
 *  who slips a little on every word, and one who mashes the keys (three to eight wrong keys a word) */
const SLIPS = {
  usual: (_: () => number, ok: boolean) => (ok ? 0 : 2),
  careful: (kid: () => number) => (kid() < 0.6 ? 0 : 1),
  mash: (kid: () => number) => 3 + Math.floor(kid() * 6),
};
// the numbers before round 9: energy grew with friendship (12 + level, up to 30; Big Heart 6 more), a
// counterattack took 2 (1 more each later island), a Champion's 4, and every one the same
const OLD = { energy: (level: number, role: RoleId) => 12 + Math.min(18, Math.max(1, level)) + (role === 'heart' ? 6 : 0), hit: (champion: boolean, tier: number) => (champion ? 4 : 2) + tier };

/** One battle, start to finish: true when it's lost. */
function lostOne(c: Case, seed: number): boolean { return playOne(c, seed).phase === 'lost'; }
/** One battle, start to finish (or 400 moves), played by the pretend child. */
function playOne(c: Case, seed: number): Battle {
  const pool = c.pool ?? plus, role = c.role ?? 'speed', level = c.level ?? 10, champion = !!c.champion, tier = c.tier ?? 0;
  const kid = mulberry32(seed * 7919 + 17);
  const energy = c.old ? OLD.energy(level, role) : sparkFor(level, role);
  const grump = grumpFor(pool, champion);
  const hit = c.old ? OLD.hit(champion, tier) : hitFor({ champion, tier, level, subject: pool.subject });
  const foe: Foe = { glimmer: 'puddlepup', rarity: 'common', champion, element: 'tide', grump, max: grump, hit };
  const b: Battle = newBattle({ pool, seed, sparkMax: energy, role, gear: c.gear ?? null, team: c.team ?? [], foe, kit: c.kit });
  for (let n = 0; n < 400 && (b.phase === 'pick' || b.phase === 'block'); n++) {
    // (the old counters were all the same size)
    if (c.old) b.bold = 0;
    if (b.phase === 'block') { block(b, kid() < c.blocks, 2000); continue; }
    if (b.finale >= FINALE_AT) { finale(b); continue; }
    const card = b.cards[Math.floor(kid() * b.cards.length)];
    const ok = kid() < (c.cards ?? 0.85);
    const think = 2500 + kid() * 4000;
    // typing: every word is finished; its slips take some of its power (enough of them, all of it)
    if (b.subject === 'typing') { play(b, card.id, { ok: true, value: card.word!.length, slips: (c.slips ?? SLIPS.usual)(kid, ok), thinkMs: think }); continue; }
    const f = card.fact ?? (card.open ? openFact(card.open, 1 + Math.floor(kid() * 9)) : undefined);
    play(b, card.id, f ? { ok, value: ok ? answerOf(f) : answerOf(f) + 1, thinkMs: think, fact: f } : { ok: false, value: 0, thinkMs: think });
  }
  return b;
}
/** The share of 500 seeded battles lost. */
function lossRate(c: Case, n = 500): number {
  let lost = 0;
  for (let s = 1; s <= n; s++) if (lostOne(c, s)) lost++;
  return lost / n;
}
const avg = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
/** every buddy kind at a new and a well-loved friendship level (or just the one given) */
const everyone = (c: Case, levels = LEVELS) => ROLES.flatMap(role => levels.map(level => lossRate({ ...c, role, level })));
const PLAYGROUND: KitKind[] = ['bubble', 'cape', 'spring', 'playset'];
const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4);

describe('battle risk (500 seeded battles a case)', () => {
  it('blocking every counterattack never loses a battle', () => {
    // (nothing lands when every one is blocked, so one friendship level is enough to show it)
    for (const pool of Object.values(POOLS)) for (const champion of [false, true]) expect(Math.max(...everyone({ pool, champion, blocks: 1 }, [26]))).toBe(0);
  });
  it('missing every counterattack loses most battles: at least 7 in 10, for every kind of buddy', () => {
    for (const pool of Object.values(POOLS)) for (const champion of [false, true]) expect(Math.min(...everyone({ pool, champion, blocks: 0 }))).toBeGreaterThanOrEqual(0.7);
    expect(Math.min(...everyone({ tier: 2, blocks: 0 }))).toBeGreaterThanOrEqual(0.7);
  });
  it('missing about half loses some: 2 to 4 in 10 normal battles, Champions a bit more', () => {
    for (const pool of Object.values(POOLS)) {
      const normal = everyone({ pool, blocks: 0.5 }), champ = everyone({ pool, champion: true, blocks: 0.5 });
      expect(avg(normal)).toBeGreaterThanOrEqual(0.2); expect(avg(normal)).toBeLessThanOrEqual(0.4);
      // no buddy is far off: Big Heart, Steady and Helper are a little safer, as they should be
      expect(Math.min(...normal)).toBeGreaterThanOrEqual(0.1); expect(Math.max(...normal)).toBeLessThanOrEqual(0.5);
      expect(avg(champ)).toBeGreaterThan(avg(normal)); expect(avg(champ)).toBeLessThanOrEqual(0.5);
    }
    // the later islands bite a little harder, never much
    expect(avg(everyone({ tier: 2, blocks: 0.5 }))).toBeLessThanOrEqual(0.45);
  });
  it('gear that adds energy or stops a hit helps, but none of it makes missing every block safe', () => {
    const base = { blocks: 0.5 }, none = { blocks: 0 };
    for (const kit of [['spring'], ['cape'], ['bubble'], ['cloudstep'], ['skyset'], PLAYGROUND] as KitKind[][]) {
      expect(lossRate({ ...base, kit }), kit.join('+')).toBeLessThan(lossRate(base));
      // a whole set on the safest buddies still loses when nothing is blocked
      for (const role of ['heart', 'steady'] as RoleId[]) expect(lossRate({ ...none, kit, role, level: 26 }), `${kit.join('+')} ${role}`).toBeGreaterThanOrEqual(0.3);
    }
    expect(lossRate({ ...base, gear: 'hover' })).toBeLessThan(lossRate(base));
  });
  it('helpers that heal or shield help too, and the strongest of them can still lose when nothing is blocked', () => {
    const team = (id: Member['id']): Member[] => [{ id, level: 20, evolved: true }];
    for (const id of ['sproutbun', 'skywhale', 'bloomdrake', 'whalecalf', 'pinepango', 'bubbleocto', 'frostowl'] as Member['id'][]) {
      expect(lossRate({ blocks: 0.5, team: [{ id, level: 1 }] }), id).toBeLessThanOrEqual(lossRate({ blocks: 0.5 }));
      expect(lossRate({ blocks: 0, team: team(id) }), id).toBeGreaterThanOrEqual(0.4);
    }
  });

  it('a pile of shields (two helpers, the Playground set, Hover, a Steady buddy) still loses when nothing is blocked', () => {
    const fort: Omit<Case, 'blocks'> = { role: 'steady', level: 26, team: [{ id: 'pinepango', level: 20, evolved: true }, { id: 'bubbleocto', level: 20, evolved: true }], kit: PLAYGROUND, gear: 'hover' };
    const heal: Omit<Case, 'blocks'> = { role: 'heart', level: 26, team: [{ id: 'skywhale', level: 20, evolved: true }, { id: 'sproutbun', level: 20, evolved: true }], kit: PLAYGROUND };
    for (const c of [fort, heal]) expect(lossRate({ ...c, blocks: 1 })).toBe(0);
    expect(lossRate({ ...fort, blocks: 0 })).toBeGreaterThanOrEqual(0.4);
    // (the healers' pile: grown-up Sky Whale and Sprout Bun, the Playground set, Big Heart)
    expect(lossRate({ ...heal, blocks: 0 })).toBeGreaterThanOrEqual(0.25);
  });

  it('typing slips lower a word\'s power: none is full, one on a long word costs a little, a few on a short one leave nothing', () => {
    expect(typePower(3, 0)).toBe(1);
    expect(typePower(7, 1)).toBeGreaterThanOrEqual(0.8);
    expect(typePower(3, 1)).toBe(0.75);
    expect(typePower(3, 2)).toBe(0.5);
    expect(typePower(3, 4)).toBe(0);
    expect(typePower(9, 6)).toBe(0);
    for (let len = 2; len <= 10; len++) for (let s = 0; s < 8; s++) expect(typePower(len, s + 1)).toBeLessThanOrEqual(typePower(len, s));
  });
  it('a careful typist still wins comfortably; one who mashes the keys does little', () => {
    // a careful typist slips once on some words and blocks most counterattacks (typing blocks need no slips)
    const careful = everyone({ pool: typing, slips: SLIPS.careful, blocks: 0.85 });
    expect(Math.max(...careful)).toBeLessThanOrEqual(0.1);
    // even blocking only half, as safe as the usual player
    expect(avg(everyone({ pool: typing, slips: SLIPS.careful, blocks: 0.5 }))).toBeLessThanOrEqual(avg(everyone({ pool: typing, blocks: 0.5 })) + 0.02);
    // mashing: hardly any cheer per word, and nearly every battle lost (its blocks mostly miss too)
    const cheer = (slips: Case['slips'], blocks: number) => { let words = 0, cheer = 0; for (let s = 1; s <= 200; s++) { const b = playOne({ pool: typing, slips, blocks }, s); words += b.stats.answers; cheer += b.stats.cheer; } return cheer / Math.max(1, words); };
    const calm = cheer(SLIPS.careful, 0.85), mash = cheer(SLIPS.mash, 0.2);
    expect(mash).toBeLessThanOrEqual(calm * 0.15);
    expect(avg(everyone({ pool: typing, slips: SLIPS.mash, blocks: 0.2 }))).toBeGreaterThanOrEqual(0.95);
    if (process.env.BALANCE_REPORT) console.log({ careful: careful.map(pct).join(' '), calmCheerPerWord: calm.toFixed(2), mashCheerPerWord: mash.toFixed(2) });
  });

  it.runIf(process.env.BALANCE_REPORT)('report', () => {
    const rows: string[] = ['case                                         | all blocked | none blocked | half blocked'];
    const line = (name: string, c: Omit<Case, 'blocks'>) => rows.push(`${name.padEnd(45)}|${[1, 0, 0.5].map(k => pct(lossRate({ ...c, blocks: k })).padStart(9).padEnd(13)).join('|')}`);
    for (const old of [true, false]) {
      rows.push(old ? '--- before ---' : '--- after ---');
      for (const champion of [false, true]) for (const [pn, pool] of Object.entries(POOLS)) for (const level of [1, 10, 26]) for (const role of ['speed', 'heart'] as RoleId[])
        line(`${champion ? 'Champion' : 'normal'} ${pn} ${role} level ${level}`, { old, pool, champion, role, level });
    }
    rows.push('--- after: gear and helpers (Speedster, level 10, plus facts) ---');
    line('nothing', {});
    for (const kit of [['spring'], ['cape'], ['bubble'], ['cloudstep'], PLAYGROUND] as KitKind[][]) line(kit.join(' + '), { kit });
    line('Playground set, Big Heart, level 26', { kit: PLAYGROUND, role: 'heart', level: 26 });
    for (const id of ['sproutbun', 'skywhale', 'pinepango', 'bubbleocto'] as Member['id'][]) line(`${id} level 20 grown up`, { team: [{ id, level: 20, evolved: true }] });
    line('everything: Heart, Sky Whale + Sprout, Playground', { role: 'heart', level: 26, team: [{ id: 'skywhale', level: 20, evolved: true }, { id: 'sproutbun', level: 20, evolved: true }], kit: PLAYGROUND });
    line('everything: Steady, Pinecone + Octopus, Playground, Hover', { role: 'steady', level: 26, team: [{ id: 'pinepango', level: 20, evolved: true }, { id: 'bubbleocto', level: 20, evolved: true }], kit: PLAYGROUND, gear: 'hover' });
    for (const cards of [0.6, 0.75, 0.95]) line(`cards right ${cards * 100}%`, { cards });
    console.log(rows.join('\n'));
  }, 600000);
});
