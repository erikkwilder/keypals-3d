// Learn episodes: the things on the table never pass through each other in the pictures themselves (the
// 3D check that also covers the buddy, the Glimmer and the corner props is src/dev/epOverlap.ts, run in the
// browser). A plate is a little wider than its radius (its rim, 2%), a pie dish a little more (its rim and
// crust), a bar's foil its width and height; pictures that are shown one after another are checked one at
// a time.
import { describe, expect, it } from 'vitest';
import { epLesson } from './episodes';
import { episodeIds } from './episodeIds';
import type { Board } from './learn';

type Round = { name: string; x: number; y: number; r: number } | { name: string; x: number; y: number; w: number; h: number };
function things(b: Board): Round[] {
  return [
    ...b.plates.map(p => ({ name: `plate ${p.id}`, x: p.x, y: p.y, r: p.r * 1.02 })),
    ...(b.dishes ?? []).map(d => (d.kind === 'foil' ? { name: `bar ${d.id}`, x: d.x, y: d.y, w: d.w ?? 0, h: d.h ?? 0 } : { name: `dish ${d.id}`, x: d.x, y: d.y, r: d.r * 1.07 })),
  ];
}
/** how far two things go into each other (board units; 0: apart) */
function into(a: Round, b: Round): number {
  const ra = 'r' in a ? a.r : null, rb = 'r' in b ? b.r : null;
  if (ra !== null && rb !== null) return Math.max(0, ra + rb - Math.hypot(a.x - b.x, a.y - b.y));
  const box = (t: Round) => ('r' in t ? { x0: t.x - t.r, x1: t.x + t.r, y0: t.y - t.r, y1: t.y + t.r } : { x0: t.x - t.w / 2, x1: t.x + t.w / 2, y0: t.y - t.h / 2, y1: t.y + t.h / 2 });
  const p = box(a), q = box(b);
  return Math.max(0, Math.min(p.x1 - q.x0, q.x1 - p.x0, p.y1 - q.y0, q.y1 - p.y0));
}

describe('Learn pictures', () => {
  it('never have plates, pies or bars passing through each other', () => {
    const bad: string[] = [];
    for (const id of episodeIds()) {
      const l = epLesson(id)!;
      const pics: [string, Board][] = [...l.steps.map((s, k) => [`step ${k + 1}`, s.board] as [string, Board]), ['buddy\'s go', l.teach.q.pic], ...l.tries.map((q, k) => [`try ${k + 1}`, q.pic] as [string, Board])];
      for (const [name, b] of pics) {
        if (!b) continue;
        const t = things(b);
        for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
          // (a balance's pans are its own two plates, never in each other)
          const d = into(t[i], t[j]);
          if (d > 2) bad.push(`${id} ${name}: the ${t[i].name} and the ${t[j].name} by ${d.toFixed(0)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });
});
