// Back pieces are sized by the buddy's body now (three/gear3d.ts backScale): a size a child saved before
// that keeps its look, a new size is on today's scale, and the Wardrobe can make things big.
import { describe, expect, it } from 'vitest';
import { newProfile } from '../engine/profile';
import { advOf } from './state';
import { NO_NUDGE, SIZE_MAX, SIZE_MIN, lookView, nudgeNow, setNudge } from './gear';
import { WEARABLES } from './wearables';

describe('sizes of worn things', () => {
  it('turns a size saved on the old scale into the same look, and leaves a new or unsized one alone', () => {
    // a backpack that was 0.4 times as big on the old scale, made 2.5 times bigger: the same size now
    expect(nudgeNow({ ...NO_NUDGE, s: 2.5 }, 0.4).s).toBeCloseTo(1);
    // never sized (s 1): today's size, not the old small one
    expect(nudgeNow({ ...NO_NUDGE, x: 0.05 }, 0.4)).toMatchObject({ s: 1, x: 0.05, v: 2 });
    // already on today's scale: as it is
    expect(nudgeNow({ ...NO_NUDGE, s: 1.8, v: 2 }, 0.4).s).toBe(1.8);
    // kept inside what Move it can do
    expect(nudgeNow({ ...NO_NUDGE, s: 0.5 }, 0.3).s).toBe(SIZE_MIN);
    expect(nudgeNow({ ...NO_NUDGE, s: 2.5 }, 5).s).toBe(SIZE_MAX);
  });
  it('keeps the scale a size was saved on', () => {
    const p = newProfile('Ava', 'dino'), a = advOf(p);
    setNudge(a, 'dino', 'teddy_pack', { ...NO_NUDGE, s: 2, v: 2 });
    setNudge(a, 'dino', 'toaster_pack', { ...NO_NUDGE, s: 2 });
    const n = lookView(a, 'dino').nudge;
    expect(n.teddy_pack).toMatchObject({ s: 2, v: 2 });
    expect(n.toaster_pack.v).toBeUndefined();
  });
  it('lets Move it make a thing three times its size', () => {
    expect(SIZE_MAX).toBeGreaterThanOrEqual(3);
  });
  it('gives every back piece its old size, for turning old saved sizes', () => {
    for (const w of WEARABLES.filter(x => x.slot === 'back')) expect(w.oldSize, w.id).toBeGreaterThan(0);
  });
});
