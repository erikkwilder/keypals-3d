// No two word cards on a Learn page cover each other, at any size (docs/lesson-rules.md, rule 20b). Cards sit
// on points in the 3D world, so where they land depends on the screen, the numbers in them and what's moving.
// Rather than place each one by hand, every frame's boxes go through here and are pushed the shortest way
// apart. Fixed boxes (the narrator's card, the child's guess, the keys) never move; a heavy card (a number on
// an edge, the big count, the sum) gives way less than a light one (a thought, a word).
export type Card = { x: number; y: number; w: number; h: number;
  /** 0: never moves. 1: an ordinary card. Between: gives way less */
  give: number };

const GAP = 6, ROUNDS = 10;

/** How far to move each card so that none overlap, staying on the page. */
export function separate(cards: Card[], page: { w: number; h: number }): { dx: number; dy: number }[] {
  const at = cards.map(c => ({ ...c }));
  for (let round = 0; round < ROUNDS; round++) {
    let touching = false;
    for (let i = 0; i < at.length; i++) for (let j = i + 1; j < at.length; j++) {
      const a = at[i], b = at[j], total = a.give + b.give;
      if (!total) continue;
      const over = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) + GAP, down = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + GAP;
      if (over <= 0 || down <= 0) continue;
      touching = true;
      // the shortest way apart
      const sideways = over < down, by = sideways ? over : down;
      const sign = sideways ? Math.sign(a.x + a.w / 2 - (b.x + b.w / 2)) || 1 : Math.sign(a.y + a.h / 2 - (b.y + b.h / 2)) || 1;
      const ka = (by * a.give) / total * sign, kb = (by * b.give) / total * sign;
      if (sideways) { a.x += ka; b.x -= kb; } else { a.y += ka; b.y -= kb; }
    }
    for (const c of at) if (c.give) { c.x = Math.max(2, Math.min(page.w - c.w - 2, c.x)); c.y = Math.max(2, Math.min(page.h - c.h - 2, c.y)); }
    if (!touching) break;
  }
  return at.map((c, i) => ({ dx: c.x - cards[i].x, dy: c.y - cards[i].y }));
}
