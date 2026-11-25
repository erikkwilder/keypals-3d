import { describe, expect, it } from 'vitest';
import { separate, settleCards, type Card } from './cardLayout';

const clash = (a: Card, b: Card) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;
const moved = (cs: Card[], page: { w: number; h: number }) => separate(cs, page).map((o, i) => ({ ...cs[i], x: cs[i].x + o.dx, y: cs[i].y + o.dy }));

describe('word cards', () => {
  const page = { w: 1280, h: 720 };
  it('a thought under the narrator moves and the narrator stays', () => {
    const dock = { x: 240, y: 60, w: 800, h: 90, give: 0 }, thought = { x: 700, y: 120, w: 150, h: 50, give: 1 };
    const [a, b] = moved([dock, thought], page);
    expect(a.x).toBe(240); expect(a.y).toBe(60);
    expect(clash(a, b)).toBe(false);
  });
  it('a heavy count gives way less than a light word', () => {
    const count = { x: 600, y: 300, w: 100, h: 60, give: 0.2 }, word = { x: 640, y: 320, w: 110, h: 30, give: 1 };
    const o = separate([count, word], page);
    expect(Math.hypot(o[0].dx, o[0].dy)).toBeLessThan(Math.hypot(o[1].dx, o[1].dy));
  });
  it('cards never end up on each other, on a laptop or a phone, however they start', () => {
    let seed = 7;
    const r = (n: number) => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * n; };
    for (const p of [page, { w: 390, h: 844 }]) for (let run = 0; run < 200; run++) {
      const cs: Card[] = [{ x: 0, y: 60, w: p.w, h: 90, give: 0 }];
      for (let i = 0; i < 6; i++) cs.push({ x: p.w * 0.2 + r(p.w * 0.5), y: 200 + r(250), w: 40 + r(90), h: 30 + r(24), give: i % 2 ? 1 : 0.3 });
      const out = moved(cs, p);
      for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(clash(out[i], out[j]), `run ${run}: ${i} and ${j}`).toBe(false);
    }
  });
});

// Erik, 2026-11-25: "some of the word bubbles that are up towards the top get kind of jittery... a word bubble...
// that almost gets close to the word bubble of the narration, those... start to jitter."
describe('word cards settle and never shake', () => {
  const page = { w: 1280, h: 720 };
  const dock = { x: 240, y: 2, w: 800, h: 80, give: 0 };
  it("a card that can't go up past the top of the page goes down, under the narrator", () => {
    // (its middle is above the narrator's, so the shortest way apart is up, into the page's edge)
    const word = { x: 600, y: 4, w: 140, h: 40, give: 1 };
    const [d, wd] = moved([dock, word], page);
    expect(d.y).toBe(2);
    expect(clash(d, wd)).toBe(false);
    expect(wd.y).toBeGreaterThanOrEqual(dock.y + dock.h);
  });
  it('a card by the narrator settles where it goes and stays still while the picture moves under it', () => {
    // its own place drifts a little every frame (the 3D thing it stands on moves with the camera)
    let nx: number | undefined, ny: number | undefined;
    const at: { x: number; y: number }[] = [];
    for (let f = 0; f < 240; f++) {
      // (its middle wanders across the narrator's middle: from there the shortest way apart is up one frame and down the next)
      const home = { x: 600 + Math.sin(f / 7) * 0.6, y: 22 + Math.sin(f / 5) * 0.8, w: 140, h: 40, give: 1 };
      const [n] = settleCards([dock], [{ ...home, nx, ny }], page);
      nx = n.nx; ny = n.ny;
      at.push({ x: home.x + nx, y: home.y + ny });
      if (f > 30) expect(clash(dock, { ...home, x: home.x + nx, y: home.y + ny }), `frame ${f}`).toBe(false);
    }
    // after it has settled it never jumps: no more than its thing moves, frame to frame
    const steps = at.slice(40).map((p, i, a) => (i ? Math.hypot(p.x - a[i - 1].x, p.y - a[i - 1].y) : 0));
    expect(Math.max(...steps)).toBeLessThan(1.5);
  });
  it('a card pushed away goes back to its own place once there is room', () => {
    let nx: number | undefined, ny: number | undefined;
    const word = { x: 600, y: 100, w: 140, h: 40, give: 1 };
    const other = { x: 610, y: 110, w: 120, h: 40, give: 0 };
    for (let f = 0; f < 20; f++) { const [n] = settleCards([other], [{ ...word, nx, ny }], page); nx = n.nx; ny = n.ny; }
    expect(Math.hypot(nx!, ny!)).toBeGreaterThan(20);
    for (let f = 0; f < 120; f++) { const [n] = settleCards([], [{ ...word, nx, ny }], page); nx = n.nx; ny = n.ny; }
    expect(Math.hypot(nx!, ny!)).toBeLessThan(1);
  });
  it('a new card starts in the clear at once', () => {
    const [n] = settleCards([dock], [{ x: 600, y: 40, w: 140, h: 40, give: 1 }], page);
    expect(clash(dock, { x: 600 + n.nx, y: 40 + n.ny, w: 140, h: 40, give: 1 })).toBe(false);
  });
});

