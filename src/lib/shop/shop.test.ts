import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { migrate, newProfile, type Profile } from '../engine/profile';
import { advOf, advView, SHOP as CARE_SHOP } from '../adventure/state';
import { CATALOG } from '../adventure/wardrobe';
import { ITEM, ITEMS, KINDS } from '../island/catalog';
import { PAINTS, SPECIAL } from '../island/blocks';
import { SNACKS } from '../island/play';
import { buyAndPlace, freeSpot, growthOf, islandOf, islandView, ownedOf, storedOf } from '../island/save';
import { ledgerNote, ledgerSnap } from '../engine/ledger';
import { placeOf } from '../path/rules';
import { SECTIONS, SHOP_ENTRY, SHOP_LIST, buyShop, careHave, careText, eggsHeld, groupsOf, haveOf, islandEntry, islandShelf, paintEntry, sectionOf } from './shop';

const rich = () => { const p = newProfile('Ava', 'dino'); advOf(p).shells = 20000; return p; };
const src = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');

describe('one Shop', () => {
  it('has three sections, and no thing is in two of them (or twice in one)', () => {
    expect(SECTIONS.map(s => s.id)).toEqual(['wear', 'island', 'care']);
    for (const s of SECTIONS) expect(sectionOf(s.id).length).toBeGreaterThan(0);
    // every key once
    expect(new Set(SHOP_LIST.map(e => e.key)).size).toBe(SHOP_LIST.length);
    // and every thing's own id in one section only
    const seen = new Map<string, string>();
    for (const e of SHOP_LIST) {
      const id = e.group === 'paint' ? `paint-${e.id}` : e.id;
      expect(seen.get(id), `${e.key} is also in ${seen.get(id)}`).toBeUndefined();
      seen.set(id, e.key);
    }
  });
  it('sells everything there is to wear, everything for the island, the special paints, the eggs and the treats', () => {
    expect(sectionOf('wear').map(e => e.id).sort()).toEqual(CATALOG.map(c => c.id).sort());
    expect(sectionOf('island').filter(e => e.group !== 'paint').map(e => e.id).sort()).toEqual(ITEMS.filter(i => !i.gift).map(i => i.id).sort());
    expect(sectionOf('island').filter(e => e.group === 'paint').map(e => Number(e.id)).sort()).toEqual(SPECIAL.map(p => p.id).sort());
    expect(sectionOf('care').map(e => e.id)).toEqual([...CARE_SHOP.map(s => s.id), 'island-treats']);
    // gifts and keepsakes are never sold
    expect(SHOP_LIST.some(e => e.section === 'island' && ITEM[e.id]?.gift)).toBe(false);
    expect(groupsOf('island')).toEqual([...KINDS.map(k => k.id), 'paint']);
    expect(groupsOf('care')).toEqual(['eggs', 'treats']);
  });
  it('one set of prices: the island\'s tray shows the Shop\'s Island section, thing for thing, price for price', () => {
    for (const k of KINDS) {
      const tray = islandShelf(k.id);
      expect(tray).toEqual(sectionOf('island').filter(e => e.group === k.id));
      for (const e of tray) { expect(e.price).toBe(ITEM[e.id].price); expect(islandEntry(e.id)).toBe(e); }
    }
    for (const pd of SPECIAL) expect(paintEntry(pd.id).price).toBe(pd.special!.price);
    expect(SHOP_ENTRY['care:island-treats'].price).toBe(SNACKS.price);
    // buying on the island (put straight out) costs what the Shop charges
    for (const id of ['cottage', 'pond', 'flowers', 'balloon']) {
      const a = rich(), b = rich();
      expect(buyShop(a, `island:${id}`).ok).toBe(true);
      const s = islandOf(b), spot = freeSpot(s, growthOf(b).r, ITEM[id], 0)!;
      expect(buyAndPlace(b, id, spot.x, spot.z, 0).ok).toBe(true);
      expect(advView(a).shells).toBe(advView(b).shells);
      expect(advView(a).shells).toBe(20000 - ITEM[id].price);
    }
  });
  it('no second shop: the Wardrobe and My Sky Island buy only through the Shop\'s catalogue', () => {
    const closet = src('../screens/Closet.svelte'), isle = src('../screens/SkyIsland.svelte');
    // eggs, the Glimmer treat and island treats are the Care section's alone
    for (const f of [closet, isle]) { expect(f).not.toMatch(/buySnacks|SNACKS\.price|\bSHOP\b|EGG_ODDS/); expect(f).not.toMatch(/import[^;]*\bbuy\b[^;]*adventure\/state/); }
    expect(closet).toMatch(/buyShop\(/);
    // the tray's things come from the Shop's Island section
    expect(isle).toMatch(/islandShelf\(kind\)/);
    expect(isle).not.toMatch(/\.shells -= /);
  });
  it('buys each kind of thing, keeps it where the save always kept it, and won\'t sell what you can only have once', () => {
    const p = rich();
    advOf(p).team = ['puddlepup', null, null] as never;
    advOf(p).glimmers = { puddlepup: { level: 2, xp: 0, got: 1 } } as never;
    let shells = advView(p).shells;
    const spend = (key: string) => { expect(buyShop(p, key).ok, key).toBe(true); shells -= SHOP_ENTRY[key].price!; expect(advView(p).shells).toBe(shells); };
    spend('wear:vibe_sparkles'); expect(haveOf(p, 'wear:vibe_sparkles')).toBe(1);
    expect(buyShop(p, 'wear:vibe_sparkles').ok).toBe(false);
    spend('island:cottage'); expect(storedOf(islandView(p), 'cottage')).toBe(1); expect(haveOf(p, 'island:cottage')).toBe(2); // and the starter cottage
    spend('island:cottage'); expect(storedOf(islandView(p), 'cottage')).toBe(2);
    spend('paint:21'); expect(islandView(p).mats).toContain(21); expect(buyShop(p, 'paint:21').ok).toBe(false);
    spend('care:island-treats'); expect(islandView(p).treats).toBe(SNACKS.n);
    spend('care:egg-common'); expect([...advView(p).incubator, ...advView(p).nest].filter(Boolean).length).toBe(1);
    spend('care:treat'); expect(advView(p).glimmers.puddlepup!.level).toBe(3);
    // not for sale: a friendship gift, or more than you have
    expect(buyShop(p, 'wear:gold_crown').ok).toBe(false);
    const poor = newProfile('Bo', 'dino');
    expect(buyShop(poor, 'island:balloon')).toEqual({ ok: false, why: `You need ${ITEM.balloon.price} more shells.` });
  });
  it('an old save keeps everything it bought and owned', () => {
    // an older save: gear kept per buddy, the island before blocks, paints, treats and friends came along
    const old = {
      version: 1, activeId: 'old1',
      profiles: [{
        id: 'old1', name: 'Mia', buddy: 'cat', createdAt: 1, settings: {}, lessons: {}, keys: {}, totals: {}, days: {}, badges: {}, medals: {}, unlocked: [], history: [],
        pals: { cat: { xp: 4000 } },
        adventure: {
          shells: 75,
          gear: { cat: { owned: ['bubble_wand', 'spring_shoes'], on: { hand: 'bubble_wand' } }, dino: { owned: ['hero_cape'], on: {} } },
          glimmers: { puddlepup: { level: 3, xp: 0, got: 5 } }, team: ['puddlepup', null, null],
        },
        island: {
          owned: { pond: 1, swing: 2, lamp: 1 }, placed: { a1: { item: 'pond', x: 2, z: 2, rot: 0, at: 9 }, a2: { item: 'swing', x: -2, z: 1, rot: 1, at: 9 } },
          out: null, visits: [], postcards: [], shells: { day: '', n: 0 }, hearts: [], seenHearts: 0, started: true, grown: 0,
          mats: [21], treats: 4,
        },
      }],
    };
    const p: Profile = migrate(JSON.parse(JSON.stringify(old))).profiles[0];
    expect(haveOf(p, 'wear:bubble_wand')).toBe(1);
    expect(haveOf(p, 'wear:spring_shoes')).toBe(1);
    expect(haveOf(p, 'wear:hero_cape')).toBe(1);
    expect(haveOf(p, 'island:pond')).toBe(1);
    expect(haveOf(p, 'island:swing')).toBe(2);
    expect(storedOf(islandView(p), 'swing')).toBe(1);
    expect(haveOf(p, 'island:lamp')).toBe(1);
    expect(haveOf(p, 'island:cottage')).toBe(1); // the starter kit
    expect(haveOf(p, 'paint:21')).toBe(1);
    expect(haveOf(p, 'care:island-treats')).toBe(4);
    expect(advView(p).shells).toBe(75);
    // and buying something new keeps the rest
    advOf(p).shells = 500;
    expect(buyShop(p, 'island:lamp').ok).toBe(true);
    expect(ownedOf(islandView(p), 'lamp')).toBe(2);
    expect(ownedOf(islandView(p), 'swing')).toBe(2);
    expect(islandView(p).treats).toBe(4);
    expect(haveOf(p, 'wear:hero_cape')).toBe(1);
    expect(islandView(p).placed.a2.item).toBe('swing');
  });
  it('spending goes in "What I earned", with what it bought; island time and Shop time stay apart', () => {
    const p = rich();
    let snap = ledgerSnap(p);
    buyShop(p, 'island:pond');
    ledgerNote(p, snap, { from: 'Shop', bought: ['island:pond'] }, 1000);
    snap = ledgerSnap(p);
    buyShop(p, 'island:lamp');
    ledgerNote(p, snap, { from: 'Shop', bought: ['island:lamp'] }, 2000);
    expect(p.ledger).toHaveLength(1);
    expect(p.ledger![0]).toMatchObject({ from: 'Shop', shells: -(ITEM.pond.price + ITEM.lamp.price), bought: ['island:pond', 'island:lamp'] });
    // a "bought" with nothing spent (it didn't go through) writes nothing
    snap = ledgerSnap(p);
    expect(ledgerNote(p, snap, { from: 'My Sky Island', bought: ['island:pond'] }, 500_000)).toBeNull();
    // the island's tray counts as island time, the Shop as Wardrobe and Shop time
    expect(placeOf('island', 'outfits')).toBe('island');
    expect(placeOf('shop', 'outfits')).toBe('closet');
  });
  it('the Glimmers section (eggs and treats) says what each thing gives, how many you have, and where they go', () => {
    // a child can tell what it is; its id stays `care`, so old "What I earned" lines still find their things
    expect(SECTIONS.find(s => s.id === 'care')?.name).toBe('Glimmers');
    expect(SHOP_ENTRY['care:egg-common'].section).toBe('care');
    const p = rich();
    const uncommon = SHOP_ENTRY['care:egg-uncommon'], common = SHOP_ENTRY['care:egg-common'];
    expect(careText(common, null).gets).toBe('Hatches a Common Glimmer');
    expect(careText(uncommon, null).gets).toBe('Hatches an Uncommon Glimmer');
    expect(careText(common, null).line).toMatch(/after \d+ right answers in practice\.$/);
    expect(careHave(p, common)).toMatch(/warm nest/);
    // three warm nests fill first, the fourth waits; a different rarity doesn't count
    for (let i = 0; i < 4; i++) expect(buyShop(p, 'care:egg-common').ok).toBe(true);
    expect(buyShop(p, 'care:egg-rare').ok).toBe(true);
    expect(eggsHeld(p, 'common')).toEqual({ warm: 3, waiting: 1 });
    expect(haveOf(p, 'care:egg-common')).toBe(4);
    expect(haveOf(p, 'care:egg-rare')).toBe(1);
    expect(careHave(p, common)).toBe('You have 4: 3 in a warm nest, 1 waiting.');
    // a Milestone or other special egg is its own thing, not a plain one from the Shop
    advOf(p).nest.push({ id: 'x', rarity: 'common', need: 1, have: 0, got: 1, kind: 'milestone', glimmer: 'puddlepup' } as never);
    expect(eggsHeld(p, 'common').waiting).toBe(1);
    // the treats
    const treat = SHOP_ENTRY['care:treat'], bag = SHOP_ENTRY['care:island-treats'];
    expect(careText(treat, null).then).toMatch(/Meet a Glimmer/);
    expect(careText(treat, 'puddlepup').line).toMatch(/Puddle Pup/);
    expect(careHave(p, bag)).toMatch(/treat bag on My Sky Island/);
    expect(buyShop(p, bag.key).ok).toBe(true);
    expect(careHave(p, bag)).toBe(`You have ${SNACKS.n} in your treat bag on My Sky Island.`);
  });
  it('all three sections are one page: the tiles, cards and buy card are the same size in each', () => {
    const rule = (f: string, sel: string) => f.split('\n').find(l => l.trim().startsWith(`${sel} {`))?.trim();
    const wear = src('../screens/Closet.svelte'), shelf = src('./ShopShelf.svelte');
    for (const sel of ['.body', '.rail', '.rb', '.rpic', '.it', '.sgrid', '.tryon', '.it b', '.sidehead', '.foot', '.whochip', '.stagebox'])
      expect(rule(shelf, sel), sel).toBe(rule(wear, sel));
    // no second layout: the stage is the Wardrobe's own turntable on the game's world
    expect(shelf).toMatch(/<Turntable /);
    expect(shelf).toMatch(/ShowScene\.create\(/);
  });
  it('every island thing and paint the island can place is in the Shop (nothing sold only on the island)', () => {
    for (const i of ITEMS) if (!i.gift) expect(islandEntry(i.id), i.id).toBeTruthy();
    for (const pd of PAINTS) if (pd.special) expect(paintEntry(pd.id), pd.name).toBeTruthy();
  });
});
