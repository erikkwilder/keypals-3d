import { describe, expect, it } from 'vitest';
import { migrate, newProfile, bookOf, buddyPal } from './profile';
import { ledgerNote, ledgerSnap, ledgerWhere, LEDGER_CAP } from './ledger';
import { mergeProfile } from '../state/merge';

const adv = (p: ReturnType<typeof newProfile>) => ((p as unknown as { adventure: Record<string, unknown> }).adventure ??= { shells: 0, incubator: [null, null, null], nest: [], glimmers: {} }) as {
  shells: number; incubator: ({ id: string } | null)[]; nest: { id: string }[]; glimmers: Record<string, unknown>;
};

describe('the earnings ledger', () => {
  it('writes down a lesson: its stars and name, the shells, medals and stickers', () => {
    const p = newProfile('Ava', 'dino');
    adv(p); bookOf(p);
    const was = ledgerSnap(p);
    p.history.push({ at: 1000, lessonId: 'village-2', wpm: 12, acc: 0.95, stars: 2, ride: 1, ms: 60000 });
    adv(p).shells += 14;
    bookOf(p).medals.clean = 1;
    bookOf(p).stickers['hello'] = { at: 1000, by: 'dino' };
    const e = ledgerNote(p, was, ledgerWhere({ screen: 'results' }), 2000)!;
    expect(e).toMatchObject({ from: 'Typing lesson', ref: 'typing:village-2', stars: 2, shells: 14, medals: ['clean'], stickers: ['hello'] });
    expect(p.ledger).toHaveLength(1);
  });
  it('a reward opened on the results card joins the same line; the next game makes a new one', () => {
    const p = newProfile('Ava', 'dino');
    adv(p);
    let was = ledgerSnap(p);
    p.history.push({ at: 1000, lessonId: 'village-2', wpm: 12, acc: 0.95, stars: 1, ride: 1, ms: 60000 });
    ledgerNote(p, was, ledgerWhere({ screen: 'results' }), 2000);
    was = ledgerSnap(p);
    adv(p).nest.push({ id: 'egg-1' });
    adv(p).shells += 5;
    ledgerNote(p, was, ledgerWhere({ screen: 'results' }), 5000);
    expect(p.ledger).toHaveLength(1);
    expect(p.ledger![0]).toMatchObject({ stars: 1, shells: 5, eggs: 1 });
    was = ledgerSnap(p);
    p.history.push({ at: 9000, lessonId: 'village-2', wpm: 13, acc: 0.95, stars: 2, ride: 1, ms: 60000 });
    ledgerNote(p, was, ledgerWhere({ screen: 'results' }), 9500);
    expect(p.ledger).toHaveLength(2);
  });
  it('shells spent, battles and Glimmers; nothing new writes nothing', () => {
    const p = newProfile('Ava', 'dino');
    adv(p).shells = 100;
    let was = ledgerSnap(p);
    adv(p).shells -= 60;
    expect(ledgerNote(p, was, ledgerWhere({ screen: 'shop' }))).toMatchObject({ from: 'Shop', shells: -60 });
    was = ledgerSnap(p);
    adv(p).glimmers.puddlepup = { level: 1 };
    expect(ledgerNote(p, was, ledgerWhere({ screen: 'battle', battleNode: 'meadow-0' }))).toMatchObject({ from: 'Adventure battle', ref: 'battle:meadow-0', glimmers: ['puddlepup'] });
    was = ledgerSnap(p);
    expect(ledgerNote(p, was, ledgerWhere({ screen: 'hub' }))).toBeNull();
  });
  it('the first sticker book (built from an old save) is not counted as earning', () => {
    const p = newProfile('Old', 'dino');
    buddyPal(p).medals = { clean: 4 };
    const was = ledgerSnap(p);
    bookOf(p);
    expect(ledgerNote(p, was, ledgerWhere({ screen: 'stickers' }))).toBeNull();
  });
  it('keeps the last 200, loads old saves, and joins two computers\' lists', () => {
    const p = newProfile('Ava', 'dino');
    adv(p);
    for (let i = 0; i < LEDGER_CAP + 30; i++) { const was = ledgerSnap(p); adv(p).shells += 1; ledgerNote(p, was, { from: i % 2 ? 'A' : 'B' }, i * 1_000_000); }
    expect(p.ledger).toHaveLength(LEDGER_CAP);
    const old = migrate({ profiles: [{ id: 'x', name: 'Old' }], activeId: 'x' }).profiles[0];
    expect(old.ledger).toBeUndefined();
    const bad = migrate({ profiles: [{ id: 'x', name: 'Old', ledger: 'oops' }], activeId: 'x' }).profiles[0];
    expect(bad.ledger).toBeUndefined();
    const a = { ...newProfile('Ava', 'dino'), id: 'same', ledger: [{ at: 1, from: 'A', shells: 3 }] };
    const b = { ...newProfile('Ava', 'dino'), id: 'same', ledger: [{ at: 2, from: 'B', shells: 4 }] };
    expect(mergeProfile(a, b, null).ledger?.map(e => e.from)).toEqual(['A', 'B']);
  });
});