describe('word cards by the narrator, as the picture moves under them (600 crowds on a laptop and a phone)', () => {
  // Each crowd: the narrator's card along the top, 2 to 5 cards on and below it, their own places drifting a little
  // every frame as the 3D things they stand on move. Pushed apart from their own places every frame (the old way),
  // 22 of these crowds shook (142 jumps back and forth of over 1.5 px), and cards sat on each other in 49082 frames.
  let seed = 11;
  const r = (n: number) => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * n; };
  it('no card shakes back and forth, and cards stay off each other', () => {
    let shakes = 0, on = 0, cardFrames = 0;
    for (const page of [{ w: 1280, h: 720 }, { w: 390, h: 844 }]) for (let k = 0; k < 300; k++) {
      const dock: Card = { x: page.w * 0.15, y: 2, w: page.w * 0.7, h: 70 + r(40), give: 0 };
      const n = 2 + Math.floor(r(4));
      const base = Array.from({ length: n }, (_, i) => ({ x: dock.x + r(dock.w - 120), y: r(dock.h + 40), w: 60 + r(110), h: 28 + r(20), give: i % 2 ? 1 : 0.3, ax: r(6.28), ay: r(6.28), s: 0.3 + r(1.5) }));
      const homes = (f: number): Card[] => base.map(b => ({ x: b.x + Math.sin(f / 9 + b.ax) * b.s, y: b.y + Math.sin(f / 7 + b.ay) * b.s, w: b.w, h: b.h, give: b.give }));
      const nx: (number | undefined)[] = Array(n).fill(undefined), ny: (number | undefined)[] = Array(n).fill(undefined);
      const at: Card[][] = [];
      for (let f = 0; f < 300; f++) {
        const hs = homes(f);
        settleCards([dock], hs.map((h, i) => ({ ...h, nx: nx[i], ny: ny[i] })), page).forEach((o, i) => { nx[i] = o.nx; ny[i] = o.ny; });
        at.push(hs.map((h, i) => ({ ...h, x: h.x + nx[i]!, y: h.y + ny[i]! })));
      }
      for (let f = 62; f < 300; f++) for (let i = 0; i < n; i++) {
        const a = { x: at[f - 1][i].x - at[f - 2][i].x, y: at[f - 1][i].y - at[f - 2][i].y }, b = { x: at[f][i].x - at[f - 1][i].x, y: at[f][i].y - at[f - 1][i].y };
        if (Math.hypot(a.x, a.y) > 1.5 && Math.hypot(b.x, b.y) > 1.5 && a.x * b.x + a.y * b.y < 0) shakes++;
        cardFrames++;
        if (clash(at[f][i], dock)) on++;
        for (let j = i + 1; j < n; j++) if (clash(at[f][i], at[f][j])) on++;
      }
    }
    expect(shakes).toBe(0);
    // (a crowd too big for its room can still touch for a moment: under one card-frame in a thousand)
    expect(on / cardFrames).toBeLessThan(0.001);
  });
});
